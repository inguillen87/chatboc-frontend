import type { Order, PortalActivity, PortalContent, PortalLoyaltySummary, PortalNews, PortalSurvey } from '@/types/unified';

const toIsoString = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
};

const toStatusType = (status?: string): PortalActivity['statusType'] => {
  const normalized = String(status || '').toLowerCase();
  if (['delivered', 'entregado', 'resolved', 'resuelto'].includes(normalized)) return 'success';
  if (['cancelled', 'rechazado', 'error'].includes(normalized)) return 'error';
  if (['pending', 'en revision', 'preparing', 'en proceso'].includes(normalized)) return 'warning';
  return 'info';
};

export const mapPortalOrders = (rawOrders: any): Order[] => {
  if (!Array.isArray(rawOrders)) return [];

  return rawOrders
    .map((order: any) => {
      const id = order?.id ?? order?.order_id ?? order?.nro_pedido;
      const status = order?.status ?? order?.estado;
      if (!id || !status) return null;
      return {
        id,
        total: Number(order?.total ?? order?.monto_total ?? 0),
        status: String(status) as Order['status'],
        items: Array.isArray(order?.items) ? order.items : [],
        created_at: toIsoString(order?.created_at ?? order?.date) ?? '',
        updated_at: toIsoString(order?.updated_at ?? order?.tracking?.eta),
        notes: order?.tracking?.latest_event ?? order?.status_label,
      };
    })
    .filter((order): order is Order => Boolean(order));
};

export const mapHistoryToActivities = (historyResponse: any): PortalActivity[] => {
  const timeline = Array.isArray(historyResponse?.timeline) ? historyResponse.timeline : [];

  return timeline
    .map((entry: any, idx: number) => {
      const type = typeof entry?.type === 'string' ? entry.type : undefined;
      const status = typeof entry?.status === 'string'
        ? entry.status
        : typeof entry?.stage === 'string'
          ? entry.stage
          : undefined;
      const label = entry?.title || entry?.label || entry?.description;
      if (!label) return null;

      return {
        id: String(entry?.id ?? `${type || 'activity'}-${idx}`),
        description: String(label),
        type,
        status,
        statusType: toStatusType(status),
        date: toIsoString(entry?.at ?? entry?.date),
        link: entry?.link,
      };
    })
    .filter((entry): entry is PortalActivity => Boolean(entry));
};

export const mapNetworkFeedToNews = (feedResponse: any): PortalNews[] => {
  const items = Array.isArray(feedResponse?.items) ? feedResponse.items : [];

  return items
    .map((item: any, idx: number) => {
      const title = item?.title || item?.name || item?.label;
      if (!title) return null;
      return {
        id: String(item?.id ?? item?.slug ?? `feed-${idx}`),
        title: String(title),
        category: item?.type ? String(item.type) : undefined,
        date: toIsoString(item?.date),
        summary: item?.summary || item?.tenant?.name,
        link: item?.link,
      };
    })
    .filter((item): item is PortalNews => Boolean(item));
};

export const mapSurveysHistory = (surveysResponse: any): PortalSurvey[] => {
  const raw = Array.isArray(surveysResponse)
    ? surveysResponse
    : Array.isArray(surveysResponse?.surveys)
      ? surveysResponse.surveys
      : Array.isArray(surveysResponse?.items)
        ? surveysResponse.items
        : [];

  return raw
    .map((survey: any, idx: number) => {
      const title = survey?.title ?? survey?.name ?? survey?.label;
      if (!title) return null;
      return {
        id: String(survey?.id ?? survey?.slug ?? `survey-${idx}`),
        title: String(title),
        link: survey?.link,
      };
    })
    .filter((survey): survey is PortalSurvey => Boolean(survey));
};

export const mapBenefitsToLoyaltySummary = (
  benefitsResponse: any,
  historyResponse: any,
): PortalLoyaltySummary | null => {
  const rawPoints = benefitsResponse?.current_points ?? benefitsResponse?.points ?? historyResponse?.summary?.points;
  const points = rawPoints === undefined || rawPoints === null ? undefined : Number(rawPoints);
  const counts = historyResponse?.summary?.counts || {};
  const rewards = Array.isArray(benefitsResponse?.benefits)
    ? benefitsResponse.benefits
        .map((benefit: any, idx: number) => {
          const title = benefit?.title ?? benefit?.name;
          if (!title) return null;
          return {
            id: String(benefit?.id ?? `benefit-${idx}`),
            title: String(title),
            cost: Number(benefit?.points_cost ?? benefit?.cost ?? 0),
            type: benefit?.eligible ? 'available' : 'locked',
            description: benefit?.description,
          };
        })
        .filter(Boolean) as PortalLoyaltySummary['availableRewards']
    : [];

  if (points === undefined && rewards.length === 0 && !counts?.surveys && !counts?.suggestions && !counts?.claims) {
    return null;
  }

  return {
    points: Number.isFinite(points) ? points! : 0,
    level: String(benefitsResponse?.level ?? historyResponse?.summary?.level ?? ''),
    surveysCompleted: Number(counts?.surveys ?? 0),
    suggestionsShared: Number(counts?.suggestions ?? 0),
    claimsFiled: Number(counts?.claims ?? 0),
    availableRewards: rewards,
  };
};

export const mergePortalExperience = (
  content: PortalContent,
  historyResponse: any,
  feedResponse: any,
  benefitsResponse: any,
  dashboardResponse: any,
  surveysResponse: any,
): PortalContent => {
  const mappedActivities = mapHistoryToActivities(historyResponse);
  const mappedNews = mapNetworkFeedToNews(feedResponse);
  const mappedLoyaltySummary = mapBenefitsToLoyaltySummary(benefitsResponse, historyResponse);
  const mappedSurveys = mapSurveysHistory(surveysResponse);
  const dashboardSummary = dashboardResponse?.summary || {};
  const benefits = Array.isArray(benefitsResponse?.benefits) ? benefitsResponse.benefits : [];
  const mappedBenefits = benefits
    .map((benefit: any, idx: number) => {
      const title = benefit?.title ?? benefit?.name;
      if (!title) return null;
      const pointsCost = benefit?.points_cost ?? benefit?.cost;
      return {
        id: String(benefit?.id ?? `benefit-${idx}`),
        title: String(title),
        description: benefit?.description,
        category: 'beneficios',
        status: benefit?.eligible ? 'Disponible' : 'Bloqueado',
        price: pointsCost === undefined ? undefined : Number(pointsCost),
        priceLabel: pointsCost === undefined ? undefined : `${Number(pointsCost)} pts`,
        link: benefit?.link,
      };
    })
    .filter(Boolean);

  return {
    ...content,
    activities: mappedActivities.length > 0 ? mappedActivities : content.activities,
    news: mappedNews.length > 0 ? mappedNews : content.news,
    catalog: mappedBenefits.length > 0 ? (mappedBenefits as PortalContent['catalog']) : content.catalog,
    surveys: mappedSurveys.length > 0 ? mappedSurveys : content.surveys,
    loyaltySummary: mappedLoyaltySummary
      ? {
          ...mappedLoyaltySummary,
          claimsFiled: Number(dashboardSummary?.claims ?? mappedLoyaltySummary.claimsFiled ?? 0),
          surveysCompleted: Number(dashboardSummary?.surveys ?? mappedLoyaltySummary.surveysCompleted ?? 0),
        }
      : content.loyaltySummary,
    notifications: content.notifications,
  };
};
