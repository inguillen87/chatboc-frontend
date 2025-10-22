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
  getTenantPublicInfo,
  listFollowedTenants,
  unfollowTenant as unfollowTenantRequest,
} from '@/api/tenant';
import type { TenantPublicInfo, TenantSummary } from '@/types/tenant';
import { getErrorMessage } from '@/utils/api';

interface TenantContextValue {
  currentSlug: string | null;
  tenant: TenantPublicInfo | null;
  isLoadingTenant: boolean;
  tenantError: string | null;
  refreshTenant: () => Promise<void>;
  followedTenants: TenantSummary[];
  isLoadingFollowedTenants: boolean;
  followedTenantsError: string | null;
  refreshFollowedTenants: () => Promise<void>;
  isCurrentTenantFollowed: boolean;
  followCurrentTenant: () => Promise<void>;
  unfollowCurrentTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const TENANT_PATH_REGEX = /^\/t\/([^/]+)/i;

const extractSlugFromLocation = (pathname: string, search: string): string | null => {
  const match = pathname.match(TENANT_PATH_REGEX);
  if (match && match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch (error) {
      console.warn('[TenantContext] No se pudo decodificar el slug de la URL', error);
      return match[1];
    }
  }

  if (search) {
    try {
      const params = new URLSearchParams(search);
      const fromQuery = params.get('tenant');
      return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
    } catch (error) {
      console.warn('[TenantContext] No se pudo leer la query string para tenant', error);
    }
  }

  return null;
};

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [tenant, setTenant] = useState<TenantPublicInfo | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [followedTenants, setFollowedTenants] = useState<TenantSummary[]>([]);
  const [isLoadingFollowedTenants, setIsLoadingFollowedTenants] = useState(false);
  const [followedTenantsError, setFollowedTenantsError] = useState<string | null>(null);
  const activeTenantRequest = useRef(0);
  const currentSlugRef = useRef<string | null>(null);

  const fetchTenant = useCallback(async (slug: string) => {
    const requestId = ++activeTenantRequest.current;
    setIsLoadingTenant(true);
    setTenantError(null);

    try {
      const info = await getTenantPublicInfo(slug);
      if (activeTenantRequest.current === requestId) {
        setTenant(info);
      }
    } catch (error) {
      if (activeTenantRequest.current === requestId) {
        setTenant(null);
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
    const slug = extractSlugFromLocation(location.pathname, location.search);
    currentSlugRef.current = slug;
    setCurrentSlug(slug);

    if (!slug) {
      activeTenantRequest.current += 1;
      setTenant(null);
      setTenantError(null);
      setIsLoadingTenant(false);
      return;
    }

    fetchTenant(slug).catch((error) => {
      console.warn('[TenantContext] No se pudo cargar la información pública del tenant', error);
    });
  }, [fetchTenant, location.pathname, location.search]);

  const refreshTenant = useCallback(async () => {
    if (!currentSlugRef.current) return;
    try {
      await fetchTenant(currentSlugRef.current);
    } catch {
      // el estado ya quedó manejado por fetchTenant
    }
  }, [fetchTenant]);

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
    tenant,
    isLoadingTenant,
    tenantError,
    refreshTenant,
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
    throw new Error('useTenant debe utilizarse dentro de un TenantProvider.');
  }
  return context;
};
