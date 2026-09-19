// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { getGitPreviewBuildDecision } from './vercelGitPreviewPolicy.mjs';

const sha = '74e58fb173b9e1b7089e5aa09f7e012c61a6504f';
const preview = { VERCEL_ENV: 'preview', VERCEL_GIT_PROVIDER: 'github', VERCEL_GIT_COMMIT_SHA: sha };
for (const provider of ['github', 'gitlab', 'bitbucket']) {
  test(`skips identified ${provider} Git preview`, () => {
    const result = getGitPreviewBuildDecision({ ...preview, VERCEL_GIT_PROVIDER: provider });
    assert.equal(result.exitCode, 0);
    assert.equal(result.action, 'skip_git_preview');
    assert.equal(result.reason, 'use_bound_qa_prebuilt_flow');
  });
}
for (const target of ['production', 'development', '', undefined, 'staging']) {
  test(`continues existing checks for target ${String(target)}`, () => {
    assert.equal(getGitPreviewBuildDecision({ ...preview, VERCEL_ENV: target }).exitCode, 1);
  });
}
test('normalizes casing and whitespace without changing the input', () => {
  const env = Object.freeze({ VERCEL_ENV: ' Preview ', VERCEL_GIT_PROVIDER: ' GITHUB ', VERCEL_GIT_COMMIT_SHA: sha.toUpperCase() });
  assert.equal(getGitPreviewBuildDecision(env).exitCode, 0);
  assert.equal(env.VERCEL_ENV, ' Preview ');
});
for (const commit of ['', undefined, '74e58fb', 'g'.repeat(40), 'a'.repeat(39), 'a'.repeat(41)]) {
  test(`does not skip with missing or invalid commit ${String(commit)}`, () => {
    assert.equal(getGitPreviewBuildDecision({ ...preview, VERCEL_GIT_COMMIT_SHA: commit }).exitCode, 1);
  });
}
test('recognizes full SHA-256 Git object identifiers', () => {
  assert.equal(getGitPreviewBuildDecision({ ...preview, VERCEL_GIT_COMMIT_SHA: 'a'.repeat(64) }).exitCode, 0);
});
for (const provider of ['', undefined, 'manual', 'unknown']) {
  test(`does not skip unrecognized provider ${String(provider)}`, () => {
    assert.equal(getGitPreviewBuildDecision({ ...preview, VERCEL_GIT_PROVIDER: provider }).exitCode, 1);
  });
}
test('local CLI preview retains the existing guard and build path', () => {
  assert.equal(getGitPreviewBuildDecision({ VERCEL_ENV: 'preview' }).exitCode, 1);
});
for (const [target, expected] of [['preview', 0], ['production', 1], ['development', 1]]) {
  test(`CLI returns Vercel ignoreCommand status ${expected} for ${target}`, () => {
    const result = spawnSync(process.execPath, [resolve('scripts/vercelGitPreviewPolicy.mjs')], {
      env: { ...process.env, ...preview, VERCEL_ENV: target }, encoding: 'utf8', timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, expected, result.stderr);
    assert.equal(JSON.parse(result.stdout).exitCode, expected);
    assert.equal(result.stderr, '');
  });
}
test('configuration binds the policy without removing the build guard', () => {
  const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
  assert.equal(config.ignoreCommand, 'node scripts/vercelGitPreviewPolicy.mjs');
  assert.match(pkg.scripts.build, /^npm run guard:vercel-rewrites && /);
  const productionRoutes = config.rewrites.filter((rule) => rule.destination.startsWith('https://api.chatboc.ar/'));
  assert.equal(productionRoutes.length, 8);
  assert.equal(config.rewrites.some((rule) => rule.destination.includes('api-preview.chatboc.ar')), false);
});
