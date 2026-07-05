import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Clock3, ExternalLink, Image as ImageIcon, MapPin, Paperclip, Send, ShieldCheck, UserRound } from 'lucide-react';

import {
  getOmnichannelInboxDetailV2,
  postOmnichannelInboxActionV2,
  type OmnichannelActionDelivery,
  type OmnichannelInboxItem,
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
import { getErrorMessage } from '@/utils/api';
import {
  getAttachmentDeliveryUrl,
  getAttachmentPreviewUrl,
  getAttachmentSecurityLabel,
  type AttachmentLike,
} from '@/utils/attachment';
import { formatTicketStatusLabel } from '@/utils/ticketStatus';

import { AgentSuggestionBox } from '../agent-assist/AgentSuggestionBox';
import { AgentSummaryPanel } from '../agent-assist/AgentSummaryPanel';
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

const deliveryTone = (delivery?: OmnichannelActionDelivery | null) => {
  if (delivery?.mode === 'real_message' || delivery?.external_dispatch) return 'sent';
  if (delivery?.mode === 'timeline_only') return 'crm';
  return 'internal';
};

const deliveryTitle = (delivery?: OmnichannelActionDelivery | null) => {
  const tone = deliveryTone(delivery);
  if (tone === 'sent') return 'Mensaje enviado';
  if (tone === 'crm') return 'Guardado en CRM';
  return 'Accion aplicada';
};

const deliveryDescription = (delivery?: OmnichannelActionDelivery | null, fallback?: string | null) =>
  delivery?.operator_message ||
  fallback ||
  (deliveryTone(delivery) === 'crm'
    ? 'La respuesta quedo registrada en el timeline operativo.'
    : 'El inbox fue actualizado.');

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
  const [draft, setDraft] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [lastDelivery, setLastDelivery] = useState<OmnichannelActionDelivery | null>(null);
  const detailQuery = useQuery({
    queryKey: ['inbox-omnichannel-v2-detail', tenantSlug, ticketId, ticket?.detail_endpoint],
    queryFn: () => getOmnichannelInboxDetailV2(ticketId!, tenantSlug, ticket?.detail_endpoint),
    enabled: Boolean(ticketId),
    retry: 0,
    staleTime: 20_000,
  });
  const detailTicket = detailQuery.data?.item ?? ticket;

  const actionMutation = useMutation({
    mutationFn: ({ action, payload }: { action: string; payload?: Record<string, unknown> }) => {
      if (!ticketId) throw new Error('Falta el ticket seleccionado.');
      return postOmnichannelInboxActionV2(ticketId, { action, payload }, tenantSlug);
    },
    onSuccess: (result) => {
      const updatedTicket = result.ticket;
      const delivery = result.delivery ?? null;
      setLastDelivery(delivery);
      if (updatedTicket.id === ticketId) {
        setDraft('');
        setDraftSavedAt(null);
        if (draftStorageKey) {
          try {
            window.localStorage.removeItem(draftStorageKey);
          } catch {
            // local draft cleanup is best-effort
          }
        }
      }
      toast({
        title: deliveryTitle(delivery),
        description: deliveryDescription(
          delivery,
          updatedTicket.status ? `Estado actual: ${formatTicketStatusLabel(updatedTicket.status)}.` : null,
        ),
      });
      onActionComplete?.();
    },
    onError: (error) => {
      toast({
        title: 'No se pudo aplicar la accion',
        description: getErrorMessage(error, 'Reintenta en unos segundos.'),
        variant: 'destructive',
      });
    },
  });

  const draftStorageKey = detailTicket?.id ? `chatboc:omnichannel-draft:${detailTicket.id}` : null;

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
    if (!actionName) return;
    actionMutation.mutate({
      action: actionName,
      payload: {
        ...(action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)
          ? (action.payload as Record<string, unknown>)
          : {}),
        ...(action.endpoint ? { endpoint: action.endpoint } : {}),
      },
    });
  };

  const handleReply = () => {
    const message = draft.trim();
    if (!message) return;
    const replyAction = detailTicket?.allowed_actions?.find((action) => action.id === 'reply');
    const replyDefaults =
      replyAction?.payload && typeof replyAction.payload === 'object' && !Array.isArray(replyAction.payload)
        ? (replyAction.payload as Record<string, unknown>)
        : {};
    actionMutation.mutate({
      action: 'reply',
      payload: {
        ...replyDefaults,
        ...(replyAction?.endpoint ? { endpoint: replyAction.endpoint } : {}),
        message,
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

  const visibleActions = (detailTicket.allowed_actions?.length ? detailTicket.allowed_actions : detailTicket.actions).filter((action) => {
    const required = action.requires ?? [];
    if (!required.length) return true;
    const payload = action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)
      ? action.payload as Record<string, unknown>
      : {};
    return required.every((key) => payload[key] !== undefined && payload[key] !== null && payload[key] !== '');
  });
  const sourceMetadata = detailTicket.source_metadata ?? {};
  const assignee = detailTicket.assignee ?? {};
  const sla = detailTicket.sla ?? {};
  const locationPoint = readInboxLocationPoint(detailTicket.location);
  const canRenderMap = detailTicket.map?.can_render === false ? false : Boolean(locationPoint);
  const attachments = detailTicket.attachments ?? [];
  const channelLabel = normalizeChannelLabel(detailTicket.canal_ingreso ?? detailTicket.channel);
  const assigneeLabel = asText(assignee.name) || asText(assignee.email);
  const slaLabel = asText(sla.status) || (sla.overdue === true ? 'Vencido' : null);
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
  const statusTiles = [
    channelLabel ? { icon: ShieldCheck, label: 'Canal', value: channelLabel } : null,
    assigneeLabel ? { icon: UserRound, label: 'Responsable', value: assigneeLabel } : null,
    slaLabel ? { icon: Clock3, label: 'SLA', value: slaLabel } : null,
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
            </div>
            <Badge variant={deliveryTone(lastDelivery) === 'sent' ? 'default' : 'secondary'}>
              {lastDelivery.channel || 'crm'} · {lastDelivery.reply_status || lastDelivery.status || 'registrado'}
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
