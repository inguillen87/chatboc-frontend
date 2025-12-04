import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { demoPortalContent, PortalContent } from '@/data/portalDemoContent';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const PORTAL_CACHE_KEY = 'chatboc_portal_cache';

const persistContent = (content: PortalContent) => {
  try {
    safeLocalStorage.setItem(PORTAL_CACHE_KEY, JSON.stringify(content));
  } catch {
    // Ignore cache write errors
  }
};

const readCachedContent = (): PortalContent | null => {
  try {
    const raw = safeLocalStorage.getItem(PORTAL_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PortalContent;
  } catch {
    return null;
  }
};

const fetchPortalContent = async (tenantSlug: string): Promise<PortalContent> => {
  const params = new URLSearchParams({ tenant_slug: tenantSlug, tenant: tenantSlug });
  const response = await fetch(`/api/${tenantSlug}/portal-content?${params.toString()}`);

  if (!response.ok) {
    throw new Error('No se pudo obtener el contenido del portal');
  }

  const data = await response.json();
  persistContent(data);
  return data as PortalContent;
};

export const usePortalContent = () => {
  const { currentSlug } = useTenant();
  const cached = useMemo(() => readCachedContent(), []);

  const query = useQuery({
    queryKey: ['portal-content', currentSlug],
    queryFn: () => fetchPortalContent(currentSlug!),
    enabled: Boolean(currentSlug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: cached ?? demoPortalContent,
  });

  const content = query.data ?? cached ?? demoPortalContent;
  const isDemo = !query.data;

  return {
    content,
    isDemo,
    isLoading: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};
