import React from 'react';
import { CheckCircle2, Loader2, UserCheck } from 'lucide-react';

import { postOmnichannelInboxActionV2 } from '@/api/v2/saas';
import { Button } from '@/components/ui/button';
import { useTickets } from '@/context/TicketContext';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import useAssignableAgents from '@/hooks/useAssignableAgents';
import { assignTicketToAgent, type AssignableAgent } from '@/services/ticketService';
import type { Ticket } from '@/types/tickets';
import { ApiError } from '@/utils/api';
import { toast } from 'sonner';

const normalize = (value: unknown) =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const ticketCategoryKeys = (ticket: Ticket): Set<string> => {
  const keys = new Set<string>();
  if (ticket.categoria_id) keys.add(`id:${ticket.categoria_id}`);
  for (const id of ticket.categoria_ids || []) keys.add(`id:${id}`);
  for (const category of ticket.categorias || []) {
    if (category.id) keys.add(`id:${category.id}`);
    const name = normalize(category.nombre);
    if (name) keys.add(`name:${name}`);
  }
  const categoryName = normalize(ticket.categoria_principal || ticket.categoria);
  if (categoryName) keys.add(`name:${categoryName}`);
  return keys;
};

const agentCategoryKeys = (agent: AssignableAgent): Set<string> => {
  const keys = new Set<string>();
  if (agent.categoria_id) keys.add(`id:${agent.categoria_id}`);
  for (const id of agent.categoria_ids || []) keys.add(`id:${id}`);
  for (const category of agent.categorias || []) {
    if (category.id) keys.add(`id:${category.id}`);
    const name = normalize(category.nombre);
    if (name) keys.add(`name:${name}`);
  }
  return keys;
};

export const canAgentClaimTicketCategory = (ticket: Ticket, agent: AssignableAgent): boolean => {
  const ticketKeys = ticketCategoryKeys(ticket);
  const agentKeys = agentCategoryKeys(agent);
  if (!ticketKeys.size || !agentKeys.size) return false;
  return [...ticketKeys].some((key) => agentKeys.has(key));
};

const assignedUserId = (ticket: Ticket): string =>
  String(
    ticket.assignedAgent?.id ??
      ticket.assignedAgentId ??
      ticket.assigned_agent_id ??
      ticket.assigned_user_id ??
      '',
  ).trim();

const supportsAtomicClaim = (ticket: Ticket | null): boolean => {
  const sourceModel = String(ticket?.source_model ?? '').trim();
  return sourceModel === 'TenantTicket' || sourceModel === 'MunicipioTicket';
};

const sessionAgent = (
  user: ReturnType<typeof useUser>['user'],
): AssignableAgent | null => {
  const id = user?.id;
  if (id === undefined || id === null || String(id).trim() === '') return null;

  return {
    id,
    nombre_usuario: user?.name?.trim() || user?.email?.trim() || 'Mi usuario',
    email: user?.email?.trim() || '',
    categoria_id: user?.categoria_id ?? null,
    categoria_ids: user?.categoria_ids ?? null,
    categorias: (user?.categorias ?? []).map((category) => ({
      id: category.id,
      nombre: category.nombre?.trim() || `Categoría ${category.id}`,
    })),
  };
};

interface TicketClaimButtonProps {
  onClaimConfirmed?: () => void | Promise<void>;
}

const TicketClaimButton: React.FC<TicketClaimButtonProps> = ({ onClaimConfirmed }) => {
  const { selectedTicket, updateTicket } = useTickets();
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const atomicClaim = supportsAtomicClaim(selectedTicket);
  const { agents, loading, error } = useAssignableAgents(
    selectedTicket && !atomicClaim ? selectedTicket.tipo : undefined,
  );
  const [assigning, setAssigning] = React.useState(false);
  const [confirmedTicketKey, setConfirmedTicketKey] = React.useState<string | null>(null);

  if (!selectedTicket) return null;

  const userId = String(user?.id ?? '').trim();
  const ticketKey = `${selectedTicket.tipo}:${selectedTicket.id}`;
  const currentAssigneeId = assignedUserId(selectedTicket);
  const currentAgent = agents.find((agent) => String(agent.id) === userId);
  const confirmedAgent = currentAgent ?? (atomicClaim ? sessionAgent(user) : null);
  const isAssignedToMe = Boolean(userId) && (currentAssigneeId === userId || confirmedTicketKey === ticketKey);
  const isAssignedToSomeoneElse = Boolean(currentAssigneeId) && currentAssigneeId !== userId;
  const categoryAuthorized = Boolean(currentAgent && canAgentClaimTicketCategory(selectedTicket, currentAgent));

  let blockReason: string | null = null;
  if (!userId) blockReason = 'No hay una identidad de operador autenticada.';
  else if (isAssignedToSomeoneElse) blockReason = 'El ticket ya tiene responsable. La reasignación se gestiona desde el inspector de supervisión.';
  else if (!atomicClaim && error) blockReason = 'No se pudo verificar la capacidad de asignación con el backend.';
  else if (!atomicClaim && !loading && !currentAgent) blockReason = 'El backend no publicó este usuario como agente asignable.';
  else if (!atomicClaim && !loading && currentAgent && !categoryAuthorized) blockReason = 'Tu perfil no tiene habilitada la categoría de este ticket.';

  const claimTicket = async () => {
    if (!userId || !confirmedAgent || blockReason || assigning || isAssignedToMe) return;
    setAssigning(true);
    try {
      const sourceModel = String(selectedTicket.source_model ?? '').trim();
      if (atomicClaim) {
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
      } else {
        // Old ticket payloads do not identify their backing model. Preserve the
        // compatible route until every deployment publishes source_model.
        await assignTicketToAgent(selectedTicket.id, selectedTicket.tipo, confirmedAgent.id);
      }
      updateTicket(selectedTicket.id, {
        assignedAgent: confirmedAgent,
        assignedAgentId: confirmedAgent.id,
        assigned_agent_id: confirmedAgent.id,
        assigned_user_id: confirmedAgent.id,
      });
      setConfirmedTicketKey(ticketKey);
      if (atomicClaim) {
        try {
          await onClaimConfirmed?.();
        } catch (refreshError) {
          console.warn('El ticket fue asignado, pero no se pudo refrescar el contrato de respuesta:', refreshError);
        }
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

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="h-9 gap-1.5"
        onClick={() => void claimTicket()}
        disabled={(!atomicClaim && loading) || assigning || Boolean(blockReason)}
        title={blockReason || (atomicClaim
          ? 'El backend verificará tu permiso, tenant y categoría antes de asignar'
          : 'Asignar este ticket a mi usuario')}
        aria-describedby={blockReason ? 'ticket-claim-block-reason' : undefined}
        data-testid="ticket-claim-action"
      >
        {assigning || (!atomicClaim && loading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
        {assigning ? 'Asignando…' : !atomicClaim && loading ? 'Verificando…' : 'Tomar ticket'}
      </Button>
      {blockReason ? <span id="ticket-claim-block-reason" className="sr-only">{blockReason}</span> : null}
    </>
  );
};

export default TicketClaimButton;
