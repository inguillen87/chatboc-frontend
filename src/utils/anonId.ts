import { apiFetch } from './api';
import { safeLocalStorage } from './safeLocalStorage';
import getOrCreateAnonId from './anonIdGenerator';

export { getOrCreateAnonId };

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

export async function ensureRemoteAnonId(options?: { tenantSlug?: string | null; widgetToken?: string | null }): Promise<string> {
  const existing = getOrCreateAnonId();
  const searchParams = new URLSearchParams();
  if (options?.tenantSlug) searchParams.set('tenant', options.tenantSlug);
  if (options?.widgetToken) searchParams.set('widget_token', options.widgetToken);

  try {
    const response = await apiFetch<{ anon_id?: string; anonId?: string }>(
      `/api/pwa/anon-id${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
      {
        method: 'GET',
        skipAuth: true,
        omitCredentials: true,
        isWidgetRequest: true,
        sendAnonId: true,
      },
    );

    const next = response?.anon_id || response?.anonId;
    if (next && next !== existing) {
      safeLocalStorage.setItem('chatboc_anon_id', next);
      persistAnonCookie(next);
      return next;
    }
  } catch (error) {
    console.warn('[anonId] No se pudo recuperar anon_id del backend, se usará el local.', error);
  }

  return existing;
}

export default getOrCreateAnonId;
