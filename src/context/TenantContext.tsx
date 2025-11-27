import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

import {
  followTenant as followTenantRequest,
  getTenantPublicInfoFlexible,
  listFollowedTenants,
  unfollowTenant as unfollowTenantRequest,
} from '@/api/tenant';
import type { TenantPublicInfo, TenantSummary } from '@/types/tenant';
import { getErrorMessage } from '@/utils/api';
import { ensureRemoteAnonId } from '@/utils/anonId';

interface TenantContextValue {
  currentSlug: string | null;
  tenant: TenantPublicInfo | null;
  isLoadingTenant: boolean;
  tenantError: string | null;
  refreshTenant: () => Promise<void>;
  widgetToken: string | null;
  followedTenants: TenantSummary[];
  isLoadingFollowedTenants: boolean;
  followedTenantsError: string | null;
  refreshFollowedTenants: () => Promise<void>;
  isCurrentTenantFollowed: boolean;
  followCurrentTenant: () => Promise<void>;
  unfollowCurrentTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const DEFAULT_TENANT_INFO: TenantPublicInfo = {
  slug: 'default',
  nombre: 'Chatboc',
  logo_url: null,
  tema: null,
  tipo: 'pyme',
  descripcion: null,
};

const DEFAULT_TENANT_CONTEXT: TenantContextValue = {
  currentSlug: null,
  tenant: DEFAULT_TENANT_INFO,
  isLoadingTenant: false,
  tenantError: null,
  refreshTenant: async () => {},
  widgetToken: null,
  followedTenants: [],
  isLoadingFollowedTenants: false,
  followedTenantsError: null,
  refreshFollowedTenants: async () => {},
  isCurrentTenantFollowed: false,
  followCurrentTenant: async () => {},
  unfollowCurrentTenant: async () => {},
};

const TENANT_PATH_REGEX = /^\/t\/([^/]+)/i;
const PLACEHOLDER_SLUGS = new Set(['iframe', 'embed', 'widget']);

const sanitizeTenantSlug = (slug?: string | null) => {
  if (!slug) return null;
  const normalized = slug.trim();
  if (!normalized) return null;
  return PLACEHOLDER_SLUGS.has(normalized.toLowerCase()) ? null : normalized;
};

const extractSlugFromLocation = (pathname: string, search: string): string | null => {
  const match = pathname.match(TENANT_PATH_REGEX);
  if (match && match[1]) {
    try {
      const decoded = decodeURIComponent(match[1]);
      return sanitizeTenantSlug(decoded);
    } catch (error) {
      console.warn('[TenantContext] No se pudo decodificar el slug de la URL', error);
      return match[1];
    }
  }

  if (search) {
    try {
      const params = new URLSearchParams(search);
      const fromQuery = params.get('tenant');
      return sanitizeTenantSlug(fromQuery);
    } catch (error) {
      console.warn('[TenantContext] No se pudo leer la query string para tenant', error);
    }
  }

  return null;
};

const readTenantFromScripts = (): { slug: string | null; widgetToken: string | null } => {
  if (typeof document === 'undefined') return { slug: null, widgetToken: null };

  const scripts = Array.from(document.querySelectorAll('script'));
  for (const script of scripts) {
    const dataset = (script as HTMLScriptElement).dataset;
    if (!dataset) continue;

    const slug = dataset.tenant?.trim() || dataset.tenantSlug?.trim() || null;
    const widgetToken =
      dataset.widgetToken?.trim() ||
      dataset.widget_token?.trim() ||
      dataset.ownerToken?.trim() ||
      null;

    if (slug || widgetToken) {
      return { slug: slug ?? null, widgetToken };
    }
  }

  return { slug: null, widgetToken: null };
};

const readTenantFromSubdomain = (): string | null => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (!host || host === 'localhost') return null;

  const segments = host.split('.');
  if (segments.length < 2) return null;

  const candidate = segments[0];
  if (!candidate || ['www', 'app', 'panel'].includes(candidate.toLowerCase())) return null;
  return candidate;
};

const resolveTenantBootstrap = (
  pathname: string,
  search: string,
): { slug: string | null; widgetToken: string | null } => {
  const slugFromUrl = extractSlugFromLocation(pathname, search);
  const params = new URLSearchParams(search);
  const widgetTokenFromQuery =
    params.get('widget_token') ||
    params.get('entityToken') ||
    params.get('entity_token') ||
    params.get('ownerToken') ||
    params.get('owner_token');

  if (slugFromUrl || widgetTokenFromQuery) {
    return { slug: sanitizeTenantSlug(slugFromUrl), widgetToken: widgetTokenFromQuery };
  }

  const fromScripts = readTenantFromScripts();
  if (fromScripts.slug || fromScripts.widgetToken) {
    return fromScripts;
  }

  return { slug: sanitizeTenantSlug(readTenantFromSubdomain()), widgetToken: null };
};

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [tenant, setTenant] = useState<TenantPublicInfo | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [widgetToken, setWidgetToken] = useState<string | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [followedTenants, setFollowedTenants] = useState<TenantSummary[]>([]);
  const [isLoadingFollowedTenants, setIsLoadingFollowedTenants] = useState(false);
  const [followedTenantsError, setFollowedTenantsError] = useState<string | null>(null);
  const activeTenantRequest = useRef(0);
  const currentSlugRef = useRef<string | null>(null);

  const fetchTenant = useCallback(async (slug: string | null, token: string | null) => {
    const requestId = ++activeTenantRequest.current;
    setIsLoadingTenant(true);
    setTenantError(null);

    try {
      const info = await getTenantPublicInfoFlexible(slug, token);
      if (activeTenantRequest.current === requestId) {
        setTenant(info);
        if (!currentSlugRef.current && info.slug) {
          setCurrentSlug(info.slug);
          currentSlugRef.current = info.slug;
        }
      }
    } catch (error) {
      if (activeTenantRequest.current === requestId) {
        setTenant(DEFAULT_TENANT_INFO);
        setTenantError(getErrorMessage(error));
      }
      throw error;
    } finally {
      if (activeTenantRequest.current === requestId) {
        setIsLoadingTenant(false);
      }
    }
  }, []);

  useEffect(() => {
    const { slug, widgetToken: token } = resolveTenantBootstrap(location.pathname, location.search);
    currentSlugRef.current = slug;
    setCurrentSlug(slug);
    setWidgetToken(token ?? null);

    if (!slug && !token) {
      activeTenantRequest.current += 1;
      setTenant(DEFAULT_TENANT_INFO);
      setTenantError(null);
      setIsLoadingTenant(false);
      return;
    }

    fetchTenant(slug, token ?? null).catch((error) => {
      console.warn('[TenantContext] No se pudo cargar la información pública del tenant', error);
    });
  }, [fetchTenant, location.pathname, location.search]);

  const refreshTenant = useCallback(async () => {
    if (!currentSlugRef.current && !widgetToken) return;
    try {
      await fetchTenant(currentSlugRef.current, widgetToken);
    } catch {
      // el estado ya quedó manejado por fetchTenant
    }
  }, [fetchTenant, widgetToken]);

  useEffect(() => {
    ensureRemoteAnonId({ tenantSlug: currentSlugRef.current, widgetToken }).catch((error) => {
      console.warn('[TenantContext] No se pudo asegurar anon_id remoto', error);
    });
  }, [widgetToken]);

  useEffect(() => {
    if (!tenant?.tema || typeof document === 'undefined') return;

    const theme = tenant.tema as Record<string, unknown>;
    const root = document.documentElement;
    const colorEntries = Object.entries(theme)
      .filter(([key, value]) => typeof value === 'string' && key.toLowerCase().includes('color')) as [string, string][];

    colorEntries.forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    return () => {
      colorEntries.forEach(([key]) => root.style.removeProperty(`--${key}`));
    };
  }, [tenant?.tema]);

  const refreshFollowedTenants = useCallback(async () => {
    setIsLoadingFollowedTenants(true);
    setFollowedTenantsError(null);
    try {
      const items = await listFollowedTenants();
      setFollowedTenants(items);
    } catch (error) {
      setFollowedTenantsError(
        getErrorMessage(error, 'No se pudieron actualizar los espacios seguidos en este momento.'),
      );
    } finally {
      setIsLoadingFollowedTenants(false);
    }
  }, []);

  useEffect(() => {
    refreshFollowedTenants().catch((error) => {
      console.warn('[TenantContext] No se pudo cargar la lista inicial de tenants seguidos', error);
    });
  }, [refreshFollowedTenants]);

  const isCurrentTenantFollowed = useMemo(() => {
    const slug = tenant?.slug ?? currentSlug;
    if (!slug) return false;
    return followedTenants.some((item) => item.slug === slug);
  }, [currentSlug, followedTenants, tenant?.slug]);

  const followCurrentTenant = useCallback(async () => {
    if (!currentSlugRef.current) {
      throw new Error('No hay un espacio seleccionado para seguir.');
    }
    await followTenantRequest(currentSlugRef.current);
    await refreshFollowedTenants();
  }, [refreshFollowedTenants]);

  const unfollowCurrentTenant = useCallback(async () => {
    if (!currentSlugRef.current) {
      throw new Error('No hay un espacio seleccionado para dejar de seguir.');
    }
    await unfollowTenantRequest(currentSlugRef.current);
    await refreshFollowedTenants();
  }, [refreshFollowedTenants]);

  const value = useMemo<TenantContextValue>(() => ({
    currentSlug,
    tenant: tenant ?? DEFAULT_TENANT_INFO,
    isLoadingTenant,
    tenantError,
    refreshTenant,
    widgetToken,
    followedTenants,
    isLoadingFollowedTenants,
    followedTenantsError,
    refreshFollowedTenants,
    isCurrentTenantFollowed,
    followCurrentTenant,
    unfollowCurrentTenant,
  }), [
    currentSlug,
    tenant,
    isLoadingTenant,
    tenantError,
    refreshTenant,
    widgetToken,
    followedTenants,
    isLoadingFollowedTenants,
    followedTenantsError,
    refreshFollowedTenants,
    isCurrentTenantFollowed,
    followCurrentTenant,
    unfollowCurrentTenant,
  ]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    console.warn(
      '[TenantContext] useTenant utilizado fuera de TenantProvider. Se devolverá un valor por defecto.',
    );
    return DEFAULT_TENANT_CONTEXT;
  }
  return context;
};

// Permite detectar si ya existe un TenantProvider en el árbol sin devolver el valor por defecto.
export const useTenantContextPresence = () => useContext(TenantContext);
