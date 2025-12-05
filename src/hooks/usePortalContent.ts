import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { apiFetch } from '@/utils/api';
import { getDemoPortalContent } from '@/data/portalDemoContent';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

// Define unified content structure
export interface PortalNotification {
  id: string;
  title: string;
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  actionLabel?: string;
  actionHref?: string;
  date?: string;
}

export interface PortalEvent {
  id: string;
  title: string;
  date?: string;
  location?: string;
  status?: string; // e.g. 'inscripcion', 'proximo', 'finalizado'
  description?: string;
  spots?: number;
  registered?: number;
  coverUrl?: string;
  link?: string;
}

export interface PortalNews {
  id: string;
  title: string;
  category?: string;
  date?: string;
  summary?: string;
  featured?: boolean;
  coverUrl?: string;
  link?: string;
}

export interface PortalCatalogItem {
  id: string;
  title: string;
  description?: string;
  category?: string; // 'beneficios', 'tramites', 'productos'
  priceLabel?: string;
  price?: number;
  status?: string;
  imageUrl?: string;
  link?: string;
}

export interface PortalActivity {
  id: string;
  description: string;
  type?: string;
  status?: string;
  statusType?: 'info' | 'success' | 'warning' | 'error';
  date?: string;
  link?: string;
}

export interface PortalSurvey {
  id: string;
  title: string;
  link?: string;
}

export interface PortalLoyaltySummary {
  points: number;
  level: string;
  surveysCompleted: number;
  suggestionsShared: number;
  claimsFiled: number;
}

export interface PortalContent {
  notifications: PortalNotification[];
  events: PortalEvent[];
  news: PortalNews[];
  catalog: PortalCatalogItem[];
  activities: PortalActivity[];
  surveys: PortalSurvey[];
  loyaltySummary: PortalLoyaltySummary | null;
}

export function usePortalContent() {
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const [content, setContent] = useState<PortalContent>(() => getDemoPortalContent());
  const [isLoading, setIsLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fetchContent = useCallback(async () => {
    if (!currentSlug) return;

    setIsLoading(true);
    setIsDemo(false);
    setError(null);

    try {
      // Intentionally using a generic endpoint that aggregates data
      const data = await apiFetch<PortalContent>(`/api/portal/${currentSlug}/content`, {
        tenantSlug: currentSlug,
        suppressPanel401Redirect: true, // Don't force logout on portal
      });

      setContent(data);
    } catch (err: any) {
      console.warn('Failed to fetch portal content, falling back to demo', err);
      // Only fallback if not a severe auth error?
      // Actually for the portal we want resilience.
      setIsDemo(true);
      setError(err);
      // In a real app, we might merge demo data with partial real data if available
      // but here we just replace it.
      // We could also check if it's a 404 or 500.
      setContent(getDemoPortalContent());
    } finally {
      setIsLoading(false);
    }
  }, [currentSlug]);

  useEffect(() => {
    // If we have a user and tenant, try to fetch real data
    if (currentSlug) {
      fetchContent();
    }
  }, [currentSlug, fetchContent, user]); // Refetch if user changes (login/logout)

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
    isLoading,
    isDemo,
    error,
    refetch: fetchContent,
  };
}
