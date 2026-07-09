import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { CrmOperatorAction, CrmReviewCard, Order } from '@/types/unified';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Loader2, Package, Sparkles, Truck, CheckCircle, XCircle, Search, ShoppingBag, MessageCircle, Globe, ExternalLink, Plus, RefreshCw, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getCommercialStageLabel, getCommercialStageTone, getCommercialToneClassName, normalizeChannelLabel } from '@/utils/orderCommercial';
import { AssistedRequestPanel } from '@/components/orders/AssistedRequestPanel';
import UploadOrderFromFile from '@/components/cart/UploadOrderFromFile';
import { buildTenantPath } from '@/utils/tenantPaths';
import { cn } from '@/lib/utils';
import IdentityAvatar from '@/components/identity/IdentityAvatar';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: Package },
  confirmed: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const CHANNEL_ICONS: Record<string, any> = {
  mercadolibre: ShoppingBag, // Represents a bag/store
  whatsapp: MessageCircle,
  tiendanube: Globe, // Represents a web store
  web: Globe,
  marketplace: ShoppingBag,
};

const CHANNEL_LABELS: Record<string, string> = {
  mercadolibre: "Mercado Libre",
  whatsapp: "WhatsApp",
  tiendanube: "Tienda Nube",
  web: "Web Propia",
  marketplace: "Marketplace",
  manual_admin: "Manual admin",
  phone: "Teléfono",
};

const AI_FILTER_VALUES = new Set(['all', 'assisted', 'needs_review', 'ready']);
const CHANNEL_FILTER_VALUES = new Set([
  'all',
  'mercadolibre',
  'whatsapp',
  'tiendanube',
  'marketplace',
  'manual_admin',
  'phone',
  'web',
]);

const normalizeAiFocusParam = (value: string | null): string => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'all';
  if (['review', 'needs-review', 'needs_review', 'manual_review', 'pending_operator_review'].includes(normalized)) {
    return 'needs_review';
  }
  if (['ready', 'ready_to_reply', 'ready_for_confirmation', 'confirmation'].includes(normalized)) {
    return 'ready';
  }
  if (['assisted', 'ai', 'ia', 'commerce_assisted_orders'].includes(normalized)) {
    return 'assisted';
  }
  return AI_FILTER_VALUES.has(normalized) ? normalized : 'all';
};

const normalizeChannelParam = (value: string | null): string => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return 'all';
  return CHANNEL_FILTER_VALUES.has(normalized) ? normalized : 'all';
};

const normalizeOrders = (raw: unknown): Order[] => {
  if (Array.isArray(raw)) return raw;

  if (raw && typeof raw === 'object') {
    // Try standard "pagination" structures: orders, results, data, items
    const candidate = (raw as any).orders ?? (raw as any).results ?? (raw as any).data ?? (raw as any).items;
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

const getOrderCustomerProfile = (order: Order): Record<string, any> => {
  const raw = order as any;
  return raw.customer_profile || raw.customer_identity || raw.contact || {};
};

const getOrderCustomerName = (order: Order): string => {
  const profile = getOrderCustomerProfile(order);
  return profile.name || profile.display_name || (order as any).customerName || (order as any).contact_name || 'Cliente Final';
};

const getOrderCustomerPhone = (order: Order): string | undefined => {
  const profile = getOrderCustomerProfile(order);
  return profile.phone || (order as any).customerPhone || undefined;
};

const getOrderCustomerAvatar = (order: Order) => {
  const profile = getOrderCustomerProfile(order);
  const identity = profile.identity || (order as any).customer_identity || {};
  return {
    avatarUrl: profile.avatar_url || profile.avatarUrl || profile.picture || identity.avatar_url || identity.avatarUrl || identity.picture,
    source: profile.avatar_source || profile.avatarSource || identity.avatar_source || identity.avatarSource,
    consented: profile.avatar_consent ?? profile.avatarConsent ?? profile.profile_picture_consent ?? identity.avatar_consent ?? identity.avatarConsent ?? identity.profile_picture_consent,
  };
};

const assistedSummaryNumber = (order: Order, key: 'matched' | 'unmatched' | 'detected') => {
  const cardValue = order.crm_review_card?.summary?.[key];
  if (typeof cardValue === 'number' && Number.isFinite(cardValue)) return cardValue;
  const value = order.assisted_request?.match_summary?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const hasArrayItems = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const assistedRequestRecord = (order: Order): Record<string, any> =>
  isRecord(order.assisted_request) ? (order.assisted_request as Record<string, any>) : {};

const crmReviewCardRecord = (order: Order): Record<string, any> =>
  isRecord(order.crm_review_card) ? (order.crm_review_card as Record<string, any>) : {};

const hasAssistedOrderContract = (order: Order): boolean => Boolean(order.assisted_request || order.crm_review_card);

const hasAssistedStructuredLines = (order: Order): boolean => {
  const request = assistedRequestRecord(order);
  const card = crmReviewCardRecord(order);
  return (
    hasArrayItems(card.lines) ||
    hasArrayItems(request.lines) ||
    hasArrayItems(request.crm_order_draft?.lines) ||
    hasArrayItems(request.crm_handoff?.draft_order?.lines)
  );
};

const hasAssistedExtractionIssue = (order: Order): boolean => {
  const request = assistedRequestRecord(order);
  const card = crmReviewCardRecord(order);
  const requestSource = isRecord(request.source) ? request.source : {};
  const cardSource = isRecord(card.source) ? card.source : {};
  return Boolean(
    request.extraction_error ||
      card.extraction_error ||
      requestSource.extraction_error ||
      cardSource.extraction_error ||
      request.provider_status === 'failed' ||
      card.provider_status === 'failed' ||
      requestSource.provider_status === 'failed' ||
      cardSource.provider_status === 'failed' ||
      hasArrayItems(request.row_errors) ||
      hasArrayItems(card.row_errors) ||
      hasArrayItems(request.structured_extraction?.row_errors) ||
      hasArrayItems(request.crm_order_draft?.row_errors),
  );
};

const isAssistedNeedsReview = (order: Order): boolean => {
  const request = assistedRequestRecord(order);
  const card = crmReviewCardRecord(order);
  const status = firstText(card.status, card.state, request.crm_state, request.status);
  return Boolean(
    card.needs_operator_review ||
      card.status === 'needs_review' ||
      card.priority === 'high' ||
      request.operator_pack?.needs_human_review ||
      request.operator_pack?.priority === 'high' ||
      assistedSummaryNumber(order, 'unmatched') > 0 ||
      hasAssistedExtractionIssue(order) ||
      ['needs_review', 'manual_review', 'pending_operator_review', 'ai_unavailable', 'failed', 'error'].includes(status || ''),
  );
};

const isAssistedReady = (order: Order): boolean => {
  if (!hasAssistedOrderContract(order) || isAssistedNeedsReview(order)) return false;
  const request = assistedRequestRecord(order);
  const card = crmReviewCardRecord(order);
  const explicitReady = card.status === 'ready_to_reply' || request.crm_state === 'ready_for_confirmation';
  const hasStructure = hasAssistedStructuredLines(order) || assistedSummaryNumber(order, 'detected') > 0 || assistedSummaryNumber(order, 'matched') > 0;
  return Boolean(explicitReady && hasStructure && assistedSummaryNumber(order, 'unmatched') === 0);
};

const crmStateLabel = (state?: string | null) => {
  if (state === 'manual_review' || state === 'ai_unavailable' || state === 'failed' || state === 'error') return 'Revisión manual';
  if (state === 'needs_review') return 'Revisar en CRM';
  if (state === 'ready_to_reply') return 'Listo para responder';
  if (state === 'ready_for_confirmation') return 'Listo para confirmar';
  if (state === 'pending_operator_review') return 'Revisar en CRM';
  return 'Pedido asistido';
};

const crmOperationalStateLabel = (state?: string | null) => {
  if (state === 'ready_for_order_creation') return 'Listo para crear pedido';
  if (state === 'needs_catalog_resolution') return 'Resolver catalogo';
  if (state === 'needs_operator_review') return 'Revision operativa';
  if (state === 'ready_to_reply') return 'Listo para responder';
  return state ? state.replace(/_/g, ' ') : null;
};

const getCrmOperatorActions = (order: Order): CrmOperatorAction[] => {
  const cardActions = order.crm_review_card?.operator_actions;
  if (Array.isArray(cardActions) && cardActions.length > 0) {
    return cardActions.filter(Boolean);
  }
  const requestActions = order.assisted_request?.crm_review_card?.operator_actions;
  if (Array.isArray(requestActions) && requestActions.length > 0) {
    return requestActions.filter(Boolean);
  }
  return [];
};

const getPrimaryCrmOperatorAction = (order: Order): CrmOperatorAction | null => {
  const actions = getCrmOperatorActions(order);
  if (actions.length === 0) return null;
  const primaryId = order.crm_review_card?.primary_action_id || order.assisted_request?.crm_review_card?.primary_action_id;
  if (primaryId) {
    const byPrimaryId = actions.find((action) => action.id === primaryId);
    if (byPrimaryId) return byPrimaryId;
  }
  return actions.find((action) => action.id === 'confirm_order_draft') || actions[0] || null;
};

const assistedConfirmActionLabel = (order: Order) => {
  const primaryActionLabel = textValue(getPrimaryCrmOperatorAction(order)?.label)?.trim();
  if (primaryActionLabel) return primaryActionLabel;
  const state = order.assisted_request?.crm_state;
  if (state === 'ready_for_confirmation') return 'Crear pedido';
  if (state === 'pending_operator_review') return 'Revisar y confirmar';
  return order.assisted_request ? 'Confirmar candidato' : 'Confirmar';
};

const canConfirmOrderFromCrm = (order: Order): boolean =>
  !hasAssistedOrderContract(order) || isAssistedReady(order);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const textValue = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = textValue(value)?.trim();
    if (text) return text;
  }
  return null;
};

type CrmReviewCardView = {
  title: string;
  summary: string | null;
  statusLabel: string | null;
  priorityLabel: string | null;
  nextStep: string | null;
  reasons: string[];
  metrics: Array<{ label: string; value: string }>;
};

const flattenSearchText = (value: unknown): string => {
  const primitive = textValue(value);
  if (primitive) return primitive;
  if (Array.isArray(value)) return value.map(flattenSearchText).filter(Boolean).join(' ');
  if (isRecord(value)) return Object.values(value).map(flattenSearchText).filter(Boolean).join(' ');
  return '';
};

const normalizeSearchText = (value: unknown) =>
  flattenSearchText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getAssistedPreview = (order: Order) => {
  const assistedRequest = order.assisted_request;
  return firstText(
    order.crm_review_card?.source?.text_preview,
    order.crm_review_card?.suggested_reply,
    assistedRequest?.customer_message,
    assistedRequest?.source?.text_preview,
    assistedRequest?.structured_extraction?.fields?.resumen,
    assistedRequest?.review_context?.summary,
    order.notes,
  );
};

const formatCardValue = (value: unknown): string | null => {
  const primitive = textValue(value)?.trim();
  if (primitive) return primitive;
  if (Array.isArray(value)) {
    return value.map(formatCardValue).filter(Boolean).join(', ') || null;
  }
  if (isRecord(value)) {
    const direct = firstText(value.label, value.text, value.value, value.summary, value.resumen);
    if (direct) return direct;
    const parts = Object.entries(value)
      .map(([key, item]) => {
        const formatted = formatCardValue(item);
        return formatted ? `${key.replace(/_/g, ' ')}: ${formatted}` : null;
      })
      .filter(Boolean);
    return parts.slice(0, 4).join(' - ') || null;
  }
  return null;
};

const normalizeReviewReasons = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(formatCardValue)
    .filter((item): item is string => Boolean(item))
    .slice(0, 4);
};

const normalizeReviewMetrics = (value: unknown): Array<{ label: string; value: string }> => {
  if (Array.isArray(value)) {
    return value
      .filter(isRecord)
      .map((item) => {
        const label = firstText(item.label, item.title, item.key, item.name);
        const metricValue = formatCardValue(item.value ?? item.count ?? item.total ?? item.amount);
        return label && metricValue ? { label, value: metricValue } : null;
      })
      .filter((item): item is { label: string; value: string } => Boolean(item))
      .slice(0, 4);
  }

  if (!isRecord(value)) return [];
  return Object.entries(value)
    .map(([key, item]) => {
      const formatted = formatCardValue(item);
      return formatted ? { label: key.replace(/_/g, ' '), value: formatted } : null;
    })
    .filter((item): item is { label: string; value: string } => Boolean(item))
    .slice(0, 4);
};

const normalizeCrmReviewCard = (value: unknown): CrmReviewCardView | null => {
  if (!isRecord(value)) return null;
  const card = value as CrmReviewCard;
  const title = firstText(card.title, card.label, card.heading, card.name) || 'Resumen CRM';
  const summary =
    firstText(card.summary, card.resumen, card.description, card.review_summary, card.text) ||
    formatCardValue(card.summary) ||
    formatCardValue(card.resumen);
  const statusLabel = firstText(card.status_label, card.status, card.state, card.crm_state);
  const priorityLabel = firstText(card.priority_label, card.priority, card.urgency);
  const nextStep = firstText(card.recommended_next_step, card.next_step, card.next_action, card.action);
  const reasons = [
    ...normalizeReviewReasons(card.review_reasons),
    ...normalizeReviewReasons(card.reasons),
    ...normalizeReviewReasons(card.highlights),
  ].slice(0, 4);
  const metrics = [
    ...normalizeReviewMetrics(card.metrics),
    ...normalizeReviewMetrics(card.kpis),
    ...normalizeReviewMetrics(card.summary_metrics),
  ].slice(0, 4);

  if (!summary && !statusLabel && !priorityLabel && !nextStep && reasons.length === 0 && metrics.length === 0) {
    return null;
  }

  return { title, summary, statusLabel, priorityLabel, nextStep, reasons, metrics };
};

const getCrmReviewCard = (order: Order): CrmReviewCardView | null => {
  const rawOrder = order as unknown as Record<string, unknown>;
  const assistedRequest = order.assisted_request as (Record<string, unknown> | null | undefined);
  const metadata = isRecord(order.metadata) ? order.metadata : {};
  const metadataCrm = isRecord(metadata.crm) ? metadata.crm : {};
  const operatorPack = isRecord(assistedRequest?.operator_pack) ? assistedRequest.operator_pack : {};
  const sources = [
    order.crm_review_card,
    rawOrder.crm_review_card,
    assistedRequest?.crm_review_card,
    operatorPack.crm_review_card,
    metadata.crm_review_card,
    metadataCrm.review_card,
  ];

  for (const source of sources) {
    const normalized = normalizeCrmReviewCard(source);
    if (normalized) return normalized;
  }
  return null;
};

const getFollowUpCode = (order: Order) => order.assisted_request?.public_follow_up?.tracking?.code || null;

const buildOrderSearchText = (order: Order) => {
  const assistedRequest = order.assisted_request;
  const profile = (order as any).customer_profile || {};
  return normalizeSearchText([
    order.id,
    order.externalId,
    (order as any).market_order_id,
    (order as any).order_id,
    order.contact_name,
    order.customerName,
    order.customerPhone,
    order.customerEmail,
    profile.name,
    profile.phone,
    profile.email,
    profile.contact_key,
    profile.channel_group,
    order.items,
    order.crm_review_card?.reference,
    order.crm_review_card?.request_kind_label,
    order.crm_review_card?.recommended_next_step,
    order.crm_review_card?.suggested_reply,
    order.crm_review_card?.source?.text_preview,
    order.crm_review_card?.lines,
    order.crm_review_card?.unmatched_items,
    assistedRequest?.request_kind_label,
    assistedRequest?.customer_message,
    assistedRequest?.source?.text_preview,
    assistedRequest?.structured_extraction?.fields,
    assistedRequest?.unmatched_items,
    getCrmReviewCard(order),
    getFollowUpCode(order),
    order.notes,
  ]);
};

const resolveUpdatedOrder = (current: Order, response: unknown, fallbackStatus: string): Order => {
  const candidate = isRecord(response)
    ? (isRecord(response.order) ? response.order : isRecord(response.data) ? response.data : response)
    : null;
  return candidate ? ({ ...current, ...candidate } as Order) : { ...current, status: fallbackStatus as any };
};

const getShippingInfo = (order: Order) => {
  const raw = order as any;
  const metadata = isRecord(order.metadata) ? order.metadata : {};
  const delivery = isRecord(metadata.delivery)
    ? metadata.delivery
    : isRecord(metadata.envio)
      ? metadata.envio
      : isRecord(metadata.shipping)
        ? metadata.shipping
        : isRecord(raw.delivery)
          ? raw.delivery
          : isRecord(raw.envio)
            ? raw.envio
            : isRecord(raw.shipping)
              ? raw.shipping
              : {};
  const fields = isRecord(order.assisted_request?.structured_extraction?.fields)
    ? order.assisted_request?.structured_extraction?.fields
    : {};
  const method = firstText(
    raw.shipping_method,
    raw.metodo_envio,
    raw.delivery_method,
    delivery.method,
    delivery.metodo,
    fields?.metodo_envio,
    fields?.tipo_envio,
  );
  const address = firstText(
    raw.shipping_address,
    raw.direccion_envio,
    raw.address,
    raw.direccion,
    delivery.address,
    delivery.direccion,
    fields?.direccion,
    fields?.domicilio,
  );
  const notes = firstText(
    raw.shipping_notes,
    raw.referencias_envio,
    delivery.notes,
    delivery.notas,
    fields?.referencias,
    fields?.observaciones,
  );
  return {
    hasData: Boolean(method || address || notes),
    method: method || (address ? 'Entrega a coordinar' : 'Sin datos de envio'),
    address,
    notes,
  };
};

const CrmReviewCardSummary = ({ card, compact = false }: { card: CrmReviewCardView; compact?: boolean }) => (
  <div
    className={cn(
      'rounded-lg border border-violet-200 bg-violet-50/70 text-violet-950 shadow-sm dark:border-violet-900 dark:bg-violet-950/20 dark:text-violet-100',
      compact ? 'p-2 text-xs' : 'p-4 text-sm',
    )}
  >
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ClipboardList className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          <p className="font-semibold">{card.title}</p>
        </div>
        {card.summary ? (
          <p className={cn('mt-1 text-violet-900/80 dark:text-violet-100/80', compact ? 'line-clamp-2' : 'leading-6')}>
            {card.summary}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {card.statusLabel ? <Badge variant="outline" className="bg-background/80">{card.statusLabel}</Badge> : null}
        {card.priorityLabel ? <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">{card.priorityLabel}</Badge> : null}
      </div>
    </div>
    {card.nextStep ? (
      <p className={cn('mt-2 font-medium', compact && 'line-clamp-1')}>
        Proximo paso: {card.nextStep}
      </p>
    ) : null}
    {!compact && (card.reasons.length > 0 || card.metrics.length > 0) ? (
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {card.reasons.length > 0 ? (
          <div className="rounded-md border border-violet-200/80 bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motivos</p>
            <ul className="mt-2 space-y-1">
              {card.reasons.map((reason) => (
                <li key={reason} className="text-sm">{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {card.metrics.length > 0 ? (
          <div className="rounded-md border border-violet-200/80 bg-background/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos clave</p>
            <div className="mt-2 grid gap-1.5">
              {card.metrics.map((metric) => (
                <div key={`${metric.label}-${metric.value}`} className="flex justify-between gap-3 text-sm">
                  <span className="capitalize text-muted-foreground">{metric.label}</span>
                  <span className="font-semibold">{metric.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ) : null}
  </div>
);

const CrmOperatorActionsPanel = ({
  order,
  onStatusChange,
}: {
  order: Order;
  onStatusChange: (orderId: string | number, newStatus: string) => void;
}) => {
  const actions = getCrmOperatorActions(order).filter((action) => action && (action.id || action.label)).slice(0, 4);
  const operationalStateLabel = crmOperationalStateLabel(order.crm_review_card?.operational_state);
  if (actions.length === 0) return null;

  return (
    <div
      data-testid="crm-operator-actions"
      className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950 shadow-sm dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">Acciones operativas</p>
          <p className="text-xs text-blue-900/70 dark:text-blue-100/70">
            El CRM recibe la nota, el pedido sugerido y las acciones para resolverlo sin perder contexto.
          </p>
        </div>
        {operationalStateLabel ? (
          <Badge variant="outline" className="bg-background/80">
            {operationalStateLabel}
          </Badge>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {actions.map((action) => {
          const label = textValue(action.label || action.id) || 'Accion CRM';
          const description = textValue(action.description);
          const targetStatus = textValue(action.target_status);
          const href = textValue(action.href);
          const enabled = action.enabled !== false;
          const canExecuteStatusAction = enabled && action.requires_review !== true;
          const isStatusAction = action.type === 'status_transition' && Boolean(targetStatus);
          const creates = Array.isArray(action.creates) ? action.creates.filter(Boolean) : [];

          return (
            <div key={`${action.id || label}-${targetStatus || href || 'action'}`} className="rounded-md border border-blue-200/80 bg-background/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{label}</p>
                {action.requires_review ? (
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                    Requiere revision
                  </Badge>
                ) : null}
              </div>
              {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
              {creates.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {creates.map((record) => (
                    <Badge key={String(record)} variant="outline" className="bg-background/80 text-[11px]">
                      Crea {String(record).replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="mt-3">
                {isStatusAction && targetStatus ? (
                  <Button
                    size="sm"
                    disabled={!canExecuteStatusAction}
                    title={
                      canExecuteStatusAction
                        ? undefined
                        : textValue(action.disabled_reason) || 'Resolver catalogo y revision antes de crear el pedido operativo.'
                    }
                    onClick={() => onStatusChange(order.id, targetStatus)}
                  >
                    Ejecutar accion
                  </Button>
                ) : href ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={href} target="_blank" rel="noreferrer">
                      {label}
                    </a>
                  </Button>
                ) : (
                  <Badge variant="outline" className={enabled ? 'bg-background/80' : 'opacity-60'}>
                    {enabled ? 'Disponible en CRM' : 'No disponible'}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PedidosPage = () => {
  const { currentSlug } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const initialSearchTerm = searchParams.get('q') || searchParams.get('search') || '';
  const requestedOrderId = searchParams.get('order_id') || searchParams.get('id') || searchParams.get('pedido_id') || '';
  const hasOperationalDeepLink = Boolean(
    searchParams.get('focus') ||
      searchParams.get('queue') ||
      searchParams.get('ai') ||
      searchParams.get('channel') ||
      searchParams.get('canal') ||
      initialSearchTerm ||
      requestedOrderId,
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(() => initialSearchTerm);
  const [channelFilter, setChannelFilter] = useState<string>(() =>
    normalizeChannelParam(searchParams.get('channel') || searchParams.get('canal')),
  );
  const [aiFilter, setAiFilter] = useState<string>(() =>
    normalizeAiFocusParam(searchParams.get('focus') || searchParams.get('queue') || searchParams.get('ai')),
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Manual Order State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssistedUploadOpen, setIsAssistedUploadOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newItem, setNewItem] = useState({ contact_name: '', product_name: '', price: '', quantity: '1' });
  const [resolvingCatalogCandidateKey, setResolvingCatalogCandidateKey] = useState<string | null>(null);

  useEffect(() => {
    if (currentSlug) {
      loadOrders();
    }
  }, [currentSlug]);

  useEffect(() => {
    const nextSearchTerm = searchParams.get('q') || searchParams.get('search') || '';
    const nextChannelFilter = normalizeChannelParam(searchParams.get('channel') || searchParams.get('canal'));
    const nextAiFilter = normalizeAiFocusParam(searchParams.get('focus') || searchParams.get('queue') || searchParams.get('ai'));

    setSearchTerm((current) => (current === nextSearchTerm ? current : nextSearchTerm));
    setChannelFilter((current) => (current === nextChannelFilter ? current : nextChannelFilter));
    setAiFilter((current) => (current === nextAiFilter ? current : nextAiFilter));
    setSelectedOrder(null);
  }, [queryString, searchParams]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;

      const data = await apiClient.adminListOrders(currentSlug, { status: 'all', limit: 100 });
      const normalized = normalizeOrders(data);
      setOrders(normalized);
    } catch (error) {
      console.error('Error loading orders:', error);

      try {
          // Fallback retry without filters
          const fallbackData = await apiClient.adminListOrders(currentSlug);
          const fallbackNormalized = normalizeOrders(fallbackData);
          if (fallbackNormalized.length > 0) {
              setOrders(fallbackNormalized);
              return;
          }
      } catch (e) {
          // Ignore fallback error
      }
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string | number, newStatus: string) => {
    if (!currentSlug) return;
    const currentOrders = Array.isArray(orders) ? orders : [];
    if (newStatus === 'cancelled' && !window.confirm('Confirmas cancelar este pedido?')) return;

    try {
      const response = await apiClient.adminUpdateOrder(currentSlug, orderId, { status: newStatus });
      const updatedOrders = currentOrders.map((order) =>
        order.id === orderId ? resolveUpdatedOrder(order, response, newStatus) : order,
      );
      setOrders(updatedOrders);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(resolveUpdatedOrder(selectedOrder, response, newStatus));
      }
    } catch (error) {
      console.error('Failed to update status', error);
      toast.error("No se pudo actualizar el estado. El pedido no fue modificado.");
    }
  };

  const handleResolveCatalogCandidate = async (
    order: Order,
    payload: {
      lineId?: string | null;
      sourceName: string;
      catalogItemId: string | number;
      candidateName: string;
    },
  ) => {
    if (!currentSlug) return;
    const resolutionKey = `${payload.lineId || payload.sourceName}:${payload.catalogItemId}`;
    setResolvingCatalogCandidateKey(resolutionKey);
    try {
      const response = await apiClient.adminUpdateOrder(currentSlug, order.id, {
        catalog_resolutions: [
          {
            line_id: payload.lineId,
            source_name: payload.sourceName,
            catalog_item_id: payload.catalogItemId,
          },
        ],
      });
      const updated = resolveUpdatedOrder(order, response, order.status);
      setOrders((currentOrders) => currentOrders.map((item) => (item.id === order.id ? resolveUpdatedOrder(item, response, item.status) : item)));
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder(updated);
      }
      toast.success(`Catalogo vinculado: ${payload.sourceName} -> ${payload.candidateName}`);
    } catch (error) {
      console.error('Failed to resolve catalog candidate', error);
      toast.error('No se pudo vincular el producto del catalogo.');
    } finally {
      setResolvingCatalogCandidateKey(null);
    }
  };

  const handleCreateOrder = async () => {
    if (!currentSlug) return;
    if (!newItem.contact_name || !newItem.product_name || !newItem.price) {
      toast.error("Complete los campos obligatorios");
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        contact_name: newItem.contact_name,
        items: [{
          name: newItem.product_name,
          price: parseFloat(newItem.price),
          quantity: parseInt(newItem.quantity) || 1,
        }],
      };

      await apiClient.adminCreateOrder(currentSlug, payload);
      toast.success("Pedido creado correctamente");
      setIsCreateOpen(false);
      setNewItem({ contact_name: '', product_name: '', price: '', quantity: '1' });
      loadOrders(); // Refresh list
    } catch (error) {
      console.error("Create order failed", error);
      toast.error("Error al crear el pedido");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAssistedUploadProcessed = () => {
    toast.success('Solicitud IA creada en el CRM');
    setAiFilter('assisted');
    setIsAssistedUploadOpen(false);
    loadOrders();
  };

  const safeOrders = Array.isArray(orders) ? orders : [];
  const assistedOrders = safeOrders.filter(hasAssistedOrderContract);
  const assistedNeedsReview = assistedOrders.filter(isAssistedNeedsReview);
  const assistedReady = assistedOrders.filter(isAssistedReady);

  const filteredOrders = safeOrders.filter(o => {
    const normalizedSearch = normalizeSearchText(searchTerm);
    const matchesSearch = !normalizedSearch || buildOrderSearchText(o).includes(normalizedSearch);
    const orderChannel = o.crm_review_card?.source?.channel || o.assisted_request?.source?.channel || (o as any).channel || (o as any).commercial_state?.channel;
    const matchesChannel = channelFilter === 'all' || orderChannel === channelFilter;
    const matchesAi =
      aiFilter === 'all' ||
      (aiFilter === 'assisted' && hasAssistedOrderContract(o)) ||
      (aiFilter === 'needs_review' && isAssistedNeedsReview(o)) ||
      (aiFilter === 'ready' && isAssistedReady(o));
    return matchesSearch && matchesChannel && matchesAi;
  });
  const selectedShippingInfo = selectedOrder ? getShippingInfo(selectedOrder) : null;
  const selectedAssistedCrmState = selectedOrder?.crm_review_card?.status || selectedOrder?.assisted_request?.crm_state || null;
  const selectedCrmReviewCard = selectedOrder ? getCrmReviewCard(selectedOrder) : null;
  const selectedCustomerProfile = selectedOrder ? getOrderCustomerProfile(selectedOrder) : {};
  const selectedCustomerName = selectedOrder ? getOrderCustomerName(selectedOrder) : 'Consumidor Final';
  const selectedCanConfirmOrder = selectedOrder ? canConfirmOrderFromCrm(selectedOrder) : false;
  const selectedCustomerAvatar = selectedOrder
    ? getOrderCustomerAvatar(selectedOrder)
    : { avatarUrl: undefined, source: undefined, consented: undefined };
  const selectedCustomerPhone = selectedCustomerProfile.phone || (selectedOrder as any)?.customerPhone || 'Sin teléfono';
  const selectedCustomerEmail = selectedCustomerProfile.email || (selectedOrder as any)?.customerEmail || 'Sin email';

  useEffect(() => {
    if (!hasOperationalDeepLink || loading || selectedOrder || !filteredOrders.length) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;

    const requested = requestedOrderId
      ? filteredOrders.find((order) => String(order.id) === String(requestedOrderId))
      : null;
    setSelectedOrder(requested || filteredOrders[0]);
  }, [filteredOrders, hasOperationalDeepLink, loading, requestedOrderId, selectedOrder]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none ${selectedOrder ? 'hidden md:flex' : ''}`}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestión de Pedidos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Centraliza tus ventas de Mercado Libre, Tienda Nube y WhatsApp.</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto flex-wrap">
            <Dialog open={isAssistedUploadOpen} onOpenChange={setIsAssistedUploadOpen}>
                <DialogTrigger asChild>
                    <Button variant="secondary" className="gap-2">
                        <Upload className="h-4 w-4" /> Cargar nota con IA
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Cargar solicitud asistida</DialogTitle>
                        <DialogDescription>
                            Subi una foto, boleta, manuscrito o lista pegada para que Chatboc la transforme en caso CRM antes de responder.
                        </DialogDescription>
                    </DialogHeader>
                    <UploadOrderFromFile
                      tenantSlug={currentSlug}
                      variant="crm"
                      onProcessed={handleAssistedUploadProcessed}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Crear Pedido
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Pedido Manual</DialogTitle>
                        <DialogDescription>Registra una venta realizada por fuera de la plataforma.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Nombre del Cliente</Label>
                            <Input
                                value={newItem.contact_name}
                                onChange={e => setNewItem({...newItem, contact_name: e.target.value})}
                                placeholder="Juan Pérez"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Producto</Label>
                            <Input
                                value={newItem.product_name}
                                onChange={e => setNewItem({...newItem, product_name: e.target.value})}
                                placeholder="Producto ejemplo"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Precio Unitario</Label>
                                <Input
                                    type="number"
                                    value={newItem.price}
                                    onChange={e => setNewItem({...newItem, price: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Cantidad</Label>
                                <Input
                                    type="number"
                                    value={newItem.quantity}
                                    onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                                    placeholder="1"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateOrder} disabled={createLoading}>
                            {createLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Crear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por cliente, WhatsApp, item, seguimiento o texto IA..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los canales</SelectItem>
                    <SelectItem value="mercadolibre">Mercado Libre</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="tiendanube">Tienda Nube</SelectItem>
                    <SelectItem value="marketplace">Marketplace</SelectItem>
                    <SelectItem value="manual_admin">Manual admin</SelectItem>
                    <SelectItem value="phone">Teléfono</SelectItem>
                </SelectContent>
            </Select>
            <Select value={aiFilter} onValueChange={setAiFilter}>
                <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="IA" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los pedidos</SelectItem>
                    <SelectItem value="assisted">Solo IA asistida</SelectItem>
                    <SelectItem value="needs_review">IA para revisar</SelectItem>
                    <SelectItem value="ready">IA lista</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className={`grid gap-3 md:grid-cols-3 flex-none ${selectedOrder ? 'hidden md:grid' : ''}`}>
        <Card
          role="button"
          tabIndex={0}
          className={`cursor-pointer border-blue-200 bg-blue-50/60 transition hover:shadow-md dark:border-blue-900 dark:bg-blue-950/20 ${aiFilter === 'assisted' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setAiFilter(aiFilter === 'assisted' ? 'all' : 'assisted')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setAiFilter(aiFilter === 'assisted' ? 'all' : 'assisted');
            }
          }}
          aria-label="Filtrar solicitudes IA"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Solicitudes IA</p>
              <p className="mt-1 text-2xl font-bold">{assistedOrders.length}</p>
            </div>
            <Sparkles className="h-5 w-5 text-blue-600" />
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          className={`cursor-pointer border-amber-200 bg-amber-50/60 transition hover:shadow-md dark:border-amber-900 dark:bg-amber-950/20 ${aiFilter === 'needs_review' ? 'ring-2 ring-amber-500' : ''}`}
          onClick={() => setAiFilter(aiFilter === 'needs_review' ? 'all' : 'needs_review')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setAiFilter(aiFilter === 'needs_review' ? 'all' : 'needs_review');
            }
          }}
          aria-label="Filtrar solicitudes IA para revisar"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Para revisar</p>
              <p className="mt-1 text-2xl font-bold">{assistedNeedsReview.length}</p>
            </div>
            <Package className="h-5 w-5 text-amber-600" />
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          className={`cursor-pointer border-emerald-200 bg-emerald-50/60 transition hover:shadow-md dark:border-emerald-900 dark:bg-emerald-950/20 ${aiFilter === 'ready' ? 'ring-2 ring-emerald-500' : ''}`}
          onClick={() => setAiFilter(aiFilter === 'ready' ? 'all' : 'ready')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setAiFilter(aiFilter === 'ready' ? 'all' : 'ready');
            }
          }}
          aria-label="Filtrar solicitudes IA listas para confirmar"
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Listas para confirmar</p>
              <p className="mt-1 text-2xl font-bold">{assistedReady.length}</p>
            </div>
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          </CardContent>
        </Card>
      </div>

      {hasOperationalDeepLink ? (
        <div
          data-testid="orders-operational-focus"
          className="flex flex-none flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3 text-sm text-blue-950 shadow-sm dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100 md:flex-row md:items-center md:justify-between"
        >
          <div className="min-w-0">
            <p className="font-semibold">Vista operativa aplicada</p>
            <p className="text-xs text-blue-900/75 dark:text-blue-100/75">
              {aiFilter === 'needs_review'
                ? 'Pedidos asistidos que requieren revision del operador.'
                : aiFilter === 'ready'
                  ? 'Pedidos asistidos listos para confirmar o responder.'
                  : aiFilter === 'assisted'
                    ? 'Pedidos asistidos recibidos desde marketplace, WhatsApp o widget.'
                    : 'Pedidos filtrados por contexto operativo.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {channelFilter !== 'all' ? <Badge variant="secondary">Canal: {CHANNEL_LABELS[channelFilter] || channelFilter}</Badge> : null}
            {searchTerm ? <Badge variant="secondary">Busqueda: {searchTerm}</Badge> : null}
            <Badge variant="outline">{filteredOrders.length} visibles</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setChannelFilter('all');
                setAiFilter('all');
                setSelectedOrder(null);
                const next = new URLSearchParams(searchParams);
                ['focus', 'queue', 'ai', 'channel', 'canal', 'q', 'search', 'order_id', 'id', 'pedido_id'].forEach((key) =>
                  next.delete(key),
                );
                setSearchParams(next, { replace: true });
              }}
            >
              Limpiar vista
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 relative">
        {/* Order List */}
        <div className={`md:col-span-1 overflow-y-auto pr-2 space-y-3 ${selectedOrder ? 'hidden md:block' : 'block'}`}>
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
          ) : filteredOrders.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed rounded-lg bg-muted/10">
                 <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                     <Package className="h-6 w-6 text-muted-foreground" />
                 </div>
                 <h3 className="font-medium text-foreground">Sin pedidos</h3>
                 <p className="text-sm text-muted-foreground mt-1">
                     {searchTerm || channelFilter !== 'all' || aiFilter !== 'all'
                        ? "No hay pedidos que coincidan con los filtros."
                        : "Aún no recibiste pedidos en este canal."}
                 </p>
                 {(searchTerm || channelFilter !== 'all' || aiFilter !== 'all') && (
                     <Button variant="link" onClick={() => { setSearchTerm(''); setChannelFilter('all'); setAiFilter('all'); }}>
                         Limpiar filtros
                     </Button>
                 )}
                 <Button variant="outline" size="sm" onClick={loadOrders} className="mt-4 gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Actualizar lista
                 </Button>
             </div>
          ) : (
            filteredOrders.map(order => {
              const orderChannel = order.crm_review_card?.source?.channel || order.assisted_request?.source?.channel || (order as any).channel || (order as any).commercial_state?.channel || 'web';
              const stageLabel = getCommercialStageLabel((order as any).commercial_stage || (order as any).commercial_state?.stage);
              const ChannelIcon = CHANNEL_ICONS[orderChannel] || Globe;
              const isSelected = selectedOrder?.id === order.id;
              const assistedRequest = order.assisted_request;
              const crmReviewCardRaw = order.crm_review_card;
              const crmReviewCardView = getCrmReviewCard(order);
              const hasCrmReviewCard = Boolean(crmReviewCardRaw || crmReviewCardView);
              const unmatchedCount = assistedSummaryNumber(order, 'unmatched');
              const needsManualReview = isAssistedNeedsReview(order);
              const readyForConfirmation = isAssistedReady(order);
              const assistedLabel = crmReviewCardRaw?.request_kind_label || crmReviewCardView?.title || assistedRequest?.request_kind_label || 'Solicitud asistida';
              const assistedIsCatalog = assistedRequest?.document_profile?.catalog_matching !== false;
              const assistedPreview = getAssistedPreview(order);
              const followUpCode = getFollowUpCode(order);
              const customerName = getOrderCustomerName(order);
              const customerPhone = getOrderCustomerPhone(order);
              const customerAvatar = getOrderCustomerAvatar(order);
              const selectOrder = () => {
                if (window.innerWidth < 768) {
                  navigate(buildTenantPath(`/pedidos/${encodeURIComponent(String(order.id))}`, currentSlug));
                } else {
                  setSelectedOrder(order);
                }
              };

              return (
                <Card
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Abrir pedido ${order.id}`}
                  className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'border-primary ring-1 ring-primary bg-accent/50' : ''} ${assistedRequest || hasCrmReviewCard ? 'border-blue-400/60 bg-blue-50/35 dark:bg-blue-950/20' : ''}`}
                  onClick={selectOrder}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectOrder();
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                          <Badge variant="outline" className="px-1.5 h-6 w-6 flex items-center justify-center rounded-full border-muted-foreground/30" title={CHANNEL_LABELS[orderChannel] || normalizeChannelLabel(orderChannel)}>
                              <ChannelIcon className="h-3 w-3" />
                          </Badge>
                          <span className="font-mono text-sm font-bold">#{order.id}</span>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant="secondary" className={STATUS_MAP[order.status]?.color || 'bg-gray-100'}>
                           {STATUS_MAP[order.status]?.label || order.status}
                        </Badge>
                        {stageLabel ? (
                          <Badge variant="outline" className={getCommercialToneClassName(getCommercialStageTone((order as any).commercial_stage || (order as any).commercial_state?.stage))}>
                            {stageLabel}
                          </Badge>
                        ) : null}
                        {assistedRequest || hasCrmReviewCard ? (
                          <Badge
                            variant="outline"
                            className={
                              needsManualReview
                                ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                : readyForConfirmation
                                  ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                  : 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200'
                            }
                          >
                            <Sparkles className="mr-1 h-3 w-3" />
                            {needsManualReview ? 'Revisar' : readyForConfirmation ? 'IA lista' : 'Asistido'}
                          </Badge>
                        ) : null}
                        {hasCrmReviewCard ? (
                          <Badge variant="outline" className="border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200">
                            CRM
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {assistedRequest || hasCrmReviewCard ? (
                      <div className="mb-3 rounded-md border border-blue-200 bg-background/70 p-2 text-xs dark:border-blue-900">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-blue-900 dark:text-blue-100">{assistedLabel}</span>
                          <span className={needsManualReview ? 'text-amber-700 dark:text-amber-300' : readyForConfirmation ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'}>
                            {crmStateLabel(crmReviewCardRaw?.status || crmReviewCardView?.statusLabel || assistedRequest?.crm_state)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-muted-foreground">
                          {assistedIsCatalog ? <span>{assistedSummaryNumber(order, 'matched')} en catalogo</span> : null}
                          <span>{unmatchedCount} para revisar</span>
                          {crmReviewCardRaw?.reference ? <span className="font-mono">{crmReviewCardRaw.reference}</span> : null}
                          {followUpCode ? <span className="font-mono">Seg. {followUpCode}</span> : null}
                        </div>
                        {assistedPreview ? (
                          <p className="mt-2 line-clamp-2 text-muted-foreground">{assistedPreview}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {crmReviewCardView ? (
                      <div className="mb-3">
                        <CrmReviewCardSummary card={crmReviewCardView} compact />
                      </div>
                    ) : null}

                    <div className="flex justify-between items-end gap-3">
                        <div className="min-w-0">
                            <div className="text-sm text-muted-foreground">
                                {format(new Date(order.created_at), "d MMM, HH:mm", { locale: es })}
                            </div>
                            <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                                <IdentityAvatar
                                  name={customerName}
                                  avatarUrl={customerAvatar.avatarUrl}
                                  source={customerAvatar.source}
                                  consented={customerAvatar.consented}
                                  size="sm"
                                  className="h-7 w-7"
                                />
                                <span className="min-w-0 truncate">
                                  {order.items.length} items • {customerName}
                                  {customerPhone ? ` • ${customerPhone}` : ''}
                                </span>
                            </div>
                        </div>
                        <div className="font-bold text-lg">
                            ${order.total.toLocaleString()}
                        </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Order Detail */}
        <div className={`md:col-span-2 h-full min-h-0 flex flex-col ${!selectedOrder ? 'hidden md:flex' : 'flex'}`}>
           {selectedOrder ? (
             <Card className="h-full flex flex-col border-muted/60 shadow-md">
               <CardHeader className="border-b bg-muted/20 py-4 flex-none">
                 <div className="flex justify-between items-center">
                   <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1 md:hidden">
                            <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => setSelectedOrder(null)}>
                                ← Volver
                            </Button>
                        </div>
                        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                            Pedido #{selectedOrder.id}
                            {selectedOrder.externalId && (
                                <Badge variant="outline" className="text-xs font-normal font-mono">
                                    Ref: {selectedOrder.externalId}
                                </Badge>
                            )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                             Canal: {CHANNEL_LABELS[(selectedOrder as any).channel || (selectedOrder as any).commercial_state?.channel || 'web'] || normalizeChannelLabel((selectedOrder as any).channel || (selectedOrder as any).commercial_state?.channel || 'web')}
                             {selectedOrder.externalUrl && (
                                 <a href={selectedOrder.externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5 ml-2">
                                     (Ver original <ExternalLink className="h-3 w-3"/>)
                                 </a>
                             )}
                        </p>
                   </div>
                   <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => window.print()}>Imprimir</Button>
                      <Button size="sm" onClick={() => navigate(buildTenantPath(`/pedidos/${encodeURIComponent(String(selectedOrder.id))}`, currentSlug))}>Ver Detalle Completo</Button>
                   </div>
                 </div>
               </CardHeader>

               <CardContent className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Status Actions */}
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-4">
                    <span className="text-sm font-medium">Estado actual:</span>
                    <Badge className={`text-sm px-3 py-1 ${STATUS_MAP[selectedOrder.status]?.color}`}>
                        {STATUS_MAP[selectedOrder.status]?.label || selectedOrder.status}
                    </Badge>
                    {getCommercialStageLabel((selectedOrder as any).commercial_stage || (selectedOrder as any).commercial_state?.stage) ? (
                      <Badge variant="outline" className={getCommercialToneClassName(getCommercialStageTone((selectedOrder as any).commercial_stage || (selectedOrder as any).commercial_state?.stage))}>
                        {getCommercialStageLabel((selectedOrder as any).commercial_stage || (selectedOrder as any).commercial_state?.stage)}
                      </Badge>
                    ) : null}
                    {(selectedOrder as any).market_order_id ? (
                      <Badge variant="outline" className="border-border/60 bg-background/80">
                        Order #{(selectedOrder as any).market_order_id}
                      </Badge>
                    ) : null}
                    {selectedOrder.assisted_request || selectedOrder.crm_review_card ? (
                      <Badge variant="outline" className="gap-1 border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        {crmStateLabel(selectedAssistedCrmState)}
                      </Badge>
                    ) : null}
                    <div className="flex-1" />
                    <div className="flex gap-2">
                        {selectedOrder.status === 'nuevo' && (
                            <Button
                              size="sm"
                              disabled={!selectedCanConfirmOrder}
                              title={
                                selectedCanConfirmOrder
                                  ? undefined
                                  : 'Resolver catalogo, datos bloqueantes o revision antes de crear el pedido operativo.'
                              }
                              onClick={() => handleStatusChange(selectedOrder.id, 'confirmed')}
                            >
                              {assistedConfirmActionLabel(selectedOrder)}
                            </Button>
                        )}
                        {selectedOrder.status === 'confirmed' && (
                            <Button size="sm" onClick={() => handleStatusChange(selectedOrder.id, 'shipped')}>Marcar Despachado</Button>
                        )}
                        {selectedOrder.status === 'shipped' && (
                            <Button size="sm" onClick={() => handleStatusChange(selectedOrder.id, 'delivered')}>Marcar Entregado</Button>
                        )}
                        {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                             <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleStatusChange(selectedOrder.id, 'cancelled')}>Cancelar</Button>
                        )}
                    </div>
                  </div>

                  {selectedCrmReviewCard ? (
                    <CrmReviewCardSummary card={selectedCrmReviewCard} />
                  ) : null}

                  <CrmOperatorActionsPanel order={selectedOrder} onStatusChange={handleStatusChange} />

                  <AssistedRequestPanel
                    order={selectedOrder}
                    resolvingCatalogCandidateKey={resolvingCatalogCandidateKey}
                    onResolveCatalogCandidate={(payload) => handleResolveCatalogCandidate(selectedOrder, payload)}
                  />

                  <div className="grid md:grid-cols-2 gap-6">
                      {/* Customer Info */}
                      <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cliente</h3>
                          <div className="p-3 border rounded-md bg-card">
                              <div className="flex min-w-0 items-start gap-3">
                                <IdentityAvatar
                                  name={selectedCustomerName}
                                  avatarUrl={selectedCustomerAvatar.avatarUrl}
                                  source={selectedCustomerAvatar.source}
                                  consented={selectedCustomerAvatar.consented}
                                  size="lg"
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{selectedCustomerName}</p>
                                  <p className="text-sm text-muted-foreground">{selectedCustomerPhone}</p>
                                  <p className="text-sm text-muted-foreground">{selectedCustomerEmail}</p>
                                </div>
                              </div>
                              {(selectedCustomerProfile.contact_key || selectedCustomerProfile.channel_group) ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {selectedCustomerProfile.contact_key ? (
                                    <Badge variant="outline">{selectedCustomerProfile.contact_key}</Badge>
                                  ) : null}
                                  {selectedCustomerProfile.channel_group ? (
                                    <Badge variant="outline">{normalizeChannelLabel(selectedCustomerProfile.channel_group)}</Badge>
                                  ) : null}
                                </div>
                              ) : null}
                          </div>
                      </div>

                      {/* Shipping Info */}
                      <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Envío</h3>
                           <div className={`p-3 border rounded-md bg-card ${selectedShippingInfo?.hasData ? '' : 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'}`}>
                              <p className="font-medium">{selectedShippingInfo?.method || 'Sin datos de envio'}</p>
                              {selectedShippingInfo?.address ? (
                                <p className="text-sm text-muted-foreground">{selectedShippingInfo.address}</p>
                              ) : (
                                <p className="text-sm text-amber-700 dark:text-amber-300">
                                  No hay direccion ni metodo confirmado. Pedirlo antes de despachar.
                                </p>
                              )}
                              {selectedShippingInfo?.notes ? (
                                <p className="mt-1 text-xs text-muted-foreground">{selectedShippingInfo.notes}</p>
                              ) : null}
                          </div>
                      </div>
                  </div>

                  {/* Items Table */}
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="p-3 text-left font-medium">Producto</th>
                          <th className="p-3 text-right font-medium">Cant.</th>
                          <th className="p-3 text-right font-medium">Precio</th>
                          <th className="p-3 text-right font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedOrder.items || []).map((item, idx) => (
                          <tr key={idx} className="border-t last:border-0">
                            <td className="p-3">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-muted-foreground">SKU: {item.sku || 'N/A'}</div>
                            </td>
                            <td className="p-3 text-right">{item.quantity}</td>
                            <td className="p-3 text-right">${item.price.toLocaleString()}</td>
                            <td className="p-3 text-right font-medium">${(item.price * item.quantity).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 font-medium">
                        <tr>
                          <td colSpan={3} className="p-3 text-right">Total</td>
                          <td className="p-3 text-right text-lg">${selectedOrder.total.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Dispatch Info */}
                  {selectedOrder.dispatch_email || selectedOrder.dispatch_phone ? (
                      <div className="space-y-2">
                          <h3 className="text-sm font-medium text-blue-900 flex items-center gap-2">
                              <Truck className="h-4 w-4"/> Datos de Despacho
                          </h3>
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-sm text-blue-900">
                              {selectedOrder.dispatch_email && <p>Email: {selectedOrder.dispatch_email}</p>}
                              {selectedOrder.dispatch_phone && <p>Tel: {selectedOrder.dispatch_phone}</p>}
                          </div>
                      </div>
                  ) : null}

                  {/* Internal Notes */}
                  <div className="space-y-2">
                      <h3 className="text-sm font-medium">Notas internas</h3>
                      <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-md text-sm text-yellow-900">
                          {selectedOrder.notes || "Sin notas adicionales."}
                      </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-sm font-medium">Historial de Eventos</h3>
                      <div className="space-y-4 ml-2 border-l-2 border-muted pl-4">
                          {[
                              {
                                  status: 'created',
                                  label: 'Pedido Creado',
                                  // Always active if order exists
                                  active: true,
                                  // Use created_at as the source of truth for the first step
                                  date: selectedOrder.created_at
                              },
                              {
                                  status: 'confirmed',
                                  label: 'Confirmado',
                                  active: ['confirmed', 'paid', 'shipped', 'delivered'].includes(selectedOrder.status),
                                  // If this is the *current* status, we might use updated_at if available, but Order type doesn't guarantee it.
                                  // We leave date undefined to avoid faking it, showing "Completado" instead.
                                  date: undefined
                              },
                              {
                                  status: 'shipped',
                                  label: 'Enviado',
                                  active: ['shipped', 'delivered'].includes(selectedOrder.status),
                                  date: undefined
                              },
                              {
                                  status: 'delivered',
                                  label: 'Entregado',
                                  active: ['delivered'].includes(selectedOrder.status),
                                  date: undefined
                              }
                          ].map((step, idx) => (
                              <div key={idx} className={`relative ${step.active ? '' : 'opacity-50'}`}>
                                  <div className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-background ${step.active ? 'bg-primary' : 'bg-muted'}`} />
                                  <p className="text-sm font-medium">{step.label}</p>
                                  {step.date ? (
                                      <p className="text-xs text-muted-foreground">{format(new Date(step.date), "d MMM, HH:mm", { locale: es })}</p>
                                  ) : (
                                      step.active && <p className="text-xs text-muted-foreground italic">Completado</p>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>

               </CardContent>
             </Card>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-muted rounded-xl p-10 bg-muted/5">
               <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 opacity-50" />
               </div>
               <p className="text-lg font-medium">Selecciona un pedido</p>
               <p className="text-sm">Verás los detalles completos y podrás gestionar su estado.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default PedidosPage;
