import React, { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';

import { postOmnichannelInboxActionV2, type OmnichannelInboxItem, type SaasAction } from '@/api/v2/saas';
import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import type { TicketTimelineEvent } from '@/schemas/api';
import type { ChatExperienceBlock } from '@/types/chat';
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
    setDraft(ticket?.suggested_reply ?? '');
  }, [ticket?.id, ticket?.suggested_reply]);

  const contactLabel = useMemo(() => {
    const contact = ticket?.contact ?? {};
    return String(contact.name ?? contact.nombre ?? contact.display_name ?? contact.email ?? ticket?.title ?? '');
  }, [ticket]);

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

  if (!ticketId || !ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-muted/10 text-muted-foreground">
        <p>Selecciona una conversacion para ver el detalle omnicanal.</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b bg-card/50 px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium">#{ticket.id}</h3>
            <Badge variant="outline">{ticket.status}</Badge>
            {ticket.channel ? <Badge variant="secondary">{ticket.channel}</Badge> : null}
          </div>
          {contactLabel ? <p className="mt-1 truncate text-xs text-muted-foreground">{contactLabel}</p> : null}
        </div>
        <PresenceAvatars users={ticket.presence} />
      </div>

      <AgentSummaryPanel
        isLoading={false}
        summary={ticket.summary ?? null}
        nextSteps={ticket.next_steps}
      />

      {ticket.actions.length ? (
        <div className="flex flex-wrap gap-2 border-b bg-muted/20 px-4 py-3">
          {ticket.actions.map((action) => (
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

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {ticket.timeline.length ? (
          <TimelineMergeView events={ticket.timeline as TicketTimelineEvent[]} />
        ) : (
          <ViewState
            status="partial"
            title="Timeline pendiente"
            description="El item llego desde inbox omnicanal, pero backend no envio timeline para esta conversacion."
            className="min-h-[180px]"
          />
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t bg-background p-3">
        {ticket.suggested_reply ? (
          <AgentSuggestionBox
            suggestion={ticket.suggested_reply}
            onAccept={(text) => setDraft(text)}
            onReject={() => setDraft('')}
          />
        ) : null}

        {ticket.agent_copilot_suggestions?.length ? (
          <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/20 px-3 py-2">
            {ticket.agent_copilot_suggestions.map((item, index) => {
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
