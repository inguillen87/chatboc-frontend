import { safeLocalStorage } from './safeLocalStorage';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const persistAnonCookie = (anonId: string) => {
  try {
    if (typeof document === 'undefined') return;
    const encoded = encodeURIComponent(anonId);
    document.cookie = `chatboc_anon_id=${encoded}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  } catch {
    // Ignore cookie persistence errors (e.g. in private browsing modes).
  }
};

export function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return '';
  try {
    // Check new key first
    let anonId = safeLocalStorage.getItem('chatboc_anon_id');

    // Fallback to legacy key
    if (!anonId) {
      const legacy = safeLocalStorage.getItem('anon_id');
      if (legacy) {
        anonId = legacy;
        // Migrate to new key
        safeLocalStorage.setItem('chatboc_anon_id', legacy);
      }
    }

    if (!anonId) {
      anonId =
        window.crypto?.randomUUID?.() ||
        `anon-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
      safeLocalStorage.setItem('chatboc_anon_id', anonId);
    }
    persistAnonCookie(anonId);
    return anonId;
  } catch {
    const fallback = `anon-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
    return fallback;
  }
}

export default getOrCreateAnonId;
