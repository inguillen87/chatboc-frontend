import { apiFetch } from '@/utils/api';
import { Ticket } from '@/types/tickets';

const generateRandomAvatar = (seed: string) => {
    return `https://i.pravatar.cc/150?u=${seed}`;
}

export const getTickets = async (): Promise<{tickets: Ticket[]}> => {
  try {
    const response = await apiFetch<{tickets: Ticket[]}>('/tickets');
    const tickets = response.tickets || [];

    const ticketsWithAvatars = tickets.map(ticket => ({
      ...ticket,
      avatarUrl: ticket.avatarUrl || generateRandomAvatar(ticket.email || ticket.id.toString())
    }));

    return { tickets: ticketsWithAvatars };

  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }
};

export const getTicketById = async (id: string): Promise<Ticket> => {
    try {
        const response = await apiFetch<Ticket>(`/tickets/municipio/${id}`); // Asumo municipio por ahora
        return {
            ...response,
            avatarUrl: response.avatarUrl || generateRandomAvatar(response.email || response.id.toString())
        };
    } catch (error) {
        console.error(`Error fetching ticket ${id}:`, error);
        throw error;
    }
};

export const getTicketMessages = async (ticketId: number, tipo: 'municipio' | 'pyme'): Promise<Message[]> => {
    try {
        const response = await apiFetch<{ mensajes: Message[] }>(`/tickets/chat/${tipo}/${ticketId}/mensajes`);
        return response.mensajes || [];
    } catch (error) {
        console.error(`Error fetching messages for ticket ${ticketId}:`, error);
        throw error;
    }
}

export const sendMessage = async (ticketId: number, tipo: 'municipio' | 'pyme', comentario: string): Promise<any> => {
    try {
        const response = await apiFetch(`/tickets/${tipo}/${ticketId}/responder`, {
            method: 'POST',
            body: { comentario },
        });
        return response;
    } catch (error) {
        console.error(`Error sending message to ticket ${ticketId}:`, error);
        throw error;
    }
}
