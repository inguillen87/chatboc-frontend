import React, { useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { enforceTipoChatForRubro, parseRubro } from '@/utils/tipoChat';
import { getIframeToken } from '@/utils/config';
import { getStoredEntityToken, normalizeEntityToken, persistEntityToken } from '@/utils/entityToken';
import { getValidStoredToken } from '@/utils/authTokens';
import { TENANT_ROUTE_PREFIXES } from '@/utils/tenantPaths';

interface UserData {
  id?: number;
  name?: string;
  email?: string;
  token?: string;
  plan?: string;
  rubro?: string;
  nombre_empresa?: string;
  logo_url?: string;
  picture?: string;
  tipo_chat?: 'pyme' | 'municipio';
  entityToken?: string;
  rol?: string;
  tenantSlug?: string;
  publicCartUrl?: string;
  publicCatalogUrl?: string;
  categoria_id?: number;
  categoria_ids?: number[];
  categorias?: { id: number; nombre?: string }[];
  widget_icon_url?: string;
  widget_animation?: string;
  latitud?: number;
  longitud?: number;
}

interface UserContextValue {
  user: UserData | null;
  setUser: (u: UserData | null) => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const UserContext = React.createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  refreshUser: async () => {},
  loading: false,
});

const PLACEHOLDER_SLUGS = new Set(['iframe', 'embed', 'widget']);

const sanitizeTenantSlug = (slug?: string | null) => {
  if (!slug || typeof slug !== 'string') return null;
  const normalized = slug.trim();
  if (!normalized) return null;
  return PLACEHOLDER_SLUGS.has(normalized.toLowerCase()) ? null : normalized;
};

const deriveTenantSlugFromUrl = (rawUrl?: string | null) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const url = new URL(rawUrl, 'http://localhost');
    const params = url.searchParams;
    const fromQuery = params.get('tenant') || params.get('tenant_slug') || params.get('endpoint');
    if (fromQuery?.trim()) {
      return fromQuery.trim();
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const tenantPrefixIndex = segments.findIndex((segment) =>
      TENANT_ROUTE_PREFIXES.includes(segment.toLowerCase() as typeof TENANT_ROUTE_PREFIXES[number]),
    );
    if (tenantPrefixIndex >= 0 && segments[tenantPrefixIndex + 1]) {
      return decodeURIComponent(segments[tenantPrefixIndex + 1]);
    }
  } catch (error) {
    console.warn('[useUser] No se pudo derivar tenantSlug desde URL pública', { rawUrl, error });
  }

  return null;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(() => {
    try {
      const hasEntity = safeLocalStorage.getItem('entityToken') || getIframeToken();
      const authToken = getValidStoredToken('authToken');
      const chatToken = getValidStoredToken('chatAuthToken');
      const activeToken = authToken || chatToken;
      const stored = safeLocalStorage.getItem('user');

      if (!activeToken && stored) {
        safeLocalStorage.removeItem('user');
        return null;
      }

      if (hasEntity && !activeToken) return null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const refreshUser = useCallback(async () => {
    const panelToken = getValidStoredToken('authToken');
    const chatToken = getValidStoredToken('chatAuthToken');
    const activeToken = panelToken ?? chatToken;
    const tokenKey: 'authToken' | 'chatAuthToken' | null = panelToken
      ? 'authToken'
      : chatToken
        ? 'chatAuthToken'
        : null;
    if (!activeToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<any>('/me', { omitTenant: true });
      const rubroNorm = parseRubro(data.rubro) || '';
      if (!data.tipo_chat) {
        console.warn('tipo_chat faltante en respuesta de /me');
      }
      if (!data.rol) {
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
        data?.tenant?.plan ?? data?.tenant_plan ?? data?.tenantPlan ?? data?.plan ?? 'free';
      const updated: UserData = {
        id: data.id,
        name: data.name,
        email: data.email,
        plan: resolvedPlan,
        rubro: rubroNorm,
        nombre_empresa: data.nombre_empresa,
        logo_url: data.logo_url,
        picture: data.picture,
        tipo_chat: finalTipo,
        rol: data.rol,
        token: activeToken,
        entityToken: normalizedEntityToken || storedEntityToken || undefined,
        tenantSlug: resolvedTenantSlug || undefined,
        publicCartUrl: normalizedPublicCartUrl,
        publicCatalogUrl: normalizedPublicCatalogUrl,
        categoria_id: Number.isFinite(data.categoria_id) ? Number(data.categoria_id) : undefined,
        categoria_ids: normalizeCategoryIds(data.categoria_ids),
        categorias: normalizedCategories,
        widget_icon_url: data.widget_icon_url,
        widget_animation: data.widget_animation,
        latitud: typeof data.latitud === 'number' ? data.latitud : Number(data.latitud),
        longitud: typeof data.longitud === 'number' ? data.longitud : Number(data.longitud),
      };
      if (resolvedTenantSlug) {
        safeLocalStorage.setItem('tenantSlug', resolvedTenantSlug);
      }
      safeLocalStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : (e as any)?.status;

      if (status === 401 || status === 403) {
        console.error('Auth error fetching user profile, logging out.', e);
        // If fetching the user fails due to auth, clear session to force re-login.
        safeLocalStorage.removeItem('user');
        if (tokenKey) {
          safeLocalStorage.removeItem(tokenKey);
        }
        setUser(null);
      } else {
        // Network or server errors shouldn't drop an otherwise valid session.
        console.warn('Transient error fetching user profile. Preserving session.', e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const lastRefreshTokenRef = React.useRef<string | null>(null);

  useEffect(() => {
    const token =
      getValidStoredToken('authToken') ||
      getValidStoredToken('chatAuthToken');
    if (token && token !== lastRefreshTokenRef.current) {
      lastRefreshTokenRef.current = token;
      refreshUser();
      return;
    }
    if (token && (!user || !user.rubro)) {
      refreshUser();
    }
  }, [refreshUser, user]);

  return (
    <UserContext.Provider value={{ user, setUser, refreshUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export function useUser() {
  return useContext(UserContext);
}
