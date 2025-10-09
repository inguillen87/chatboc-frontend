import { DEFAULT_ENTITY_TOKEN } from '@/config';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

export function getChatbocConfig() {
  const g = (window as any).CHATBOC_CONFIG || {};
  const storedToken = safeLocalStorage.getItem('entityToken') || '';
  const fallbackToken =
    typeof DEFAULT_ENTITY_TOKEN === 'string' && DEFAULT_ENTITY_TOKEN.trim()
      ? DEFAULT_ENTITY_TOKEN.trim()
      : '';
  const effectiveEntityToken =
    typeof g.entityToken === 'string' && g.entityToken.trim()
      ? g.entityToken
      : storedToken || fallbackToken;
  return {
    endpoint: g.endpoint || 'municipio',
    entityToken: effectiveEntityToken,
    userToken: g.userToken || null,
    defaultOpen: !!g.defaultOpen,
    width: g.width || '460px',
    height: g.height || '680px',
    closedWidth: g.closedWidth || '72px',
    closedHeight: g.closedHeight || '72px',
    bottom: g.bottom || '20px',
    right: g.right || '20px',
    primaryColor: g.primaryColor || '#007aff',
    accentColor: g.accentColor || '',
    logoUrl: g.logoUrl || '',
    headerLogoUrl: g.headerLogoUrl || g.logoUrl || '',
    logoAnimation: g.logoAnimation || '',
    welcomeTitle: g.welcomeTitle || '',
    welcomeSubtitle: g.welcomeSubtitle || ''
  };
}

export interface AnalyticsSettings {
  enabled: boolean;
  tenants: string[];
  defaultTenantId?: string;
  defaultContext?: string;
}

export function getAnalyticsSettings(): AnalyticsSettings {
  if (typeof window === 'undefined') {
    return { enabled: true, tenants: [] };
  }
  const analytics = ((window as any).CHATBOC_CONFIG || {}).analytics || {};
  const tenants = Array.isArray(analytics.tenants)
    ? analytics.tenants.filter((tenant: unknown) => typeof tenant === 'string' && tenant.trim())
    : [];
  const defaultTenantId =
    typeof analytics.defaultTenantId === 'string' && analytics.defaultTenantId.trim()
      ? analytics.defaultTenantId
      : undefined;
  const defaultContext =
    typeof analytics.defaultContext === 'string' && analytics.defaultContext.trim()
      ? analytics.defaultContext
      : undefined;
  const enabled = analytics.enabled === undefined ? true : analytics.enabled !== false;
  return {
    enabled,
    tenants,
    defaultTenantId,
    defaultContext,
  };
}

export function getIframeToken(): string {
  const globalToken = (window as any).CHATBOC_CONFIG?.entityToken;
  if (typeof globalToken === 'string' && globalToken.trim()) {
    return globalToken;
  }

  try {
    const stored = safeLocalStorage.getItem('entityToken');
    if (stored && stored.trim()) {
      return stored;
    }
  } catch {
    // ignore storage access issues and fallback to env token
  }

  if (typeof DEFAULT_ENTITY_TOKEN === 'string' && DEFAULT_ENTITY_TOKEN.trim()) {
    const trimmed = DEFAULT_ENTITY_TOKEN.trim();
    try {
      const existing = safeLocalStorage.getItem('entityToken');
      if (!existing) {
        safeLocalStorage.setItem('entityToken', trimmed);
      }
    } catch {
      // Ignore storage errors; still return the fallback token.
    }
    return trimmed;
  }

  return '';
}
