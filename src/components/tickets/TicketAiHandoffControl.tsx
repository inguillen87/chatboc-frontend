import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bot, Headphones, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';

import {
  buildSaasActionPayload,
  createMunicipalHandoffIdempotencyKey,
  isDurableMunicipalHandoffAction,
  postOmnichannelInboxActionV2,
  type OmnichannelInboxActionV2,
  type SaasAction,
} from '@/api/v2/saas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/hooks/useUser';
import { ApiError, getErrorMessage } from '@/utils/api';
import {
  captureChatbocSessionRevision,
  isChatbocSessionRevisionCurrent,
  subscribeChatbocSessionRevision,
} from '@/utils/chatbocSessionRevision';

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

// The current municipal service validates these fields before querying or writing.
const HANDOFF_NO_WRITE_VALIDATION_CODES = new Set([
  'handoff_reason_required', 'handoff_reason_invalid', 'handoff_channel_required',
  'invalid_handoff_channel', 'handoff_channel_alias_conflict',
  'handoff_idempotency_key_required', 'handoff_idempotency_key_invalid',
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

const isMissingValue = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && !value.trim());

export const getHandoffActionBlockReason = (
  action: SaasAction,
  ticketId: string,
  input: PlainRecord = {},
): string | null => {
  if (action.disabled) {
    return action.disabled_reason || 'El backend marcó esta acción como no disponible.';
  }

  const method = (action.method || 'POST').trim().toUpperCase();
  if (method !== 'POST') {
    return `Método ${method} no habilitado para cambiar el control de la conversación.`;
  }

  if (!action.endpoint?.startsWith('/')) {
    return 'El backend no publicó un endpoint seguro para cambiar el control de la conversación.';
  }

  if (action.delivery_mode !== 'internal_event' || action.external_dispatch !== false) {
    return 'La transición no garantiza una acción interna sin despacho externo.';
  }

  const payload: PlainRecord = { ...buildSaasActionPayload(action), ...input, ticket_id: ticketId };
  const missing = (action.requires || []).filter((field) =>
    !(field === 'idempotency_key_header' && isDurableMunicipalHandoffAction(action)) &&
    isMissingValue(payload[field]));
  if (missing.length) {
    if (missing.length === 1 && missing[0] === 'reason') return 'Completá el motivo de la derivación.';
    return `Falta completar el contrato backend: ${missing.join(', ')}.`;
  }
  if (action.requires?.includes('reason')) {
    const reason = asText(payload.reason);
    if (!reason || reason.length > 500 || reason.includes('\u0000')) {
      return 'Completá un motivo de hasta 500 caracteres.';
    }
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
  const { user, loading, organizationProfileVerified, hasVerifiedSession } = useUser();
  const handoffActions = useMemo(() => actions.filter(isAiHandoffAction), [actions]);
  const sessionRevision = useSyncExternalStore(subscribeChatbocSessionRevision,
    captureChatbocSessionRevision, captureChatbocSessionRevision);
  const authorityReady = Boolean(user?.id != null && asText(user.rol || user.role) &&
    hasVerifiedSession === true && organizationProfileVerified === true && !loading);
  const actorAuthority = [user?.id, user?.tenant_slug ?? user?.tenantSlug, user?.rol ?? user?.role,
    user?.permissions, user?.capabilities, user?.scopes, user?.categoria_id, user?.categoria_ids,
    user?.categorias, loading, organizationProfileVerified, hasVerifiedSession];
  const scopeKey = JSON.stringify([tenantSlug ?? null, ticketId, handoffActions, sessionRevision, actorAuthority]);
  const authorityRef = useRef({ key: scopeKey, epoch: 0 });
  if (authorityRef.current.key !== scopeKey) {
    authorityRef.current = { key: scopeKey, epoch: authorityRef.current.epoch + 1 };
  }
  const scopeEpoch = authorityRef.current.epoch;
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const reasonId = useId();
  const [reasonDraft, setReasonDraft] = useState({ scopeEpoch, value: '' });
  const [preparationError, setPreparationError] = useState<{ scopeEpoch: number; message: string } | null>(null);
  const [confirmedState, setConfirmedState] = useState<{
    scopeEpoch: number; result: OmnichannelInboxActionV2;
  } | null>(null);
  const reason = reasonDraft.scopeEpoch === scopeEpoch ? reasonDraft.value : '';
  type Attempt = {
    scopeKey: string;
    scopeEpoch: number;
    action: SaasAction;
    ticketId: string;
    tenantSlug?: string | null;
    payload: PlainRecord;
    isCurrent: () => boolean;
  };
  const attemptRef = useRef<Attempt | null>(null);
  const inFlightRef = useRef<Attempt | null>(null);

  const mutation = useMutation({
    mutationFn: (attempt: Attempt) => {
      if (!attempt.isCurrent()) throw new ApiError('El caso o la sesión cambió. Actualizá antes de continuar.', 409);
      return postOmnichannelInboxActionV2(
        attempt.ticketId,
        {
          action: attempt.action.id,
          endpoint: attempt.action.endpoint,
          payload: attempt.payload,
        },
        attempt.tenantSlug,
        undefined,
        { isCurrent: attempt.isCurrent },
      );
    },
    onSuccess: (result, attempt) => {
      if (!attempt.isCurrent()) return;
      if (attemptRef.current === attempt) attemptRef.current = null;
      setConfirmedState({ scopeEpoch: attempt.scopeEpoch, result });
      onActionComplete?.(result);
    },
    onError: (error, attempt) => {
      const body = asRecord(error instanceof ApiError ? error.body : null);
      const code = asText(body.reason_code ?? body.code);
      if (attempt.isCurrent() && attemptRef.current === attempt && error instanceof ApiError &&
          error.status === 400 && code && HANDOFF_NO_WRITE_VALIDATION_CODES.has(code)) {
        attemptRef.current = null;
      }
    },
    onSettled: (_data, _error, attempt) => {
      if (inFlightRef.current === attempt) inFlightRef.current = null;
    },
  });

  const currentMutation = mutation.variables?.scopeEpoch === scopeEpoch;
  const result = confirmedState?.scopeEpoch === scopeEpoch ? confirmedState.result : undefined;
  const pending = currentMutation && mutation.isPending;
  const uncertainAttempt = attemptRef.current?.scopeEpoch === scopeEpoch ? attemptRef.current : null;
  const acknowledgedActions = result && Object.prototype.hasOwnProperty.call(asRecord(result.ticket.raw), 'allowed_actions');
  const effectiveActions = result && acknowledgedActions ? result.ticket.allowed_actions.filter(isAiHandoffAction) : handoffActions;
  const effectiveHandoff = result?.ticket.handoff || handoff;
  const state = describeHandoffState(effectiveHandoff, effectiveActions);
  const actorName = handoffActorName(asRecord(effectiveHandoff));

  if (!effectiveActions.length && !asText(asRecord(effectiveHandoff).status)) {
    return null;
  }

  const executeAction = (action: SaasAction) => {
    if (!authorityReady || inFlightRef.current?.scopeEpoch === scopeEpoch || pending) return;
    if (!effectiveActions.includes(action)) return;
    const input = action.requires?.includes('reason') ? { reason } : {};
    if (getHandoffActionBlockReason(action, ticketId, input)) return;
    const durable = isDurableMunicipalHandoffAction(action);
    if (durable && !tenantSlug?.trim()) return;
    let attempt = attemptRef.current;
    if (!attempt || attempt.scopeEpoch !== scopeEpoch || attempt.action.id !== action.id) {
      try {
        attempt = {
          scopeKey, scopeEpoch, action, ticketId, tenantSlug,
          payload: { ...buildSaasActionPayload(action), ...input,
            ...(durable ? { idempotency_key: createMunicipalHandoffIdempotencyKey() } : {}) },
          isCurrent: () => mountedRef.current && authorityRef.current.key === scopeKey &&
            authorityRef.current.epoch === scopeEpoch &&
            isChatbocSessionRevisionCurrent(sessionRevision),
        };
      } catch (error) {
        setPreparationError({ scopeEpoch, message: getErrorMessage(error,
          'No pudimos preparar la derivación. Actualizá e intentá nuevamente.') });
        return;
      }
      if (durable) attemptRef.current = attempt;
    }
    setPreparationError(null);
    inFlightRef.current = attempt;
    mutation.mutate(attempt);
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

        {effectiveActions.length ? (
          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[12rem]">
            {effectiveActions.map((action) => {
              const needsReason = action.requires?.includes('reason');
              const blockedReason = getHandoffActionBlockReason(action, ticketId, needsReason ? { reason } : {}) ||
                (!authorityReady ? 'Estamos verificando tu acceso. Actualizá la sesión antes de continuar.' : null) ||
                (isDurableMunicipalHandoffAction(action) && !tenantSlug?.trim()
                  ? 'Seleccioná la organización antes de derivar el caso.' : null);
              const isCurrentAction = pending && mutation.variables?.action.id === action.id;
              return (
                <div key={action.id} className="space-y-1">
                  {needsReason ? (
                    <div className="space-y-1">
                      <label className="text-xs font-medium" htmlFor={`${reasonId}-${action.id}`}>Motivo de la derivación</label>
                      <Textarea id={`${reasonId}-${action.id}`} value={reason} maxLength={500}
                        disabled={pending || Boolean(uncertainAttempt)}
                        onChange={(event) => setReasonDraft({ scopeEpoch, value: event.target.value })} />
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant={action.id === 'resume_ai' ? 'outline' : 'default'}
                    className="w-full justify-center"
                    disabled={Boolean(blockedReason) || pending}
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

      {result ? (
        <div className="mt-3 rounded-md border border-current/20 bg-background/60 px-3 py-2 text-xs" data-testid="handoff-action-result">
          <span className="font-semibold">Confirmado por backend.</span>{' '}
          {result.delivery?.operator_message || `Transición ${result.action || 'operativa'} registrada.`}
        </div>
      ) : null}

      {currentMutation && mutation.isError ? (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {getErrorMessage(mutation.error, 'No se pudo cambiar el control de la conversación.')}
          {uncertainAttempt ? <p>Se conserva el motivo para reintentar la misma derivación.</p> : null}
        </div>
      ) : null}
      {preparationError?.scopeEpoch === scopeEpoch ? (
        <p className="mt-3 text-xs text-destructive" role="alert">{preparationError.message}</p>
      ) : null}
    </section>
  );
};

export default TicketAiHandoffControl;
