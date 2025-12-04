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
  const params = new URLSearchParams({ tenant_slug: tenantSlug, tenant: tenantSlug });
  const response = await fetch(`/api/${tenantSlug}/portal-content?${params.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw new Error('No se pudo obtener el contenido del portal');
  }

  if (response.status === 204) {
    return {};
  }

  return (await response.json()) as PortalContentDTO;
};
