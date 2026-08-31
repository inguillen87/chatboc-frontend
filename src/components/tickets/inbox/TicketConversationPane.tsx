import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Image as ImageIcon, MapPin, MessageCircle, Paperclip, Send, ShieldCheck, UserRound } from 'lucide-react';

import {
  createOmnichannelReplyClientMessageId,
  getOmnichannelInboxDetailV2,
  postOmnichannelInboxActionV2,
  type OmnichannelActionDelivery,
  type OmnichannelInboxItem,
  type OmnichannelLiveChatStatus,
  type SaasAction,
} from '@/api/v2/saas';
import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import type { TicketTimelineEvent } from '@/schemas/api';
import type { ChatExperienceBlock } from '@/types/chat';
import type { EducationCaseAlias } from '@/types/education';
import { ApiError, getErrorMessage } from '@/utils/api';
import {
  getAttachmentDeliveryUrl,
  getAttachmentPreviewUrl,
  getAttachmentSecurityLabel,
  type AttachmentLike,
} from '@/utils/attachment';
import { formatTicketStatusLabel } from '@/utils/ticketStatus';

import { AgentSuggestionBox } from '../agent-assist/AgentSuggestionBox';
import { AgentSummaryPanel } from '../agent-assist/AgentSummaryPanel';
import TicketAiHandoffControl, { isAiHandoffAction } from '../TicketAiHandoffControl';
import { TicketSlaClocks } from '../TicketSlaClocks';
import { PresenceAvatars } from './PresenceAvatars';
import { TimelineMergeView } from './TimelineMergeView';

const LazyTicketMap = React.lazy(() => import('@/components/TicketMap'));

interface TicketConversationPaneProps {
  ticketId?: string;
  ticket?: OmnichannelInboxItem;
  tenantSlug?: string | null;
  onActionComplete?: () => void;
}

const asText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const asFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const readInboxLocationPoint = (location?: Record<string, unknown>) => {
  if (!location) return null;
  const lat = asFiniteNumber(location.latitud ?? location.lat ?? location.latitude);
  const lng = asFiniteNumber(location.longitud ?? location.lng ?? location.lon ?? location.longitude);
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

const readInboxAttachmentUrl = (attachment: Record<string, unknown>) =>
  getAttachmentDeliveryUrl(attachment as AttachmentLike);

const readInboxAttachmentPreviewUrl = (attachment: Record<string, unknown>) =>
  getAttachmentPreviewUrl(attachment as AttachmentLike);

const readInboxAttachmentLabel = (attachment: Record<string, unknown>, index: number) =>
  asText(attachment.name) ||
  asText(attachment.nombre) ||
  asText(attachment.filename) ||
  asText(attachment.file_name) ||
  asText(attachment.type) ||
  (attachment.archivo_adjunto_id ? `Archivo ${String(attachment.archivo_adjunto_id)}` : `Archivo ${index + 1}`);

const isImageAttachment = (attachment: Record<string, unknown>) => {
  const type = asText(attachment.type)?.toLowerCase() || asText(attachment.mime_type)?.toLowerCase() || '';
  const url = readInboxAttachmentUrl(attachment)?.toLowerCase() || '';
  return type.startsWith('image') || /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url);
};

const normalizeChannelLabel = (value?: string | null) =>
  value?.trim().toLowerCase() === 'whatsapp' ? 'WhatsApp' : value?.trim() || null;

const liveChatLabel = (liveChat?: OmnichannelLiveChatStatus) => {
  const state = liveChat?.channel_state;
  if (state === 'queued') return 'Mensaje en cola';
  if (state === 'online') return 'Chat en vivo disponible';
  if (state === 'offline') return 'Fuera de horario';
  return null;
};

const liveChatClassName = (state?: string) => {
  if (state === 'queued') return 'border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-200';
  if (state === 'online') return 'border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  return 'border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-200';
};

type DeliveryTone = 'success' | 'warning' | 'pending' | 'replay' | 'crm' | 'internal';

interface DeliveryView {
  title: string;
  badge: string;
  tone: DeliveryTone;
}

const deliveryView = (delivery?: OmnichannelActionDelivery | null): DeliveryView => {
  const finalStatus = delivery?.final_delivery?.status?.trim().toLowerCase();
  const finalSource = delivery?.final_delivery?.authoritative_source?.trim().toLowerCase();
  const mode = delivery?.mode?.trim().toLowerCase();
  const evidenceStage = delivery?.evidence_stage?.trim().toLowerCase();
  const status = delivery?.status?.trim().toLowerCase();
  const providerCallbackIsAuthoritative = finalSource === 'provider_status_callback';

  if (providerCallbackIsAuthoritative && ['delivered', 'read'].includes(finalStatus || '')) {
    return { title: 'Entrega confirmada', badge: finalStatus === 'read' ? 'Leído' : 'Entregado', tone: 'success' };
  }
  if (providerCallbackIsAuthoritative && ['failed', 'undelivered'].includes(finalStatus || '')) {
    return { title: 'Entrega no realizada', badge: 'Fallo confirmado', tone: 'warning' };
  }
  if (mode === 'idempotent_replay' || delivery?.idempotency?.replayed) {
    return { title: 'Reintento reconocido', badge: 'Replay sin duplicado', tone: 'replay' };
  }
  if (mode === 'durable_queue' || evidenceStage === 'durably_staged' || status === 'durably_staged') {
    return { title: 'Respuesta encolada', badge: 'Encolado', tone: 'pending' };
  }
  if (evidenceStage === 'provider_accepted' || status === 'provider_accepted') {
    return { title: 'Aceptado por el proveedor', badge: 'Pendiente de callback', tone: 'pending' };
  }
  if (mode === 'timeline_only' || evidenceStage === 'crm_only') {
    return { title: 'Guardado solo en CRM', badge: 'CRM-only', tone: 'crm' };
  }
  return { title: 'Acción aplicada', badge: delivery?.status || 'Registrado', tone: 'internal' };
};

const deliveryTitle = (delivery?: OmnichannelActionDelivery | null) => deliveryView(delivery).title;

const deliveryDescription = (delivery?: OmnichannelActionDelivery | null, fallback?: string | null) => {
  const view = deliveryView(delivery);
  if (view.tone === 'success') return 'El callback del proveedor confirmó la entrega final.';
  if (view.tone === 'warning') return 'El callback del proveedor confirmó que la entrega no se completó.';
  return delivery?.operator_message ||
    fallback ||
    (view.tone === 'crm'
      ? 'La respuesta quedó registrada en el timeline operativo sin despacho externo.'
      : 'El inbox fue actualizado; la entrega final depende de la evidencia del proveedor.');
};

const finalDeliveryEvidenceLabel = (status: string) => {
  const normalized = status.trim().toLowerCase();
  const labels: Record<string, string> = {
    pending_provider_callback: 'pendiente de callback del proveedor',
    preserved_from_original_attempt: 'evidencia del intento original preservada',
    not_dispatched: 'sin despacho externo',
    delivered: 'entregada',
    read: 'leída',
    failed: 'fallida',
    undelivered: 'no entregada',
  };
  return labels[normalized] || normalized.replace(/_/g, ' ');
};

const finalDeliverySourceLabel = (source: string) => {
  const normalized = source.trim().toLowerCase();
  const labels: Record<string, string> = {
    provider_status_callback: 'callback de estado del proveedor',
    original_attempt_evidence: 'evidencia del intento original',
    not_applicable: 'no aplica',
  };
  return labels[normalized] || normalized.replace(/_/g, ' ');
};

const deliveryEvidence = (delivery?: OmnichannelActionDelivery | null) => {
  if (!delivery) return [];
  const evidence: string[] = [];
  const finalStatus = delivery.final_delivery?.status;
  const finalSource = delivery.final_delivery?.authoritative_source;
  if (finalStatus) {
    const statusLabel = finalSource?.trim().toLowerCase() === 'provider_status_callback'
      ? 'Entrega final'
      : 'Estado preservado';
    evidence.push(`${statusLabel}: ${finalDeliveryEvidenceLabel(finalStatus)}`);
  }
  if (finalSource) {
    evidence.push(`Fuente: ${finalDeliverySourceLabel(finalSource)}`);
  }
  if (delivery.idempotency) {
    evidence.push(`Idempotencia: ${delivery.idempotency.replayed ? 'replay sin duplicado' : 'primera aplicación'}`);
  }
  if (delivery.outbox) {
    const effectCount = delivery.outbox.effect_count;
    evidence.push(
      typeof effectCount === 'number'
        ? `Outbox: ${effectCount} efecto${effectCount === 1 ? '' : 's'}`
        : `Outbox: ${delivery.outbox.durably_staged ? 'encolado' : 'sin evidencia durable'}`,
    );
  }
  return evidence;
};

const isAmbiguousActionError = (error: unknown) => {
  if (!(error instanceof ApiError)) return true;
  return error.status >= 500 || [408, 425, 429].includes(error.status);
};

interface ReplyAttempt {
  fingerprint: string;
  clientMessageId: string;
}

const normalizeInboxTenantScope = (tenantSlug?: string | null) =>
  tenantSlug?.trim().toLowerCase() || 'unscoped';

const inboxDetailQueryKey = (
  tenantSlug: string | null | undefined,
  ticketId: string | undefined,
  detailEndpoint?: string | null,
) => ['inbox-omnichannel-v2-detail', normalizeInboxTenantScope(tenantSlug), ticketId ?? 'missing', detailEndpoint ?? null] as const;

interface InboxActionScope {
  key: string;
  ticketId: string;
  tenantSlug?: string | null;
  detailEndpoint?: string | null;
  detailQueryKey: ReturnType<typeof inboxDetailQueryKey>;
  draftStorageKey?: string | null;
  attemptClientMessageId?: string | null;
}

interface InboxActionVariables {
  action: string;
  payload?: Record<string, unknown>;
  scope: InboxActionScope;
}

function SafeInboxImage({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const cleanSrc = src?.trim();
  if (!cleanSrc || failed) return null;
  return (
    <img
      src={cleanSrc}
      alt={alt}
      loading="lazy"
      className="h-40 w-full rounded-[8px] border object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export const TicketConversationPane: React.FC<TicketConversationPaneProps> = ({
  ticketId,
  ticket,
  tenantSlug,
  onActionComplete,
}) => {
  const queryClient = useQueryClient();
  const detailQueryKey = inboxDetailQueryKey(tenantSlug, ticketId, ticket?.detail_endpoint);
  const activeScopeKey = JSON.stringify([
    normalizeInboxTenantScope(tenantSlug),
    ticketId ?? 'missing',
    ticket?.detail_endpoint ?? null,
  ]);
  const [draftState, setDraftState] = useState<{
    scopeKey: string;
    value: string;
    savedAt: string | null;
  } | null>(null);
  const [lastDeliveryState, setLastDeliveryState] = useState<{
    scopeKey: string;
    delivery: OmnichannelActionDelivery;
  } | null>(null);
  const replyAttemptRef = useRef<ReplyAttempt | null>(null);
  const activeScopeRef = useRef(activeScopeKey);
  activeScopeRef.current = activeScopeKey;
  const draft = draftState?.scopeKey === activeScopeKey ? draftState.value : '';
  const draftSavedAt = draftState?.scopeKey === activeScopeKey ? draftState.savedAt : null;
  const setDraft = (value: string) => {
    setDraftState((current) => ({
      scopeKey: activeScopeKey,
      value,
      savedAt: current?.scopeKey === activeScopeKey ? current.savedAt : null,
    }));
  };
  const setDraftSavedAt = (savedAt: string | null) => {
    setDraftState((current) => ({
      scopeKey: activeScopeKey,
      value: current?.scopeKey === activeScopeKey ? current.value : '',
      savedAt,
    }));
  };
  const lastDelivery = lastDeliveryState?.scopeKey === activeScopeKey
    ? lastDeliveryState.delivery
    : null;
  const detailQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => getOmnichannelInboxDetailV2(ticketId!, tenantSlug, ticket?.detail_endpoint),
    enabled: Boolean(ticketId),
    retry: 0,
    staleTime: 20_000,
  });
  const detailTicket = detailQuery.data?.item ?? ticket;

  const actionMutation = useMutation({
    mutationFn: ({ action, payload, scope }: InboxActionVariables) => {
      return postOmnichannelInboxActionV2(scope.ticketId, { action, payload }, scope.tenantSlug);
    },
    onSuccess: async (result, variables) => {
      const updatedTicket = result.ticket;
      const delivery = result.delivery ?? null;
      const isCurrentScope = activeScopeRef.current === variables.scope.key;
      const responseMatchesTicket = updatedTicket.id === variables.scope.ticketId;
      if (responseMatchesTicket) {
        queryClient.setQueryData(variables.scope.detailQueryKey, (previous: unknown) => ({
          ...(previous && typeof previous === 'object' ? previous : {}),
          item: updatedTicket,
          raw: result.raw,
        }));
        await queryClient.invalidateQueries({
          queryKey: variables.scope.detailQueryKey,
          exact: true,
          refetchType: 'active',
        });
      }
      if (!isCurrentScope) {
        onActionComplete?.();
        return;
      }
      setLastDeliveryState(
        responseMatchesTicket && delivery
          ? { scopeKey: variables.scope.key, delivery }
          : null,
      );
      if (
        variables.action === 'reply' &&
        replyAttemptRef.current?.clientMessageId === variables.scope.attemptClientMessageId
      ) {
        replyAttemptRef.current = null;
      }
      if (variables.action === 'reply' && responseMatchesTicket) {
        setDraft('');
        setDraftSavedAt(null);
        if (variables.scope.draftStorageKey) {
          try {
            window.localStorage.removeItem(variables.scope.draftStorageKey);
          } catch {
            // local draft cleanup is best-effort
          }
        }
      }
      toast(responseMatchesTicket
        ? {
            title: deliveryTitle(delivery),
            description: deliveryDescription(
              delivery,
              updatedTicket.status ? `Estado actual: ${formatTicketStatusLabel(updatedTicket.status)}.` : null,
            ),
          }
        : {
            title: 'Respuesta no confirmada',
            description: 'El backend devolviÃ³ otro ticket. No se aplicÃ³ el resultado en esta conversaciÃ³n.',
            variant: 'destructive',
          });
      onActionComplete?.();
    },
    onError: (error, variables) => {
      if (activeScopeRef.current !== variables.scope.key) return;
      if (
        variables.action === 'reply' &&
        !isAmbiguousActionError(error) &&
        replyAttemptRef.current?.clientMessageId === variables.scope.attemptClientMessageId
      ) {
        replyAttemptRef.current = null;
      }
      toast({
        title: 'No se pudo aplicar la accion',
        description: getErrorMessage(error, 'Reintenta en unos segundos.'),
        variant: 'destructive',
      });
    },
  });

  const draftStorageKey = detailTicket?.id
    ? `chatboc:omnichannel-draft:${normalizeInboxTenantScope(tenantSlug)}:${detailTicket.id}`
    : null;

  useEffect(() => {
    replyAttemptRef.current = null;
    setLastDeliveryState(null);
  }, [activeScopeKey]);

  useEffect(() => {
    if (!draftStorageKey) {
      setDraft(detailTicket?.suggested_reply ?? '');
      setDraftSavedAt(null);
      return;
    }
    let storedDraft: string | null = null;
    try {
      storedDraft = window.localStorage.getItem(draftStorageKey);
    } catch {
      storedDraft = null;
    }
    setDraft(storedDraft ?? detailTicket?.suggested_reply ?? '');
    setDraftSavedAt(storedDraft ? 'guardado local' : null);
  }, [detailTicket?.id, detailTicket?.suggested_reply, draftStorageKey]);

  const contactLabel = useMemo(() => {
    const contact = detailTicket?.contact ?? {};
    return String(contact.name ?? contact.nombre ?? contact.display_name ?? contact.email ?? detailTicket?.title ?? '');
  }, [detailTicket]);

  const handleAction = (action: SaasAction) => {
    if (action.href) {
      window.open(action.href, '_blank', 'noopener,noreferrer');
      return;
    }
    const actionName = action.type ?? action.id;
    if (!actionName || !ticketId) return;
    actionMutation.mutate({
      action: actionName,
      payload: {
        ...(action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)
          ? (action.payload as Record<string, unknown>)
          : {}),
        ...(action.endpoint ? { endpoint: action.endpoint } : {}),
      },
      scope: {
        key: activeScopeKey,
        ticketId,
        tenantSlug,
        detailEndpoint: ticket?.detail_endpoint,
        detailQueryKey,
        draftStorageKey,
      },
    });
  };

  const handleReply = () => {
    const message = draft.trim();
    if (!message || !ticketId) return;
    const replyAction = detailTicket?.allowed_actions?.find((action) => action.id === 'reply');
    const replyDefaults =
      replyAction?.payload && typeof replyAction.payload === 'object' && !Array.isArray(replyAction.payload)
        ? (replyAction.payload as Record<string, unknown>)
        : {};
    const safeReplyDefaults = { ...replyDefaults };
    delete safeReplyDefaults.client_message_id;
    delete safeReplyDefaults.idempotency_key;
    const fingerprint = JSON.stringify({ tenant: normalizeInboxTenantScope(tenantSlug), ticketId, message });
    let replyAttempt = replyAttemptRef.current;
    if (!replyAttempt || replyAttempt.fingerprint !== fingerprint) {
      try {
        replyAttempt = {
          fingerprint,
          clientMessageId: createOmnichannelReplyClientMessageId(),
        };
      } catch (error) {
        toast({
          title: 'No se pudo identificar la respuesta',
          description: getErrorMessage(error, 'Usa un navegador con criptografía segura.'),
          variant: 'destructive',
        });
        return;
      }
      replyAttemptRef.current = replyAttempt;
    }
    actionMutation.mutate({
      action: 'reply',
      payload: {
        ...safeReplyDefaults,
        ...(replyAction?.endpoint ? { endpoint: replyAction.endpoint } : {}),
        message,
        client_message_id: replyAttempt.clientMessageId,
      },
      scope: {
        key: activeScopeKey,
        ticketId,
        tenantSlug,
        detailEndpoint: ticket?.detail_endpoint,
        detailQueryKey,
        draftStorageKey,
        attemptClientMessageId: replyAttempt.clientMessageId,
      },
    });
  };

  const handleSaveDraft = () => {
    const message = draft.trim();
    if (!message || !draftStorageKey) return;
    try {
      window.localStorage.setItem(draftStorageKey, message);
      setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      toast({ title: 'Borrador guardado', description: 'Queda disponible en este dispositivo.' });
    } catch {
      toast({
        title: 'No se pudo guardar el borrador',
        description: 'El navegador no permitio guardar este texto localmente.',
        variant: 'destructive',
      });
    }
  };

  const readSuggestionLabel = (item: ChatExperienceBlock) =>
    item.label?.trim() || item.title?.trim() || item.text?.trim() || '';

  const readSuggestionText = (item: ChatExperienceBlock) =>
    item.text?.trim() || item.label?.trim() || item.title?.trim() || '';

  if (!ticketId || !detailTicket) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted/10 text-muted-foreground">
        <p>Seleccioná una conversación para ver el detalle omnicanal.</p>
      </div>
    );
  }

  const publishedActions = detailTicket.allowed_actions?.length ? detailTicket.allowed_actions : detailTicket.actions;
  const handoffActions = publishedActions.filter(isAiHandoffAction);
  const visibleActions = publishedActions.filter((action) => !isAiHandoffAction(action)).filter((action) => {
    const required = action.requires ?? [];
    if (!required.length) return true;
    const payload = action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)
      ? action.payload as Record<string, unknown>
      : {};
    return required.every((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '');
  });
  const sourceMetadata = detailTicket.source_metadata ?? {};
  const assignee = detailTicket.assignee ?? {};
  const locationPoint = readInboxLocationPoint(detailTicket.location);
  const canRenderMap = detailTicket.map?.can_render === false ? false : Boolean(locationPoint);
  const attachments = detailTicket.attachments ?? [];
  const channelLabel = normalizeChannelLabel(detailTicket.canal_ingreso ?? detailTicket.channel);
  const assigneeLabel = asText(assignee.name) || asText(assignee.email);
  const attachmentCount = detailTicket.archivos_count ?? attachments.length;
  const directPhotoUrl =
    asText(detailTicket.foto_url_directa) ||
    attachments
      .map((attachment) => (isImageAttachment(attachment) ? readInboxAttachmentPreviewUrl(attachment) : null))
      .find(Boolean) ||
    null;
  const locationAddress = asText(detailTicket.location?.address) || asText(detailTicket.location?.direccion);
  const originRows = [
    channelLabel ? ['Canal', channelLabel] as [string, string] : null,
    asText(sourceMetadata.origin) ? ['Origen', String(sourceMetadata.origin)] as [string, string] : null,
    asText(sourceMetadata.demo_session_id) ? ['Demo', String(sourceMetadata.demo_session_id)] as [string, string] : null,
    asText(sourceMetadata.widget_id) ? ['Widget', String(sourceMetadata.widget_id)] as [string, string] : null,
  ].filter((row): row is [string, string] => Boolean(row));
  const locationRows = [
    locationAddress ? ['Direccion', locationAddress] as [string, string] : null,
    locationPoint ? ['Coordenadas', `${locationPoint.lat.toFixed(5)}, ${locationPoint.lng.toFixed(5)}`] as [string, string] : null,
  ].filter((row): row is [string, string] => Boolean(row));
  const attachmentRows = [
    attachmentCount ? ['Total', String(attachmentCount)] as [string, string] : null,
    directPhotoUrl ? ['Foto', 'Disponible'] as [string, string] : null,
    detailQuery.isFetching ? ['Estado', 'Actualizando'] as [string, string] : null,
    detailQuery.isError ? ['Estado', 'No disponible'] as [string, string] : null,
  ].filter((row): row is [string, string] => Boolean(row));
  const liveChat = detailTicket.live_chat;
  const liveChatStateLabel = liveChatLabel(liveChat);
  const liveChatSchedule =
    asText(liveChat?.schedule_label) ||
    asText(liveChat?.availability?.schedule_label) ||
    asText(liveChat?.description);
  const liveChatOfflineMessage =
    asText(liveChat?.offline_fallback_message) ||
    asText(liveChat?.availability?.offline_fallback_message) ||
    asText(liveChat?.offline_message?.message);
  const liveChatPendingMessages = asFiniteNumber(liveChat?.queue?.pending_customer_messages) ?? 0;
  const liveChatAction = (liveChat?.actions || []).find((action) => action.href || action.endpoint);
  const lastDeliveryView = deliveryView(lastDelivery);
  const lastDeliveryEvidence = deliveryEvidence(lastDelivery);
  const statusTiles = [
    channelLabel ? { icon: ShieldCheck, label: 'Canal', value: channelLabel } : null,
    liveChatStateLabel ? { icon: MessageCircle, label: 'Live chat', value: liveChatStateLabel } : null,
    assigneeLabel ? { icon: UserRound, label: 'Responsable', value: assigneeLabel } : null,
    locationPoint ? { icon: MapPin, label: 'Ubicacion', value: 'Con coordenadas' } : null,
    attachmentCount ? { icon: Paperclip, label: 'Adjuntos', value: String(attachmentCount) } : null,
  ].filter((tile): tile is { icon: React.ElementType; label: string; value: string } => Boolean(tile));

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/50 px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium">#{detailTicket.nro_ticket || detailTicket.ticket_id || detailTicket.id}</h3>
            <Badge variant="outline">{detailTicket.status}</Badge>
            {channelLabel ? <Badge variant="secondary">{channelLabel}</Badge> : null}
            {liveChatStateLabel ? (
              <Badge
                variant="outline"
                className={liveChatClassName(liveChat?.channel_state)}
                data-testid="omnichannel-live-chat-state"
              >
                {liveChatStateLabel}
              </Badge>
            ) : null}
            {detailTicket.priority ? <Badge variant="outline">{detailTicket.priority}</Badge> : null}
          </div>
          {contactLabel ? <p className="mt-1 truncate text-xs text-muted-foreground">{contactLabel}</p> : null}
        </div>
        <PresenceAvatars users={detailTicket.presence} />
      </div>

      {statusTiles.length ? (
        <div className="grid gap-3 border-b bg-muted/10 px-4 py-3 text-xs md:grid-cols-4">
          {statusTiles.map((tile) => (
            <StatusTile key={`${tile.label}-${tile.value}`} icon={tile.icon} label={tile.label} value={tile.value} />
          ))}
        </div>
      ) : null}

      <div className="border-b bg-background px-4 py-3">
        <TicketSlaClocks sla={detailTicket.sla} />
      </div>

      {liveChatStateLabel ? (
        <div
          className={`mx-4 mt-3 rounded-[8px] border px-3 py-2 text-xs ${liveChatClassName(liveChat?.channel_state)}`}
          data-testid="omnichannel-live-chat-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MessageCircle className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">{liveChatStateLabel}</p>
                {liveChatSchedule ? <p className="truncate opacity-80">{liveChatSchedule}</p> : null}
              </div>
            </div>
            {liveChatPendingMessages > 0 ? (
              <Badge variant="outline" className="border-current text-current">
                {liveChatPendingMessages} pendiente{liveChatPendingMessages === 1 ? '' : 's'}
              </Badge>
            ) : null}
            {liveChatAction ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-current text-current hover:bg-background/60"
                onClick={() => handleAction(liveChatAction)}
                disabled={actionMutation.isPending}
              >
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                {liveChatAction.label || 'Abrir hilo'}
              </Button>
            ) : null}
          </div>
          {liveChat?.channel_state !== 'online' && liveChatOfflineMessage ? (
            <p className="mt-2 leading-5 opacity-90">{liveChatOfflineMessage}</p>
          ) : null}
        </div>
      ) : null}

      {handoffActions.length || detailTicket.handoff?.status ? (
        <div className="px-4 pt-3">
          <TicketAiHandoffControl
            ticketId={ticketId}
            tenantSlug={tenantSlug}
            handoff={detailTicket.handoff}
            actions={handoffActions}
            onActionComplete={(result) => {
              setLastDeliveryState(
                result.delivery ? { scopeKey: activeScopeKey, delivery: result.delivery } : null,
              );
              void detailQuery.refetch();
              onActionComplete?.();
            }}
          />
        </div>
      ) : null}

      <AgentSummaryPanel
        isLoading={false}
        summary={detailTicket.summary ?? detailTicket.description ?? null}
        nextSteps={detailTicket.next_steps}
      />

      {detailTicket.school_case ? <SchoolCaseAliasPanel schoolCase={detailTicket.school_case} /> : null}

      {visibleActions.length ? (
        <div className="flex flex-wrap gap-2 border-b bg-muted/20 px-4 py-3">
          {visibleActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              type="button"
              variant="outline"
              disabled={action.disabled || actionMutation.isPending}
              onClick={() => handleAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {originRows.length || locationRows.length || attachmentRows.length ? (
        <div className="grid gap-3 border-b bg-background px-4 py-3 text-xs lg:grid-cols-[1fr_1fr_1fr]">
          <MiniContractPanel title="Origen" rows={originRows} />
          <MiniContractPanel title="Ubicacion" rows={locationRows} />
          <MiniContractPanel title="Adjuntos" rows={attachmentRows} />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {directPhotoUrl || attachments.length ? (
          <EvidencePanel photoUrl={directPhotoUrl} attachments={attachments} />
        ) : null}
        {canRenderMap && locationPoint ? (
          <React.Suspense
            fallback={
              <div className="flex h-44 items-center justify-center rounded-lg border border-border bg-muted/40 text-xs text-muted-foreground">
                Cargando mapa...
              </div>
            }
          >
            <LazyTicketMap
              ticket={{
                latitud: locationPoint.lat,
                longitud: locationPoint.lng,
                direccion: locationAddress,
              }}
              hideTitle
              showOverlay={false}
              showAddressHint={Boolean(locationAddress)}
              heightClassName="h-44"
            />
          </React.Suspense>
        ) : null}
        {detailTicket.timeline.length ? (
          <TimelineMergeView events={detailTicket.timeline as TicketTimelineEvent[]} />
        ) : (
          <ViewState
            status="partial"
            title="Timeline pendiente"
            description="Este ítem todavía no tiene timeline para esta conversación."
            className="min-h-[180px]"
          />
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t bg-background p-3">
        {detailTicket.suggested_reply ? (
          <AgentSuggestionBox
            suggestion={detailTicket.suggested_reply}
            onAccept={(text) => setDraft(text)}
            onReject={() => setDraft('')}
          />
        ) : null}

        {detailTicket.agent_copilot_suggestions?.length ? (
          <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 px-3 py-2">
            {detailTicket.agent_copilot_suggestions.map((item, index) => {
              const label = readSuggestionLabel(item);
              const text = readSuggestionText(item);
              if (!label || !text) return null;
              return (
                <Button
                  key={item.id || `${label}-${index}`}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-auto whitespace-normal text-xs"
                  disabled={actionMutation.isPending}
                  onClick={() => setDraft(text)}
                >
                  {label}
                </Button>
              );
            })}
          </div>
        ) : null}

        {lastDelivery ? (
          <div
            data-testid="omnichannel-delivery-status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border bg-muted/20 px-3 py-2 text-xs"
          >
            <div className="min-w-0">
              <div className="font-semibold text-foreground">{deliveryTitle(lastDelivery)}</div>
              <div className="mt-0.5 text-muted-foreground">{deliveryDescription(lastDelivery)}</div>
              {lastDeliveryEvidence.length ? (
                <div
                  className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
                  data-testid="omnichannel-delivery-evidence"
                >
                  {lastDeliveryEvidence.map((item) => <span key={item}>{item}</span>)}
                </div>
              ) : null}
            </div>
            <Badge variant={lastDeliveryView.tone === 'success' ? 'default' : 'secondary'}>
              {lastDelivery.channel || 'crm'} · {lastDeliveryView.badge}
            </Badge>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            placeholder="Escribe una respuesta..."
            className="min-h-[80px] resize-none text-sm"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex items-center justify-end gap-2">
            {draftSavedAt ? <span className="mr-auto text-xs text-muted-foreground">Borrador {draftSavedAt}</span> : null}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              type="button"
              disabled={!draft.trim()}
              onClick={handleSaveDraft}
            >
              Guardar borrador
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              type="button"
              disabled={!draft.trim() || actionMutation.isPending}
              onClick={handleReply}
            >
              Enviar mensaje <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusTile = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="rounded-[8px] border bg-background px-3 py-2">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="font-medium">{label}</span>
    </div>
    <div className="mt-1 truncate font-semibold text-foreground">{value}</div>
  </div>
);

const MiniContractPanel = ({ title, rows }: { title: string; rows: Array<[string, string]> }) => (
  rows.length ? (
  <div className="rounded-[8px] border bg-muted/10 p-3">
    <div className="mb-2 font-semibold text-foreground">{title}</div>
    <div className="space-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 justify-between gap-3">
          <span className="text-muted-foreground">{label}</span>
          <span className="truncate font-medium text-foreground">{value}</span>
        </div>
      ))}
    </div>
  </div>
  ) : null
);

const EvidencePanel = ({
  photoUrl,
  attachments,
}: {
  photoUrl?: string | null;
  attachments: Record<string, unknown>[];
}) => (
  <div className="space-y-3 rounded-[8px] border bg-muted/10 p-3">
    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
      <ImageIcon className="h-3.5 w-3.5 text-primary" />
      Evidencia del caso
    </div>
    {photoUrl ? <SafeInboxImage src={photoUrl} alt="Evidencia adjunta al reclamo" /> : null}
    {attachments.length ? (
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment, index) => {
          const label = readInboxAttachmentLabel(attachment, index);
          const url = readInboxAttachmentUrl(attachment);
          const previewUrl = readInboxAttachmentPreviewUrl(attachment);
          const securityLabel = getAttachmentSecurityLabel(attachment as AttachmentLike);
          const key = `${String(attachment.id ?? attachment.archivo_adjunto_id ?? url ?? label)}-${index}`;
          return url ? (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {previewUrl && isImageAttachment(attachment) ? (
                <ImageIcon className="h-3 w-3" />
              ) : (
                <Paperclip className="h-3 w-3" />
              )}
              <span className="truncate">{label}</span>
              {securityLabel ? <span className="shrink-0 text-[10px] font-semibold uppercase">{securityLabel}</span> : null}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <Badge key={key} variant="outline" className="max-w-full gap-1">
              <Paperclip className="h-3 w-3" />
              <span className="truncate">{label}</span>
            </Badge>
          );
        })}
      </div>
    ) : null}
  </div>
);

const readCaseValue = (schoolCase: EducationCaseAlias, keys: Array<keyof EducationCaseAlias>) => {
  for (const key of keys) {
    const value = schoolCase[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return null;
};

const SchoolCaseAliasPanel = ({ schoolCase }: { schoolCase: EducationCaseAlias }) => {
  const fields = [
    { id: 'school', label: 'Colegio', value: readCaseValue(schoolCase, ['school_name', 'school_id']) },
    { id: 'student', label: 'Alumno/familia', value: readCaseValue(schoolCase, ['student_name', 'guardian_name']) },
    { id: 'case', label: 'Caso', value: readCaseValue(schoolCase, ['taxonomy_label', 'case_type', 'case_id']) },
  ].filter((field) => field.value);

  return (
    <div className="border-b bg-muted/20 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-foreground">Caso escolar</span>
        {schoolCase.contract_version ? <Badge variant="outline">{schoolCase.contract_version}</Badge> : null}
        {schoolCase.status ? <Badge variant="secondary">{schoolCase.status}</Badge> : null}
        {schoolCase.sensitivity_level ? <Badge variant="outline">{schoolCase.sensitivity_level}</Badge> : null}
        {schoolCase.requires_handoff ? <Badge variant="destructive">handoff</Badge> : null}
      </div>
      {fields.length ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {fields.map((field) => (
            <div key={field.id} className="min-w-0 rounded-md border bg-background px-2 py-1.5">
              <p className="text-[11px] text-muted-foreground">{field.label}</p>
              <p className="truncate text-xs font-medium text-foreground">{field.value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
