import { panelApi } from '@/api/v2/client';
import type { AnalyticsOverview } from './analyticsTypes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeOverview = (response: unknown): AnalyticsOverview => {
  const source = isRecord(response) && isRecord(response.summary) ? response.summary : response;
  if (!isRecord(source)) return {};

  return {
    conversations: asNumber(source.conversations ?? source.conversaciones),
    open_tickets: asNumber(source.open_tickets ?? source.tickets_abiertos),
    overdue_tickets: asNumber(source.overdue_tickets ?? source.tickets_vencidos),
    response_time: asNumber(source.response_time ?? source.first_response_time ?? source.frt),
    survey_responses: asNumber(source.survey_responses ?? source.respuestas_encuestas),
    nps: asNumber(source.nps),
    csat: asNumber(source.csat),
    handoff_rate: asNumber(source.handoff_rate),
  };
};

export const getAnalyticsOverviewV2 = async (tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>('/api/v2/analytics/overview', {
    tenantSlug,
    legacyFallbackPath: '/analytics/overview',
  });
  return normalizeOverview(response);
};
