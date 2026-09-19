import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const normalize = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const gitProviders = new Set(['github', 'gitlab', 'bitbucket']);

/** Vercel ignoreCommand: 0 skips a build; 1 continues its existing checks. */
export function getGitPreviewBuildDecision(environment = process.env) {
  const target = normalize(environment.VERCEL_ENV);
  const provider = normalize(environment.VERCEL_GIT_PROVIDER);
  const commit = normalize(environment.VERCEL_GIT_COMMIT_SHA);
  const verifiedGitContext = gitProviders.has(provider) && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit);
  const skip = target === 'preview' && verifiedGitContext;
  return {
    contract: 'chatboc.git-preview-build-policy.v1',
    action: skip ? 'skip_git_preview' : 'continue_existing_pipeline',
    reason: skip ? 'use_bound_qa_prebuilt_flow' : 'not_an_identified_git_preview',
    exitCode: skip ? 0 : 1,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const decision = getGitPreviewBuildDecision();
  process.stdout.write(`${JSON.stringify(decision)}\n`);
  process.exitCode = decision.exitCode;
}
