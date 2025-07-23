import { apiFetch } from '@/utils/api';
import { Ticket } from '@/types/tickets';

export const getTickets = async (anonId?: string): Promise<Ticket[]> => {
  try {
    const endpoint = anonId ? `/tickets/anonymous?anonId=${anonId}` : '/tickets';
    const response = await apiFetch<Ticket[]>(endpoint, { sendAnonId: !!anonId });
    return response;
  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }
};

export const getTicketById = async (id: string): Promise<Ticket> => {
    try {
        const response = await apiFetch<Ticket>(`/tickets/${id}`);
        return response;
    } catch (error) {
        console.error(`Error fetching ticket ${id}:`, error);
        throw error;
    }
};
