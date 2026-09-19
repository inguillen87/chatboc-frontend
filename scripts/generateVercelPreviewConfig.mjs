import { resolvePreviewBackend } from './previewBackendTarget.mjs';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const canonicalConfigPath = resolve(projectRoot, 'vercel.json');
const previewConfigPath = resolve(projectRoot, '.vercel', 'qa', 'vercel.preview.json');

const PRODUCTION_BACKEND_ORIGIN = 'https://api.chatboc.ar';
const {origin: PREVIEW_BACKEND_ORIGIN, revision: expectedBackendRevision} = resolvePreviewBackend(process.env);
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

const canonicalRaw = readFileSync(canonicalConfigPath, 'utf8');
const canonicalConfig = JSON.parse(canonicalRaw);

if (!Array.isArray(canonicalConfig.rewrites)) {
  throw new Error('vercel.json must define a rewrites array.');
}

const transformedSources = [];
const previewConfig = {
  ...canonicalConfig,
  rewrites: canonicalConfig.rewrites.map((rule) => {
    if (
      !rule ||
      typeof rule !== 'object' ||
      typeof rule.destination !== 'string' ||
      !rule.destination.startsWith(`${PRODUCTION_BACKEND_ORIGIN}/`)
    ) {
      return rule;
    }

    if (typeof rule.source !== 'string') {
      throw new Error('A backend rewrite is missing its source.');
    }

    transformedSources.push(rule.source);
    return {
      ...rule,
      destination: `${PREVIEW_BACKEND_ORIGIN}${rule.destination.slice(PRODUCTION_BACKEND_ORIGIN.length)}`,
    };
  }),
};

const transformedSourceSet = new Set(transformedSources);
const missingSources = [...EXPECTED_BACKEND_REWRITE_SOURCES].filter(
  (source) => !transformedSourceSet.has(source),
);
const unexpectedSources = [...transformedSourceSet].filter(
  (source) => !EXPECTED_BACKEND_REWRITE_SOURCES.has(source),
);

if (
  transformedSources.length !== EXPECTED_BACKEND_REWRITE_SOURCES.size ||
  transformedSourceSet.size !== EXPECTED_BACKEND_REWRITE_SOURCES.size ||
  missingSources.length > 0 ||
  unexpectedSources.length > 0
) {
  throw new Error(
    `Refusing to generate Preview routing: expected ${EXPECTED_BACKEND_REWRITE_SOURCES.size} canonical backend rewrites, ` +
      `found ${transformedSources.length}; missing=${missingSources.join(',') || 'none'}; ` +
      `unexpected=${unexpectedSources.join(',') || 'none'}.`,
  );
}

const previewBackendDestinations = previewConfig.rewrites.filter(
  (rule) =>
    rule &&
    typeof rule === 'object' &&
    typeof rule.destination === 'string' &&
    rule.destination.startsWith(`${PREVIEW_BACKEND_ORIGIN}/`),
);

if (previewBackendDestinations.length !== EXPECTED_BACKEND_REWRITE_SOURCES.size) {
  throw new Error('Preview routing validation failed after transformation.');
}

const previewRaw = `${JSON.stringify(previewConfig, null, 2)}\n`;
mkdirSync(dirname(previewConfigPath), { recursive: true });
writeFileSync(previewConfigPath, previewRaw, 'utf8');

const canonicalAfter = readFileSync(canonicalConfigPath, 'utf8');
if (canonicalAfter !== canonicalRaw) {
  throw new Error('Canonical vercel.json changed while generating Preview routing.');
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

process.stdout.write(
  `${JSON.stringify({
    contract: 'chatboc.frontend.preview-routing.v1',
    output: relative(projectRoot, previewConfigPath).replaceAll('\\', '/'),
    preview_backend_origin: PREVIEW_BACKEND_ORIGIN,
    expected_backend_revision: expectedBackendRevision,
    rewrites_transformed: transformedSources.length,
    canonical_sha256: sha256(canonicalRaw),
    preview_sha256: sha256(previewRaw),
    canonical_unchanged: true,
  })}\n`,
);
