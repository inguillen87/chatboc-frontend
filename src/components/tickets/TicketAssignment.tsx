import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  postOmnichannelInboxActionV2,
  type EmployeeRoutingEmployee,
} from '@/api/v2/saas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCapabilities } from '@/context/CapabilitiesContext';
import { useTenant } from '@/context/TenantContext';
import { useTickets } from '@/context/TicketContext';
import useTicketRoutingAuthority from '@/hooks/useTicketRoutingAuthority';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import type { User } from '@/types/tickets';
import { ApiError } from '@/utils/api';
import {
  canSuperviseTicketAssignments,
  describeRoutingReason,
  employeeIsEligibleForRoutingTicket,
  type TicketRoutingAuthority,
} from './ticketRoutingAuthority';

interface TicketAssignmentProps {
  className?: string;
  variant?: 'default' | 'compact';
}

export interface TicketAssignmentSelection {
  agentId: string;
  scopeKey: string;
  source: 'automatic' | 'manual';
}

const readString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const employeeEmail = (employee: EmployeeRoutingEmployee): string =>
  readString(employee.raw, ['email', 'email_usuario']) || 'sin-email@chatboc.local';

const employeeAsTicketUser = (employee: EmployeeRoutingEmployee): User => ({
  id: employee.id,
  nombre_usuario: employee.name,
  email: employeeEmail(employee),
});

const authorityFailureMessage = (
  loading: boolean,
  error: string | null,
  reason?: string,
) => {
  if (loading) return 'Verificando categoría, carga y permisos con el backend…';
  if (error) return 'No se pudo verificar la autoridad de asignación. Las acciones permanecen bloqueadas.';
  if (reason === 'missing_ticket_identity') return 'Este caso no publica la identidad source_model + id requerida para asignar con seguridad.';
  if (reason === 'ticket_not_published') return 'El caso no figura en la cola operativa autoritativa del tenant.';
  return 'El backend no publicó el contrato employee.routing.v1 requerido para asignar.';
};

export const serializeAssignmentIdentifier = (value: string | number) => {
  const normalized = String(value).trim();
  const numeric = Number(normalized);
  return /^(?:0|[1-9]\d*)$/.test(normalized) &&
    Number.isSafeInteger(numeric) &&
    String(numeric) === normalized
    ? numeric
    : normalized;
};

export const buildSupervisedAssignmentPayload = (
  authority: TicketRoutingAuthority,
  assigneeId: string | number,
) => ({
  source_model: authority.sourceModel,
  ticket_id: serializeAssignmentIdentifier(authority.ticketId),
  assignee_id: serializeAssignmentIdentifier(assigneeId),
  expected_assignee_id: authority.currentAssigneeId
    ? serializeAssignmentIdentifier(authority.currentAssigneeId)
    : null,
});

const TicketAssignment: React.FC<TicketAssignmentProps> = ({
  className,
  variant = 'default',
}) => {
  const { selectedTicket, updateTicket } = useTickets();
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const { hasCapability } = useCapabilities();
  const queryClient = useQueryClient();
  const routingState = useTicketRoutingAuthority(selectedTicket);
  const [selection, setSelection] = useState<TicketAssignmentSelection>({
    agentId: '',
    scopeKey: '',
    source: 'automatic',
  });
  const [assigning, setAssigning] = useState(false);

  const authority = routingState.resolution?.ok
    ? routingState.resolution.authority
    : null;
  const canSupervise = canSuperviseTicketAssignments(
    user?.rol ?? user?.role,
    hasCapability('tickets.assign'),
  );
  const suggested = authority?.suggestedEmployee ?? null;
  const candidates = authority?.eligibleEmployees ?? [];
  const authorityKey = authority?.identity ?? '';
  const candidateKey = candidates.map((candidate) => String(candidate.id)).join('|');

  useEffect(() => {
    setSelection((current) => {
      if (current.scopeKey === authorityKey && current.source === 'manual') {
        const remainsEligible = candidates.some(
          (candidate) => String(candidate.id) === current.agentId,
        );
        if (remainsEligible) return current;
      }
      const automaticId = suggested?.id ?? candidates[0]?.id ?? '';
      return {
        agentId: automaticId ? String(automaticId) : '',
        scopeKey: authorityKey,
        source: 'automatic',
      };
    });
  }, [authorityKey, candidateKey, suggested?.id]);

  const selectedAgentId = selection.scopeKey === authorityKey ? selection.agentId : '';
  const selectedEmployee = useMemo(
    () => candidates.find((candidate) => String(candidate.id) === selectedAgentId) ?? null,
    [candidates, selectedAgentId],
  );
  const currentUserEligible = employeeIsEligibleForRoutingTicket(authority, user?.id);
  const assignedToMe = Boolean(
    authority?.currentAssigneeId && String(authority.currentAssigneeId) === String(user?.id),
  );
  const compact = variant === 'compact';
  const currentAssignee = authority?.currentAssigneeId
    ? candidates.find(
        (candidate) => String(candidate.id) === String(authority.currentAssigneeId),
      ) ?? null
    : null;
  const localAssigneeId = selectedTicket?.assignedAgentId ??
    selectedTicket?.assigned_agent_id ??
    selectedTicket?.assigned_user_id ??
    selectedTicket?.assignedAgent?.id ??
    null;
  const localAssigneeMatchesAuthority = Boolean(
    authority?.currentAssigneeId &&
    localAssigneeId != null &&
    String(localAssigneeId) === String(authority.currentAssigneeId),
  );
  const currentAssigneeLabel = currentAssignee?.name ||
    (localAssigneeMatchesAuthority ? selectedTicket?.assignedAgent?.nombre_usuario : null) ||
    (authority?.currentAssigneeId ? `Responsable #${authority.currentAssigneeId}` : 'Sin asignar');

  if (!selectedTicket) return null;

  const updateLocalAssignment = (employee: EmployeeRoutingEmployee) => {
    const assignedAgent = employeeAsTicketUser(employee);
    updateTicket(selectedTicket.id, {
      assignedAgent,
      assignedAgentId: employee.id,
      assigned_agent_id: employee.id,
      assigned_user_id: employee.id,
    }, authority?.sourceModel ?? selectedTicket.source_model);
  };

  const refreshConfirmedAssignment = async () => {
    const results = await Promise.allSettled([
      routingState.refresh(),
      queryClient.invalidateQueries({ queryKey: ['ticket-composer-action-contract'] }),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      console.warn('La asignación quedó confirmada, pero una vista dependiente no pudo refrescarse.');
    }
  };

  const postAssignment = async (employee: EmployeeRoutingEmployee) => {
    if (!authority) return;
    await postOmnichannelInboxActionV2(
      authority.ticketId,
      {
        action: 'assign',
        payload: buildSupervisedAssignmentPayload(authority, employee.id),
      },
      selectedTicket.tenant_slug || currentSlug,
    );
  };

  const handleAssignment = async (employee: EmployeeRoutingEmployee | null) => {
    if (!canSupervise || !authority || !employee || assigning) return;
    if (!candidates.some((candidate) => String(candidate.id) === String(employee.id))) {
      toast.error('La persona ya no figura como compatible en la matriz operativa.');
      return;
    }
    setAssigning(true);
    try {
      await postAssignment(employee);
      updateLocalAssignment(employee);
      toast.success(`Caso asignado a ${employee.name}`);
      await refreshConfirmedAssignment();
    } catch (assignmentError) {
      console.error('No se pudo confirmar la asignación supervisada:', assignmentError);
      toast.error(
        assignmentError instanceof ApiError && assignmentError.status === 409
          ? 'La asignación cambió en otro puesto. Actualizá la ficha antes de reintentar.'
          : assignmentError instanceof ApiError && assignmentError.status === 403
            ? 'Tu usuario no tiene autoridad para asignar o reasignar este caso.'
            : 'El backend no confirmó la asignación. El caso sigue sin cambios.',
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleClaim = async () => {
    if (!authority || !currentUserEligible || !user?.id || assigning) return;
    const currentEmployee = candidates.find(
      (candidate) => String(candidate.id) === String(user.id),
    );
    if (!currentEmployee) return;
    setAssigning(true);
    try {
      await postOmnichannelInboxActionV2(
        authority.ticketId,
        {
          action: 'claim',
          payload: {
            source_model: authority.sourceModel,
            ticket_id: serializeAssignmentIdentifier(authority.ticketId),
          },
        },
        selectedTicket.tenant_slug || currentSlug,
      );
      updateLocalAssignment(currentEmployee);
      toast.success('Caso asignado a tu usuario');
      await refreshConfirmedAssignment();
    } catch (claimError) {
      console.error('No se pudo tomar el ticket:', claimError);
      toast.error(
        claimError instanceof ApiError && claimError.status === 409
          ? 'Otro operador tomó este caso. Actualizá la ficha.'
          : 'El backend no confirmó la asignación. El caso sigue sin cambios.',
      );
    } finally {
      setAssigning(false);
    }
  };

  if (routingState.loading || routingState.error || !routingState.resolution?.ok) {
    const reason = routingState.resolution?.ok === false
      ? routingState.resolution.reason
      : undefined;
    return (
      <div
        className={cn(
          compact ? 'rounded-lg p-2.5' : 'rounded-xl p-3',
          'border border-amber-300/70 bg-amber-50/80 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
          className,
        )}
        role={routingState.loading ? 'status' : 'alert'}
        data-testid="ticket-assignment-authority-blocked"
      >
        <div className="flex items-start gap-2">
          {routingState.loading ? (
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-semibold">Asignación protegida</p>
            <p className="mt-1 text-xs">
              {authorityFailureMessage(routingState.loading, routingState.error, reason)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!canSupervise) {
    return (
      <div
        className={cn(
          compact ? 'space-y-2 rounded-lg p-2.5' : 'space-y-3 rounded-xl p-3',
          'border border-border/70 bg-muted/30',
          className,
        )}
        data-testid="ticket-assignment-employee-view"
        data-variant={variant}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Responsable del caso</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cobertura verificada por categoría{authority.category ? ` · ${authority.category}` : ''}.
            </p>
          </div>
          <Badge variant={authority.currentAssigneeId ? 'secondary' : 'outline'}>
            {authority.currentAssigneeId ? 'Asignado' : 'Disponible'}
          </Badge>
        </div>
        {assignedToMe ? (
          <Button type="button" size="sm" variant="secondary" disabled className="w-full sm:w-auto">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Asignado a mí
          </Button>
        ) : currentUserEligible && !authority.currentAssigneeId ? (
          <Button
            type="button"
            size="sm"
            onClick={() => void handleClaim()}
            disabled={assigning}
            className="w-full sm:w-auto"
          >
            {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
            {assigning ? 'Tomando caso…' : 'Tomar ticket'}
          </Button>
        ) : (
          <p className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
            {authority.currentAssigneeId
              ? 'El caso ya tiene una persona responsable.'
              : 'Este caso está fuera de las categorías habilitadas para tu usuario.'}
          </p>
        )}
      </div>
    );
  }

  const recommendation = authority.recommendation;
  const reasons = recommendation?.reasons ?? [];

  if (compact) {
    return (
      <div
        className={cn(
          'space-y-3 rounded-lg border border-border/70 bg-background/80 p-3 shadow-sm',
          className,
        )}
        data-testid="ticket-assignment-supervisor-view"
        data-variant="compact"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Responsable
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold" title={currentAssigneeLabel}>
              {currentAssigneeLabel}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {authority.category
                ? `Cobertura validada para ${authority.category}.`
                : 'Cobertura validada por employee.routing.v1.'}
            </p>
          </div>
          <Badge variant={authority.currentAssigneeId ? 'secondary' : 'outline'}>
            {authority.currentAssigneeId ? 'Asignado' : 'Disponible'}
          </Badge>
        </div>

        {candidates.length ? (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <Select
              value={selectedAgentId}
              onValueChange={(agentId) => setSelection({
                agentId,
                scopeKey: authority.identity,
                source: 'manual',
              })}
              disabled={assigning}
            >
              <SelectTrigger
                id="ticket-assignment-agent-compact"
                className="min-w-0 flex-1"
                aria-label="Responsable compatible"
              >
                <SelectValue placeholder="Elegí una persona" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((employee) => (
                  <SelectItem key={employee.id} value={String(employee.id)}>
                    {employee.name} · {employee.workload_open ?? 0} activos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleAssignment(selectedEmployee)}
              disabled={
                !selectedEmployee ||
                assigning ||
                String(selectedEmployee.id) === String(authority.currentAssigneeId ?? '')
              }
              className="shrink-0"
            >
              {assigning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Users className="mr-2 h-4 w-4" />
              )}
              {authority.currentAssigneeId ? 'Reasignar' : 'Asignar'}
            </Button>
          </div>
        ) : (
          <p
            className="rounded-lg border border-amber-300/70 bg-amber-50 p-2.5 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
            role="alert"
          >
            No hay personal compatible publicado para esta categoría.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {suggested ? (
            <span className="min-w-0 flex-1 truncate">
              Sugerencia: <strong className="font-semibold text-foreground">{suggested.name}</strong>
              {' · '}{suggested.workload_open ?? 0} activos
            </span>
          ) : (
            <span className="min-w-0 flex-1">Sin recomendación compatible.</span>
          )}
          {!authority.currentAssigneeId && currentUserEligible ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleClaim()}
              disabled={assigning}
              className="h-8 shrink-0"
            >
              <UserCheck className="mr-1.5 h-3.5 w-3.5" />
              Tomar ticket
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void routingState.refresh()}
            disabled={routingState.loading || assigning}
            className="h-8 shrink-0 px-2"
            aria-label="Actualizar matriz de asignación"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-4 rounded-xl border border-border/70 bg-muted/30 p-3 shadow-sm', className)}
      data-testid="ticket-assignment-supervisor-view"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Asignación supervisada</p>
          <p className="mt-1 text-sm font-semibold">Cobertura, carga y recomendación del backend</p>
        </div>
        <Badge variant={authority.currentAssigneeId ? 'secondary' : 'outline'}>
          {authority.currentAssigneeId ? 'Con responsable' : 'Sin asignar'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {authority.category ? <Badge variant="outline">Categoría · {authority.category}</Badge> : null}
        {authority.zone ? <Badge variant="outline">Zona · {authority.zone}</Badge> : null}
        {authority.channel ? <Badge variant="outline">Canal · {authority.channel}</Badge> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="ticket-assignment-agent">
            Responsable compatible
          </label>
          <Select
            value={selectedAgentId}
            onValueChange={(agentId) => setSelection({
              agentId,
              scopeKey: authority.identity,
              source: 'manual',
            })}
            disabled={assigning || !candidates.length}
          >
            <SelectTrigger id="ticket-assignment-agent" className="w-full">
              <SelectValue placeholder={candidates.length ? 'Elegí una persona' : 'Sin personal compatible'} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((employee) => (
                <SelectItem key={employee.id} value={String(employee.id)}>
                  {employee.name} · {employee.workload_open ?? 0} activos
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {candidates.length} {candidates.length === 1 ? 'persona compatible' : 'personas compatibles'} según la categoría oficial del caso.
          </p>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sugerencia operativa</p>
              <p className="mt-1 text-sm font-semibold">
                {suggested?.name ?? 'Sin recomendación compatible'}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs font-semibold">
              <Gauge className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {recommendation?.score ?? '—'}
            </div>
          </div>
          {suggested ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Carga actual: {suggested.workload_open ?? 0} casos abiertos.
            </p>
          ) : null}
          {reasons.length ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {reasons.map((reason) => (
                <Badge key={reason} variant="secondary" className="font-normal">
                  {describeRoutingReason(reason)}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {!candidates.length ? (
        <div className="rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" role="alert">
          No hay personal compatible publicado para esta categoría. Configurá la cobertura desde Empleados antes de asignar.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => void handleAssignment(selectedEmployee)}
          disabled={!selectedEmployee || assigning || String(selectedEmployee.id) === authority.currentAssigneeId}
        >
          {assigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
          {authority.currentAssigneeId ? 'Reasignar' : 'Asignar'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void handleAssignment(suggested)}
          disabled={!suggested || assigning || String(suggested.id) === authority.currentAssigneeId}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Aplicar sugerencia
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void routingState.refresh()}
          disabled={routingState.loading || assigning}
          className="ml-auto"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualizar matriz
        </Button>
      </div>
    </div>
  );
};

export default TicketAssignment;
