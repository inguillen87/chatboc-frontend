import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AssignableAgent, assignTicketToAgent } from '@/services/ticketService';
import { useTickets } from '@/context/TicketContext';
import { useUser } from '@/hooks/useUser';
import useAssignableAgents from '@/hooks/useAssignableAgents';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { normalizeTicketStatus } from '@/utils/ticketStatus';
import { MessageSquare, RefreshCcw, ShieldCheck, UserCheck, Users } from 'lucide-react';

interface TicketAssignmentProps {
  className?: string;
}

const TicketAssignment: React.FC<TicketAssignmentProps> = ({ className }) => {
  const { selectedTicket, tickets, updateTicket } = useTickets();
  const { user } = useUser();
  const { agents, loading, error, refresh } = useAssignableAgents(selectedTicket?.tipo);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const openTicketsByAgent = useMemo(() => {
    const counter = new Map<string, number>();
    const isOpenStatus = (status?: string | null) => {
      const normalized = normalizeTicketStatus(status || '');
      return normalized && !['resuelto', 'cerrado'].includes(normalized);
    };

    for (const ticket of tickets) {
      if (!isOpenStatus(ticket.estado)) continue;
      const agentId = ticket.assignedAgentId ?? ticket.assigned_agent_id;
      if (agentId === undefined || agentId === null) continue;
      const key = String(agentId);
      counter.set(key, (counter.get(key) || 0) + 1);
    }

    return counter;
  }, [tickets]);

  const categoryCandidates = useMemo(() => {
    if (!selectedTicket) return agents;

    const ticketCategoryIds = new Set<number>();
    if (selectedTicket.categoria_id) {
      ticketCategoryIds.add(selectedTicket.categoria_id);
    }
    if (selectedTicket.categorias) {
      for (const category of selectedTicket.categorias) {
        ticketCategoryIds.add(category.id);
      }
    }

    if (ticketCategoryIds.size === 0) return agents;

    return agents.filter((agent) => {
      if (!agent.categoria_ids && !agent.categorias) return true;

      const agentCategoryIds = new Set<number>();
      if (agent.categoria_ids) {
        for (const categoryId of agent.categoria_ids) {
          agentCategoryIds.add(categoryId);
        }
      }
      if (agent.categorias) {
        for (const category of agent.categorias) {
          agentCategoryIds.add(category.id);
        }
      }

      for (const ticketCategoryId of ticketCategoryIds) {
        if (agentCategoryIds.has(ticketCategoryId)) {
          return true;
        }
      }

      return false;
    });
  }, [agents, selectedTicket]);

  const recommendedAgent = useMemo(() => {
    if (categoryCandidates.length === 0) return undefined;

    return categoryCandidates.reduce<AssignableAgent | undefined>((best, agent) => {
      const currentLoad = openTicketsByAgent.get(String(agent.id)) || 0;
      if (!best) return agent;
      const bestLoad = openTicketsByAgent.get(String(best.id)) || 0;
      if (currentLoad < bestLoad) return agent;
      if (currentLoad === bestLoad) {
        const agentScore = (agent.abiertos ?? 0) + (agent.atendidos ?? 0);
        const bestScore = (best.abiertos ?? 0) + (best.atendidos ?? 0);
        return agentScore < bestScore ? agent : best;
      }
      return best;
    }, undefined);
  }, [categoryCandidates, openTicketsByAgent]);

  useEffect(() => {
    if (!categoryCandidates.length) {
      setSelectedAgentId('');
      return;
    }
    setSelectedAgentId(String(categoryCandidates[0].id));
  }, [categoryCandidates]);

  if (!selectedTicket) {
    return null;
  }

  const currentAssignee = selectedTicket.assignedAgent;

  const buildAgentLabel = (agent: AssignableAgent) => {
    const load = openTicketsByAgent.get(String(agent.id)) || 0;
    return `${agent.nombre_usuario}${load ? ` · ${load} activos` : ''}`;
  };

  const resolveAgentById = (agentId: string | number): AssignableAgent => {
    const fromList = agents.find((agent) => String(agent.id) === String(agentId));
    if (fromList) return fromList;

    return {
      id: agentId,
      nombre_usuario: currentAssignee?.nombre_usuario || 'Agente',
      email: currentAssignee?.email || 'desconocido@chatboc.local',
    };
  };

  const handleAssignment = async (agentId?: string) => {
    if (!agentId || !selectedTicket) return;
    setAssigning(true);
    try {
      const resolvedAgent = resolveAgentById(agentId);
      await assignTicketToAgent(selectedTicket.id, selectedTicket.tipo, resolvedAgent.id);
      updateTicket(selectedTicket.id, {
        assignedAgent: resolvedAgent,
        assignedAgentId: resolvedAgent.id,
      });
      toast.success(`Ticket asignado a ${resolvedAgent.nombre_usuario}`);
    } catch (err: any) {
      console.error('Error asignando ticket:', err);
      if (err.status === 405) {
        toast.error('No se pudo asignar el ticket. El servidor no está configurado para aceptar asignaciones.');
      } else {
        toast.error('No se pudo asignar el ticket. Intenta nuevamente.');
      }
    } finally {
      setAssigning(false);
    }
  };

  const handleClaim = async () => {
    if (!user?.id) return;
    await handleAssignment(String(user.id));
  };

  const canClaim = Boolean(user?.id) && (!currentAssignee || String(currentAssignee.id) !== String(user?.id));

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border border-border/70 bg-muted/40 p-3 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Asignación</p>
          <p className="text-sm text-muted-foreground">Distribuí los tickets por equipo y equilibrá la carga.</p>
        </div>
        <Badge variant={currentAssignee ? 'secondary' : 'outline'} className="whitespace-nowrap">
          {currentAssignee ? `Asignado a ${currentAssignee.nombre_usuario}` : 'Sin asignar'}
        </Badge>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Elegí un agente</p>
          <Select
            value={selectedAgentId}
            onValueChange={setSelectedAgentId}
            disabled={loading || !categoryCandidates.length}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loading ? 'Cargando agentes...' : 'Sin agentes disponibles'} />
            </SelectTrigger>
            <SelectContent>
              {categoryCandidates.map((agent) => (
                <SelectItem key={agent.id} value={String(agent.id)}>
                  {buildAgentLabel(agent)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sugerencia</p>
          <div className="flex h-10 items-center justify-between rounded-lg border border-border/60 bg-background px-3 text-sm">
            {recommendedAgent ? (
              <>
                <span className="truncate">{buildAgentLabel(recommendedAgent)}</span>
                <ShieldCheck className="h-4 w-4 text-primary" />
              </>
            ) : (
              <span className="text-muted-foreground">Sin recomendación disponible</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => handleAssignment(selectedAgentId)}
          disabled={!selectedAgentId || assigning || loading}
        >
          <Users className="mr-2 h-4 w-4" />
          Asignar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleAssignment(recommendedAgent ? String(recommendedAgent.id) : selectedAgentId)}
          disabled={assigning || loading || (!recommendedAgent && !selectedAgentId)}
        >
          <UserCheck className="mr-2 h-4 w-4" />
          Asignar sugerido
        </Button>
        {canClaim && (
          <Button size="sm" variant="secondary" onClick={handleClaim} disabled={assigning || loading}>
            <MessageSquareIcon className="mr-2 h-4 w-4" />
            Tomar ticket
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={refresh}
          disabled={loading}
          className="ml-auto"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Actualizar lista
        </Button>
      </div>
    </div>
  );
};

const MessageSquareIcon = MessageSquare;

export default TicketAssignment;
