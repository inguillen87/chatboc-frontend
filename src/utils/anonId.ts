import { safeLocalStorage } from './safeLocalStorage';

export function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let anonId = safeLocalStorage.getItem('anon_id');
    if (!anonId) {
      anonId =
        window.crypto?.randomUUID?.() ||
        `anon-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
      safeLocalStorage.setItem('anon_id', anonId);
    }
    return anonId;
  } catch {
    const fallback = `anon-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
    return fallback;
  }
}

export default getOrCreateAnonId;
