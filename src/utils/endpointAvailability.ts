import { safeLocalStorage } from '@/utils/safeLocalStorage';

const STORAGE_PREFIX = 'endpoint-unavailable:';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

type StoredValue = {
  expires: number;
};

const buildKey = (path: string) => `${STORAGE_PREFIX}${path}`;

export function markEndpointUnavailable(path: string, ttlMs: number = DEFAULT_TTL_MS) {
  try {
    const expires = Date.now() + Math.max(0, ttlMs);
    safeLocalStorage.setItem(buildKey(path), JSON.stringify({ expires } satisfies StoredValue));
  } catch (error) {
    console.warn('[endpointAvailability] Unable to persist endpoint flag', { path, error });
  }
}

export function clearEndpointUnavailable(path: string) {
  try {
    safeLocalStorage.removeItem(buildKey(path));
  } catch (error) {
    console.warn('[endpointAvailability] Unable to clear endpoint flag', { path, error });
  }
}

export function isEndpointMarkedUnavailable(path: string): boolean {
  try {
    const raw = safeLocalStorage.getItem(buildKey(path));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<StoredValue>;
    if (typeof parsed.expires === 'number') {
      if (parsed.expires > Date.now()) {
        return true;
      }
    }
    safeLocalStorage.removeItem(buildKey(path));
    return false;
  } catch (error) {
    console.warn('[endpointAvailability] Invalid flag detected, clearing', { path, error });
    try {
      safeLocalStorage.removeItem(buildKey(path));
    } catch (removeError) {
      console.warn('[endpointAvailability] Unable to remove corrupted flag', { path, removeError });
    }
    return false;
  }
}
