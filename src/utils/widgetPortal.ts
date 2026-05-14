import type {
  PortalActivity,
  PortalCatalogItem,
  PortalContent,
  PortalLoyaltySummary,
  PortalNotification,
  PortalSurvey,
} from "@/types/unified";
import type {
  WidgetCommerceCartSnapshot,
  WidgetCommerceHistory,
  WidgetCommerceSession,
} from "@/types/widgetCommerce";

type RawRecord = Record<string, unknown>;

export interface WidgetPortalAttachment {
  id?: string;
  label?: string;
  url?: string;
  kind?: string;
}

export interface WidgetPortalTimelineEvent {
  id: string;
  label: string;
  status?: string;
  at?: string;
  description?: string;
}

export interface WidgetPortalClaim {
  id: string;
  nroTicket?: string;
  title?: string;
  status?: string;
  statusLabel?: string;
  category?: string;
  address?: string;
  lat?: number;
  lng?: number;
  neighborName?: string;
  neighborPhone?: string;
  channel?: string;
  detailEndpoint?: string;
  commentEndpoint?: string;
  photoEndpoint?: string;
  createdAt?: string;
  attachments: WidgetPortalAttachment[];
  timeline: WidgetPortalTimelineEvent[];
}

export interface WidgetPortalOrder {
  id: string;
  nroPedido?: string;
  title?: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  amountTotal?: number;
  trackingUrl?: string;
  detailEndpoint?: string;
  items: Array<{
    id: string;
    name?: string;
    quantity?: number;
    price?: number;
  }>;
}

export interface WidgetPortalProfile {
  canRegister: boolean;
  userId?: string;
  status?: string;
  name?: string;
  phone?: string;
  email?: string;
  viewUrl?: string;
}

const EMPTY_PORTAL_CONTENT: PortalContent = {
  notifications: [],
  events: [],
  news: [],
  catalog: [],
  activities: [],
  surveys: [],
  loyaltySummary: null,
};

const isRecord = (value: unknown): value is RawRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const readBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "si", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const getSectionItems = (section: unknown): unknown[] => {
  if (Array.isArray(section)) return section;
  if (!isRecord(section)) return [];
  if (Array.isArray(section.items)) return section.items;
  if (Array.isArray(section.results)) return section.results;
  if (Array.isArray(section.data)) return section.data;
  return [];
};

const getNestedRecord = (record: RawRecord | null | undefined, key: string) => {
  const value = record?.[key];
  return isRecord(value) ? value : null;
};

const toStatusType = (status?: string): PortalActivity["statusType"] => {
  const normalized = String(status || "").toLowerCase();
  if (["closed", "cerrado", "resolved", "resuelto", "delivered", "entregado"].includes(normalized)) return "success";
  if (["cancelled", "rechazado", "error", "failed"].includes(normalized)) return "error";
  if (["pending", "pendiente", "en revision", "preparing", "en proceso", "in_progress"].includes(normalized)) return "warning";
  return "info";
};

const normalizeAttachments = (item: RawRecord): WidgetPortalAttachment[] => {
  const raw = [
    ...getSectionItems(item.attachments),
    ...getSectionItems(item.adjuntos),
    ...getSectionItems(item.archivos),
    ...getSectionItems(item.files),
  ];

  const normalized = raw
    .map<WidgetPortalAttachment | null>((entry, index) => {
      if (!isRecord(entry)) return null;
      const url = readString(entry.url, entry.href, entry.file_url, entry.download_url, entry.foto_url_directa);
      const id = readString(entry.id, entry.archivo_adjunto_id, url, `attachment-${index}`);
      if (!url && !id) return null;
      return {
        id,
        label: readString(entry.label, entry.name, entry.filename, entry.type, entry.kind),
        url,
        kind: readString(entry.kind, entry.type, entry.mime_type),
      };
    })
    .filter((entry): entry is WidgetPortalAttachment => Boolean(entry));

  const directPhoto = readString(item.foto_url_directa, item.photo_url, item.image_url);
  if (directPhoto && !normalized.some((attachment) => attachment.url === directPhoto)) {
    normalized.unshift({
      id: readString(item.archivo_adjunto_id, directPhoto),
      label: readString(item.foto_label, item.image_label),
      url: directPhoto,
      kind: "image",
    });
  }

  return normalized;
};

const normalizeTimeline = (item: RawRecord): WidgetPortalTimelineEvent[] =>
  [
    ...getSectionItems(item.timeline),
    ...getSectionItems(item.events),
    ...getSectionItems(item.eventos),
  ]
    .map<WidgetPortalTimelineEvent | null>((entry, index) => {
      if (!isRecord(entry)) return null;
      const label = readString(entry.label, entry.title, entry.description, entry.message, entry.status);
      if (!label) return null;
      return {
        id: readString(entry.id, entry.event_id, `${label}-${index}`) ?? `${label}-${index}`,
        label,
        status: readString(entry.status, entry.stage),
        at: readString(entry.at, entry.date, entry.created_at, entry.timestamp),
        description: readString(entry.description, entry.detail, entry.message),
      };
    })
    .filter((entry): entry is WidgetPortalTimelineEvent => Boolean(entry));

const normalizeEndpoint = (item: RawRecord, ...keys: string[]) => {
  for (const key of keys) {
    const direct = readString(item[key]);
    if (direct) return direct;
    const endpointBlock = getNestedRecord(item, key);
    const nested = readString(endpointBlock?.endpoint, endpointBlock?.url, endpointBlock?.href);
    if (nested) return nested;
  }
  const actions = getNestedRecord(item, "actions");
  for (const key of keys) {
    const action = getNestedRecord(actions, key);
    const nested = readString(action?.endpoint, action?.url, action?.href);
    if (nested) return nested;
  }
  return undefined;
};

export const normalizeWidgetProfile = (
  history?: WidgetCommerceHistory | null,
  session?: WidgetCommerceSession | null,
): WidgetPortalProfile => {
  const historyRecord = isRecord(history) ? history : null;
  const sessionRecord = isRecord(session) ? session : null;
  const profile = getNestedRecord(historyRecord, "profile") ?? getNestedRecord(sessionRecord, "profile");
  const portal = getNestedRecord(historyRecord, "portal") ?? getNestedRecord(sessionRecord, "portal");
  return {
    canRegister: readBoolean(profile?.can_register ?? profile?.canRegister, false),
    userId: readString(profile?.user_id, profile?.id),
    status: readString(profile?.status),
    name: readString(profile?.name, profile?.nombre),
    phone: readString(profile?.phone, profile?.telefono),
    email: readString(profile?.email),
    viewUrl: readString(portal?.view_url, portal?.url),
  };
};

export const normalizeWidgetClaims = (history?: WidgetCommerceHistory | null): WidgetPortalClaim[] => {
  const source = isRecord(history) ? history : null;
  const items = [
    ...getSectionItems(source?.claims),
    ...getSectionItems(source?.tickets),
    ...getSectionItems(source?.reclamos),
    ...getSectionItems(source?.items).filter((entry) => {
      if (!isRecord(entry)) return false;
      const kind = readString(entry.kind, entry.type);
      return ["claim", "ticket", "reclamo"].includes(String(kind || "").toLowerCase());
    }),
  ];

  return items
    .map<WidgetPortalClaim | null>((entry, index) => {
      if (!isRecord(entry)) return null;
      const nroTicket = readString(entry.nro_ticket, entry.ticket_number, entry.ticket_id, entry.id);
      const detailEndpoint = normalizeEndpoint(entry, "detail_endpoint", "detail", "view_url", "url");
      const title = readString(entry.title, entry.subject, entry.label, entry.categoria, entry.category);
      const id = readString(entry.id, entry.ticket_id, entry.nro_ticket, detailEndpoint, `claim-${index}`);
      if (!id) return null;

      const lat = readNumber(entry.latitud, entry.latitude, entry.lat);
      const lng = readNumber(entry.longitud, entry.longitude, entry.lng, entry.lon);

      return {
        id,
        nroTicket,
        title,
        status: readString(entry.status, entry.estado),
        statusLabel: readString(entry.status_label, entry.estado_label, entry.estado),
        category: readString(entry.categoria, entry.category),
        address: readString(entry.direccion, entry.address, entry.location_label),
        lat,
        lng,
        neighborName: readString(entry.nombre_vecino, entry.neighbor_name, entry.customer_name),
        neighborPhone: readString(entry.telefono_vecino, entry.neighbor_phone, entry.customer_phone),
        channel: readString(entry.canal_ingreso, entry.channel),
        detailEndpoint,
        commentEndpoint: normalizeEndpoint(entry, "comment_endpoint", "add_comment", "comments_endpoint"),
        photoEndpoint: normalizeEndpoint(entry, "photo_endpoint", "add_photo", "attachments_endpoint"),
        createdAt: readString(entry.created_at, entry.fecha, entry.date, entry.at),
        attachments: normalizeAttachments(entry),
        timeline: normalizeTimeline(entry),
      };
    })
    .filter((entry): entry is WidgetPortalClaim => Boolean(entry));
};

const readClaimDetailCandidate = (payload: unknown): RawRecord | null => {
  if (!isRecord(payload)) return null;
  const candidates = [
    payload.claim,
    payload.ticket,
    payload.reclamo,
    payload.item,
    payload.data,
    payload,
  ];
  for (const candidate of candidates) {
    if (isRecord(candidate)) return candidate;
  }
  return null;
};

export const normalizeWidgetClaimDetail = (payload: unknown): WidgetPortalClaim | null => {
  const candidate = readClaimDetailCandidate(payload);
  if (!candidate) return null;
  return normalizeWidgetClaims({ claims: { items: [candidate] } })[0] ?? null;
};

const readDefined = <T,>(value: T | undefined): T | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  return value;
};

export const mergeWidgetClaimDetail = (
  base: WidgetPortalClaim,
  detail?: WidgetPortalClaim | null,
): WidgetPortalClaim => {
  if (!detail) return base;
  return {
    ...base,
    nroTicket: readDefined(detail.nroTicket) ?? base.nroTicket,
    title: readDefined(detail.title) ?? base.title,
    status: readDefined(detail.status) ?? base.status,
    statusLabel: readDefined(detail.statusLabel) ?? base.statusLabel,
    category: readDefined(detail.category) ?? base.category,
    address: readDefined(detail.address) ?? base.address,
    lat: readDefined(detail.lat) ?? base.lat,
    lng: readDefined(detail.lng) ?? base.lng,
    neighborName: readDefined(detail.neighborName) ?? base.neighborName,
    neighborPhone: readDefined(detail.neighborPhone) ?? base.neighborPhone,
    channel: readDefined(detail.channel) ?? base.channel,
    detailEndpoint: readDefined(detail.detailEndpoint) ?? base.detailEndpoint,
    commentEndpoint: readDefined(detail.commentEndpoint) ?? base.commentEndpoint,
    photoEndpoint: readDefined(detail.photoEndpoint) ?? base.photoEndpoint,
    createdAt: readDefined(detail.createdAt) ?? base.createdAt,
    attachments: detail.attachments.length > 0 ? detail.attachments : base.attachments,
    timeline: detail.timeline.length > 0 ? detail.timeline : base.timeline,
  };
};

export const normalizeWidgetOrders = (history?: WidgetCommerceHistory | null): WidgetPortalOrder[] => {
  const source = isRecord(history) ? history : null;
  const items = [
    ...getSectionItems(source?.orders),
    ...getSectionItems(source?.pedidos),
    ...getSectionItems(source?.items).filter((entry) => {
      if (!isRecord(entry)) return false;
      const kind = readString(entry.kind, entry.type);
      return ["order", "pedido"].includes(String(kind || "").toLowerCase());
    }),
  ];
  return items
    .map<WidgetPortalOrder | null>((entry, index) => {
      if (!isRecord(entry)) return null;
      const nroPedido = readString(entry.nro_pedido, entry.order_number, entry.order_id, entry.id);
      const detailEndpoint = normalizeEndpoint(entry, "detail_endpoint", "detail", "view_url", "url");
      const trackingUrl = readString(entry.tracking_url) || (nroPedido ? `/tracking/order/${encodeURIComponent(nroPedido)}` : undefined);
      const id = readString(entry.id, entry.order_id, entry.nro_pedido, detailEndpoint, `order-${index}`);
      if (!id) return null;
      const details = getSectionItems(entry.detalles).length > 0 ? getSectionItems(entry.detalles) : getSectionItems(entry.items);
      return {
        id,
        nroPedido,
        title: readString(entry.title, entry.label, entry.nro_pedido),
        status: readString(entry.status, entry.estado),
        customerName: readString(entry.nombre_cliente, entry.customer_name, entry.name),
        customerPhone: readString(entry.telefono_cliente, entry.customer_phone, entry.phone),
        amountTotal: readNumber(entry.monto_total, entry.total, getNestedRecord(entry, "totals")?.total),
        trackingUrl,
        detailEndpoint,
        items: details
          .map<WidgetPortalOrder["items"][number] | null>((detail, detailIndex) => {
            if (!isRecord(detail)) return null;
            return {
              id: readString(detail.id, detail.product_id, detail.sku, `item-${detailIndex}`) ?? `item-${detailIndex}`,
              name: readString(detail.name, detail.nombre, detail.product_name, detail.sku),
              quantity: readNumber(detail.quantity, detail.cantidad, detail.qty),
              price: readNumber(detail.price, detail.precio, detail.unit_price),
            };
          })
          .filter((detail): detail is WidgetPortalOrder["items"][number] => Boolean(detail)),
      };
    })
    .filter((entry): entry is WidgetPortalOrder => Boolean(entry));
};

const normalizeNotifications = (history?: WidgetCommerceHistory | null): PortalNotification[] =>
  getSectionItems(isRecord(history) ? history.notifications : null)
    .map<PortalNotification | null>((entry, index) => {
      if (!isRecord(entry)) return null;
      const title = readString(entry.title, entry.label);
      const message = readString(entry.message, entry.description, entry.summary);
      if (!title || !message) return null;
      return {
        id: readString(entry.id, `notification-${index}`) ?? `notification-${index}`,
        title,
        message,
        severity: readString(entry.severity, entry.type) as PortalNotification["severity"],
        actionLabel: readString(entry.action_label, entry.cta_label),
        actionHref: readString(entry.action_href, entry.href, entry.url),
        date: readString(entry.date, entry.created_at, entry.at),
        read: readBoolean(entry.read, false),
      };
    })
    .filter((entry): entry is PortalNotification => Boolean(entry));

const normalizeSurveys = (history?: WidgetCommerceHistory | null): PortalSurvey[] =>
  getSectionItems(isRecord(history) ? history.surveys : null)
    .map<PortalSurvey | null>((entry, index) => {
      if (!isRecord(entry)) return null;
      const title = readString(entry.title, entry.name, entry.label);
      if (!title) return null;
      return {
        id: readString(entry.id, entry.slug, `survey-${index}`) ?? `survey-${index}`,
        title,
        link: readString(entry.link, entry.url, entry.view_url),
      };
    })
    .filter((entry): entry is PortalSurvey => Boolean(entry));

const normalizeRewards = (
  cart?: WidgetCommerceCartSnapshot | null,
  history?: WidgetCommerceHistory | null,
): PortalCatalogItem[] => {
  const cartRecord = isRecord(cart) ? cart : null;
  const historyRecord = isRecord(history) ? history : null;
  const items = [
    ...getSectionItems(cartRecord?.items),
    ...getSectionItems(getNestedRecord(cartRecord, "cart")?.items),
    ...getSectionItems(getNestedRecord(historyRecord, "cart")?.items),
    ...getSectionItems(historyRecord?.benefits),
    ...getSectionItems(historyRecord?.rewards),
  ];

  return items
    .map<PortalCatalogItem | null>((entry, index) => {
      if (!isRecord(entry)) return null;
      const points = readNumber(entry.points, entry.puntos, entry.points_cost, entry.cost_points, entry.redeem_points);
      if (points === undefined) return null;
      const title = readString(entry.title, entry.name, entry.nombre, entry.label);
      if (!title) return null;
      return {
        id: readString(entry.id, entry.product_id, `reward-${index}`) ?? `reward-${index}`,
        title,
        description: readString(entry.description, entry.descripcion, entry.summary),
        category: readString(entry.category, entry.categoria),
        price: points,
        priceLabel: `${points} pts`,
        status: readString(entry.status, entry.estado),
        imageUrl: readString(entry.image_url, entry.thumbnail_url, entry.preview_url),
        link: readString(entry.link, entry.url, entry.view_url),
      };
    })
    .filter((entry): entry is PortalCatalogItem => Boolean(entry));
};

const normalizeLoyaltySummary = (
  cart?: WidgetCommerceCartSnapshot | null,
  history?: WidgetCommerceHistory | null,
): PortalLoyaltySummary | null => {
  const cartRecord = isRecord(cart) ? cart : null;
  const historyRecord = isRecord(history) ? history : null;
  const cartSummary = getNestedRecord(cartRecord, "summary");
  const historySummary = getNestedRecord(historyRecord, "summary");
  const pointsRecord = getNestedRecord(historyRecord, "points");
  const counts = getNestedRecord(historySummary, "counts");
  const points = readNumber(
    cartSummary?.points,
    cartSummary?.points_balance,
    cartSummary?.balance_points,
    historySummary?.points,
    pointsRecord?.balance,
    pointsRecord?.current_points,
    historyRecord?.current_points,
  );
  const rewards = normalizeRewards(cart, history);
  const surveysCompleted = readNumber(counts?.surveys, historySummary?.surveys_completed);
  const suggestionsShared = readNumber(counts?.suggestions, historySummary?.suggestions_shared);
  const claimsFiled = readNumber(counts?.claims, historySummary?.claims_filed);

  if (
    points === undefined
  ) {
    return null;
  }

  return {
    points: points ?? 0,
    level: readString(pointsRecord?.level, historySummary?.level) ?? "",
    surveysCompleted: surveysCompleted ?? 0,
    suggestionsShared: suggestionsShared ?? 0,
    claimsFiled: claimsFiled ?? 0,
    hasParticipationMetrics:
      surveysCompleted !== undefined ||
      suggestionsShared !== undefined ||
      claimsFiled !== undefined,
    availableRewards: rewards.map((reward) => ({
      id: reward.id,
      title: reward.title,
      cost: reward.price ?? 0,
      type: reward.status ?? reward.category ?? "",
      description: reward.description,
    })),
  };
};

const claimToActivity = (claim: WidgetPortalClaim): PortalActivity | null => {
  const description = claim.title || claim.category || (claim.nroTicket ? `#${claim.nroTicket}` : undefined);
  if (!description) return null;
  return {
    id: claim.id,
    description,
    type: claim.channel === "whatsapp" ? "whatsapp" : "claim",
    status: claim.statusLabel ?? claim.status,
    statusType: toStatusType(claim.status ?? claim.statusLabel),
    date: claim.createdAt,
    link: claim.detailEndpoint,
  };
};

const orderToActivity = (order: WidgetPortalOrder): PortalActivity | null => {
  const description = order.title || (order.nroPedido ? `#${order.nroPedido}` : undefined);
  if (!description) return null;
  return {
    id: order.id,
    description,
    type: "order",
    status: order.status,
    statusType: toStatusType(order.status),
    link: order.detailEndpoint ?? order.trackingUrl,
  };
};

export const buildPortalContentFromWidgetHistory = (
  history?: WidgetCommerceHistory | null,
  cart?: WidgetCommerceCartSnapshot | null,
): PortalContent => {
  const claims = normalizeWidgetClaims(history);
  const orders = normalizeWidgetOrders(history);
  const activities = [
    ...claims.map(claimToActivity),
    ...orders.map(orderToActivity),
  ].filter((entry): entry is PortalActivity => Boolean(entry));

  return {
    ...EMPTY_PORTAL_CONTENT,
    notifications: normalizeNotifications(history),
    catalog: normalizeRewards(cart, history),
    activities,
    surveys: normalizeSurveys(history),
    loyaltySummary: normalizeLoyaltySummary(cart, history),
  };
};

export const overlayPortalContent = (base: PortalContent, overlay: PortalContent): PortalContent => ({
  notifications: overlay.notifications.length > 0 ? overlay.notifications : base.notifications,
  events: overlay.events.length > 0 ? overlay.events : base.events,
  news: overlay.news.length > 0 ? overlay.news : base.news,
  catalog: overlay.catalog.length > 0 ? overlay.catalog : base.catalog,
  activities: overlay.activities.length > 0 ? overlay.activities : base.activities,
  surveys: overlay.surveys.length > 0 ? overlay.surveys : base.surveys,
  loyaltySummary: overlay.loyaltySummary ?? base.loyaltySummary,
});
