import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import TicketListPanel from './TicketListPanel';
import TicketDetailPanel from './TicketDetailPanel';
import ClientInfoPanel from './ClientInfoPanel';
import TicketsPanelHeader from './TicketsPanelHeader';
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

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<string>("todos"); // Para la barra superior
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityStatus | "">("");

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{tickets: TicketSummary[]}>("/tickets", { sendEntityToken: true });
      setAllTickets(data.tickets);
    } catch (err) {
      // ... (manejo de errores)
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // ... (lógica de Pusher)

  const categories = useMemo(() => {
    const allCategories = allTickets.map(t => t.categoria).filter(Boolean);
    return [...new Set(allCategories as string[])];
  }, [allTickets]);

  const filteredTickets = useMemo(() => {
    let filtered = allTickets;

    if (activeView !== 'todos') {
      filtered = filtered.filter(t => t.categoria === activeView);
    }

    if (statusFilter) {
      filtered = filtered.filter(t => t.estado === statusFilter);
    }

    if (priorityFilter) {
        filtered = filtered.filter(t => t.priority === priorityFilter);
    }

    if (debouncedSearchTerm) {
         filtered = filtered.filter(ticket => {
              const term = debouncedSearchTerm.toLowerCase();
              const contains = (str: string | null | undefined) => str && str.toLowerCase().includes(term);
              return ticket.id.toString().includes(term) ||
                     ticket.nro_ticket.toString().includes(term) ||
                     contains(ticket.asunto) ||
                     contains(ticket.nombre_usuario);
          });
    }

    return filtered;
  }, [allTickets, activeView, statusFilter, priorityFilter, debouncedSearchTerm]);

  const groupedTickets = useMemo(() => {
    const sorted = filteredTickets.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const groups: { [key in TicketStatus]?: TicketSummary[] } = {};
    for (const ticket of sorted) {
        if (!groups[ticket.estado]) groups[ticket.estado] = [];
        groups[ticket.estado]!.push(ticket);
    }
    return ESTADOS_ORDEN_PRIORIDAD
        .map(status => ({ categoryName: ESTADOS[status].label, tickets: groups[status] || [] }))
        .filter(group => group.tickets.length > 0);
  }, [filteredTickets]);

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
    <div className="flex flex-col h-screen bg-muted/30 text-foreground">
      <TicketsPanelHeader
        onNewTicket={() => console.log("Nuevo Ticket")}
        onRefresh={fetchInitialData}
        categories={categories}
        activeCategory={activeView}
        onCategoryChange={setActiveView}
      />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={30} minSize={25} maxSize={45}>
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
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={45} minSize={30}>
          <TicketDetailPanel
            ticket={detailedTicket}
            onTicketPropertyChange={handleTicketPropertyChange}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={20}>
          {detailedTicket && <ClientInfoPanel ticket={detailedTicket} />}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default TicketsPanelLayout;
