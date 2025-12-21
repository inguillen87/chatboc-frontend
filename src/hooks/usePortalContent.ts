import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { apiClient } from '@/api/client'; // Use the central client
import { getDemoPortalContent } from '@/data/portalDemoContent';
import { PortalContent } from '@/types/unified';

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
      // Use apiClient to ensure consistent logic (prefix handling etc.)
      const data = await apiClient.getPortalContent(currentSlug);
      setContent(data);
    } catch (err: any) {
      console.warn('Failed to fetch portal content, falling back to demo', err);
      setIsDemo(true);
      setError(err);
      // Fallback to demo data on error (e.g. 404 or network error)
      setContent(getDemoPortalContent());
    } finally {
      setIsLoading(false);
    }
  }, [currentSlug]);

  useEffect(() => {
    if (currentSlug) {
      fetchContent();
    }
  }, [currentSlug, fetchContent, user]);

  return {
    content,
    isLoading,
    isDemo,
    error,
    refetch: fetchContent,
  };
}
