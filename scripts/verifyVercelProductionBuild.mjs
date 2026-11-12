import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRODUCTION_ORIGIN = 'https://api.chatboc.ar';
const CONTRACT = 'chatboc.frontend.production-build-verification.v1';
const ROUTES = [
  ['/ask/(.*)', '^/ask(?:/(.*))$', '/ask/$1'],
  ['/archivos/(.*)', '^/archivos(?:/(.*))$', '/archivos/$1'],
  ['/public/(.*)', '^/public(?:/(.*))$', '/public/$1'],
  ['/api/(.*)', '^/api(?:/(.*))$', '/api/$1'],
  ['/admin/login', '^/admin/login$', '/admin/login'],
  ['/admin/analytics/export.csv', '^/admin/analytics/export\\.csv$', '/admin/analytics/export.csv'],
  ['/admin/(.*)', '^/admin(?:/(.*))$', '/admin/$1'],
  ['/socket.io/(.*)', '^/socket\\.io(?:/(.*))$', '/socket.io/$1'],
];

class VerificationError extends Error {}

const fail = (file, key) => {
  throw new VerificationError(`Production build verification failed: ${file} [${key}].`);
};

const readText = (path, label) => {
  try {
    if (!lstatSync(path).isFile()) fail(label, 'regular_file_required');
    return readFileSync(path, 'utf8');
  } catch {
    fail(label, 'readable_regular_file_required');
  }
};

const readJson = (path, label) => {
  const text = readText(path, label);
  try {
    return JSON.parse(text);
  } catch {
    fail(label, 'valid_json_required');
  }
};

const externalDestination = (value) =>
  typeof value === 'string' && /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);

const verifyRoutes = (config, label, compiled) => {
  const rules = config?.[compiled ? 'routes' : 'rewrites'];
  if (!Array.isArray(rules)) fail(label, compiled ? 'routes' : 'rewrites');
  // Inspect the complete routing object as well as the selected destination
  // list: a Preview reference must not hide in another routing property.
  if (/api-preview\.chatboc\.ar/i.test(JSON.stringify(config))) fail(label, 'preview_destination');
  const sourceKey = compiled ? 'src' : 'source';
  const destinationKey = compiled ? 'dest' : 'destination';
  const externalRules = rules.filter((rule) => externalDestination(rule?.[destinationKey]));
  if (externalRules.length !== ROUTES.length) fail(label, 'exactly_eight_backend_destinations');
  for (const [source, compiledSource, path] of ROUTES) {
    const matches = externalRules.filter((rule) =>
      rule[sourceKey] === (compiled ? compiledSource : source) &&
      rule[destinationKey] === `${PRODUCTION_ORIGIN}${path}` &&
      !rule.has && !rule.missing,
    );
    if (matches.length !== 1) fail(label, 'canonical_backend_route');
  }
};

const revisionFromHtml = (html) => {
  const revisions = [];
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...tag[0].matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g)]
        .map((match) => [match[1].toLowerCase(), match[3]]),
    );
    if (attributes.name === 'chatboc-build-revision') revisions.push(attributes.content);
  }
  return revisions;
};

const javascriptFiles = (directory, label = 'static') => {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    fail(label, 'readable_directory_required');
  }
  return entries.flatMap((entry) => {
    const entryLabel = `${label}/${entry.name}`;
    if (entry.isSymbolicLink()) fail(entryLabel, 'symlink_not_allowed');
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(entryPath, entryLabel);
    return entry.isFile() && entry.name.endsWith('.js') ? [{ path: entryPath, label: entryLabel }] : [];
  });
};

export const verifyVercelProductionBuild = ({
  projectRoot = process.cwd(),
  outputRoot = '.vercel/output',
  gitSha,
  apiOrigin = PRODUCTION_ORIGIN,
  socketOrigin = PRODUCTION_ORIGIN,
} = {}) => {
  if (typeof gitSha !== 'string' || !/^[a-f0-9]{40}$/.test(gitSha)) fail('input', 'git_sha');
  if (apiOrigin !== PRODUCTION_ORIGIN) fail('input', 'VITE_API_URL');
  if (socketOrigin !== PRODUCTION_ORIGIN) fail('input', 'VITE_SOCKET_URL');
  const root = resolve(projectRoot);
  const output = resolve(root, outputRoot);
  verifyRoutes(readJson(resolve(root, 'vercel.json'), 'vercel.json'), 'vercel.json', false);
  verifyRoutes(readJson(resolve(output, 'config.json'), 'output/config.json'), 'output/config.json', true);
  const metadata = readJson(resolve(output, 'builds.json'), 'output/builds.json');
  if (metadata?.target !== 'production') fail('output/builds.json', 'production_target');

  const html = readText(resolve(output, 'static/index.html'), 'static/index.html');
  const revisions = revisionFromHtml(html);
  if (revisions.length !== 1 || revisions[0] !== gitSha) fail('static/index.html', 'chatboc-build-revision');

  const files = javascriptFiles(resolve(output, 'static'));
  if (files.length === 0) fail('static', 'emitted_javascript_required');
  const observedOrigins = new Set();
  for (const file of files) {
    const code = readText(file.path, file.label);
    if (code.includes('[SENSITIVE]')) fail(file.label, 'masked_public_configuration');
    if (/api-preview\.chatboc\.ar/i.test(code)) fail(file.label, 'preview_api_origin');
    for (const origin of [apiOrigin, socketOrigin]) {
      if (code.includes(JSON.stringify(origin)) || code.includes(`'${origin}'`)) {
        observedOrigins.add(origin);
      }
    }
  }
  if (!observedOrigins.has(apiOrigin)) fail('static/*.js', 'VITE_API_URL_origin_literal');
  if (!observedOrigins.has(socketOrigin)) fail('static/*.js', 'VITE_SOCKET_URL_origin_literal');

  return {
    contract: CONTRACT,
    ready: true,
    target: 'production',
    frontend_revision: gitSha,
    canonical_backend_routes: ROUTES.length,
    compiled_backend_routes: ROUTES.length,
    preview_backend_references: 0,
    masked_configuration_files: 0,
    javascript_files_checked: files.length,
    // Minification removes environment-key names. This is static literal and
    // exclusion evidence, not proof of runtime URL selection or live canaries.
    public_origin_evidence: 'canonical_literals_present_no_preview_backend',
    runtime_network_verification_required: true,
  };
};

export const runProductionBuildVerification = (args = process.argv.slice(2)) => {
  const flags = new Map([
    ['--root', 'projectRoot'], ['--output-root', 'outputRoot'], ['--git-sha', 'gitSha'],
    ['--api-origin', 'apiOrigin'], ['--socket-origin', 'socketOrigin'],
  ]);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = flags.get(args[index]);
    if (!option || !args[index + 1] || Object.hasOwn(options, option)) fail('input', 'arguments');
    options[option] = args[index + 1];
  }
  return verifyVercelProductionBuild(options);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(runProductionBuildVerification())}\n`);
  } catch (error) {
    // Never echo bundle content, malformed JSON, URLs or supplied argument
    // values. Diagnostics deliberately contain only filenames and key names.
    process.stderr.write(`${error instanceof VerificationError ? error.message : 'Production build verification failed: unexpected read-only validation error.'}\n`);
    process.exitCode = 1;
  }
}
