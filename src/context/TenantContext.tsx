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
import { ApiError, getErrorMessage } from '@/utils/api';
import { ensureRemoteAnonId } from '@/utils/anonId';
import { normalizeEntityToken } from '@/utils/entityToken';
import { TENANT_PLACEHOLDER_SLUGS, TENANT_ROUTE_PREFIXES } from '@/constants/tenant';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { useTenantStore } from '@/stores';
import {
  isTenantSlugDeploymentHostnameMirror,
  readTenantSlugFromHostname,
} from '@/utils/tenantHostname';
import {
  persistWidgetTokenScope,
  resolveWidgetTokenForTenant,
} from '@/utils/widgetTokenScope';

const LOCAL_PLACEHOLDER_SLUGS = new Set([...TENANT_PLACEHOLDER_SLUGS, 'e']);

interface TenantContextValue {
  currentSlug: string | null;
  tenant: TenantPublicInfo | null;
  isLoadingTenant: boolean;
  tenantError: string | null;
  setTenantSlug: (slug: string) => void;
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
  public_base_url: null,
  public_cart_url: null,
  public_catalog_url: null,
  whatsapp_share_url: null,
};

const DEFAULT_TENANT_CONTEXT: TenantContextValue = {
  currentSlug: null,
  tenant: DEFAULT_TENANT_INFO,
  isLoadingTenant: false,
  tenantError: null,
  setTenantSlug: () => {},
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

const TENANT_PATH_REGEX = new RegExp(`^/(?:${TENANT_ROUTE_PREFIXES.join('|')}|demo)/([^/]+)`, 'i');
const PORTAL_SECTION_SEGMENTS = new Set([
  'dashboard',
  'catalogo',
  'pedidos',
  'reclamos',
  'noticias',
  'eventos',
  'beneficios',
  'encuestas',
  'cuenta',
  'tramites',
]);

const shouldLogTenantWarnings = () => {
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any)?.env : undefined;
  return Boolean(metaEnv?.DEV || metaEnv?.MODE === 'development');
};

const sanitizeTenantSlug = (slug?: string | null) => {
  if (!slug) return null;
  const normalized = slug.trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (
    LOCAL_PLACEHOLDER_SLUGS.has(lowered) ||
    lowered === 'localhost' ||
    lowered === '::1' ||
    /^\d+$/.test(lowered) ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(lowered)
  ) {
    return null;
  }
  return normalized;
};

const readTenantFromConfig = (): { slug: string | null; widgetToken: string | null } => {
  if (typeof window === 'undefined') return { slug: null, widgetToken: null };

  const cfg = (window as any).CHATBOC_CONFIG || {};
  const slug =
    cfg.tenant?.toString?.() ||
    cfg.tenantSlug?.toString?.() ||
    cfg.endpoint?.toString?.() ||
    null;

  const widgetToken = normalizeEntityToken(
    cfg.entityToken?.toString?.() || cfg.ownerToken?.toString?.() || cfg.widgetToken?.toString?.(),
  );

  if (slug || widgetToken) {
    return { slug: sanitizeTenantSlug(slug), widgetToken };
  }

  return { slug: null, widgetToken: null };
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

  // Handle direct tenant paths (e.g. /bodega/productos)
  // We exclude reserved prefixes
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0]?.toLowerCase() === 'portal' && segments[1] && !PORTAL_SECTION_SEGMENTS.has(segments[1].toLowerCase())) {
    try {
      return sanitizeTenantSlug(decodeURIComponent(segments[1]));
    } catch (error) {
      console.warn('[TenantContext] No se pudo decodificar el tenant del portal publico', error);
      return sanitizeTenantSlug(segments[1]);
    }
  }

  if (segments.length > 0) {
      const potentialSlug = segments[0];
      const reserved = new Set([...LOCAL_PLACEHOLDER_SLUGS, ...TENANT_ROUTE_PREFIXES, 'demo']);
      if (!reserved.has(potentialSlug.toLowerCase())) {
          return sanitizeTenantSlug(potentialSlug);
      }
  }

  if (search) {
    try {
      const params = new URLSearchParams(search);
      const fromQuery =
        params.get('tenant') || params.get('tenant_slug') || params.get('endpoint');
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
    const widgetToken = normalizeEntityToken(
      dataset.widgetToken?.trim() ||
        dataset.widget_token?.trim() ||
        dataset.ownerToken?.trim() ||
        null,
    );

    if (slug || widgetToken) {
      return { slug: slug ?? null, widgetToken };
    }
  }

  return { slug: null, widgetToken: null };
};

const readTenantFromSubdomain = (): string | null => {
  if (typeof window === 'undefined') return null;
  return readTenantSlugFromHostname(window.location.hostname);
};

const resolveTenantBootstrap = (
  pathname: string,
  search: string,
): { slug: string | null; widgetToken: string | null } => {
  const slugFromUrl = extractSlugFromLocation(pathname, search);
  const params = new URLSearchParams(search);
  const widgetTokenFromQuery = normalizeEntityToken(
    params.get('widget_token') ||
      params.get('token') ||
      params.get('entityToken') ||
      params.get('entity_token') ||
      params.get('ownerToken') ||
      params.get('owner_token'),
  );

  if (slugFromUrl || widgetTokenFromQuery) {
    const slug = sanitizeTenantSlug(slugFromUrl);
    return { slug, widgetToken: resolveWidgetTokenForTenant(widgetTokenFromQuery, slug) };
  }

  const fromConfig = readTenantFromConfig();
  if (fromConfig.slug || fromConfig.widgetToken) {
    return {
      slug: fromConfig.slug,
      widgetToken: resolveWidgetTokenForTenant(fromConfig.widgetToken, fromConfig.slug),
    };
  }

  const fromScripts = readTenantFromScripts();
  if (fromScripts.slug || fromScripts.widgetToken) {
    return {
      slug: fromScripts.slug,
      widgetToken: resolveWidgetTokenForTenant(fromScripts.widgetToken, fromScripts.slug),
    };
  }

  const storedSlugCandidate = sanitizeTenantSlug(safeLocalStorage.getItem('tenantSlug'));
  const storedSlug =
    typeof window !== 'undefined' &&
    isTenantSlugDeploymentHostnameMirror(storedSlugCandidate, window.location.hostname)
      ? null
      : storedSlugCandidate;

  if (storedSlugCandidate && !storedSlug) {
    safeLocalStorage.removeItem('tenantSlug');
  }

  if (storedSlug) {
    return { slug: storedSlug, widgetToken: null };
  }

  const subdomain = sanitizeTenantSlug(readTenantFromSubdomain());
  if (subdomain) {
    return { slug: subdomain, widgetToken: null };
  }

  return { slug: null, widgetToken: null };
};

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [tenant, setTenant] = useState<TenantPublicInfo | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [widgetToken, setWidgetToken] = useState<string | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [followedTenants, setFollowedTenants] = useState<TenantSummary[]>([]);
  const [isLoadingFollowedTenants, setIsLoadingFollowedTenants] = useState(false);
  const [followedTenantsError, setFollowedTenantsError] = useState<string | null>(null);
  const activeTenantRequest = useRef(0);
  const currentSlugRef = useRef<string | null>(null);

  const isRecoverableTenantError = useCallback((error: unknown) => {
    if (error instanceof ApiError) {
      // 404 must surface explicitly (no silent fallback to default tenant info).
      // Keep only structural/request-shape recoverables.
      return [400, 405].includes(error.status);
    }
    return false;
  }, []);

  const fetchTenant = useCallback(async (slug: string | null, token: string | null) => {
    const requestId = ++activeTenantRequest.current;
    setIsLoadingTenant(true);
    setTenantError(null);

    try {
      const info = await getTenantPublicInfoFlexible(slug, token);

      if (activeTenantRequest.current === requestId) {
        setTenant(info);
        if (info?.slug) {
           setCurrentSlug(info.slug);
           currentSlugRef.current = info.slug;
           useTenantStore.getState().setTenant(info.slug, info);
           if (token) {
             const scopedToken = resolveWidgetTokenForTenant(token, info.slug);
             if (scopedToken) {
               persistWidgetTokenScope(scopedToken, info.slug);
               setWidgetToken(scopedToken);
             } else {
               setWidgetToken(null);
             }
           }
        }
      }

    } catch (error) {
      if (activeTenantRequest.current === requestId) {
        const recoverable = isRecoverableTenantError(error);
        setTenant(DEFAULT_TENANT_INFO);
        setTenantError(recoverable ? null : getErrorMessage(error));

        if (recoverable) {
          setCurrentSlug(null);
          currentSlugRef.current = null;
          useTenantStore.getState().clearTenant();
        }

      }
      if (!isRecoverableTenantError(error)) {
        throw error;
      }
    } finally {
      if (activeTenantRequest.current === requestId) {
        setIsLoadingTenant(false);
      }
    }
  }, [isRecoverableTenantError]);

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
      useTenantStore.getState().clearTenant();
      return;
    }

    fetchTenant(slug, token ?? null).catch((error) => {
      if (shouldLogTenantWarnings()) {
        console.warn('[TenantContext] No se pudo cargar la información pública del tenant', error);
      }
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
    const sanitized = sanitizeTenantSlug(currentSlugRef.current);
    if (sanitized) {
      safeLocalStorage.setItem('tenantSlug', sanitized);
    } else {
      safeLocalStorage.removeItem('tenantSlug');
    }
  }, [currentSlug]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).currentTenantSlug = currentSlug ?? null;
  }, [currentSlug]);

  useEffect(() => {
    if (!tenant?.tema || typeof document === 'undefined') return;

    const theme = tenant?.tema as Record<string, unknown> || {};
    const root = document.documentElement;
    const colorEntries = Object.entries(theme)
      .filter(([key, value]) => typeof value === 'string' && key.toLowerCase().includes('color')) as [string, string][];

    const isTenantRoute =
      Boolean(tenant?.slug && location.pathname.startsWith(`/${tenant.slug}`)) ||
      TENANT_ROUTE_PREFIXES.some((prefix) => location.pathname.startsWith(`/${prefix}/`));

    // Skip theme injection on the landing/marketing pages to preserve SaaS branding
    // and avoid widget/theme config bleeding into the public site.
    if (!isTenantRoute) {
      colorEntries.forEach(([key]) => root.style.removeProperty(`--${key}`));
      return;
    }

    colorEntries.forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    return () => {
      colorEntries.forEach(([key]) => root.style.removeProperty(`--${key}`));
    };
  }, [tenant?.tema, location.pathname, tenant?.slug]);

  const refreshFollowedTenants = useCallback(async () => {
    if (!currentSlugRef.current && !widgetToken) {
      setFollowedTenants([]);
      setFollowedTenantsError(null);
      setIsLoadingFollowedTenants(false);
      return;
    }

    setIsLoadingFollowedTenants(true);
    setFollowedTenantsError(null);
    try {
      const items = await listFollowedTenants(currentSlugRef.current, widgetToken);
      setFollowedTenants(items);
    } catch (error) {
      setFollowedTenantsError(
        getErrorMessage(error, 'No se pudieron actualizar los espacios seguidos en este momento.'),
      );
    } finally {
      setIsLoadingFollowedTenants(false);
    }
  }, [widgetToken]);

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
    setTenantSlug: (slug: string) => {
        const sanitized = sanitizeTenantSlug(slug);
        setCurrentSlug(sanitized);
        currentSlugRef.current = sanitized;
        if (sanitized) safeLocalStorage.setItem('tenantSlug', sanitized);
        else safeLocalStorage.removeItem('tenantSlug');
    }
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
