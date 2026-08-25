import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

export const PRODUCTION_BACKEND_ORIGIN = 'https://api.chatboc.ar';
export const PREVIEW_BACKEND_ORIGIN = 'https://api-preview.chatboc.ar';
export const EFFECTIVE_CONFIG_ENV = 'CHATBOC_VERCEL_EFFECTIVE_CONFIG';
export const PREBUILT_BINDING_ENV = 'CHATBOC_VERCEL_PREBUILT_LOCAL_CONFIG_BOUND';
export const GUARDED_VERCEL_ENVIRONMENTS = new Set(['preview', 'development']);

const DEFAULT_CONFIG_PATH = 'vercel.json';
const SAFE_PREVIEW_CONFIG_PATH = '.vercel/qa/vercel.preview.json';
const CONTRACT_VERSION = 'chatboc.vercel_preview_rewrite_guard.v1';
const EXPECTED_BACKEND_REWRITE_SOURCES = new Set([
  '/ask/(.*)',
  '/archivos/(.*)',
  '/public/(.*)',
  '/api/(.*)',
  '/admin/login',
  '/admin/analytics/export.csv',
  '/admin/(.*)',
  '/socket.io/(.*)',
]);
const EXPECTED_PREVIEW_REWRITES = [
  { source: '/ask/(.*)', destination: `${PREVIEW_BACKEND_ORIGIN}/ask/$1` },
  { source: '/archivos/(.*)', destination: `${PREVIEW_BACKEND_ORIGIN}/archivos/$1` },
  { source: '/public/(.*)', destination: `${PREVIEW_BACKEND_ORIGIN}/public/$1` },
  { source: '/api/(.*)', destination: `${PREVIEW_BACKEND_ORIGIN}/api/$1` },
  { source: '/admin/login', destination: `${PREVIEW_BACKEND_ORIGIN}/admin/login` },
  {
    source: '/admin/analytics/export.csv',
    destination: `${PREVIEW_BACKEND_ORIGIN}/admin/analytics/export.csv`,
  },
  {
    source: '/admin/(.*)',
    has: [{ type: 'header', key: 'accept', value: '.*text/html.*' }],
    destination: '/index.html',
  },
  { source: '/admin/(.*)', destination: `${PREVIEW_BACKEND_ORIGIN}/admin/$1` },
  { source: '/socket.io/(.*)', destination: `${PREVIEW_BACKEND_ORIGIN}/socket.io/$1` },
  { source: '/iframe', destination: '/iframe.html' },
  { source: '/iframe/(.*)', destination: '/iframe.html' },
  { source: '/privacidad', destination: '/privacidad/index.html' },
  { source: '/terminos', destination: '/terminos/index.html' },
  { source: '/eliminacion-datos', destination: '/eliminacion-datos/index.html' },
  {
    source: '/((?!assets/|api/|ask/|archivos/|public/|socket.io/).*)',
    destination: '/index.html',
  },
];

const normalizeEnvironment = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const isProductionBackendUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return false;

  try {
    const rawValue = value.trim();
    const parseableValue = rawValue.startsWith('//')
      ? `https:${rawValue}`
      : /^api\.chatboc\.ar(?::\d+)?(?:[/?#]|$)/i.test(rawValue)
        ? `https://${rawValue}`
        : rawValue;
    const hostname = new URL(parseableValue, 'https://guard.invalid').hostname
      .toLowerCase()
      .replace(/\.+$/, '');
    return hostname === 'api.chatboc.ar';
  } catch {
    return false;
  }
};

const assertPreviewRewriteContract = (config) => {
  if (!Array.isArray(config?.rewrites)) {
    throw new Error('[vercel-preview-rewrite-guard] Safe Preview config must define rewrites.');
  }
  if (!isDeepStrictEqual(config.rewrites, EXPECTED_PREVIEW_REWRITES)) {
    throw new Error(
      '[vercel-preview-rewrite-guard] Safe Preview config rewrites differ from the exact audited route contract.',
    );
  }

  const rewritesBySource = new Map();
  let previewBackendRewriteCount = 0;
  for (const rule of config.rewrites) {
    if (!rule || typeof rule !== 'object') {
      continue;
    }
    let destinationOrigin = null;
    try {
      destinationOrigin = new URL(rule.destination).origin.toLowerCase();
    } catch {
      // Internal Vercel rewrites are intentionally not part of this backend contract.
    }
    if (destinationOrigin !== PREVIEW_BACKEND_ORIGIN) {
      continue;
    }
    previewBackendRewriteCount += 1;
    if (!EXPECTED_BACKEND_REWRITE_SOURCES.has(rule.source)) {
      throw new Error(
        '[vercel-preview-rewrite-guard] Safe Preview config contains an unexpected Preview backend rewrite source.',
      );
    }
    const rules = rewritesBySource.get(rule.source) ?? [];
    rules.push(rule);
    rewritesBySource.set(rule.source, rules);
  }

  for (const source of EXPECTED_BACKEND_REWRITE_SOURCES) {
    const rules = rewritesBySource.get(source) ?? [];
    if (rules.length !== 1) {
      throw new Error(
        `[vercel-preview-rewrite-guard] Safe Preview config requires exactly one ${source} rewrite; found ${rules.length}.`,
      );
    }

  }

  if (previewBackendRewriteCount !== EXPECTED_BACKEND_REWRITE_SOURCES.size) {
    throw new Error(
      `[vercel-preview-rewrite-guard] Safe Preview config requires exactly ${EXPECTED_BACKEND_REWRITE_SOURCES.size} Preview backend rewrites; found ${previewBackendRewriteCount}.`,
    );
  }

  return EXPECTED_BACKEND_REWRITE_SOURCES.size;
};

const appendJsonPath = (base, key) =>
  typeof key === 'number'
    ? `${base}[${key}]`
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${base}.${key}`
      : `${base}[${JSON.stringify(key)}]`;

export const findProductionBackendReferences = (value, path = '$', visited = new WeakSet()) => {
  if (isProductionBackendUrl(value)) return [{ path, value }];
  if (!value || typeof value !== 'object') return [];
  if (visited.has(value)) return [];
  visited.add(value);

  const entries = Array.isArray(value)
    ? value.map((item, index) => [index, item])
    : Object.entries(value);

  return entries.flatMap(([key, nestedValue]) =>
    findProductionBackendReferences(nestedValue, appendJsonPath(path, key), visited),
  );
};

export const assertNonProductionVercelConfigSafe = ({
  config,
  configPath = DEFAULT_CONFIG_PATH,
  vercelEnvironment,
}) => {
  const normalizedEnvironment = normalizeEnvironment(vercelEnvironment);
  if (!GUARDED_VERCEL_ENVIRONMENTS.has(normalizedEnvironment)) {
    return {
      checked: false,
      configPath,
      productionBackendReferences: [],
      vercelEnvironment: normalizedEnvironment || null,
    };
  }

  const productionBackendReferences = findProductionBackendReferences(config);
  if (productionBackendReferences.length > 0) {
    const locations = productionBackendReferences.map((match) => match.path).join(', ');
    throw new Error(
      `[vercel-preview-rewrite-guard] Refusing Vercel ${normalizedEnvironment} build: ` +
        `${configPath} routes to the Production backend ${PRODUCTION_BACKEND_ORIGIN} at ${locations}. ` +
        `Generate the safe Preview config and set ${EFFECTIVE_CONFIG_ENV} to its path.`,
    );
  }

  return {
    checked: true,
    configPath,
    productionBackendReferences,
    vercelEnvironment: normalizedEnvironment,
  };
};

const resolveConfigPathInsideProject = (projectRoot, configuredPath) => {
  const absoluteProjectRoot = resolve(projectRoot);
  const absoluteConfigPath = resolve(absoluteProjectRoot, configuredPath || DEFAULT_CONFIG_PATH);
  const relativeConfigPath = relative(absoluteProjectRoot, absoluteConfigPath);
  const escapesProject =
    relativeConfigPath === '..' ||
    relativeConfigPath.startsWith(`..${sep}`) ||
    isAbsolute(relativeConfigPath);

  if (escapesProject) {
    throw new Error(
      `[vercel-preview-rewrite-guard] Effective config must stay inside the project: ${absoluteConfigPath}`,
    );
  }

  return { absoluteConfigPath, relativeConfigPath: relativeConfigPath.replaceAll('\\', '/') };
};

export const runVercelPreviewRewriteGuard = ({
  environment = process.env,
  projectRoot = process.cwd(),
  readTextFile = (path) => readFileSync(path, 'utf8'),
  writeLine = (line) => process.stdout.write(`${line}\n`),
} = {}) => {
  const vercelEnvironment = normalizeEnvironment(environment.VERCEL_ENV);
  if (!GUARDED_VERCEL_ENVIRONMENTS.has(vercelEnvironment)) {
    return {
      checked: false,
      contract: CONTRACT_VERSION,
      vercelEnvironment: vercelEnvironment || null,
    };
  }

  const configuredPathOverride = environment[EFFECTIVE_CONFIG_ENV]?.trim();
  const configuredPath = configuredPathOverride || DEFAULT_CONFIG_PATH;
  const { absoluteConfigPath, relativeConfigPath } = resolveConfigPathInsideProject(
    projectRoot,
    configuredPath,
  );
  if (
    configuredPathOverride &&
    relativeConfigPath.toLowerCase() !== SAFE_PREVIEW_CONFIG_PATH.toLowerCase()
  ) {
    throw new Error(
      `[vercel-preview-rewrite-guard] ${EFFECTIVE_CONFIG_ENV} may only select ${SAFE_PREVIEW_CONFIG_PATH}.`,
    );
  }
  if (configuredPathOverride && environment[PREBUILT_BINDING_ENV]?.trim() !== '1') {
    throw new Error(
      `[vercel-preview-rewrite-guard] ${EFFECTIVE_CONFIG_ENV} is only valid in the bound QA prebuilt flow.`,
    );
  }

  let rawConfig;
  try {
    rawConfig = readTextFile(absoluteConfigPath);
  } catch (error) {
    throw new Error(
      `[vercel-preview-rewrite-guard] Refusing Vercel ${vercelEnvironment} build: ` +
        `cannot read effective config ${relativeConfigPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let config;
  try {
    config = JSON.parse(rawConfig);
  } catch (error) {
    throw new Error(
      `[vercel-preview-rewrite-guard] Refusing Vercel ${vercelEnvironment} build: ` +
        `effective config ${relativeConfigPath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const result = assertNonProductionVercelConfigSafe({
    config,
    configPath: relativeConfigPath,
    vercelEnvironment,
  });
  const previewBackendRewrites = configuredPathOverride
    ? assertPreviewRewriteContract(config)
    : 0;
  const evidence = {
    checked: result.checked,
    config: relativeConfigPath,
    contract: CONTRACT_VERSION,
    production_backend_references: result.productionBackendReferences.length,
    preview_backend_rewrites: previewBackendRewrites,
    vercel_environment: vercelEnvironment,
  };
  writeLine(JSON.stringify(evidence));
  return evidence;
};

const isMainModule =
  typeof process.argv[1] === 'string' &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  try {
    runVercelPreviewRewriteGuard();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
