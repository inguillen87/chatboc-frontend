import type { Order, PortalActivity, PortalContent, PortalLoyaltySummary, PortalNews } from '@/types/unified';

const toIsoString = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
};

const toStatusType = (status?: string): PortalActivity['statusType'] => {
  const normalized = String(status || '').toLowerCase();
  if (['delivered', 'entregado', 'resolved', 'resuelto'].includes(normalized)) return 'success';
  if (['cancelled', 'rechazado', 'error'].includes(normalized)) return 'error';
  if (['pending', 'en revisión', 'preparing', 'en proceso'].includes(normalized)) return 'warning';
  return 'info';
};

export const mapPortalOrders = (rawOrders: any): Order[] => {
  if (!Array.isArray(rawOrders)) return [];

  return rawOrders.map((order: any, idx: number) => ({
    id: order?.id ?? `order-${idx}`,
    total: Number(order?.total ?? 0),
    status: String(order?.status ?? 'pending') as Order['status'],
    items: Array.isArray(order?.items) ? order.items : [],
    created_at: toIsoString(order?.created_at ?? order?.date),
    updated_at: toIsoString(order?.updated_at ?? order?.tracking?.eta),
    notes: order?.tracking?.latest_event ?? order?.status_label,
  }));
};

export const mapHistoryToActivities = (historyResponse: any): PortalActivity[] => {
  const timeline = Array.isArray(historyResponse?.timeline) ? historyResponse.timeline : [];

  return timeline.map((entry: any, idx: number) => {
    const type = String(entry?.type ?? 'actividad');
    const status = String(entry?.status ?? entry?.stage ?? '');
    const label =
      entry?.title ||
      entry?.label ||
      entry?.description ||
      `${type}${status ? ` · ${status}` : ''}`;

    return {
      id: String(entry?.id ?? `${type}-${idx}`),
      description: String(label),
      type,
      status,
      statusType: toStatusType(status),
      date: toIsoString(entry?.at ?? entry?.date),
      link: entry?.link,
    };
  });
};

export const mapNetworkFeedToNews = (feedResponse: any): PortalNews[] => {
  const items = Array.isArray(feedResponse?.items) ? feedResponse.items : [];

  return items.map((item: any, idx: number) => ({
    id: String(item?.id ?? `feed-${idx}`),
    title: String(item?.title ?? 'Novedad'),
    category: String(item?.type ?? 'news'),
    date: toIsoString(item?.date),
    summary: item?.summary || item?.tenant?.name,
    link: item?.link,
  }));
};

export const mapBenefitsToLoyaltySummary = (benefitsResponse: any, historyResponse: any): PortalLoyaltySummary => {
  const points = Number(benefitsResponse?.current_points ?? 0);
  const counts = historyResponse?.summary?.counts || {};

  return {
    points,
    level: points >= 500 ? 'Gold' : points >= 200 ? 'Silver' : 'Bronze',
    surveysCompleted: Number(counts?.surveys ?? 0),
    suggestionsShared: Number(counts?.suggestions ?? 0),
    claimsFiled: Number(counts?.claims ?? 0),
    availableRewards: Array.isArray(benefitsResponse?.benefits)
      ? benefitsResponse.benefits.map((benefit: any, idx: number) => ({
          id: String(benefit?.id ?? `benefit-${idx}`),
          title: String(benefit?.title ?? benefit?.name ?? 'Beneficio'),
          cost: Number(benefit?.points_cost ?? benefit?.cost ?? 0),
          type: benefit?.eligible ? 'available' : 'locked',
          description: benefit?.description,
        }))
      : [],
  };
};

export const mergePortalExperience = (
  content: PortalContent,
  historyResponse: any,
  feedResponse: any,
  benefitsResponse: any,
): PortalContent => {
  const mappedActivities = mapHistoryToActivities(historyResponse);
  const mappedNews = mapNetworkFeedToNews(feedResponse);
  const mappedOrders = mapPortalOrders(historyResponse?.orders);
  const mappedLoyaltySummary = mapBenefitsToLoyaltySummary(benefitsResponse, historyResponse);

  return {
    ...content,
    activities: mappedActivities.length > 0 ? mappedActivities : content.activities,
    news: mappedNews.length > 0 ? mappedNews : content.news,
    catalog:
      Array.isArray(benefitsResponse?.benefits) && benefitsResponse.benefits.length > 0
        ? benefitsResponse.benefits.map((benefit: any, idx: number) => ({
            id: String(benefit?.id ?? `benefit-${idx}`),
            title: String(benefit?.title ?? benefit?.name ?? 'Beneficio'),
            description: benefit?.description,
            category: 'beneficios',
            status: benefit?.eligible ? 'Disponible' : 'Bloqueado',
            price: Number(benefit?.points_cost ?? 0),
            priceLabel: `${Number(benefit?.points_cost ?? 0)} pts`,
            link: '/portal/beneficios',
          }))
        : content.catalog,
    loyaltySummary: mappedLoyaltySummary,
    notifications: mappedOrders.slice(0, 3).map((order, idx) => ({
      id: `order-notification-${idx}`,
      title: `Pedido #${order.id}`,
      message: String(order.notes || order.status || ''),
      severity: 'info',
      actionLabel: 'Ver detalle',
      actionHref: '/portal/pedidos',
      date: order.created_at,
      read: false,
    })),
  };
};
