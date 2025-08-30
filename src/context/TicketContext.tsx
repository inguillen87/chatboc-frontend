import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Ticket } from '@/types/tickets';
import { getTickets } from '@/services/ticketService';
import useTicketUpdates from '@/hooks/useTicketUpdates';

interface TicketContextType {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  selectTicket: (ticketId: number | null) => void;
  updateTicket: (ticketId: number, updates: Partial<Ticket>) => void;
  loading: boolean;
  error: string | null;
  ticketsByCategory: { [key: string]: Ticket[] };
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);

const groupTicketsByCategory = (tickets: Ticket[]) => {
    return tickets.reduce((acc, ticket) => {
      const category = ticket.categoria || 'Sin Categoría';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(ticket);
      return acc;
    }, {} as { [key: string]: Ticket[] });
  };

export const TicketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const apiResponse = await getTickets();
      const fetchedTickets = (apiResponse as any)?.tickets;

      if (Array.isArray(fetchedTickets)) {
        setTickets(fetchedTickets);
        setSelectedTicket((prev) => prev ?? (fetchedTickets[0] || null));
      } else {
        console.warn("La respuesta de la API no contiene un array de tickets:", apiResponse);
        setTickets([]);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError('No se pudieron cargar los tickets.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  const selectTicket = (ticketId: number | null) => {
    if (ticketId === null) {
        setSelectedTicket(null);
        return;
    }
    const ticket = tickets.find(t => t.id === ticketId);
    setSelectedTicket(ticket || null);
  };

  const updateTicket = (ticketId: number, updates: Partial<Ticket>) => {
    setTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket
      )
    );
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  useTicketUpdates({
    onNewTicket: fetchTickets,
    onNewComment: (data) => {
      updateTicket(data.ticketId, { estado: data.estado });
    },
  });

  const ticketsByCategory = groupTicketsByCategory(tickets);

  const value = {
    tickets,
    selectedTicket,
    selectTicket,
    updateTicket,
    loading,
    error,
    ticketsByCategory,
  };

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};

export const useTickets = () => {
  const context = useContext(TicketContext);
  if (context === undefined) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
};
