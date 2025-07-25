import { apiFetch } from '@/utils/api';
import { Ticket, Message } from '@/types/tickets';

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
        const response = await apiFetch<Ticket>(`/tickets/municipio/${id}`);
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
        const endpoint = tipo === 'municipio' ? `/tickets/chat/${ticketId}/mensajes` : `/tickets/chat/pyme/${ticketId}/mensajes`;
        const response = await apiFetch<{ mensajes: Message[] }>(endpoint);
        return response.mensajes || [];
    } catch (error) {
        console.error(`Error fetching messages for ticket ${ticketId}:`, error);
        throw error;
    }
}

export interface Button {
    type: 'reply';
    reply: {
        id: string;
        title: string;
    };
}

export interface InteractiveMessage {
    type: 'interactive';
    interactive: {
        type: 'button';
        body: {
            text: string;
        };
        action: {
            buttons: Button[];
        };
    };
}

export const sendMessage = async (
    ticketId: number,
    tipo: 'municipio' | 'pyme',
    comentario: string,
    formData?: FormData,
    buttons?: Button[]
): Promise<any> => {
    try {
        let body: any;
        let headers: any = {};

        if (buttons && buttons.length > 0) {
            const interactiveMessage: InteractiveMessage = {
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: {
                        text: comentario,
                    },
                    action: {
                        buttons: buttons,
                    },
                },
            };
            body = JSON.stringify(interactiveMessage);
            headers['Content-Type'] = 'application/json';
        } else {
            body = formData ? formData : new FormData();
            if (comentario) {
                body.append('comentario', comentario);
            }
        }

        const response = await apiFetch(`/tickets/${tipo}/${ticketId}/responder`, {
            method: 'POST',
            body: body,
            headers: headers,
        });
        return response;
    } catch (error) {
        console.error(`Error sending message to ticket ${ticketId}:`, error);
        throw error;
    }
};
