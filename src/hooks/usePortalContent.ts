import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import type { ManagerOptions, SocketOptions } from 'socket.io-client';
import { useTenant } from '@/context/TenantContext';
import { demoPortalContent, PortalContent } from '@/data/portalDemoContent';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { fetchPortalContent, normalizePortalContent, PortalContentDTO } from '@/services/portalContentApi';
import { getSocketUrl, SOCKET_PATH } from '@/config';
import { safeOn } from '@/utils/safeOn';

const PORTAL_CACHE_KEY = 'chatboc_portal_cache';

const sanitizeSocketPath = (value?: string) => {
  const normalized = value?.trim().replace(/\/+$|\s+/g, '') || '/socket.io';
  if (!normalized) return '/socket.io';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const resolveSocketUrl = (): string | undefined => {
  const rawUrl = import.meta.env.VITE_SOCKET_URL || getSocketUrl();
  if (!rawUrl) {
    if (typeof window !== 'undefined') {
      return window.location.origin.replace(/^http/i, 'ws');
    }
    return undefined;
  }
  let trimmed = rawUrl.trim();
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^http/i, 'ws');
  return trimmed;
};

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

  useEffect(() => {
    if (!currentSlug) return;

    let socket: Socket | null = null;
    let active = true;

    const initSocket = () => {
      const socketUrl = resolveSocketUrl();
      const socketPath = sanitizeSocketPath(import.meta.env.VITE_SOCKET_PATH || SOCKET_PATH);

      const socketOptions: Partial<ManagerOptions & SocketOptions> = {
        transports: ['websocket'],
        path: socketPath,
        query: {
          tenant: currentSlug,
          tenant_slug: currentSlug,
          portal_user: 'true',
        },
      };

      socket = io(socketUrl ?? undefined, socketOptions);

      safeOn(socket, 'connect', () => {
        console.log('[Portal] Socket connected');
      });

      // Listen for content updates from the admin panel
      const handleUpdate = () => {
        if (active) {
          console.log('[Portal] Content update received, refreshing...');
          void query.refetch();
        }
      };

      safeOn(socket, 'tenant_content_update', handleUpdate);
      safeOn(socket, 'news_update', handleUpdate);
      safeOn(socket, 'events_update', handleUpdate);
      safeOn(socket, 'catalog_update', handleUpdate);
    };

    initSocket();

    return () => {
      active = false;
      if (socket) socket.disconnect();
    };
  }, [currentSlug, query]);

  return {
    content,
    isDemo,
    isLoading: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
};
