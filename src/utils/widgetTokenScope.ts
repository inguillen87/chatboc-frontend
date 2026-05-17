import { safeLocalStorage } from '@/utils/safeLocalStorage';

const WIDGET_TOKEN_SCOPE_KEY = 'chatboc_widget_token_scope_v1';

export const normalizeWidgetTenantScopeSlug = (slug?: string | null): string | null => {
  if (!slug) return null;
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.endsWith('.chatboc.ar') ? trimmed.slice(0, -'.chatboc.ar'.length) : trimmed;
};

export const readWidgetTokenScope = (): { token: string; tenantSlug: string } | null => {
  try {
    const raw = safeLocalStorage.getItem(WIDGET_TOKEN_SCOPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const token = typeof parsed.token === 'string' ? parsed.token.trim() : '';
    const tenantSlug = normalizeWidgetTenantScopeSlug(
      typeof parsed.tenantSlug === 'string' ? parsed.tenantSlug : null,
    );
    return token && tenantSlug ? { token, tenantSlug } : null;
  } catch {
    return null;
  }
};

export const persistWidgetTokenScope = (token?: string | null, tenantSlug?: string | null) => {
  const trimmedToken = typeof token === 'string' ? token.trim() : '';
  const normalizedTenant = normalizeWidgetTenantScopeSlug(tenantSlug);
  if (!trimmedToken || !normalizedTenant) return;
  safeLocalStorage.setItem(
    WIDGET_TOKEN_SCOPE_KEY,
    JSON.stringify({ token: trimmedToken, tenantSlug: normalizedTenant }),
  );
};

export const clearCachedWidgetTokenScope = () => {
  safeLocalStorage.removeItem(WIDGET_TOKEN_SCOPE_KEY);
};

export const clearCachedWidgetToken = () => {
  [
    WIDGET_TOKEN_SCOPE_KEY,
    'entityToken',
    'entity_token',
    'widgetToken',
    'widget_token',
    'ownerToken',
    'owner_token',
    'widgetOwnerToken',
    'widget_owner_token',
  ].forEach((key) => safeLocalStorage.removeItem(key));
};

export const clearWidgetRuntimeCacheForTenantSwitch = () => {
  clearCachedWidgetToken();
  [
    'chat_session_id',
    'chatboc_demo_session_id',
    'demoSessionId',
    'chatboc_demo_chat_session_id',
    'demoChatSessionId',
    'chatboc_demo_tenant_slug',
    'widget_session_token',
    'cart_session',
    'tenant_history',
    'widget_tenant_history',
  ].forEach((key) => safeLocalStorage.removeItem(key));
};

export const resolveWidgetTokenForTenant = (
  token?: string | null,
  tenantSlug?: string | null,
): string | null => {
  const trimmedToken = typeof token === 'string' ? token.trim() : '';
  if (!trimmedToken) return null;
  const normalizedTenant = normalizeWidgetTenantScopeSlug(tenantSlug);
  const scoped = readWidgetTokenScope();
  if (
    scoped?.token === trimmedToken &&
    normalizedTenant &&
    scoped.tenantSlug !== normalizedTenant
  ) {
    clearCachedWidgetToken();
    return null;
  }
  return trimmedToken;
};
