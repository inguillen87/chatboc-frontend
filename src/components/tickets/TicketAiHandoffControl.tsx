import React, { useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bot, Headphones, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';

import {
  postOmnichannelInboxActionV2,
  type OmnichannelInboxActionV2,
  type SaasAction,
} from '@/api/v2/saas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/utils/api';

const HANDOFF_ACTION_IDS = new Set([
  'handoff',
  'accept_handoff',
  'takeover',
  'resume_ai',
]);

const QUEUED_HANDOFF_STATES = new Set([
  'requested',
  'pending',
  'queued',
  'waiting_agent',
  'esperando_agente_en_vivo',
]);

const HUMAN_HANDOFF_STATES = new Set([
  'accepted',
  'assigned',
  'active',
  'human_active',
  'in_progress',
]);

const AI_HANDOFF_STATES = new Set([
  'resolved',
  'resumed',
  'resumed_ai',
  'expired',
  'cancelled',
  'closed',
]);

type PlainRecord = Record<string, unknown>;

interface TicketAiHandoffControlProps {
  ticketId: string;
  tenantSlug?: string | null;
  handoff?: PlainRecord | null;
  actions: SaasAction[];
  onActionComplete?: (result: OmnichannelInboxActionV2) => void;
}

type HandoffState = {
  label: string;
  detail: string;
  tone: 'ai' | 'queued' | 'human' | 'unknown';
};

const asRecord = (value: unknown): PlainRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as PlainRecord) : {};

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const normalizeActionId = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

export const isAiHandoffAction = (action: Pick<SaasAction, 'id' | 'type'>): boolean =>
  HANDOFF_ACTION_IDS.has(normalizeActionId(action.id)) ||
  HANDOFF_ACTION_IDS.has(normalizeActionId(action.type));

const actionPayload = (action: SaasAction): PlainRecord => ({
  ...asRecord(action.payload_defaults),
  ...asRecord(action.payloadDefaults),
  ...asRecord(action.payload),
});

const isMissingValue = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && !value.trim());

export const getHandoffActionBlockReason = (
  action: SaasAction,
  ticketId: string,
): string | null => {
  if (action.disabled) {
    return action.disabled_reason || 'El backend marcó esta acción como no disponible.';
  }

  const method = (action.method || 'POST').trim().toUpperCase();
  if (method !== 'POST') {
    return `Método ${method} no habilitado para cambiar el control de la conversación.`;
  }

  const payload = { ...actionPayload(action), ticket_id: ticketId };
  const missing = (action.requires || []).filter((field) => isMissingValue(payload[field]));
  if (missing.length) {
    return `Falta completar el contrato backend: ${missing.join(', ')}.`;
  }

  return null;
};

const handoffActorName = (handoff: PlainRecord): string | null => {
  const acceptedBy = asRecord(handoff.accepted_by);
  const requestedBy = asRecord(handoff.requested_by);
  const resolvedBy = asRecord(handoff.resolved_by);
  return (
    asText(acceptedBy.name) ||
    asText(acceptedBy.email) ||
    asText(requestedBy.name) ||
    asText(requestedBy.email) ||
    asText(resolvedBy.name) ||
    asText(resolvedBy.email)
  );
};

export const describeHandoffState = (
  handoffValue: PlainRecord | null | undefined,
  actions: SaasAction[],
): HandoffState => {
  const handoff = asRecord(handoffValue);
  const status = normalizeActionId(handoff.status);
  const actionIds = new Set(actions.map((action) => normalizeActionId(action.id)));

  if (HUMAN_HANDOFF_STATES.has(status) || actionIds.has('resume_ai')) {
    return {
      label: 'Humano atendiendo',
      detail: 'La automatización queda bajo control operativo hasta que el backend habilite reanudar la IA.',
      tone: 'human',
    };
  }

  if (QUEUED_HANDOFF_STATES.has(status) || actionIds.has('accept_handoff') || actionIds.has('takeover')) {
    return {
      label: 'Esperando operador',
      detail: 'La solicitud está en cola y debe ser aceptada desde esta mesa.',
      tone: 'queued',
    };
  }

  if (AI_HANDOFF_STATES.has(status) || actionIds.has('handoff')) {
    return {
      label: 'IA atendiendo',
      detail: 'El backend permite derivar la conversación al equipo cuando sea necesario.',
      tone: 'ai',
    };
  }

  return {
    label: status ? `Estado: ${status.replace(/_/g, ' ')}` : 'Estado no publicado',
    detail: 'No hay una transición IA-humano ejecutable publicada para este ticket.',
    tone: 'unknown',
  };
};

const stateClassName = (tone: HandoffState['tone']): string => {
  if (tone === 'human') return 'border-blue-400/50 bg-blue-500/10 text-blue-800 dark:text-blue-200';
  if (tone === 'queued') return 'border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-200';
  if (tone === 'ai') return 'border-emerald-400/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
  return 'border-border bg-muted/30 text-muted-foreground';
};

const StateIcon = ({ tone }: { tone: HandoffState['tone'] }) => {
  if (tone === 'human') return <Headphones className="h-4 w-4" />;
  if (tone === 'queued') return <ShieldCheck className="h-4 w-4" />;
  if (tone === 'ai') return <Bot className="h-4 w-4" />;
  return <RotateCcw className="h-4 w-4" />;
};

const TicketAiHandoffControl: React.FC<TicketAiHandoffControlProps> = ({
  ticketId,
  tenantSlug,
  handoff,
  actions,
  onActionComplete,
}) => {
  const inFlightRef = useRef(false);
  const handoffActions = useMemo(() => actions.filter(isAiHandoffAction), [actions]);

  const mutation = useMutation({
    mutationFn: (action: SaasAction) =>
      postOmnichannelInboxActionV2(
        ticketId,
        {
          action: action.id,
          endpoint: action.endpoint,
          payload: actionPayload(action),
        },
        tenantSlug,
      ),
    onSuccess: (result) => {
      onActionComplete?.(result);
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  const effectiveHandoff = mutation.data?.ticket.handoff || handoff;
  const state = describeHandoffState(effectiveHandoff, mutation.data?.ticket.allowed_actions || handoffActions);
  const actorName = handoffActorName(asRecord(effectiveHandoff));

  if (!handoffActions.length && !asText(asRecord(effectiveHandoff).status)) {
    return null;
  }

  const executeAction = (action: SaasAction) => {
    if (inFlightRef.current || mutation.isPending) return;
    if (getHandoffActionBlockReason(action, ticketId)) return;
    inFlightRef.current = true;
    mutation.mutate(action);
  };

  return (
    <section
      className={`rounded-lg border p-3 ${stateClassName(state.tone)}`}
      data-testid="ticket-ai-handoff-control"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StateIcon tone={state.tone} />
            <p className="text-sm font-semibold">Control IA y equipo</p>
            <Badge variant="outline" className="border-current text-current">
              Contrato backend
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium">{state.label}</p>
          <p className="mt-1 text-xs leading-5 opacity-80">{state.detail}</p>
          {actorName ? <p className="mt-1 text-xs opacity-80">Último responsable: {actorName}</p> : null}
        </div>

        {handoffActions.length ? (
          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[12rem]">
            {handoffActions.map((action) => {
              const blockedReason = getHandoffActionBlockReason(action, ticketId);
              const isCurrentAction = mutation.isPending && mutation.variables?.id === action.id;
              return (
                <div key={action.id} className="space-y-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={action.id === 'resume_ai' ? 'outline' : 'default'}
                    className="w-full justify-center"
                    disabled={Boolean(blockedReason) || mutation.isPending}
                    title={blockedReason || action.description}
                    onClick={() => executeAction(action)}
                  >
                    {isCurrentAction ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {action.label}
                  </Button>
                  {blockedReason ? (
                    <p className="text-[11px] leading-snug opacity-80" role="status">
                      {blockedReason}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {mutation.data ? (
        <div className="mt-3 rounded-md border border-current/20 bg-background/60 px-3 py-2 text-xs" data-testid="handoff-action-result">
          <span className="font-semibold">Confirmado por backend.</span>{' '}
          {mutation.data.delivery?.operator_message || `Transición ${mutation.data.action || 'operativa'} registrada.`}
        </div>
      ) : null}

      {mutation.isError ? (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {getErrorMessage(mutation.error, 'No se pudo cambiar el control de la conversación.')}
        </div>
      ) : null}
    </section>
  );
};

export default TicketAiHandoffControl;
