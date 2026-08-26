import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  EFFECTIVE_CONFIG_ENV,
  PREBUILT_BINDING_ENV,
  assertNonProductionVercelConfigSafe,
  findProductionBackendReferences,
  runVercelPreviewRewriteGuard,
} from './guardVercelPreviewRewrites.mjs';

const temporaryDirectories = [];

const safePreviewConfig = () => ({
  rewrites: [
    { source: '/ask/(.*)', destination: 'https://api-preview.chatboc.ar/ask/$1' },
    { source: '/archivos/(.*)', destination: 'https://api-preview.chatboc.ar/archivos/$1' },
    { source: '/public/(.*)', destination: 'https://api-preview.chatboc.ar/public/$1' },
    { source: '/api/(.*)', destination: 'https://api-preview.chatboc.ar/api/$1' },
    { source: '/admin/login', destination: 'https://api-preview.chatboc.ar/admin/login' },
    {
      source: '/admin/analytics/export.csv',
      destination: 'https://api-preview.chatboc.ar/admin/analytics/export.csv',
    },
    {
      source: '/admin/(.*)',
      has: [{ type: 'header', key: 'accept', value: '.*text/html.*' }],
      destination: '/index.html',
    },
    { source: '/admin/(.*)', destination: 'https://api-preview.chatboc.ar/admin/$1' },
    { source: '/socket.io/(.*)', destination: 'https://api-preview.chatboc.ar/socket.io/$1' },
    { source: '/iframe', destination: '/iframe.html' },
    { source: '/iframe/(.*)', destination: '/iframe.html' },
    { source: '/privacidad', destination: '/privacidad/index.html' },
    { source: '/terminos', destination: '/terminos/index.html' },
    { source: '/eliminacion-datos', destination: '/eliminacion-datos/index.html' },
    {
      source: '/',
      has: [{ type: 'host', value: 'faro-tdf.vercel.app' }],
      destination: '/demo/institucional/tdf-discapacidad/index.html',
    },
    {
      source: '/demo/institucional/tdf-discapacidad',
      destination: '/demo/institucional/tdf-discapacidad/index.html',
    },
    {
      source: '/((?!assets/|api/|ask/|archivos/|public/|socket.io/).*)',
      destination: '/index.html',
    },
  ],
});

const createProject = (files) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'chatboc-vercel-guard-'));
  temporaryDirectories.push(projectRoot);

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(projectRoot, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents, 'utf8');
  }

  return projectRoot;
};

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop(), { force: true, recursive: true });
  }
});

describe('Vercel Preview rewrite guard', () => {
  it('finds Production backend host variants and ignores lookalike domains', () => {
    const matches = findProductionBackendReferences({
      rewrites: [
        { destination: 'https://api.chatboc.ar/api/$1' },
        { destination: 'http://api.chatboc.ar/api/$1' },
        { destination: 'wss://API.CHATBOC.AR./socket.io/$1' },
        { destination: '//api.chatboc.ar/admin/$1' },
        { destination: 'api.chatboc.ar/public/$1' },
        { destination: 'https://api-preview.chatboc.ar/api/$1' },
        { destination: 'https://api.chatboc.ar.evil.example/api/$1' },
      ],
    });

    expect(matches.map(({ path }) => path)).toEqual([
      '$.rewrites[0].destination',
      '$.rewrites[1].destination',
      '$.rewrites[2].destination',
      '$.rewrites[3].destination',
      '$.rewrites[4].destination',
    ]);
  });

  it.each(['preview', 'development'])(
    'blocks canonical Production rewrites in Vercel %s',
    (vercelEnvironment) => {
      expect(() =>
        assertNonProductionVercelConfigSafe({
          config: {
            rewrites: [{ destination: 'https://api.chatboc.ar/api/$1' }],
          },
          configPath: 'vercel.json',
          vercelEnvironment,
        }),
      ).toThrow(/Refusing Vercel .* build.*Production backend/s);
    },
  );

  it.each([undefined, '', 'production'])(
    'does not block local or Production builds for environment %s',
    (vercelEnvironment) => {
      expect(
        assertNonProductionVercelConfigSafe({
          config: {
            rewrites: [{ destination: 'https://api.chatboc.ar/api/$1' }],
          },
          configPath: 'vercel.json',
          vercelEnvironment,
        }).checked,
      ).toBe(false);
    },
  );

  it('uses the generated effective Preview config instead of canonical vercel.json', () => {
    const projectRoot = createProject({
      'vercel.json': JSON.stringify({
        rewrites: [{ destination: 'https://api.chatboc.ar/api/$1' }],
      }),
      '.vercel/qa/vercel.preview.json': JSON.stringify(safePreviewConfig()),
    });
    const output = [];

    const evidence = runVercelPreviewRewriteGuard({
      environment: {
        [EFFECTIVE_CONFIG_ENV]: '.vercel/qa/vercel.preview.json',
        [PREBUILT_BINDING_ENV]: '1',
        VERCEL_ENV: 'preview',
      },
      projectRoot,
      writeLine: (line) => output.push(line),
    });

    expect(evidence).toMatchObject({
      checked: true,
      config: '.vercel/qa/vercel.preview.json',
      production_backend_references: 0,
      preview_backend_rewrites: 8,
      vercel_environment: 'preview',
    });
    expect(JSON.parse(output[0])).toEqual(evidence);
  });

  it('fails closed when a guarded build cannot read or parse its effective config', () => {
    const projectRoot = createProject({
      '.vercel/qa/vercel.preview.json': '{invalid',
    });

    expect(() =>
      runVercelPreviewRewriteGuard({
        environment: { VERCEL_ENV: 'preview' },
        projectRoot,
        writeLine: () => undefined,
      }),
    ).toThrow(/cannot read effective config vercel\.json/);

    expect(() =>
      runVercelPreviewRewriteGuard({
        environment: {
          [EFFECTIVE_CONFIG_ENV]: '.vercel/qa/vercel.preview.json',
          [PREBUILT_BINDING_ENV]: '1',
          VERCEL_ENV: 'development',
        },
        projectRoot,
        writeLine: () => undefined,
      }),
    ).toThrow(/is not valid JSON/);
  });

  it('rejects an effective config path outside the project', () => {
    const projectRoot = createProject({ 'vercel.json': '{}' });

    expect(() =>
      runVercelPreviewRewriteGuard({
        environment: {
          [EFFECTIVE_CONFIG_ENV]: '../outside.json',
          [PREBUILT_BINDING_ENV]: '1',
          VERCEL_ENV: 'preview',
        },
        projectRoot,
        writeLine: () => undefined,
      }),
    ).toThrow(/must stay inside the project/);
  });

  it('rejects an arbitrary safe-looking override that Vercel is not bound to consume', () => {
    const projectRoot = createProject({
      'vercel.json': '{}',
      'safe.json': JSON.stringify(safePreviewConfig()),
    });

    expect(() =>
      runVercelPreviewRewriteGuard({
        environment: {
          [EFFECTIVE_CONFIG_ENV]: 'safe.json',
          [PREBUILT_BINDING_ENV]: '1',
          VERCEL_ENV: 'preview',
        },
        projectRoot,
        writeLine: () => undefined,
      }),
    ).toThrow(/may only select \.vercel\/qa\/vercel\.preview\.json/);
  });

  it('rejects the approved override path when its eight Preview rewrites are incomplete', () => {
    const projectRoot = createProject({
      'vercel.json': '{}',
      '.vercel/qa/vercel.preview.json': JSON.stringify({
        rewrites: [{ source: '/api/(.*)', destination: 'https://api-preview.chatboc.ar/api/$1' }],
      }),
    });

    expect(() =>
      runVercelPreviewRewriteGuard({
        environment: {
          [EFFECTIVE_CONFIG_ENV]: '.vercel/qa/vercel.preview.json',
          [PREBUILT_BINDING_ENV]: '1',
          VERCEL_ENV: 'preview',
        },
        projectRoot,
        writeLine: () => undefined,
      }),
    ).toThrow(/differ from the exact audited route contract/);
  });

  it('rejects broken Preview destination paths even when all eight sources use the safe host', () => {
    const config = safePreviewConfig();
    config.rewrites = config.rewrites.map((rule) =>
      typeof rule.destination === 'string' && rule.destination.startsWith('https://api-preview.chatboc.ar/')
        ? { ...rule, destination: 'https://api-preview.chatboc.ar/BROKEN' }
        : rule,
    );
    const projectRoot = createProject({
      'vercel.json': '{}',
      '.vercel/qa/vercel.preview.json': JSON.stringify(config),
    });

    expect(() =>
      runVercelPreviewRewriteGuard({
        environment: {
          [EFFECTIVE_CONFIG_ENV]: '.vercel/qa/vercel.preview.json',
          [PREBUILT_BINDING_ENV]: '1',
          VERCEL_ENV: 'preview',
        },
        projectRoot,
        writeLine: () => undefined,
      }),
    ).toThrow(/differ from the exact audited route contract/);
  });

  it('rejects an external rewrite inserted before an audited Preview route', () => {
    const config = safePreviewConfig();
    config.rewrites.unshift({ source: '/api/(.*)', destination: 'https://wrong.example/$1' });
    const projectRoot = createProject({
      'vercel.json': '{}',
      '.vercel/qa/vercel.preview.json': JSON.stringify(config),
    });

    expect(() =>
      runVercelPreviewRewriteGuard({
        environment: {
          [EFFECTIVE_CONFIG_ENV]: '.vercel/qa/vercel.preview.json',
          [PREBUILT_BINDING_ENV]: '1',
          VERCEL_ENV: 'preview',
        },
        projectRoot,
        writeLine: () => undefined,
      }),
    ).toThrow(/differ from the exact audited route contract/);
  });

  it('rejects the approved override when it is not bound to the QA --local-config flow', () => {
    const projectRoot = createProject({
      'vercel.json': '{}',
      '.vercel/qa/vercel.preview.json': JSON.stringify(safePreviewConfig()),
    });

    expect(() =>
      runVercelPreviewRewriteGuard({
        environment: {
          [EFFECTIVE_CONFIG_ENV]: '.vercel/qa/vercel.preview.json',
          VERCEL_ENV: 'preview',
        },
        projectRoot,
        writeLine: () => undefined,
      }),
    ).toThrow(/only valid in the bound QA prebuilt flow/);
  });
});
