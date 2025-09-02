import { apiFetch, ApiError } from '@/utils/api';
import {
  Ticket,
  Message,
  TicketHistoryEvent,
  TicketTimelineResponse,
} from '@/types/tickets';
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
        const response = await apiFetch<
            Ticket & { historial?: TicketHistoryEvent[]; mensajes?: Message[] }
        >(`/tickets/municipio/${id}`);
        const history = (response as any).history || response.historial || [];
        let messages = (response as any).mensajes || (response as any).messages || [];
        if (!messages.length) {
            try {
                messages = await getTicketMessages(response.id, response.tipo);
            } catch (err) {
                console.error(`Error fetching messages for ticket ${id}:`, err);
            }
        }
        return {
            ...response,
            history,
            messages,
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
        throw new ApiError('El PIN es obligatorio', 400);
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
            const response = await apiFetch<
                Ticket & { historial?: TicketHistoryEvent[]; mensajes?: Message[] }
            >(url, {
                skipAuth: true,
                sendAnonId: true,
                sendEntityToken: true,
            });
            const history = (response as any).history || response.historial || [];
            let messages = (response as any).mensajes || (response as any).messages || [];
            if (!messages.length) {
                try {
                    messages = await getTicketMessages(response.id, response.tipo);
                } catch (err) {
                    console.error(`Error fetching messages for ticket ${response.id}:`, err);
                }
            }
            return {
                ...response,
                history,
                messages,
                avatarUrl:
                    response.avatarUrl ||
                    generateRandomAvatar(response.email || response.id.toString()),
            };
        } catch (err) {
            const apiErr = err as ApiError;
            if (apiErr?.status === 400 && !pin) {
                throw new ApiError('El PIN es obligatorio', 400, apiErr.data);
            }
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

export const getTicketMessages = async (
  ticketId: number,
  tipo: 'municipio' | 'pyme'
): Promise<Message[]> => {
  try {
    const endpoint =
      tipo === 'municipio'
        ? `/tickets/chat/${ticketId}/mensajes`
        : `/tickets/chat/pyme/${ticketId}/mensajes`;
    const response = await apiFetch<{ mensajes?: any[]; messages?: any[] }>(endpoint);
    const rawMsgs = response.mensajes || response.messages || [];

    const parseAdminFlag = (val: any): boolean => {
      if (val === undefined || val === null) return false;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0;
      if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase();
        if (['1', 'true', 't', 'yes', 'y', 'si', 's'].includes(normalized)) return true;
        if (['0', 'false', 'f', 'no', 'n'].includes(normalized)) return false;
        return Boolean(normalized);
      }
      return Boolean(val);
    };

    return rawMsgs.map((m: any, idx: number) => ({
      id: m.id ?? idx,
      author: parseAdminFlag(m.es_admin ?? m.esAdmin ?? m.is_admin ?? m.isAdmin)
        ? 'agent'
        : 'user',
      agentName: m.nombre_agente || m.agentName,
      content: m.content || m.texto || m.mensaje || '',
      timestamp:
        typeof m.timestamp === 'number'
          ? new Date(m.timestamp).toISOString()
          : m.timestamp || m.fecha || new Date().toISOString(),
      attachments: m.attachments || m.adjuntos,
      botones: m.botones,
      structuredContent: m.structuredContent,
      ubicacion: m.ubicacion,
    }));
  } catch (error) {
    console.error(`Error fetching messages for ticket ${ticketId}:`, error);
    throw error;
  }
};

export const getTicketTimeline = async (
  ticketId: number,
  tipo: 'municipio' | 'pyme',
  opts?: { public?: boolean }
): Promise<{ estado_chat: string; history: TicketHistoryEvent[]; messages: Message[] }> => {
  try {
    const endpoint = `/tickets/${tipo}/${ticketId}/timeline`;
    const fetchOpts = opts?.public
      ? { skipAuth: true, sendAnonId: true, sendEntityToken: true }
      : { sendAnonId: true };
    const response = await apiFetch<TicketTimelineResponse>(endpoint, fetchOpts);
    const history: TicketHistoryEvent[] = [];
    const messages: Message[] = [];
    const parseAdminFlag = (val: any): boolean | null => {
      if (val === undefined || val === null) return null;
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val !== 0;
      if (typeof val === 'string') {
        const normalized = val.trim().toLowerCase();
        if (['1', 'true', 't', 'yes', 'y', 'si', 's'].includes(normalized)) return true;
        if (['0', 'false', 'f', 'no', 'n'].includes(normalized)) return false;
        return Boolean(normalized);
      }
      return Boolean(val);
    };

    response.timeline?.forEach((evt, idx) => {
      if (evt.tipo === 'comentario') {
        const isAgent =
          parseAdminFlag(evt.es_admin) ?? !!evt.user_id;
        const content =
          (evt as any).comentario ?? (evt as any).mensaje ?? evt.texto ?? '';
        messages.push({
          id: idx,
          author: isAgent ? 'agent' : 'user',
          content,
          timestamp: evt.fecha,
        });
      } else {
        history.push({
          status: evt.estado || '',
          date: evt.fecha,
        });
      }
    });
    return { estado_chat: response.estado_chat, history, messages };
  } catch (error) {
    console.error(`Error fetching timeline for ticket ${ticketId}:`, error);
    throw error;
  }
};

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
