import { usePanelSessionStore } from '@/stores';
import React, { useContext, useState, useCallback, useEffect, useRef } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { enforceTipoChatForRubro, parseRubro } from '@/utils/tipoChat';
import { getIframeToken } from '@/utils/config';
import { getStoredEntityToken, normalizeEntityToken, persistEntityToken } from '@/utils/entityToken';
import { getValidStoredToken } from '@/utils/authTokens';
import { TENANT_ROUTE_PREFIXES } from '@/utils/tenantPaths';
import { TENANT_PLACEHOLDER_SLUGS } from '@/constants/tenant';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';
import { useSessionAuthority } from '@/components/access/SessionAuthorityContext';
import type { ChannelActivationContract } from '@/api/v2/channelActivation';
import {
  captureChatbocSessionRevision,
  clearLocalChatbocSession,
  hasPersistedClerkSession,
  isChatbocSessionRevisionCurrent,
} from '@/utils/sessionLogout';

const readClerkCookieSessionIdentity = () => {
  if (safeLocalStorage.getItem('authProvider')?.trim().toLowerCase() !== 'clerk') return null;
  const clerkUserId = safeLocalStorage.getItem('clerkUserId')?.trim();
  return clerkUserId ? `clerk-cookie:${clerkUserId}` : null;
};

const profileIdentityKey = (session: string | null, revision: number, user: { id?: string | number; tenant_slug?: string; tenantSlug?: string } | null) =>
  session && user ? JSON.stringify([session, revision, user.id, user.tenant_slug || user.tenantSlug]) : null;

interface UserData {
  id?: number;
  name?: string;
  email?: string;
  token?: string;
  plan?: string;
  rubro?: string;
  nombre_empresa?: string;
  logo_url?: string;
  organization_profile?: unknown;
  organization_workspace?: unknown;
  avatar_url?: string;
  avatar_source?: string;
  avatar_consent?: boolean | string | number | null;
  profile_picture_consent?: boolean | string | number | null;
  picture?: string;
  identity?: {
    avatar_url?: string | null;
    avatar_source?: string | null;
    avatar_consent?: boolean | string | number | null;
    profile_picture_consent?: boolean | string | number | null;
    picture?: string | null;
  };
  tipo_chat?: 'pyme' | 'municipio';
  entityToken?: string;
  rol?: string;
  role?: string;
  permissions?: string[];
  capabilities?: string[];
  scopes?: string[];
  tenantSlug?: string;
  tenant_slug?: string;
  tenant?: { slug?: string; tenant_slug?: string };
  publicCartUrl?: string;
  publicCatalogUrl?: string;
  categoria_id?: number;
  categoria_ids?: number[];
  categorias?: { id: number; nombre?: string }[];
  widget_icon_url?: string;
  widget_animation?: string;
  latitud?: number;
  longitud?: number;
  channel_activation?: ChannelActivationContract | null;
}

interface UserContextValue {
  user: UserData | null;
  setUser: (u: UserData | null) => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
  organizationProfileVerified: boolean;
}

const UserContext = React.createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  refreshUser: async () => {},
  loading: false,
  organizationProfileVerified: false,
});


const shouldLogUserWarnings = () => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined;
  return Boolean(metaEnv?.DEV || metaEnv?.MODE === 'development');
};

const PLACEHOLDER_SLUGS = TENANT_PLACEHOLDER_SLUGS;

const sanitizeTenantSlug = (slug?: string | null) => {
  if (!slug || typeof slug !== 'string') return null;
  const normalized = slug.trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (
    PLACEHOLDER_SLUGS.has(lowered) ||
    lowered === 'localhost' ||
    lowered === '::1' ||
    /^\d+$/.test(lowered) ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(lowered)
  ) {
    return null;
  }
  return normalized;
};

const deriveTenantSlugFromUrl = (rawUrl?: string | null) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const url = new URL(rawUrl, 'http://localhost');
    const params = url.searchParams;
    const fromQuery = params.get('tenant') || params.get('tenant_slug') || params.get('endpoint');
    if (fromQuery?.trim()) {
      return sanitizeTenantSlug(fromQuery);
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const tenantPrefixIndex = segments.findIndex((segment) =>
      TENANT_ROUTE_PREFIXES.includes(segment.toLowerCase() as typeof TENANT_ROUTE_PREFIXES[number]),
    );
    if (tenantPrefixIndex >= 0 && segments[tenantPrefixIndex + 1]) {
      return sanitizeTenantSlug(decodeURIComponent(segments[tenantPrefixIndex + 1]));
    }
  } catch (error) {
    console.warn('[useUser] No se pudo derivar tenantSlug desde URL pública', { rawUrl, error });
  }

  return null;
};


export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, setUser, authToken: panelAuthToken } = usePanelSessionStore();
  const [loading, setLoading] = useState(false);
  const rejectedAuthTokenRef = useRef<string | null>(null);
  const profileAttemptRef = useRef<string | null>(null);
  const inFlightProfileRef = useRef<string | null>(null);
  const [verifiedProfileKey, setVerifiedProfileKey] = useState<string | null>(null);

  useEffect(() => {
    if (user) return;
    const hasValidBearer = Boolean(
      getValidStoredToken('authToken') || getValidStoredToken('chatAuthToken'),
    );
    // A cookie-backed Clerk session is verified by ClerkAuthBridge. A local
    // authProvider marker alone must never hydrate a private profile.
    if (!hasValidBearer || hasPersistedClerkSession()) return;
    if (rejectedAuthTokenRef.current) {
      const storedIdentity =
        getValidStoredToken('authToken') ||
        getValidStoredToken('chatAuthToken') ||
        readClerkCookieSessionIdentity();
      if (!storedIdentity || storedIdentity === rejectedAuthTokenRef.current) return;
      rejectedAuthTokenRef.current = null;
    }
    usePanelSessionStore.getState().loadFromStorage();
  }, [user]);

  const refreshUser = useCallback(async () => {
    const panelToken = getValidStoredToken('authToken');
    const chatToken = getValidStoredToken('chatAuthToken');
    const activeToken = panelToken ?? chatToken;
    const clerkCookieIdentity = readClerkCookieSessionIdentity();
    const sessionIdentity = activeToken || clerkCookieIdentity;
    const tokenKey: 'authToken' | 'chatAuthToken' | null = panelToken
      ? 'authToken'
      : chatToken
        ? 'chatAuthToken'
        : null;
    if (!sessionIdentity) return;
    if (rejectedAuthTokenRef.current === sessionIdentity) return;
    const requestRevision = captureChatbocSessionRevision();
    const requestKey = JSON.stringify([sessionIdentity, requestRevision]);
    if (inFlightProfileRef.current === requestKey) return;
    profileAttemptRef.current = requestKey;
    inFlightProfileRef.current = requestKey;
    const isCurrentRequest = () => {
      const currentIdentity =
        getValidStoredToken('authToken') ||
        getValidStoredToken('chatAuthToken') ||
        readClerkCookieSessionIdentity();
      return (
        currentIdentity === sessionIdentity &&
        isChatbocSessionRevisionCurrent(requestRevision)
      );
    };
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/me', {
        preserveAuthOn401: true,
        suppressPanel401Redirect: true,
        omitEntityToken: true,
        omitTenant: true,
      });
      if (!isCurrentRequest()) return;
      const rubroNorm = parseRubro(data.rubro) || '';
      const resolvedRole = typeof data.rol === 'string' ? data.rol : typeof data.role === 'string' ? data.role : undefined;
      if (!data.tipo_chat) {
        console.warn('tipo_chat faltante en respuesta de /me');
      }
      if (!resolvedRole) {
        console.warn('rol faltante en respuesta de /me');
      }
      const finalTipo = data.tipo_chat
        ? enforceTipoChatForRubro(data.tipo_chat as 'pyme' | 'municipio', rubroNorm)
        : undefined;
      const normalizeCategoryIds = (value: any): number[] | undefined => {
        const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
        const normalized = values
          .map((val) => {
            const parsed = typeof val === 'number' ? val : Number(val);
            return Number.isFinite(parsed) ? Number(parsed) : null;
          })
          .filter((val): val is number => val !== null);
        return normalized.length > 0 ? normalized : undefined;
      };

      const normalizedCategories = Array.isArray(data.categorias)
        ? data.categorias
            .map((cat: any) => {
              if (!cat || typeof cat !== 'object') return null;
              const id = Number(cat.id);
              if (!Number.isFinite(id)) return null;
              return { id, nombre: cat.nombre };
            })
            .filter((cat): cat is { id: number; nombre?: string } => Boolean(cat))
        : undefined;

      const normalizedEntityToken = normalizeEntityToken(
        data.entityToken || data.entity_token || data.token_integracion,
      );
      const normalizedTenantSlug =
        typeof data.tenantSlug === 'string'
          ? data.tenantSlug
          : typeof data.tenant_slug === 'string'
            ? data.tenant_slug
            : typeof data.tenant?.slug === 'string'
              ? data.tenant.slug
              : typeof data.tenant?.tenant_slug === 'string'
                ? data.tenant.tenant_slug
            : undefined;
      const derivedTenantSlug =
        normalizedTenantSlug ||
        deriveTenantSlugFromUrl(
          typeof data.public_catalog_url === 'string'
            ? data.public_catalog_url
            : typeof data.publicCatalogUrl === 'string'
              ? data.publicCatalogUrl
              : undefined,
        ) ||
        deriveTenantSlugFromUrl(
          typeof data.public_cart_url === 'string'
            ? data.public_cart_url
            : typeof data.publicCartUrl === 'string'
              ? data.publicCartUrl
              : undefined,
        );
      const resolvedTenantSlug = sanitizeTenantSlug(derivedTenantSlug);
      const normalizedPublicCartUrl =
        typeof data.public_cart_url === 'string'
          ? data.public_cart_url
          : typeof data.publicCartUrl === 'string'
            ? data.publicCartUrl
            : undefined;
      const normalizedPublicCatalogUrl =
        typeof data.public_catalog_url === 'string'
          ? data.public_catalog_url
          : typeof data.publicCatalogUrl === 'string'
            ? data.publicCatalogUrl
            : undefined;
      const storedEntityToken = getStoredEntityToken();

      if (normalizedEntityToken) {
        persistEntityToken(normalizedEntityToken);
      }

      const resolvedPlan =
        data.plan ||
        data.tenant?.plan ||
        data.tenant_plan ||
        'free';

      const profileAvatarUrl =
        typeof data.avatar_url === 'string'
          ? data.avatar_url
          : typeof data.picture === 'string'
            ? data.picture
            : typeof data.identity?.avatar_url === 'string'
              ? data.identity.avatar_url
              : typeof data.identity?.picture === 'string'
                ? data.identity.picture
                : undefined;
      const resolvedProfileAvatar = resolveConsentedAvatar(data, {
        avatarUrl: profileAvatarUrl,
        source:
          typeof data.avatar_source === 'string'
            ? data.avatar_source
            : typeof data.identity?.avatar_source === 'string'
              ? data.identity.avatar_source
              : undefined,
        consented:
          data.avatar_consent ??
          data.profile_picture_consent ??
          data.identity?.avatar_consent ??
          data.identity?.profile_picture_consent,
      }, data.identity);
      const updated: UserData = {
        id: data.id,
        name: data.name,
        email: data.email,
        plan: resolvedPlan,
        rubro: rubroNorm,
        nombre_empresa: data.nombre_empresa,
        logo_url: data.logo_url,
        organization_profile: data.organization_profile,
        organization_workspace: data.organization_workspace,
        avatar_url: resolvedProfileAvatar.avatarUrl,
        avatar_source: resolvedProfileAvatar.source,
        avatar_consent: resolvedProfileAvatar.consented,
        picture: resolvedProfileAvatar.avatarUrl,
        tipo_chat: finalTipo,
        rol: resolvedRole,
        role: resolvedRole,
        permissions: Array.isArray(data.permissions) ? data.permissions : undefined,
        capabilities: Array.isArray(data.capabilities) ? data.capabilities : undefined,
        scopes: Array.isArray(data.scopes) ? data.scopes : undefined,
        token: activeToken || undefined,
        entityToken: normalizedEntityToken || storedEntityToken || undefined,
        tenantSlug: resolvedTenantSlug || undefined,
        tenant_slug: resolvedTenantSlug || undefined,
        tenant:
          data.tenant && typeof data.tenant === 'object'
            ? {
                slug: resolvedTenantSlug || data.tenant.slug,
                tenant_slug: resolvedTenantSlug || data.tenant.tenant_slug,
              }
            : resolvedTenantSlug
              ? { slug: resolvedTenantSlug, tenant_slug: resolvedTenantSlug }
              : undefined,
        publicCartUrl: normalizedPublicCartUrl,
        publicCatalogUrl: normalizedPublicCatalogUrl,
        categoria_id: Number.isFinite(data.categoria_id) ? Number(data.categoria_id) : undefined,
        categoria_ids: normalizeCategoryIds(data.categoria_ids),
        categorias: normalizedCategories,
        widget_icon_url: data.widget_icon_url,
        widget_animation: data.widget_animation,
        latitud: typeof data.latitud === 'number' ? data.latitud : Number(data.latitud),
        longitud: typeof data.longitud === 'number' ? data.longitud : Number(data.longitud),
        channel_activation: data.channel_activation || null,
      };
      if (resolvedTenantSlug) {
        safeLocalStorage.setItem('tenantSlug', resolvedTenantSlug);
      }
      rejectedAuthTokenRef.current = null;
      setVerifiedProfileKey(profileIdentityKey(sessionIdentity, requestRevision, updated));
      setUser(updated as any);
    } catch (e) {
      if (!isCurrentRequest()) return;
      const status = e instanceof ApiError ? e.status : (e as any)?.status;
      if (status === 401 || status === 403) setVerifiedProfileKey(null);

      if (status === 401) {
        console.error('Auth error fetching user profile, logging out.', e);
        rejectedAuthTokenRef.current = sessionIdentity;
        // If fetching the user fails due to auth, clear session to force re-login.
        clearLocalChatbocSession();
      } else {
        // Network or server errors shouldn't drop an otherwise valid session.
        if (shouldLogUserWarnings()) {
          console.warn('Transient error fetching user profile. Preserving session.', e);
        }
      }
    } finally {
      if (inFlightProfileRef.current === requestKey) {
        inFlightProfileRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const token =
      getValidStoredToken('authToken') ||
      getValidStoredToken('chatAuthToken');
    const attemptKey = token ? JSON.stringify([token, captureChatbocSessionRevision()]) : null;
    if (token && !hasPersistedClerkSession() && profileAttemptRef.current !== attemptKey) {
      refreshUser();
    }
  }, [refreshUser, user, panelAuthToken]);

  const currentIdentity = getValidStoredToken('authToken') || getValidStoredToken('chatAuthToken') || readClerkCookieSessionIdentity();
  const organizationProfileVerified = !loading && verifiedProfileKey !== null &&
    verifiedProfileKey === profileIdentityKey(currentIdentity, captureChatbocSessionRevision(), user);
  return (
    <UserContext.Provider value={{ user, setUser, refreshUser, loading, organizationProfileVerified }}>
      {children}
    </UserContext.Provider>
  );
};

export function useUser() {
  const context = useContext(UserContext);
  const { hasVerifiedSession } = useSessionAuthority();

  return {
    ...context,
    user: hasVerifiedSession ? context.user : null,
    organizationProfileVerified: hasVerifiedSession && context.organizationProfileVerified,
  };
}
