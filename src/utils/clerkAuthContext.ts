import { safeSessionStorage } from '@/utils/safeLocalStorage';

export type ClerkAuthIntent = 'tenant_owner' | 'tenant_portal';

export interface ClerkAuthContext {
  intent: ClerkAuthIntent;
  tenantSlug: string | null;
  returnTo: string | null;
  createdAt: number;
}

const STORAGE_KEY = 'chatboc.clerk.auth-context.v1';
const MAX_CONTEXT_AGE_MS = 30 * 60 * 1000;

export const sanitizeClerkTenantSlug = (value?: string | null) => {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(normalized)
    ? normalized
    : null;
};

export const resolvePortalAuthTenantSlug = ({
  pathname,
  search = '',
  currentSlug,
  hasWidgetToken = false,
}: {
  pathname: string;
  search?: string;
  currentSlug?: string | null;
  hasWidgetToken?: boolean;
}) => {
  const routeMatch = String(pathname || '').match(
    /^\/(?:t|portal)\/([^/?#]+)\/user\/(?:login|register)\/?$/i,
  );
  if (routeMatch?.[1]) {
    try {
      return sanitizeClerkTenantSlug(decodeURIComponent(routeMatch[1]));
    } catch {
      return sanitizeClerkTenantSlug(routeMatch[1]);
    }
  }

  try {
    const params = new URLSearchParams(search);
    const explicit = sanitizeClerkTenantSlug(
      params.get('tenant') || params.get('tenant_slug'),
    );
    if (explicit) return explicit;
  } catch {
    // Ignore malformed query strings and keep the auth entry unscoped.
  }

  return hasWidgetToken ? sanitizeClerkTenantSlug(currentSlug) : null;
};

export const sanitizeClerkReturnPath = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized || !normalized.startsWith('/') || normalized.startsWith('//') || normalized.startsWith('/\\')) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return null;

  const pathOnly = normalized.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  if (['/login', '/register', '/sso-callback', '/auth/sso-callback'].includes(pathOnly)) {
    return null;
  }
  return normalized;
};

export const persistClerkAuthContext = ({
  intent = 'tenant_owner',
  tenantSlug,
  returnTo,
}: Partial<Omit<ClerkAuthContext, 'createdAt'>> = {}): ClerkAuthContext => {
  const context: ClerkAuthContext = {
    intent: intent === 'tenant_portal' ? 'tenant_portal' : 'tenant_owner',
    tenantSlug: sanitizeClerkTenantSlug(tenantSlug),
    returnTo: sanitizeClerkReturnPath(returnTo),
    createdAt: Date.now(),
  };
  safeSessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  return context;
};

export const readClerkAuthContext = (): ClerkAuthContext | null => {
  const raw = safeSessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ClerkAuthContext>;
    const createdAt = Number(parsed.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > MAX_CONTEXT_AGE_MS) {
      safeSessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      intent: parsed.intent === 'tenant_portal' ? 'tenant_portal' : 'tenant_owner',
      tenantSlug: sanitizeClerkTenantSlug(parsed.tenantSlug),
      returnTo: sanitizeClerkReturnPath(parsed.returnTo),
      createdAt,
    };
  } catch {
    safeSessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearClerkAuthContext = () => {
  safeSessionStorage.removeItem(STORAGE_KEY);
};
