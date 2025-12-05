import { PortalContent, demoPortalContent } from '@/data/portalDemoContent';

export type PortalContentDTO = Partial<PortalContent> & {
  tenantSlug?: string;
  lastUpdatedAt?: string;
};

const sanitizeArray = <T>(value: unknown, fallback: T[] = []): T[] => {
  return Array.isArray(value) ? (value as T[]) : fallback;
};

export const normalizePortalContent = (payload?: PortalContentDTO): PortalContent => {
  const base = payload ?? {};

  return {
    notifications: sanitizeArray(base.notifications),
    events: sanitizeArray(base.events),
    news: sanitizeArray(base.news),
    catalog: sanitizeArray(base.catalog),
    activities: sanitizeArray(base.activities),
    surveys: sanitizeArray(base.surveys),
    loyaltySummary: base.loyaltySummary,
  };
};

export const fetchPortalContent = async (
  tenantSlug: string,
  signal?: AbortSignal,
): Promise<PortalContentDTO> => {
  // This endpoint corresponds to the Requirement 1 in BACKEND_REQUIREMENTS.md
  // GET /api/v1/portal/:tenant_id/content
  const url = `/api/portal/${tenantSlug}/content`;

  try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        signal,
      });

      if (response.ok) {
        if (response.status === 204) return {};
        return (await response.json()) as PortalContentDTO;
      }

      console.warn(`[Portal] API fetch failed for ${url} (Status: ${response.status}). Using demo content.`);
      return demoPortalContent;

  } catch (e) {
      console.warn(`[Portal] Network error fetching ${url}. Using demo content.`, e);
      return demoPortalContent;
  }
};
