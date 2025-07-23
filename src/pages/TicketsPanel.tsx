import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Ticket as TicketIcon } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { TicketList } from '@/components/tickets/TicketList';
import { TicketChat } from '@/components/tickets/TicketChat';
import { TicketDetails } from '@/components/tickets/TicketDetails';

import { apiFetch, ApiError } from '@/utils/api';

// Tipos de datos
export type TicketStatus = "nuevo" | "en_proceso" | "derivado" | "resuelto" | "cerrado";
export type PriorityStatus = "low" | "medium" | "high";
export interface Comment { id: number; comentario: string; fecha: string; es_admin: boolean; }
export interface Ticket {
  id: number;
  tipo: 'pyme' | 'municipio';
  nro_ticket: number;
  asunto: string;
  estado: TicketStatus;
  fecha: string;
  detalles?: string;
  comentarios?: Comment[];
  nombre_usuario?: string;
  email_usuario?: string;
  telefono?: string;
  direccion?: string;
  categoria?: string;
  priority?: PriorityStatus;
}

const TicketsPanel = () => {
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para los filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityStatus | 'all'>('all');

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ tickets: Ticket[] }>("/api/tickets", { sendEntityToken: true });
      setAllTickets(data.tickets);
      setFilteredTickets(data.tickets);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error al cargar los tickets.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Lógica de filtrado
  useEffect(() => {
    let result = allTickets;

    if (searchTerm) {
        result = result.filter(ticket =>
            ticket.asunto.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.nombre_usuario?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    if (statusFilter !== 'all') {
        result = result.filter(ticket => ticket.estado === statusFilter);
    }

    if (priorityFilter !== 'all') {
        result = result.filter(ticket => ticket.priority === priorityFilter);
    }

    setFilteredTickets(result);
  }, [searchTerm, statusFilter, priorityFilter, allTickets]);


  const handleSelectTicket = useCallback(async (ticket: Ticket) => {
    // Aquí, en un futuro, podríamos cargar detalles adicionales si fuera necesario
    setSelectedTicket(ticket);
  }, []);

  const handleTicketUpdate = (updatedTicket: Ticket) => {
    setSelectedTicket(updatedTicket);
    setAllTickets(prevTickets =>
      prevTickets.map(t => t.id === updatedTicket.id ? updatedTicket : t)
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-primary h-16 w-16" />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">{error}</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center space-x-4">
            <img src="/logo/chatboc_logo_original.png" alt="Chatboc" className="h-8" />
            <h1 className="text-xl font-bold">Panel de Tickets</h1>
        </div>
        <div>
            {/* TODO: Añadir botones de acción del header */}
        </div>
      </header>
      <div className="flex-1 md:hidden">
        {/* Vista móvil */}
        {!selectedTicket ? (
          <TicketList
            tickets={filteredTickets}
            onTicketSelect={handleSelectTicket}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
          />
        ) : (
          <TicketChat ticket={selectedTicket} onTicketUpdate={handleTicketUpdate} />
        )}
      </div>
      <ResizablePanelGroup direction="horizontal" className="hidden md:flex flex-1">
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <TicketList
            tickets={filteredTickets}
            onTicketSelect={handleSelectTicket}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <AnimatePresence>
            {selectedTicket ? (
              <motion.div key={selectedTicket.id} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <TicketChat ticket={selectedTicket} onTicketUpdate={handleTicketUpdate} />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <TicketIcon className="h-20 w-20 text-muted-foreground/40" />
                <h2 className="mt-4 text-lg font-semibold">Seleccione un Ticket</h2>
                <p className="text-sm text-muted-foreground">Elija un ticket de la lista para ver los detalles y chatear.</p>
              </div>
            )}
          </AnimatePresence>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
           <AnimatePresence>
            {selectedTicket && (
              <motion.div key={selectedTicket.id} className="h-full p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <TicketDetails ticket={selectedTicket} onTicketUpdate={handleTicketUpdate} />
              </motion.div>
            )}
          </AnimatePresence>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default TicketsPanel;
