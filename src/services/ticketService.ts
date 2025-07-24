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
        const response = await apiFetch<Ticket>(`/tickets/${id}`);
        return {
            ...response,
            avatarUrl: response.avatarUrl || generateRandomAvatar(response.email || response.id.toString())
        };
    } catch (error) {
        console.error(`Error fetching ticket ${id}:`, error);
        throw error;
    }
};
