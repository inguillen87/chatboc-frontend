import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { apiClient } from '@/api/client'; // Use the central client
import { getDemoPortalContent } from '@/data/portalDemoContent';
import { PortalContent } from '@/types/unified';
import { mergePortalExperience } from '@/utils/portalExperience';

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
      const [contentResponse, historyResponse, feedResponse, benefitsResponse] = await Promise.allSettled([
        apiClient.getPortalContent(currentSlug),
        apiClient.getPortalHistory(currentSlug),
        apiClient.getPortalNetworkFeed(currentSlug),
        apiClient.getPortalBenefits(currentSlug),
      ]);

      if (contentResponse.status !== 'fulfilled') {
        throw contentResponse.reason;
      }

      const merged = mergePortalExperience(
        contentResponse.value,
        historyResponse.status === 'fulfilled' ? historyResponse.value : null,
        feedResponse.status === 'fulfilled' ? feedResponse.value : null,
        benefitsResponse.status === 'fulfilled' ? benefitsResponse.value : null,
      );

      setContent(merged);
    } catch (err: any) {
      console.warn('Failed to fetch portal content, falling back to demo', err);
      setIsDemo(true);
      setError(err);
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
