import { isDisabilityAIAgentDemoPath } from '@/config/publicPresentationRoutes';
import { BackendReadinessLeases } from './backendReadinessLease';

const BOOTSTRAP_CONTRACT_VERSION = 'chatboc.bootstrap.v1';
const BOOTSTRAP_REASON_CODE = 'application_initializing';
const DEFAULT_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TIMEOUT_MS = 20_000;

type BootstrapPayload = {
  contract_version?: unknown;
  reason_code?: unknown;
  retryable?: unknown;
};

type BootstrapGateOptions = {
  baseUrl?: string | null;
  enabled?: boolean;
  fetcher?: typeof fetch;
  maxAttempts?: number;
  timeoutMs?: number;
  expectedRevision?: string;
  wait?: (delayMs: number) => Promise<void>;
};

export class BackendBootstrapError extends Error {
  readonly status: number | null;
  readonly body: unknown;

  constructor(message: string, status: number | null = null, body: unknown = null) {
    super(message);
    this.name = 'BackendBootstrapError';
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, BackendBootstrapError.prototype);
  }
}

const readinessByUrl = new BackendReadinessLeases();

const parseBooleanFlag = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return null;
};

export const isBackendBootstrapGateEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  // The delivered institutional presentation and installed offline shell do
  // not depend on a running API to render.
  if (isDisabilityAIAgentDemoPath(window.location.pathname) || !window.navigator.onLine) {
    return false;
  }
  const explicit = parseBooleanFlag(import.meta.env.VITE_BACKEND_BOOTSTRAP_GATE_ENABLED);
  if (explicit !== null) return explicit;
  return window.location.hostname.toLowerCase().endsWith('.vercel.app');
};

const normalizeHttpBase = (value?: string | null): string => {
  if (!value?.trim()) return '';
  return value.trim().replace(/^ws/i, 'http').replace(/\/$/, '');
};

export const resolveBackendReadinessUrl = (baseUrl?: string | null): string => {
  const normalizedBase = normalizeHttpBase(baseUrl);
  if (!normalizedBase) return '/api/version';
  try {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(normalizedBase, currentOrigin);
    const normalizedPath = url.pathname.replace(/\/$/, '');
    url.pathname = normalizedPath.endsWith('/api') ? `${normalizedPath}/version` : '/api/version';
    url.search = '';
    url.hash = '';
    return url.origin === currentOrigin ? `${url.pathname}` : url.toString();
  } catch {
    return '/api/version';
  }
};

const readJsonBody = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => '');
  if (!text.trim()) return null;
  try { return JSON.parse(text); } catch { return text; }
};

const isExplicitBootstrapRejection = (response: Response, body: unknown): boolean => {
  if (response.status !== 503 || !body || typeof body !== 'object') return false;
  const payload = body as BootstrapPayload;
  return payload.contract_version === BOOTSTRAP_CONTRACT_VERSION &&
    payload.reason_code === BOOTSTRAP_REASON_CODE && payload.retryable === true;
};

const resolveRetryDelay = (response: Response): number => {
  const rawRetryAfter = response.headers.get('Retry-After')?.trim();
  if (!rawRetryAfter) return DEFAULT_RETRY_DELAY_MS;
  const seconds = Number(rawRetryAfter);
  if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_RETRY_DELAY_MS;
  return Math.min(MAX_RETRY_DELAY_MS, Math.max(250, Math.round(seconds * 1_000)));
};

const defaultWait = (delayMs: number) => new Promise<void>((resolve) => {
  globalThis.setTimeout(resolve, delayMs);
});

const probeBackend = async (
  readinessUrl: string,
  options: Required<Pick<BootstrapGateOptions, 'fetcher' | 'maxAttempts' | 'wait'>>,
  signal: AbortSignal,
  expectedRevision: string | null,
): Promise<void> => {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    signal.throwIfAborted();
    let response: Response;
    try {
      response = await options.fetcher(readinessUrl, {
        method: 'GET', credentials: 'omit', cache: 'no-store',
        headers: { Accept: 'application/json' }, signal,
      });
    } catch (error) {
      throw new BackendBootstrapError('No pudimos contactar el servicio para iniciar la plataforma.', null, error);
    }
    const body = await readJsonBody(response);
    signal.throwIfAborted();
    if (response.ok && body && typeof body === 'object' &&
        'backend' in body && typeof body.backend === 'string' && body.backend.trim() &&
        'frontend' in body && typeof body.frontend === 'string') {
      if (expectedRevision !== null && body.backend !== expectedRevision) {
        throw new BackendBootstrapError(
          'La interfaz y el servicio corresponden a versiones distintas. No se enviaron cambios.',
          409, { reason_code: 'backend_revision_mismatch' },
        );
      }
      return;
    }
    if (!isExplicitBootstrapRejection(response, body)) {
      throw new BackendBootstrapError('El servicio no pudo completar el inicio seguro.', response.status, body);
    }
    if (attempt === options.maxAttempts) {
      throw new BackendBootstrapError('La plataforma sigue iniciando. Reintenta en unos segundos.', response.status, body);
    }
    await options.wait(resolveRetryDelay(response));
  }
  // Defensive: no configuration can make an empty probe loop report success.
  throw new BackendBootstrapError('No se pudo verificar el inicio del servicio.');
};

/** Only GET /api/version is retried. Business mutations are never replayed here.
 * A short lease reduces fan-out but is not proof of a permanently warm instance.
 * QA may pin an exact backend revision; ordinary deployments remain compatible.
 */
export const ensureBackendRuntimeReady = (options: BootstrapGateOptions = {}): Promise<void> => {
  const enabled = options.enabled ?? isBackendBootstrapGateEnabled();
  if (!enabled) return Promise.resolve();
  const requestedAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const requestedTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const expectedRevision = options.expectedRevision ?? import.meta.env.VITE_EXPECTED_BACKEND_REVISION;
  if (!Number.isFinite(requestedAttempts) || !Number.isInteger(requestedAttempts) ||
      !Number.isFinite(requestedTimeout) ||
      (expectedRevision !== undefined && (typeof expectedRevision !== 'string' || !/^[0-9a-f]{40}$/.test(expectedRevision)))) {
    return Promise.reject(new BackendBootstrapError('La configuración de verificación del servicio no es válida.'));
  }
  const readinessUrl = resolveBackendReadinessUrl(options.baseUrl);
  const key = JSON.stringify([readinessUrl, expectedRevision ?? null]);
  const existing = readinessByUrl.get(key);
  if (existing) return existing;
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const maxAttempts = Math.max(1, Math.min(requestedAttempts, 8));
  const wait = options.wait ?? defaultWait;
  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(requestedTimeout, 30_000));
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new BackendBootstrapError('El servicio está tardando en responder. Puedes reintentar.'));
    }, timeoutMs);
  });
  const readiness = Promise.race([
    probeBackend(readinessUrl, { fetcher, maxAttempts, wait }, controller.signal, expectedRevision ?? null),
    deadline,
  ]).finally(() => clearTimeout(timer));
  return readinessByUrl.track(key, readiness);
};

export const resetBackendBootstrapGateForTests = () => { readinessByUrl.clear(); };
