import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { demoPortalContent, PortalContent } from '@/data/portalDemoContent';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { fetchPortalContent, normalizePortalContent, PortalContentDTO } from '@/services/portalContentApi';

const PORTAL_CACHE_KEY = 'chatboc_portal_cache';

const persistContent = (content: PortalContentDTO) => {
  try {
    safeLocalStorage.setItem(PORTAL_CACHE_KEY, JSON.stringify(content));
  } catch {
    // Ignore cache write errors
  }
};

const readCachedContent = (): PortalContentDTO | null => {
  try {
    const raw = safeLocalStorage.getItem(PORTAL_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PortalContentDTO;
  } catch {
    return null;
  }
};

const mergePortalContent = (source?: PortalContentDTO | null): PortalContent => {
  const normalized = normalizePortalContent(source ?? undefined);

  return {
    notifications: normalized.notifications.length ? normalized.notifications : demoPortalContent.notifications,
    events: normalized.events.length ? normalized.events : demoPortalContent.events,
    news: normalized.news.length ? normalized.news : demoPortalContent.news,
    catalog: normalized.catalog.length ? normalized.catalog : demoPortalContent.catalog,
    activities: normalized.activities.length ? normalized.activities : demoPortalContent.activities,
    surveys: normalized.surveys.length ? normalized.surveys : demoPortalContent.surveys,
    loyaltySummary: normalized.loyaltySummary,
  } satisfies PortalContent;
};

export const usePortalContent = () => {
  const { currentSlug } = useTenant();
  const cached = useMemo(() => readCachedContent(), []);

  const query = useQuery<PortalContentDTO>({
    queryKey: ['portal-content', currentSlug],
    queryFn: ({ signal }) => fetchPortalContent(currentSlug!, signal),
    enabled: Boolean(currentSlug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    placeholderData: cached ?? demoPortalContent,
    onSuccess: (data) => persistContent(data),
  });

  const content = useMemo(() => {
    const merged = mergePortalContent(query.data ?? cached ?? demoPortalContent);
    if (!merged.loyaltySummary) {
      return { ...merged, loyaltySummary: getDemoLoyaltySummary() };
    }
    return merged;
  }, [cached, query.data]);
  const isDemo = query.isPlaceholderData || !query.data;

  return {
    content,
    isDemo,
    isLoading: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};
