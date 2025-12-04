import { PortalContent } from '@/data/portalDemoContent';

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
  // Note: We use a relative path assuming the vite proxy or base URL handles the domain.
  // We keep the old path structure /api/:tenantSlug/... for compatibility with existing proxy rules,
  // but strictly it should probably be /api/v1/portal/... in the future.

  // For now, let's try to hit the specific endpoint if it existed, or fallback to the generic one.
  // Given the user instruction, we want to "prepare" it.

  // Let's assume the backend will implement: /api/portal/:tenantSlug/content
  const url = `/api/portal/${tenantSlug}/content`;

  try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            // 'Authorization': `Bearer ${token}` // TODO: Add auth token when available
        },
        signal,
      });

      if (response.ok) {
        if (response.status === 204) return {};
        return (await response.json()) as PortalContentDTO;
      }
      // If 404, fallback to old or demo behavior (which catch block might handle or caller handles)
  } catch (e) {
      console.warn("Failed to fetch from primary portal endpoint, falling back or returning empty.", e);
  }

  // Fallback / Stub for now to allow UI development without real backend
  // In a real scenario, we might throw or return empty.
  // For this task, we want to simulate success if the backend isn't ready,
  // but the code above shows WHERE the backend should be connected.

  throw new Error('Backend connection not yet fully implemented. Using demo data.');
};
