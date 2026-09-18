import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

import { PRODUCTION_ORIGIN, runProductionBuildVerification, verifyVercelProductionBuild } from './verifyVercelProductionBuild.mjs';

const SHA = '2dc95df8984458c88ea7140157747ba349ae84c6';
const directories = [];
const pairs = [
  ['/ask/(.*)', '^/ask(?:/(.*))$', '/ask/$1'],
  ['/archivos/(.*)', '^/archivos(?:/(.*))$', '/archivos/$1'],
  ['/public/(.*)', '^/public(?:/(.*))$', '/public/$1'],
  ['/api/(.*)', '^/api(?:/(.*))$', '/api/$1'],
  ['/admin/login', '^/admin/login$', '/admin/login'],
  ['/admin/analytics/export.csv', '^/admin/analytics/export\\.csv$', '/admin/analytics/export.csv'],
  ['/admin/(.*)', '^/admin(?:/(.*))$', '/admin/$1'],
  ['/socket.io/(.*)', '^/socket\\.io(?:/(.*))$', '/socket.io/$1'],
];

const write = (root, path, contents) => {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, typeof contents === 'string' ? contents : JSON.stringify(contents));
};
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'chatboc-production-build-'));
  directories.push(root);
  write(root, 'vercel.json', { rewrites: pairs.map(([source, , path]) => ({ source, destination: `${PRODUCTION_ORIGIN}${path}` })) });
  write(root, 'artifact/config.json', { routes: pairs.map(([, src, path]) => ({ src, dest: `${PRODUCTION_ORIGIN}${path}` })) });
  write(root, 'artifact/builds.json', { target: 'production' });
  write(root, 'artifact/static/index.html', `<meta content='${SHA}' name='chatboc-build-revision'>`);
  write(root, 'artifact/static/assets/main.js', `const origin = '${PRODUCTION_ORIGIN}'; const clerkPreviewAllowlist = 'chatboc-r2-preview.vercel.app';`);
  return { projectRoot: root, outputRoot: 'artifact', gitSha: SHA };
};
const mutateJson = (options, file, mutate) => {
  const value = JSON.parse(readFileSync(join(options.projectRoot, file), 'utf8'));
  mutate(value);
  write(options.projectRoot, file, value);
};
afterEach(() => {
  for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('Production prebuilt verification', () => {
  it('checks an exact production artifact without changing its files', () => {
    const options = fixture();
    const before = readFileSync(join(options.projectRoot, 'artifact/static/assets/main.js'));
    expect(verifyVercelProductionBuild(options)).toMatchObject({ ready: true, target: 'production', frontend_revision: SHA, compiled_backend_routes: 8, runtime_network_verification_required: true });
    expect(readFileSync(join(options.projectRoot, 'artifact/static/assets/main.js'))).toEqual(before);
  });

  it.each(['short', '', 'z'.repeat(40)])('rejects malformed full revisions', (gitSha) => {
    expect(() => verifyVercelProductionBuild({ ...fixture(), gitSha })).toThrow(/git_sha/);
  });

  it.each(['vercel.json', 'artifact/config.json'])('rejects Preview routing in %s', (file) => {
    const options = fixture();
    mutateJson(options, file, (value) => {
      const rules = value.routes ?? value.rewrites;
      const key = value.routes ? 'dest' : 'destination';
      rules[0][key] = 'https://api-preview.chatboc.ar/ask/$1';
    });
    expect(() => verifyVercelProductionBuild(options)).toThrow(/preview_destination/);
  });

  it.each(['duplicate', 'missing', 'unexpected', 'wrong-source', 'wrong-path', 'conditional'])('rejects %s compiled routes', (problem) => {
    const options = fixture();
    mutateJson(options, 'artifact/config.json', ({ routes }) => {
      if (problem === 'duplicate') routes.push(routes[0]);
      if (problem === 'missing') routes.pop();
      if (problem === 'unexpected') routes[0].dest = 'https://unexpected.example/ask/$1';
      if (problem === 'wrong-source') routes[0].src = '^/different$';
      if (problem === 'wrong-path') routes[0].dest = `${PRODUCTION_ORIGIN}/api/$1`;
      if (problem === 'conditional') routes[0].has = [{ type: 'header', key: 'x-qa' }];
    });
    expect(() => verifyVercelProductionBuild(options)).toThrow(/backend_destinations|backend_route/);
  });

  it('rejects Preview build metadata even with Production routing', () => {
    const options = fixture();
    write(options.projectRoot, 'artifact/builds.json', { target: 'preview' });
    expect(() => verifyVercelProductionBuild(options)).toThrow(/production_target/);
  });

  it.each(['missing', 'wrong', 'duplicate'])('rejects %s revision metadata, not fooled by SHA elsewhere', (problem) => {
    const options = fixture();
    const meta = `<meta name="chatboc-build-revision" content="${problem === 'wrong' ? '0'.repeat(40) : SHA}">`;
    write(options.projectRoot, 'artifact/static/index.html', `${problem === 'missing' ? '' : meta}${problem === 'duplicate' ? meta : ''}<p>${SHA}</p>`);
    expect(() => verifyVercelProductionBuild(options)).toThrow(/chatboc-build-revision/);
  });

  it.each(['[SENSITIVE]', 'https://api-preview.chatboc.ar'])('rejects unsafe content in nested lazy chunks without printing it', (value) => {
    const options = fixture();
    write(options.projectRoot, 'artifact/static/assets/lazy/export.js', `const unsafe = '${value}'; const privateValue = 'do-not-echo-me';`);
    let message;
    try { verifyVercelProductionBuild(options); } catch (error) { message = error.message; }
    expect(message).toMatch(/static\/assets\/lazy\/export.js/);
    expect(message).not.toContain(value);
    expect(message).not.toContain('do-not-echo-me');
  });

  it('requires an exact origin literal, not only longer URL prefixes', () => {
    const options = fixture();
    write(options.projectRoot, 'artifact/static/assets/main.js', `const url = '${PRODUCTION_ORIGIN}/not-the-origin';`);
    expect(() => verifyVercelProductionBuild(options)).toThrow(/VITE_API_URL_origin_literal/);
  });

  it.each(['apiOrigin', 'socketOrigin'])('rejects noncanonical intended %s without echoing it', (key) => {
    expect(() => verifyVercelProductionBuild({ ...fixture(), [key]: 'https://do-not-echo.example' })).toThrow(/VITE_(API|SOCKET)_URL/);
  });

  it('redacts malformed JSON diagnostics', () => {
    const options = fixture();
    write(options.projectRoot, 'artifact/config.json', 'private-value-invalid-json');
    expect(() => verifyVercelProductionBuild(options)).toThrow('output/config.json [valid_json_required]');
  });

  it('supports configurable CLI roots and rejects duplicate or unknown arguments', () => {
    const options = fixture();
    expect(runProductionBuildVerification(['--root', options.projectRoot, '--output-root', 'artifact', '--git-sha', SHA]).ready).toBe(true);
    expect(() => runProductionBuildVerification(['--unknown-private-value', 'private-value'])).toThrow('input [arguments]');
    expect(() => runProductionBuildVerification(['--git-sha', SHA, '--git-sha', SHA])).toThrow('input [arguments]');
  });

  it('CLI exits nonzero without exposing bundle contents', () => {
    const options = fixture();
    write(options.projectRoot, 'artifact/static/assets/main.js', 'const value = "[SENSITIVE]"; const other = "private-value";');
    const result = spawnSync(process.execPath, ['scripts/verifyVercelProductionBuild.mjs', '--root', options.projectRoot, '--output-root', 'artifact', '--git-sha', SHA], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('masked_public_configuration');
    expect(result.stderr).not.toContain('[SENSITIVE]');
    expect(result.stderr).not.toContain('private-value');
  });
});
