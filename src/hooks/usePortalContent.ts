import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { apiClient } from '@/api/client'; // Use the central client
import { getDemoPortalContent } from '@/data/portalDemoContent';
import { PortalContent, PortalPremiumBundle } from '@/types/unified';
import { mergePortalExperience } from '@/utils/portalExperience';

export function usePortalContent() {
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const [content, setContent] = useState<PortalContent>(() => getDemoPortalContent());
  const [isLoading, setIsLoading] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [bundle, setBundle] = useState<PortalPremiumBundle | null>(null);

  const fetchContent = useCallback(async () => {
    if (!currentSlug) return;

    setIsLoading(true);
    setIsDemo(false);
    setError(null);

    try {
      const includeNetwork = true;
      const [contentResponse, historyResponse, feedResponse, benefitsResponse, dashboardResponse, surveysResponse, bundleResponse] = await Promise.allSettled([
        apiClient.getPortalContent(currentSlug),
        apiClient.getPortalHistory(currentSlug, includeNetwork),
        apiClient.getPortalNetworkFeed(currentSlug),
        apiClient.getPortalBenefits(currentSlug),
        apiClient.getPortalDashboard(currentSlug, includeNetwork),
        apiClient.getPortalSurveysHistory(currentSlug, includeNetwork),
        apiClient.getPortalPremiumBundle(currentSlug),
      ]);

      if (contentResponse.status !== 'fulfilled') {
        throw contentResponse.reason;
      }

      const merged = mergePortalExperience(
        contentResponse.value,
        historyResponse.status === 'fulfilled' ? historyResponse.value : null,
        feedResponse.status === 'fulfilled' ? feedResponse.value : null,
        benefitsResponse.status === 'fulfilled' ? benefitsResponse.value : null,
        dashboardResponse.status === 'fulfilled' ? dashboardResponse.value : null,
        surveysResponse.status === 'fulfilled' ? surveysResponse.value : null,
      );

      setContent(merged);
      setBundle(bundleResponse.status === 'fulfilled' ? bundleResponse.value : null);
    } catch (err: any) {
      console.warn('Failed to fetch portal content, falling back to demo', err);
      setIsDemo(true);
      setError(err);
      setContent(getDemoPortalContent());
      setBundle(null);
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
    bundle,
    isLoading,
    isDemo,
    error,
    refetch: fetchContent,
  };
}
