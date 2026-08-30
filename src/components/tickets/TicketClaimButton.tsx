import React from 'react';
import { CheckCircle2, Loader2, UserCheck } from 'lucide-react';

import { postOmnichannelInboxActionV2, type EmployeeRoutingEmployee } from '@/api/v2/saas';
import { Button } from '@/components/ui/button';
import { useTickets } from '@/context/TicketContext';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import useTicketRoutingAuthority from '@/hooks/useTicketRoutingAuthority';
import type { Ticket, User } from '@/types/tickets';
import { ApiError } from '@/utils/api';
import { toast } from 'sonner';
import {
  employeeIsEligibleForRoutingTicket,
  getTicketRoutingIdentity,
} from './ticketRoutingAuthority';

const supportsAtomicClaim = (ticket: Ticket | null): boolean => {
  const sourceModel = String(ticket?.source_model ?? '').trim();
  return sourceModel === 'TenantTicket' || sourceModel === 'MunicipioTicket';
};

const routingEmployeeAsTicketUser = (employee: EmployeeRoutingEmployee): User => ({
  id: typeof employee.raw.id === 'number' || typeof employee.raw.id === 'string'
    ? employee.raw.id
    : employee.id,
  nombre_usuario: employee.name,
  email: String(employee.raw.email ?? employee.raw.email_usuario ?? '').trim(),
});

interface TicketClaimButtonProps {
  onClaimConfirmed?: () => void | Promise<void>;
}

const TicketClaimButton: React.FC<TicketClaimButtonProps> = ({ onClaimConfirmed }) => {
  const { selectedTicket, updateTicket } = useTickets();
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const atomicClaim = supportsAtomicClaim(selectedTicket);
  const routingState = useTicketRoutingAuthority(atomicClaim ? selectedTicket : null);
  const [assigning, setAssigning] = React.useState(false);
  const [confirmedTicketKey, setConfirmedTicketKey] = React.useState<string | null>(null);

  if (!selectedTicket) return null;

  const userId = String(user?.id ?? '').trim();
  const ticketKey = getTicketRoutingIdentity(selectedTicket) ?? `invalid:${selectedTicket.tipo}:${selectedTicket.id}`;
  const routingAuthority = routingState.resolution?.ok
    ? routingState.resolution.authority
    : null;
  const currentAssigneeId = routingAuthority?.currentAssigneeId ?? '';
  const currentEmployee = routingAuthority?.eligibleEmployees.find(
    (employee) => String(employee.id) === userId,
  ) ?? null;
  const authoritativeCategoryAuthorized = employeeIsEligibleForRoutingTicket(routingAuthority, userId);
  const confirmedAgent = currentEmployee ? routingEmployeeAsTicketUser(currentEmployee) : null;
  const isAssignedToMe = Boolean(userId) && (currentAssigneeId === userId || confirmedTicketKey === ticketKey);
  const isAssignedToSomeoneElse = Boolean(currentAssigneeId) && currentAssigneeId !== userId;

  let blockReason: string | null = null;
  if (!userId) blockReason = 'No hay una identidad de operador autenticada.';
  else if (!atomicClaim) blockReason = 'El ticket no publica una identidad source_model + id válida para una toma atómica.';
  else if (isAssignedToSomeoneElse) blockReason = 'El ticket ya tiene responsable. La reasignación se gestiona desde el inspector de supervisión.';
  else if (atomicClaim && routingState.loading) blockReason = 'Verificando tu cobertura con la matriz operativa.';
  else if (atomicClaim && routingState.error) blockReason = 'No se pudo verificar la autoridad de asignación con el backend.';
  else if (atomicClaim && !routingState.resolution?.ok) blockReason = 'El backend no publicó este caso en employee.routing.v1.';
  else if (atomicClaim && !authoritativeCategoryAuthorized) blockReason = 'Tu perfil no cubre la categoría autoritativa de este ticket.';

  const claimTicket = async () => {
    if (!userId || !confirmedAgent || blockReason || assigning || isAssignedToMe) return;
    setAssigning(true);
    try {
      const sourceModel = String(selectedTicket.source_model ?? '').trim();
      await postOmnichannelInboxActionV2(
        String(selectedTicket.id),
        {
          action: 'claim',
          payload: {
            source_model: sourceModel,
            ticket_id: selectedTicket.id,
          },
        },
        selectedTicket.tenant_slug || currentSlug,
      );
      updateTicket(selectedTicket.id, {
        assignedAgent: confirmedAgent,
        assignedAgentId: confirmedAgent.id,
        assigned_agent_id: confirmedAgent.id,
        assigned_user_id: confirmedAgent.id,
      }, sourceModel);
      setConfirmedTicketKey(ticketKey);
      try {
        await routingState.refresh();
        await onClaimConfirmed?.();
      } catch (refreshError) {
        console.warn('El ticket fue asignado, pero no se pudo refrescar el contrato de respuesta:', refreshError);
      }
      toast.success('Ticket asignado a tu usuario');
    } catch (claimError) {
      console.error('No se pudo tomar el ticket:', claimError);
      toast.error(
        claimError instanceof ApiError && claimError.status === 409
          ? 'Otro operador tomó este ticket. Actualizá la bandeja para ver el responsable.'
          : claimError instanceof ApiError && claimError.status === 403
            ? 'Tu usuario no tiene permiso o categoría habilitada para tomar este ticket.'
          : 'El backend no confirmó la asignación. El ticket sigue sin cambios.',
      );
    } finally {
      setAssigning(false);
    }
  };

  if (isAssignedToMe) {
    return (
      <Button type="button" variant="secondary" size="sm" className="h-9 gap-1.5" disabled data-testid="ticket-claim-confirmed">
        <CheckCircle2 className="h-4 w-4" />
        Asignado a mí
      </Button>
    );
  }

  if (
    atomicClaim &&
    !routingState.loading &&
    !routingState.error &&
    routingState.resolution?.ok &&
    !authoritativeCategoryAuthorized
  ) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => void claimTicket()}
        disabled={(atomicClaim && routingState.loading) || assigning || Boolean(blockReason)}
        title={blockReason || 'El backend verificará tu permiso, tenant y categoría antes de asignar'}
        aria-describedby={blockReason ? 'ticket-claim-block-reason' : undefined}
        data-testid="ticket-claim-action"
      >
        {assigning || (atomicClaim && routingState.loading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
        {assigning ? 'Asignando…' : atomicClaim && routingState.loading ? 'Verificando…' : 'Tomar ticket'}
      </Button>
      {blockReason ? <span id="ticket-claim-block-reason" className="sr-only">{blockReason}</span> : null}
    </>
  );
};

export default TicketClaimButton;
