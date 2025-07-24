import { apiFetch } from '@/utils/api';
import { Ticket } from '@/types/tickets';

export const getTickets = async (): Promise<Ticket[]> => {
  try {
    const response = await apiFetch<Ticket[]>('/tickets');
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
