import type { IncomingMessage } from 'node:http';

type NavigationRequest = Pick<IncomingMessage, 'method' | 'url' | 'headers'>;

const htmlQuality = (accept: string, type: string): boolean =>
  accept.split(',').some(part => {
    const [media, ...parameters] = part.trim().toLowerCase().split(';');
    if (media.trim() !== type) return false;
    const qualities = parameters.map(value => value.trim()).filter(value => value.startsWith('q='));
    if (qualities.length > 1) return false;
    if (!qualities.length) return true;
    const quality = qualities[0].slice(2);
    return /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality) && Number(quality) > 0;
  });

/** Route a document to the public SPA shell, never grant API authorization.
 * JSON reads/writes still reach the original backend, as do legacy login and
 * downloads. Older browsers without Fetch Metadata can use an explicit HTML
 * Accept header; conflicting or partial metadata must never swallow an API call.
 */
export function adminDocumentNavigation(request: NavigationRequest): '/index.html' | undefined {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;
  if (typeof request.url !== 'string' || request.url.length > 8192) return undefined;
  const pathname = request.url.split(/[?#]/, 1)[0];
  if (!/^\/admin(?:\/|$)/.test(pathname)) return undefined;
  if (/^\/admin\/login\/?$/.test(pathname) || /\.[^/]+\/?$/.test(pathname)) return undefined;
  const headers = request.headers;
  const accept = headers.accept;
  if (typeof accept !== 'string' || accept.length > 8192 || !htmlQuality(accept, 'text/html')) return undefined;
  if (headers['x-requested-with'] !== undefined) return undefined;
  const destination = headers['sec-fetch-dest'];
  const mode = headers['sec-fetch-mode'];
  if (destination !== undefined || mode !== undefined) {
    return destination === 'document' && mode === 'navigate' ? '/index.html' : undefined;
  }
  // The absence of metadata alone is not evidence of a document request.
  // Legacy JSON consumers sometimes include HTML among their accepted types.
  if (htmlQuality(accept, 'application/json') || htmlQuality(accept, 'application/problem+json')) return undefined;
  return '/index.html';
}
