import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Clock3, MapPin, Paperclip, Send, ShieldCheck, UserRound } from 'lucide-react';

import {
  getOmnichannelInboxDetailV2,
  postOmnichannelInboxActionV2,
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

import { AgentSuggestionBox } from '../agent-assist/AgentSuggestionBox';
import { AgentSummaryPanel } from '../agent-assist/AgentSummaryPanel';
import { PresenceAvatars } from './PresenceAvatars';
import { TimelineMergeView } from './TimelineMergeView';

interface TicketConversationPaneProps {
  ticketId?: string;
  ticket?: OmnichannelInboxItem;
  tenantSlug?: string | null;
  onActionComplete?: () => void;
}

export const TicketConversationPane: React.FC<TicketConversationPaneProps> = ({
  ticketId,
  ticket,
  tenantSlug,
  onActionComplete,
}) => {
  const [draft, setDraft] = useState('');
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
    onSuccess: (updatedTicket) => {
      if (updatedTicket.id === ticketId) {
        setDraft('');
      }
      toast({
        title: 'Accion aplicada',
        description: updatedTicket.status ? `Estado actual: ${updatedTicket.status}.` : 'El inbox fue actualizado.',
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

  useEffect(() => {
    setDraft(detailTicket?.suggested_reply ?? '');
  }, [detailTicket?.id, detailTicket?.suggested_reply]);

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
      payload: action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload)
        ? (action.payload as Record<string, unknown>)
        : undefined,
    });
  };

  const handleReply = () => {
    const message = draft.trim();
    if (!message) return;
    actionMutation.mutate({
      action: 'reply',
      payload: { message },
    });
  };

  const readSuggestionLabel = (item: ChatExperienceBlock) =>
    item.label?.trim() || item.title?.trim() || item.text?.trim() || '';

  const readSuggestionText = (item: ChatExperienceBlock) =>
    item.text?.trim() || item.label?.trim() || item.title?.trim() || '';

  if (!ticketId || !detailTicket) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted/10 text-muted-foreground">
        <p>Selecciona una conversacion para ver el detalle omnicanal.</p>
      </div>
    );
  }

  const visibleActions = detailTicket.allowed_actions?.length ? detailTicket.allowed_actions : detailTicket.actions;
  const sourceMetadata = detailTicket.source_metadata ?? {};
  const assignee = detailTicket.assignee ?? {};
  const sla = detailTicket.sla ?? {};
  const mapContract = detailTicket.map ?? {};
  const canRenderMap = Boolean(mapContract.can_render) && Boolean(detailTicket.location?.lat && (detailTicket.location?.lng || detailTicket.location?.lon));
  const attachments = detailTicket.attachments ?? [];
  const frontendContract = detailTicket.frontend_contract?.render_as ? String(detailTicket.frontend_contract.render_as) : 'inbox_360_drawer';

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/50 px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium">#{detailTicket.ticket_id || detailTicket.id}</h3>
            <Badge variant="outline">{detailTicket.status}</Badge>
            {detailTicket.channel ? <Badge variant="secondary">{detailTicket.channel}</Badge> : null}
            {detailTicket.priority ? <Badge variant="outline">{detailTicket.priority}</Badge> : null}
          </div>
          {contactLabel ? <p className="mt-1 truncate text-xs text-muted-foreground">{contactLabel}</p> : null}
        </div>
        <PresenceAvatars users={detailTicket.presence} />
      </div>

      <div className="grid gap-3 border-b bg-muted/10 px-4 py-3 text-xs md:grid-cols-4">
        <StatusTile icon={ShieldCheck} label="SLA" value={String(sla.status ?? (sla.overdue ? 'overdue' : 'ok'))} />
        <StatusTile icon={UserRound} label="Responsable" value={String(assignee.name ?? assignee.email ?? 'Sin asignar')} />
        <StatusTile icon={Clock3} label="Contrato" value={frontendContract} />
        <StatusTile icon={MapPin} label="Mapa" value={canRenderMap ? 'Con coordenadas' : String(mapContract.fallback_when_no_coordinates ?? 'timeline_only')} />
      </div>

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

      <div className="grid gap-3 border-b bg-background px-4 py-3 text-xs lg:grid-cols-[1fr_1fr_1fr]">
        <MiniContractPanel
          title="Origen"
          rows={[
            ['Canal', String(sourceMetadata.channel ?? sourceMetadata.origin ?? detailTicket.channel ?? '-')],
            ['Demo', String(sourceMetadata.demo_session_id ?? '-')],
            ['Widget', String(sourceMetadata.widget_id ?? '-')],
          ]}
        />
        <MiniContractPanel
          title="Ubicacion"
          rows={[
            ['Estado', canRenderMap ? 'ready' : 'timeline_only'],
            ['Direccion', String(detailTicket.location?.address ?? detailTicket.location?.direccion ?? '-')],
            ['Coordenadas', canRenderMap ? `${detailTicket.location?.lat}, ${detailTicket.location?.lng ?? detailTicket.location?.lon}` : '-'],
          ]}
        />
        <MiniContractPanel
          title="Adjuntos"
          rows={[
            ['Total', String(attachments.length)],
            ['Mapa', String(mapContract.fallback_when_no_coordinates ?? '-')],
            ['Detalle', detailQuery.isFetching ? 'Actualizando' : detailQuery.isError ? 'No disponible' : 'Sincronizado'],
          ]}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {attachments.length ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <Badge key={`${String(attachment.id ?? attachment.url ?? index)}`} variant="outline" className="gap-1">
                <Paperclip className="h-3 w-3" />
                {String(attachment.name ?? attachment.filename ?? attachment.type ?? `Adjunto ${index + 1}`)}
              </Badge>
            ))}
          </div>
        ) : null}
        {detailTicket.timeline.length ? (
          <TimelineMergeView events={detailTicket.timeline as TicketTimelineEvent[]} />
        ) : (
          <ViewState
            status="partial"
            title="Timeline pendiente"
            description="Este item todavia no tiene timeline para esta conversacion."
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

        <div className="flex flex-col gap-2">
          <Textarea
            value={draft}
            placeholder="Escribe una respuesta..."
            className="min-h-[80px] resize-none text-sm"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" className="h-8" type="button" disabled={!draft.trim()}>
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
