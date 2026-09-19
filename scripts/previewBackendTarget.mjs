/** A paired candidate is an explicit opt-in; production remains forbidden. */
export const QA_BACKEND = 'https://api-preview.chatboc.ar';
const CANDIDATE = /^chatboc-backend-[a-z0-9]+-marcelos-projects-c26aa499\.vercel\.app$/;
export function resolvePreviewBackend(environment = {}) {
  const raw = environment.CHATBOC_PREVIEW_BACKEND_ORIGIN ?? QA_BACKEND;
  const revision = environment.VITE_EXPECTED_BACKEND_REVISION;
  if (typeof raw !== 'string') throw new Error('Invalid Preview backend origin');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || raw !== url.origin || url.username || url.password || url.port ||
      (raw !== QA_BACKEND && !CANDIDATE.test(url.hostname))) {
    throw new Error('Only the approved QA host or an exact project candidate is allowed');
  }
  if (revision !== undefined && (typeof revision !== 'string' || !/^[0-9a-f]{40}$/.test(revision))) {
    throw new Error('Preview backend revision must be an exact lowercase commit SHA');
  }
  if (raw !== QA_BACKEND && revision === undefined) {
    throw new Error('An immutable backend candidate requires its declared revision');
  }
  return {origin:raw, revision:revision ?? null};
}
