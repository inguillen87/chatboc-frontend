import { apiFetch, ApiError } from '@/utils/api';
import { Ticket, Message, TicketHistoryEvent } from '@/types/tickets';
import { AttachmentInfo } from '@/types/chat';

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
        const response = await apiFetch<Ticket & { historial?: TicketHistoryEvent[] }>(`/tickets/municipio/${id}`);
        const history = (response as any).history || response.historial || [];
        return {
            ...response,
            history,
            avatarUrl: response.avatarUrl || generateRandomAvatar(response.email || response.id.toString())
        };
    } catch (error) {
        console.error(`Error fetching ticket ${id}:`, error);
        throw error;
    }
};

export const getTicketByNumber = async (
    nroTicket: string,
    pin?: string
): Promise<Ticket> => {
    if (!pin) {
        throw new ApiError('El PIN es obligatorio', 400, null);
    }
    const raw = nroTicket.trim();
    const clean = raw.replace(/[^\d]/g, '');
    const pinParam = `?pin=${encodeURIComponent(pin)}`;
    const endpoints = [
        `/tickets/municipio/por_numero/${encodeURIComponent(raw)}${pinParam}`,
        `/tickets/municipio/por_numero/${encodeURIComponent(clean)}${pinParam}`,
        `/tickets/municipio/${encodeURIComponent(clean)}${pinParam}`,
    ];
    let lastError: unknown;
    for (const url of endpoints) {
        try {
            const response = await apiFetch<Ticket & { historial?: TicketHistoryEvent[] }>(url, {
                skipAuth: true,
                sendAnonId: true,
                sendEntityToken: true,
            });
            const history = (response as any).history || response.historial || [];
            return {
                ...response,
                history,
                avatarUrl:
                    response.avatarUrl ||
                    generateRandomAvatar(response.email || response.id.toString()),
            };
        } catch (err) {
            const apiErr = err as ApiError;
            if (apiErr?.status !== 404) {
                throw err;
            }
            lastError = err;
        }
    }
    console.error(`Error fetching ticket by number ${nroTicket}:`, lastError);
    throw lastError;
};

export const sendTicketHistory = async (ticket: Ticket): Promise<void> => {
    try {
        await apiFetch(`/tickets/${ticket.tipo}/${ticket.id}/send-history`, {
            method: 'POST',
        });
    } catch (error) {
        console.error(`Error sending ticket history for ticket ${ticket.id}:`, error);
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
    attachmentInfo?: AttachmentInfo,
    buttons?: Button[]
): Promise<any> => {
    try {
        let body: any;

        // La lógica de botones parece crear un tipo de mensaje interactivo muy específico
        // que puede ser mutuamente excluyente con los adjuntos. Se mantiene la lógica
        // pero la ruta principal ahora es para mensajes estándar con texto y/o adjuntos.
        if (buttons && buttons.length > 0) {
            const interactiveMessage: InteractiveMessage = {
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: comentario },
                    action: { buttons: buttons },
                },
            };
            body = interactiveMessage;
        } else {
            // Cuerpo de mensaje estándar.
            // El backend espera `attachment_info`
            body = {
                comentario: comentario,
                ...(attachmentInfo && { attachment_info: attachmentInfo }),
            };
        }

        const response = await apiFetch(`/tickets/${tipo}/${ticketId}/responder`, {
            method: 'POST',
            // apiFetch se encargará de stringify el objeto body si es un JSON
            body: body,
        });
        return response;
    } catch (error) {
        console.error(`Error sending message to ticket ${ticketId}:`, error);
        throw error;
    }
};
