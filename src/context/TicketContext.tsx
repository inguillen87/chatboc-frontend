import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Ticket, User } from '@/types/tickets';
import { getTickets } from '@/services/ticketService';
import useTicketUpdates from '@/hooks/useTicketUpdates';
import { mapToKnownCategory } from '@/utils/category';
import { useUser } from '@/hooks/useUser';
import { ApiError, resolveTenantSlug } from '@/utils/api';

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
  const groups: { [key: string]: Ticket[] } = {};
  const resolved: Ticket[] = [];

  tickets.forEach((ticket) => {
    const status = ticket.estado?.toLowerCase();
    if (status && ['resuelto', 'cerrado'].includes(status)) {
      resolved.push(ticket);
      return;
    }
    const category = ticket.categoria || 'General';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push({ ...ticket, categoria: category });
  });

  if (resolved.length > 0) {
    groups['Resueltos'] = resolved;
  }

  return groups;
};

const normalizeAssignedAgent = (ticket: any): User | undefined => {
  const candidate =
    ticket?.assignedAgent ||
    ticket?.assigned_agent ||
    ticket?.assigned_user ||
    ticket?.agente_asignado ||
    ticket?.agenteAsignado ||
    ticket?.agente ||
    ticket?.responsable ||
    ticket?.usuario_asignado ||
    ticket?.usuarioAsignado;

  const resolveAgentFromPayload = (payload: any): User | undefined => {
    if (!payload || typeof payload !== 'object') return undefined;

    const id =
      payload.id ??
      payload.user_id ??
      payload.usuario_id ??
      payload.userId ??
      payload.usuarioId ??
      payload.assigned_user_id;
    const nombre =
      payload.nombre_usuario ||
      payload.nombre ||
      payload.name ||
      payload.display_name ||
      payload.username;

    const email = payload.email || payload.email_usuario || payload.emailUsuario;

    if (id === undefined && !nombre) return undefined;

    return {
      id: id ?? nombre ?? email ?? 'agent',
      nombre_usuario: nombre || 'Agente',
      email: email || 'desconocido@chatboc.local',
      avatarUrl: payload.avatarUrl || payload.avatar_url || payload.avatar,
      phone: payload.phone || payload.telefono,
      categoria_ids: payload.categoria_ids,
      categorias: payload.categorias,
    };
  };

  const resolved = resolveAgentFromPayload(candidate);
  if (resolved) return resolved;

  const directId =
    ticket?.assigned_user_id ||
    ticket?.assignedAgentId ||
    ticket?.assigned_agent_id ||
    ticket?.asigned_user_id;

  if (directId !== undefined) {
    return {
      id: directId,
      nombre_usuario:
        ticket?.assigned_user_name ||
        ticket?.assignedUserName ||
        ticket?.agente_asignado_nombre ||
        'Agente asignado',
      email:
        ticket?.assigned_user_email ||
        ticket?.assignedUserEmail ||
        'desconocido@chatboc.local',
    };
  }

  return undefined;
};

export const TicketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  const filterTicketsForUser = useCallback(
    (list: Ticket[]): Ticket[] => {
      const role = (user?.rol || '').toString().toLowerCase();
      const isSuperAdmin = role.includes('super_admin');
      const shouldRestrict = !isSuperAdmin && (role.includes('empleado') || role.includes('admin'));

      if (!shouldRestrict) return list;

      const userId = user?.id;
      const normalizeId = (value: unknown) =>
        value === undefined || value === null ? null : String(value);

      const allowedCategoryIds = new Set<number>();
      const allowedCategoryNames = new Set<string>();

      const collectUserCategory = (value: unknown) => {
        if (value === undefined || value === null) return;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          allowedCategoryIds.add(Number(numeric));
        }
        const label = String(value).trim().toLowerCase();
        if (label) {
          allowedCategoryNames.add(label);
        }
      };

      collectUserCategory(user?.categoria_id);
      (user?.categoria_ids || []).forEach(collectUserCategory);
      (user?.categorias || []).forEach((cat) => {
        collectUserCategory(cat?.id);
        if (cat?.nombre) {
          allowedCategoryNames.add(cat.nombre.toLowerCase().trim());
        }
      });

      const hasCategoryRestrictions =
        allowedCategoryIds.size > 0 || allowedCategoryNames.size > 0;

      if (!hasCategoryRestrictions) {
        return list;
      }

      return list.filter((ticket) => {
        const matchesAssignee =
          userId !== undefined && userId !== null &&
          [ticket.assignedAgentId, ticket.assigned_agent_id, ticket.assignedAgent?.id]
            .map(normalizeId)
            .some((id) => id !== null && id === normalizeId(userId));

        const ticketCategoryIds = new Set<number>();
        const ticketCategoryNames = new Set<string>();

        const collectTicketCategory = (value: unknown) => {
          if (value === undefined || value === null) return;
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            ticketCategoryIds.add(Number(numeric));
          }
          const label = String(value).trim().toLowerCase();
          if (label) {
            ticketCategoryNames.add(label);
          }
        };

        [
          ticket.categoria_principal,
          ticket.categoria_secundaria,
          ticket.categoria_simple,
          ticket.categoria,
          ticket.categoria_id,
        ].forEach(collectTicketCategory);
        (ticket.categories || []).forEach(collectTicketCategory);
        (ticket.categoria_ids || []).forEach(collectTicketCategory);
        (ticket.categorias || []).forEach((cat) => {
          collectTicketCategory(cat?.id);
          collectTicketCategory(cat?.nombre);
        });

        const matchesCategoryById =
          allowedCategoryIds.size > 0 &&
          Array.from(ticketCategoryIds).some((id) => allowedCategoryIds.has(id));
        const matchesCategoryByName =
          allowedCategoryNames.size > 0 &&
          Array.from(ticketCategoryNames).some((name) => allowedCategoryNames.has(name));

        const matchesCategory = matchesCategoryById || matchesCategoryByName;

        return matchesAssignee || matchesCategory;
      });
    },
    [user]
  );

  const fetchTickets = useCallback(async () => {
    const tenantSlug = resolveTenantSlug(user?.tenantSlug);

    try {
      const apiResponse = await getTickets(tenantSlug);
      const fetchedTickets = (apiResponse as any)?.tickets;

      if (Array.isArray(fetchedTickets)) {
        const normalizedTickets = fetchedTickets.map((t: Ticket) => {
          const assignedAgent = normalizeAssignedAgent(t);
          return {
            ...t,
            categoria: mapToKnownCategory(t.categoria, t.categories),
            assignedAgent,
            assignedAgentId:
              t.assignedAgentId ||
              t.assigned_agent_id ||
              t.assigned_user_id ||
              (assignedAgent ? assignedAgent.id : undefined),
          } as Ticket;
        });
        const filteredTickets = filterTicketsForUser(normalizedTickets);
        setTickets(filteredTickets);
        setSelectedTicket((prev) => {
          if (prev && filteredTickets.some((ticket) => ticket.id === prev.id)) {
            return prev;
          }
          return filteredTickets[0] || null;
        });
      } else {
        console.warn("La respuesta de la API no contiene un array de tickets:", apiResponse);
        setTickets([]);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
      if (err instanceof ApiError) {
        if (err.status >= 500) {
          setError('Ocurrió un error en el servidor.');
        } else {
          setError('Error al obtener los tickets.');
        }
      } else {
        setError('Error al obtener los tickets.');
      }
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filterTicketsForUser, user?.tenantSlug]);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  const selectTicket = useCallback((ticketId: number | null) => {
    if (ticketId === null) {
        setSelectedTicket(null);
        return;
    }
    const ticket = tickets.find(t => t.id === ticketId);
    setSelectedTicket(ticket || null);
  }, [tickets]);

  const updateTicket = useCallback((ticketId: number, updates: Partial<Ticket>) => {
    setTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket
      )
    );
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedTicket]);

  const handleNewTicketSocket = useCallback((data: any) => {
    // Optimistic update: Prepend the new ticket to the list without fetching
    // Data normalization logic similar to fetchTickets

    // Safety check
    if (!data || !data.id) {
        fetchTickets(); // Fallback
        return;
    }

    const assignedAgent = normalizeAssignedAgent(data);
    const normalizedTicket = {
        ...data,
        categoria: mapToKnownCategory(data.categoria, data.categories),
        assignedAgent,
        assignedAgentId:
            data.assignedAgentId ||
            data.assigned_agent_id ||
            data.assigned_user_id ||
            (assignedAgent ? assignedAgent.id : undefined),
    } as Ticket;

    // Apply user filters
    const filtered = filterTicketsForUser([normalizedTicket]);

    if (filtered.length > 0) {
        setTickets(prev => {
            // Avoid duplicates
            if (prev.some(t => t.id === normalizedTicket.id)) {
                return prev;
            }
            return [filtered[0], ...prev];
        });
    }
  }, [filterTicketsForUser, fetchTickets]);

  useTicketUpdates({
    onNewTicket: handleNewTicketSocket,
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
