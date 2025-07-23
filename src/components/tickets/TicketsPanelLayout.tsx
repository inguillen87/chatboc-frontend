import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import TicketListPanel from './TicketListPanel';
import TicketDetailPanel from './TicketDetailPanel';
import ClientInfoPanel from './ClientInfoPanel';
import { Ticket, TicketSummary, TicketStatus, PriorityStatus, ESTADOS, ESTADOS_ORDEN_PRIORIDAD } from '@/types/tickets';
import { apiFetch, ApiError } from '@/utils/api';
import { useDebounce } from '@/hooks/useDebounce';
import { usePusher } from '@/hooks/usePusher';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/hooks/useUser';

const toast = (globalThis as any).toast || {
  success: (message: string) => console.log("TOAST SUCCESS:", message),
  error: (message: string) => console.error("TOAST ERROR:", message),
  info: (message: string) => console.info("TOAST INFO:", message)
};

const TicketsPanelLayout: React.FC = () => {
  const { user } = useUser();
  const [allTickets, setAllTickets] = useState<TicketSummary[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailedTicket, setDetailedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityStatus | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string | "">("");

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{tickets: TicketSummary[]}>("/tickets", { sendEntityToken: true });
      setAllTickets(data.tickets);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error al cargar los tickets.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const channel = usePusher('tickets');

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!channel) return;

    const newTicketListener = (newTicket: TicketSummary) => {
      setAllTickets(prev => [newTicket, ...prev]);
      toast.info(`Nuevo ticket recibido: #${newTicket.nro_ticket}`);
    };

    const newCommentListener = ({ ticketId, comment }: { ticketId: number, comment: any /* Comment type */ }) => {
      if (detailedTicket && detailedTicket.id === ticketId) {
        setDetailedTicket(prev => prev ? { ...prev, comentarios: [...(prev.comentarios || []), comment] } : null);
      }
      setAllTickets(prev => prev.map(t => t.id === ticketId ? { ...t, detalles: comment.comentario } : t));
    };

    const ticketUpdateListener = (updatedTicket: TicketSummary) => {
        setAllTickets(prev => prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t));
        if (detailedTicket && detailedTicket.id === updatedTicket.id) {
            setDetailedTicket(prev => prev ? { ...prev, ...updatedTicket } : null);
        }
    };

    channel.bind('new_ticket', newTicketListener);
    channel.bind('new_comment', newCommentListener);
    channel.bind('ticket_update', ticketUpdateListener);

    return () => {
      channel.unbind('new_ticket', newTicketListener);
      channel.unbind('new_comment', newCommentListener);
      channel.unbind('ticket_update', ticketUpdateListener);
    };
  }, [channel, detailedTicket]);

  const categories = useMemo(() => {
    const allCategories = allTickets.map(t => t.categoria).filter(Boolean);
    return [...new Set(allCategories)];
  }, [allTickets]);

  const groupedTickets = useMemo(() => {
    let filtered = allTickets;
    if (statusFilter) filtered = filtered.filter(t => t.estado === statusFilter);
    if (priorityFilter) filtered = filtered.filter(t => t.priority === priorityFilter);
    if (categoryFilter) filtered = filtered.filter(t => t.categoria === categoryFilter);
    if (debouncedSearchTerm) {
         filtered = filtered.filter(ticket => {
              const term = debouncedSearchTerm.toLowerCase();
              const contains = (str: string | null | undefined) => str && str.toLowerCase().includes(term);
              return ticket.id.toString().includes(term) ||
                     ticket.nro_ticket.toString().includes(term) ||
                     contains(ticket.asunto) ||
                     contains(ticket.nombre_usuario) ||
                     contains(ticket.detalles);
          });
    }
    const safeFiltered = Array.isArray(filtered) ? filtered : [];
    const sorted = safeFiltered.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const groups: { [key in TicketStatus]?: TicketSummary[] } = {};
    for (const ticket of sorted) {
        if (!groups[ticket.estado]) groups[ticket.estado] = [];
        groups[ticket.estado]!.push(ticket);
    }
    return ESTADOS_ORDEN_PRIORIDAD
        .map(status => ({ categoryName: ESTADOS[status].label, tickets: groups[status] || [] }))
        .filter(group => group.tickets.length > 0);
  }, [allTickets, debouncedSearchTerm, statusFilter, priorityFilter, categoryFilter]);

  const loadAndSetDetailedTicket = useCallback(async (ticketSummary: TicketSummary) => {
    setSelectedTicketId(ticketSummary.id);
    setDetailedTicket(null);
    try {
      const data = await apiFetch<Ticket>(`/tickets/${ticketSummary.tipo}/${ticketSummary.id}`, { sendEntityToken: true });
      setDetailedTicket(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar detalle.');
      setSelectedTicketId(null);
    }
  }, []);

  const handleTicketDetailUpdate = (updatedTicket: Ticket) => {
    setDetailedTicket(updatedTicket);
    setAllTickets(prev => prev.map(t => t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t));
  };

  const handleTicketPropertyChange = async (property: 'estado' | 'priority', value: TicketStatus | PriorityStatus) => {
    if (!detailedTicket) return;
    const { id, tipo } = detailedTicket;

    const originalTickets = [...allTickets];
    const originalDetailedTicket = detailedTicket;

    // Actualización optimista
    const updatedDetailedTicket = { ...detailedTicket, [property]: value };
    setDetailedTicket(updatedDetailedTicket);
    setAllTickets(prev => prev.map(t => t.id === id ? { ...t, [property]: value } : t));

    try {
      const endpoint = property === 'estado' ? 'estado' : 'prioridad';
      const updatedTicketData = await apiFetch<Ticket>(`/tickets/${tipo}/${id}/${endpoint}`, {
        method: "PUT",
        body: { [property]: value, user_id: user?.id },
        sendEntityToken: true
      });
      handleTicketDetailUpdate(updatedTicketData);
      toast.success(`Ticket ${property} actualizado.`);
    } catch (error) {
      toast.error(`No se pudo actualizar la propiedad ${property}.`);
      setAllTickets(originalTickets);
      setDetailedTicket(originalDetailedTicket);
    }
  };

    if (isLoading && allTickets.length === 0) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-primary h-16 w-16" /></div>;
    if (error) return <div className="p-8 text-center text-destructive">{error}</div>;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-3 border-b dark:border-slate-700">
        <h1 className="text-xl font-bold">Panel de Tickets</h1>
      </header>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <TicketListPanel
            groupedTickets={groupedTickets}
            selectedTicketId={selectedTicketId}
            onTicketSelect={loadAndSetDetailedTicket}
            isLoading={isLoading}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={categories as (string | undefined)[]}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <TicketDetailPanel
            ticket={detailedTicket}
            onTicketPropertyChange={handleTicketPropertyChange}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          {/* {detailedTicket && <ClientInfoPanel ticket={detailedTicket} />} */}
          <div>Panel de cliente desactivado para depuración.</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default TicketsPanelLayout;
