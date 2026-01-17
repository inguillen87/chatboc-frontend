import { apiFetch, ApiError } from '@/utils/api';
import {
  Ticket,
  Message,
  TicketHistoryEvent,
  TicketTimelineResponse,
  TicketStatus,
  Attachment,
  User,
} from '@/types/tickets';
import { AttachmentInfo } from '@/types/chat';

const generateRandomAvatar = (seed: string) => {
    return `https://i.pravatar.cc/150?u=${seed}`;
}

export interface AssignableAgent extends User {
    categoria_id?: number | null;
    categoria_ids?: number[] | null;
    categorias?: { id: number; nombre: string }[] | null;
    abiertos?: number | null;
    atendidos?: number | null;
}

const normalizeAssignableAgent = (raw: any): AssignableAgent | null => {
    if (!raw || typeof raw !== 'object') return null;

    const id = raw.id ?? raw.user_id ?? raw.usuario_id ?? raw.userId;
    const nombre = raw.nombre_usuario || raw.nombre || raw.name;
    const email = raw.email || raw.email_usuario || raw.emailUsuario;

    if (id === undefined && !nombre && !email) return null;

    return {
        id: id ?? nombre ?? email ?? 'agente',
        nombre_usuario: nombre || 'Agente',
        email: email || 'desconocido@chatboc.local',
        avatarUrl: raw.avatarUrl || raw.avatar_url || raw.avatar,
        phone: raw.phone || raw.telefono,
        categoria_id: raw.categoria_id ?? null,
        categoria_ids: raw.categoria_ids ?? null,
        categorias: raw.categorias ?? null,
        abiertos: raw.abiertos ?? null,
        atendidos: raw.atendidos ?? null,
    };
};

export const getTickets = async (
  tenantSlug?: string | null,
): Promise<{ tickets: Ticket[] }> => {
  try {
    const response = await apiFetch<{ tickets: Ticket[] }>('/tickets', {
      tenantSlug,
      omitTenant: false,
      // Algunos despliegues requieren el tenant para filtrar los tickets
      // correctamente y evitar errores 500 en el backend.
    });
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

export const getAssignableAgents = async (
    tipo: 'municipio' | 'pyme',
): Promise<AssignableAgent[]> => {
    const endpoint = tipo === 'municipio' ? '/municipal/usuarios' : '/pyme/usuarios';

    try {
        const response = await apiFetch<any>(endpoint);
        const collection: any[] = Array.isArray(response)
            ? response
            : response?.usuarios || response?.users || response?.data || [];

        return collection
            .map(normalizeAssignableAgent)
            .filter((agent): agent is AssignableAgent => Boolean(agent));
    } catch (error) {
        console.error('Error fetching assignable agents:', error);
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

export type TicketHistoryEmailReason =
    | 'manual'
    | 'ticket_created'
    | 'status_change'
    | 'message_update'
    | 'auto_completion';

export type TicketHistoryNotificationChannel = 'email' | 'sms';

export interface TicketHistoryEmailOptions {
    reason?: TicketHistoryEmailReason;
    estado?: string;
    actor?: 'agent' | 'user';
    pin?: string;
    [key: string]: unknown;
}

const DEFAULT_TICKET_NOTIFICATION_CHANNELS: TicketHistoryNotificationChannel[] = ['email', 'sms'];

export interface TicketHistoryEmailParams {
    tipo: 'municipio' | 'pyme';
    ticketId: number;
    options?: TicketHistoryEmailOptions;
}

export interface TicketHistoryDeliverySuccessResult {
    status: 'sent';
    message?: string;
}

export interface TicketHistoryDeliveryErrorResult {
    status: 'delivery_error';
    message?: string;
    retriable?: boolean;
    error?: unknown;
    code?: string | number;
}

export type TicketHistoryDeliveryResult =
    | TicketHistoryDeliverySuccessResult
    | TicketHistoryDeliveryErrorResult;

export const isTicketHistoryDeliveryErrorResult = (
    result: TicketHistoryDeliveryResult,
): result is TicketHistoryDeliveryErrorResult => result.status === 'delivery_error';

export const formatTicketHistoryDeliveryErrorMessage = (
    result: TicketHistoryDeliveryErrorResult,
    contextMessage?: string,
): string => {
    const prefix = contextMessage?.trim()
        ? contextMessage.trim()
        : 'No se pudo completar la notificación por correo.';
    const detail = result.message?.trim();
    return detail ? `${prefix} Detalle: ${detail}` : prefix;
};

const shouldBubbleTicketHistoryError = (error: unknown): boolean => {
    if (error instanceof ApiError) {
        if (error.status === 401 || error.status === 403) {
            return true;
        }
    }
    return false;
};

const buildTicketHistoryDeliveryError = (
    error: unknown,
): TicketHistoryDeliveryErrorResult => {
    if (error instanceof ApiError) {
        const bodyMessage =
            (typeof error.body === 'object' && error.body !== null &&
                (error.body.message || error.body.detail || error.body.error)) ||
            undefined;
        const inferredMessage =
            bodyMessage ||
            (error.status >= 500
                ? 'El servidor de correo no respondió correctamente.'
                : error.message);
        const code =
            typeof (error.body as any)?.code === 'string' ||
            typeof (error.body as any)?.code === 'number'
                ? (error.body as any).code
                : undefined;
        return {
            status: 'delivery_error',
            message: inferredMessage,
            retriable: error.status >= 500 || error.status === 429,
            error,
            code,
        };
    }

    const fallbackMessage =
        error instanceof Error
            ? error.message
            : 'Error inesperado al enviar el historial.';

    return {
        status: 'delivery_error',
        message: fallbackMessage,
        retriable: true,
        error,
    };
};

export const normalizeTicketHistoryDeliveryError = (
    error: unknown,
): TicketHistoryDeliveryErrorResult => buildTicketHistoryDeliveryError(error);

export const requestTicketHistoryEmail = async ({
    tipo,
    ticketId,
    options,
}: TicketHistoryEmailParams): Promise<TicketHistoryDeliveryResult> => {
    const normalizeChannel = (value: unknown): TicketHistoryNotificationChannel | null => {
        if (!value) return null;
        const text = String(value).trim().toLowerCase();
        if (!text) return null;
        if (['email', 'mail', 'correo', 'correo_electronico'].includes(text)) return 'email';
        if (['sms', 'texto', 'mensaje', 'mensaje_de_texto', 'text'].includes(text)) return 'sms';
        return null;
    };

    const buildNotificationPayload = (
        rawOptions?: TicketHistoryEmailOptions,
    ): Record<string, unknown> => {
        if (!rawOptions) {
            return {
                channels: [...DEFAULT_TICKET_NOTIFICATION_CHANNELS],
                notify: { email: true, sms: true },
            };
        }

        const {
            channels,
            notifyChannels,
            sendEmail,
            sendSms,
            notify,
            pin,
            ...rest
        } = rawOptions;

        const channelSet = new Set<TicketHistoryNotificationChannel>();

        const registerChannels = (values?: Iterable<unknown>) => {
            if (!values) return;
            for (const value of values) {
                const normalized = normalizeChannel(value);
                if (normalized) {
                    channelSet.add(normalized);
                }
            }
        };

        registerChannels(channels);
        registerChannels(notifyChannels);

        let explicitPreference = channelSet.size > 0;

        if (sendEmail === true) {
            channelSet.add('email');
            explicitPreference = true;
        }
        if (sendSms === true) {
            channelSet.add('sms');
            explicitPreference = true;
        }

        if (sendEmail === false) {
            channelSet.delete('email');
            explicitPreference = true;
        }
        if (sendSms === false) {
            channelSet.delete('sms');
            explicitPreference = true;
        }

        if (notify?.email === true) {
            channelSet.add('email');
            explicitPreference = true;
        }
        if (notify?.sms === true) {
            channelSet.add('sms');
            explicitPreference = true;
        }
        if (notify?.email === false) {
            channelSet.delete('email');
            explicitPreference = true;
        }
        if (notify?.sms === false) {
            channelSet.delete('sms');
            explicitPreference = true;
        }

        if (!explicitPreference) {
            DEFAULT_TICKET_NOTIFICATION_CHANNELS.forEach((channel) => channelSet.add(channel));
        }

        const normalizedChannels = Array.from(channelSet);

        if (!normalizedChannels.length) {
            normalizedChannels.push(...DEFAULT_TICKET_NOTIFICATION_CHANNELS);
        }

        const notifyPayload: Record<string, unknown> = {
            ...(typeof notify === 'object' && notify !== null ? notify : {}),
        };

        if (!('email' in notifyPayload)) {
            notifyPayload.email = normalizedChannels.includes('email');
        }
        if (!('sms' in notifyPayload)) {
            notifyPayload.sms = normalizedChannels.includes('sms');
        }

        return {
            ...rest,
            channels: normalizedChannels,
            notify: notifyPayload,
        };
    };

    try {
        const { pin, ...notificationOptions } = options || {};
        const baseUrl = `/tickets/${tipo}/${ticketId}/send-history`;
        const endpoint = pin
            ? `${baseUrl}?pin=${encodeURIComponent(pin)}`
            : baseUrl;
        const baseFetchOptions = pin
            ? { skipAuth: true, sendAnonId: true, sendEntityToken: true }
            : { sendAnonId: true };

        await apiFetch(endpoint, {
            method: 'POST',
            body: buildNotificationPayload(notificationOptions),
            ...baseFetchOptions,
        });
        return { status: 'sent' };
    } catch (error) {
        if (shouldBubbleTicketHistoryError(error)) {
            console.error(
                `Auth error sending ticket history for ticket ${ticketId}:`,
                error,
            );
            throw error;
        }

        const normalizedError = buildTicketHistoryDeliveryError(error);
        console.error(
            `Delivery error sending ticket history for ticket ${ticketId}:`,
            normalizedError,
        );
        return normalizedError;
    }
};

export const sendTicketHistory = async (
    ticket: Ticket,
    options?: TicketHistoryEmailOptions
): Promise<TicketHistoryDeliveryResult> => {
    return requestTicketHistoryEmail({ tipo: ticket.tipo, ticketId: ticket.id, options });
};

export const updateTicketStatus = async (
    ticketId: number,
    tipo: 'municipio' | 'pyme',
    estado: TicketStatus
): Promise<void> => {
    try {
        await apiFetch(`/tickets/${tipo}/${ticketId}/estado`, {
            method: 'PUT',
            body: { estado },
        });
    } catch (error) {
        console.error(`Error updating status for ticket ${ticketId}:`, error);
        throw error;
    }
};

export const assignTicketToAgent = async (
    ticketId: number,
    tipo: 'municipio' | 'pyme',
    agent: AssignableAgent | string | number,
): Promise<void> => {
    const agentId = typeof agent === 'object' ? agent.id : agent;
    const payload = {
        user_id: agentId,
        assigned_user_id: agentId,
        assigned_to: agentId,
    };

    const endpoints = [
        `/tickets/${tipo}/${ticketId}/assign`,
        `/tickets/${tipo}/${ticketId}/asignar`,
        `/tickets/${tipo}/${ticketId}/asignacion`,
    ];

    let lastError: unknown;

    for (const endpoint of endpoints) {
        try {
            await apiFetch(endpoint, {
                method: 'POST',
                body: payload,
            });
            return;
        } catch (err: any) {
            lastError = err;
            const apiErr = err as ApiError;
            if (apiErr?.status && ![404, 405].includes(apiErr.status)) {
                throw err;
            }
        }
    }

    console.error(`No se pudo asignar el ticket ${ticketId}:`, lastError);
    throw lastError || new Error('Error desconocido al asignar el ticket');
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

    return rawMsgs.map((m: any, idx: number) => {
      const combinedAttachments: any[] = [];
      for (const value of [
        m.archivos_adjuntos,
        m.attachments,
        m.adjuntos,
      ]) {
        if (!value) {
          continue;
        }
        if (Array.isArray(value)) {
          combinedAttachments.push(...value);
        } else {
          combinedAttachments.push(value);
        }
      }
      const normalizedAttachments =
        combinedAttachments.length > 0 ? combinedAttachments : undefined;

      return {
        id: m.id ?? idx,
        author: parseAdminFlag(
          m.es_admin ?? m.esAdmin ?? m.is_admin ?? m.isAdmin,
        )
          ? 'agent'
          : 'user',
        agentName: m.nombre_agente || m.agentName,
        content: m.content || m.texto || m.mensaje || '',
        timestamp:
          typeof m.timestamp === 'number'
            ? new Date(m.timestamp).toISOString()
            : m.timestamp || m.fecha || new Date().toISOString(),
        attachments: normalizedAttachments,
        archivos_adjuntos: normalizedAttachments,
        botones: m.botones,
        structuredContent: m.structuredContent,
        ubicacion: m.ubicacion,
      };
    });
  } catch (error) {
    console.error(`Error fetching messages for ticket ${ticketId}:`, error);
    throw error;
  }
};

export const getTicketTimeline = async (
  ticketId: number,
  tipo: 'municipio' | 'pyme',
  opts?: { public?: boolean; pin?: string }
): Promise<{ estado_chat: string; history: TicketHistoryEvent[]; messages: Message[] }> => {
  try {
    const endpointBase = `/tickets/${tipo}/${ticketId}/timeline`;
    const endpoint = opts?.pin
      ? `${endpointBase}?pin=${encodeURIComponent(opts.pin)}`
      : endpointBase;
    const fetchOpts = opts?.public
      ? { skipAuth: true, sendAnonId: true, sendEntityToken: true }
      : { sendAnonId: true, sendEntityToken: true };
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
          status: evt.estado || (evt.tipo === 'ticket_creado' ? 'ticket_creado' : ''),
          date: evt.fecha,
          notes: evt.texto || (evt as any).comentario || undefined,
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
    files?: File[],
    buttons?: Button[]
): Promise<any> => {
    try {
        let body: any;

        // Si hay archivos, usamos FormData obligatoriamente
        if (files && files.length > 0) {
            const formData = new FormData();
            formData.append('comentario', comentario || ' '); // El backend puede requerir que no esté vacío si hay adjuntos
            files.forEach((file) => {
                formData.append('archivos', file);
            });
            body = formData;
        }
        // Si hay botones, usamos el formato JSON interactivo (asumiendo que no se mezclan con archivos)
        else if (buttons && buttons.length > 0) {
            const interactiveMessage: InteractiveMessage = {
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: { text: comentario },
                    action: { buttons: buttons },
                },
            };
            body = interactiveMessage;
        }
        // Si es solo texto, usamos FormData para evitar problemas con el backend
        // que espera multipart/form-data según la guía, aunque JSON podría funcionar en algunos casos.
        // La instrucción es "always use FormData".
        else {
            const formData = new FormData();
            formData.append('comentario', comentario);
            body = formData;
        }

        const response = await apiFetch(`/tickets/${tipo}/${ticketId}/responder`, {
            method: 'POST',
            body: body,
        });
        return response;
    } catch (error) {
        console.error(`Error sending message to ticket ${ticketId}:`, error);
        throw error;
    }
};
