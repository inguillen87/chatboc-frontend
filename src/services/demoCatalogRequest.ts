import { apiFetch } from '@/utils/api';

export const DEMO_CATALOG_MEMORY_CACHE_MAX_AGE_MS = 30_000;
const DEMO_CATALOG_MEMORY_CACHE_FALLBACK_AGE_MS = 5_000;

type DemoCatalogRequestOptions = {
  ensureUsers?: boolean;
};

type DemoCatalogCacheEntry = {
  expiresAt: number;
  value: unknown;
};

const responseCache = new Map<string, DemoCatalogCacheEntry>();
const inFlightRequests = new Map<string, Promise<unknown>>();

let cacheGeneration = 0;
let revalidateNextRequest = false;

const buildDemoCatalogPath = ({ ensureUsers = false }: DemoCatalogRequestOptions = {}) => {
  const query = new URLSearchParams({ response_profile: 'selector' });
  if (ensureUsers) query.set('ensure_users', 'true');
  return `/api/v2/demo/catalog?${query.toString()}`;
};

const readNonNegativeSeconds = (value: string | null): number => {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const resolveMemoryCacheAge = (response: Response): number => {
  const cacheControl = response.headers.get('cache-control')?.toLowerCase() ?? '';
  if (/\b(?:no-store|no-cache|private)\b/.test(cacheControl)) return 0;

  const maxAgeMatch = cacheControl.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)"?/);
  if (!maxAgeMatch) return DEMO_CATALOG_MEMORY_CACHE_FALLBACK_AGE_MS;

  const maxAgeSeconds = readNonNegativeSeconds(maxAgeMatch[1]);
  const currentAgeSeconds = readNonNegativeSeconds(response.headers.get('age'));
  const remainingAgeMs = Math.max(0, maxAgeSeconds - currentAgeSeconds) * 1_000;
  return Math.min(remainingAgeMs, DEMO_CATALOG_MEMORY_CACHE_MAX_AGE_MS);
};

export const invalidateDemoCatalogRequestCache = (
  { revalidate = true }: { revalidate?: boolean } = {},
) => {
  cacheGeneration += 1;
  responseCache.clear();
  inFlightRequests.clear();
  revalidateNextRequest = revalidate;
};

export const requestDemoCatalog = <T>(options: DemoCatalogRequestOptions = {}): Promise<T> => {
  const path = buildDemoCatalogPath(options);
  const memoryCacheAllowed = options.ensureUsers !== true;
  const now = Date.now();
  const cached = memoryCacheAllowed ? responseCache.get(path) : undefined;
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value as T);
  }
  if (cached) responseCache.delete(path);

  const existingRequest = inFlightRequests.get(path);
  if (existingRequest) return existingRequest as Promise<T>;

  const requestGeneration = cacheGeneration;
  // `default` delegates max-age and ETag revalidation to the browser. Explicit
  // invalidation requests `no-cache`, while the legacy provisioning query is
  // never stored because it may become identity-bearing again in the future.
  const shouldRevalidate = !options.ensureUsers && revalidateNextRequest;
  const requestCacheMode: RequestCache = options.ensureUsers
    ? 'no-store'
    : shouldRevalidate
      ? 'no-cache'
      : 'default';
  if (!options.ensureUsers) revalidateNextRequest = false;
  let memoryCacheAge = DEMO_CATALOG_MEMORY_CACHE_FALLBACK_AGE_MS;

  let request: Promise<T>;
  request = apiFetch<T>(path, {
    cache: requestCacheMode,
    omitChatSessionId: true,
    omitCredentials: true,
    omitEntityToken: true,
    omitTenant: true,
    onResponse: (response) => {
      memoryCacheAge = resolveMemoryCacheAge(response);
    },
    skipAuth: true,
  })
    .then((value) => {
      if (
        memoryCacheAllowed &&
        cacheGeneration === requestGeneration &&
        memoryCacheAge > 0
      ) {
        responseCache.set(path, {
          expiresAt: Date.now() + memoryCacheAge,
          value,
        });
      }
      return value;
    })
    .catch((error) => {
      if (shouldRevalidate && cacheGeneration === requestGeneration) {
        revalidateNextRequest = true;
      }
      throw error;
    })
    .finally(() => {
      if (inFlightRequests.get(path) === request) {
        inFlightRequests.delete(path);
      }
    });

  inFlightRequests.set(path, request);
  return request;
};
