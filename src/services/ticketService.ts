import { apiFetch, ApiError } from '@/utils/api';
import {
  Ticket,
  Message,
  TicketHistoryEvent,
  TicketTimelineResponse,
  TicketStatus,
  Attachment,
  User,
  TicketRealtimeState,
  TicketRealtimeViewer,
  TicketCollaborationState,
  UnifiedConversationStreamItem,
  TicketTimelineEvent,
} from '@/types/tickets';
import { AttachmentInfo } from '@/types/chat';
import getOrCreateAnonId from '@/utils/anonIdGenerator';
import { normalizeTicketLocation } from '@/utils/location';

const generateRandomAvatar = (seed: string) => {
    return `https://i.pravatar.cc/150?u=${seed}`;
}

const ticketApiPath = (path: string): string => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized.startsWith('/api/') ? normalized : `/api${normalized}`;
};

const TICKET_INBOX_INITIAL_PAGE_SIZE = '20';

const normalizeTicketPayload = <T extends Ticket>(ticket: T): T => {
    const location = normalizeTicketLocation(ticket);
    return {
        ...ticket,
        ...location,
    };
};

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

const normalizeTicketMessages = (rawMsgs: any[] | undefined | null): Message[] => {
    if (!Array.isArray(rawMsgs)) return [];

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
            id: m.id ?? m.comentario_id ?? m.comment_id ?? idx,
            author: parseAdminFlag(
                m.es_admin ?? m.esAdmin ?? m.is_admin ?? m.isAdmin,
            )
                ? 'agent'
                : 'user',
            agentName: m.nombre_agente || m.agentName || m.autor_nombre || m.author_name,
            content: m.content || m.texto || m.mensaje || m.comentario || '',
            timestamp:
                typeof m.timestamp === 'number'
                    ? new Date(m.timestamp).toISOString()
                    : m.timestamp || m.fecha || m.created_at || new Date().toISOString(),
            attachments: normalizedAttachments,
            archivos_adjuntos: normalizedAttachments,
            botones: m.botones,
            structuredContent: m.structuredContent,
            ubicacion: m.ubicacion,
            readAt: m.read_at ?? m.readAt ?? null,
            lastReadBy: m.last_read_by ?? m.lastReadBy ?? null,
        } as Message;
    });
};

const getInlineTicketMessageSource = (ticket: any): any[] => {
    if (!ticket || typeof ticket !== 'object') return [];
    for (const key of ['mensajes', 'messages', 'comentarios', 'comments', 'historial_chat', 'chat_history']) {
        const value = ticket[key];
        if (Array.isArray(value) && value.length > 0) {
            return value;
        }
    }
    return [];
};

const normalizeRealtimeViewer = (raw: any): TicketRealtimeViewer | null => {
    if (!raw || typeof raw !== 'object') return null;

    return {
        viewer_id: raw.viewer_id ?? raw.viewerId ?? raw.viewer_key ?? raw.viewerKey ?? raw.user_id ?? null,
        viewer_label: raw.viewer_label ?? raw.viewerLabel ?? raw.viewer_name ?? raw.viewerName ?? raw.viewer_key ?? null,
        viewer_name: raw.viewer_name ?? raw.viewerName ?? raw.viewer_label ?? raw.viewerLabel ?? null,
        session_id: raw.session_id ?? raw.sessionId ?? raw.active_session_id ?? raw.activeSessionId ?? null,
        presence_status: raw.presence_status ?? raw.presenceStatus ?? raw.status ?? null,
        effective_presence_status: raw.effective_presence_status ?? raw.effectivePresenceStatus ?? null,
        last_read_comment_id: raw.last_read_comment_id ?? raw.lastReadCommentId ?? null,
        read_at: raw.read_at ?? raw.readAt ?? raw.last_read_at ?? raw.lastReadAt ?? null,
        updated_at: raw.updated_at ?? raw.updatedAt ?? raw.last_presence_at ?? raw.lastPresenceAt ?? null,
        is_current_viewer: Boolean(raw.is_current_viewer ?? raw.isCurrentViewer ?? false),
        unread_count:
            typeof raw.unread_count === 'number'
                ? raw.unread_count
                : Number(raw.unread_count ?? raw.unreadCount ?? 0) || 0,
        has_unread: Boolean(raw.has_unread ?? raw.hasUnread ?? false),
    };
};

const normalizeRealtimeState = (raw: any): TicketRealtimeState | null => {
    if (!raw || typeof raw !== 'object') return null;

    const readState = raw.read_state && typeof raw.read_state === 'object'
        ? raw.read_state
        : raw.readState && typeof raw.readState === 'object'
            ? raw.readState
            : null;
    const presence = raw.presence && typeof raw.presence === 'object'
        ? raw.presence
        : null;
    const viewerSource = Array.isArray(raw.viewers)
        ? raw.viewers
        : Array.isArray(readState?.viewers)
            ? readState.viewers
            : [];
    const activeViewerSource = Array.isArray(raw.active_viewers)
        ? raw.active_viewers
        : Array.isArray(presence?.active_viewers)
            ? presence.active_viewers
            : [];
    const readStateSource = Array.isArray(raw.read_states)
        ? raw.read_states
        : Array.isArray(readState?.viewers)
            ? readState.viewers
            : [];

    const viewers = viewerSource.length
        ? viewerSource
            .map(normalizeRealtimeViewer)
            .filter((viewer): viewer is TicketRealtimeViewer => Boolean(viewer))
        : [];
    const active_viewers = activeViewerSource.length
        ? activeViewerSource
            .map(normalizeRealtimeViewer)
            .filter((viewer): viewer is TicketRealtimeViewer => Boolean(viewer))
        : viewers.filter((viewer) => viewer.presence_status === 'active');
    const read_states = readStateSource.length
        ? readStateSource
            .map(normalizeRealtimeViewer)
            .filter((viewer): viewer is TicketRealtimeViewer => Boolean(viewer))
        : viewers.filter(
            (viewer) =>
                viewer.last_read_comment_id !== null &&
                viewer.last_read_comment_id !== undefined,
        );
    const currentLastReadCommentId =
        raw.summary?.last_read_comment_id ??
        raw.summary?.lastReadCommentId ??
        read_states[0]?.last_read_comment_id ??
        null;

    return {
        viewers,
        active_viewers,
        read_states,
        summary:
            raw.summary && typeof raw.summary === 'object'
                ? {
                      active_count: raw.summary.active_count ?? presence?.active_count ?? active_viewers.length,
                      idle_count: raw.summary.idle_count ?? raw.summary.idleCount ?? 0,
                      read_count: raw.summary.read_count ?? read_states.length,
                      last_read_comment_id: currentLastReadCommentId,
                  }
                : {
                      active_count: presence?.active_count ?? active_viewers.length,
                      idle_count: presence?.idle_count ?? viewers.filter((viewer) => viewer.effective_presence_status === 'idle').length,
                      read_count: read_states.length,
                      last_read_comment_id: currentLastReadCommentId,
                  },
    };
};

const normalizeCollaborationState = (raw: any): TicketCollaborationState | null => {
    if (!raw || typeof raw !== 'object') return null;

    return {
        latest_comment_id: raw.latest_comment_id ?? raw.latestCommentId ?? null,
        latest_read_at: raw.latest_read_at ?? raw.latestReadAt ?? null,
        unread_count:
            typeof raw.unread_count === 'number'
                ? raw.unread_count
                : typeof raw.unreadCount === 'number'
                    ? raw.unreadCount
                    : 0,
        has_unread: Boolean(raw.has_unread ?? raw.hasUnread ?? false),
        unread_viewer_count:
            typeof raw.unread_viewer_count === 'number'
                ? raw.unread_viewer_count
                : typeof raw.unreadViewerCount === 'number'
                    ? raw.unreadViewerCount
                    : 0,
        active_viewers_count:
            typeof raw.active_viewers_count === 'number'
                ? raw.active_viewers_count
                : typeof raw.activeViewersCount === 'number'
                    ? raw.activeViewersCount
                    : 0,
        idle_viewer_count:
            typeof raw.idle_viewer_count === 'number'
                ? raw.idle_viewer_count
                : typeof raw.idleViewerCount === 'number'
                    ? raw.idleViewerCount
                    : 0,
        idle_window_minutes:
            typeof raw.idle_window_minutes === 'number'
                ? raw.idle_window_minutes
                : typeof raw.idleWindowMinutes === 'number'
                    ? raw.idleWindowMinutes
                    : 0,
    };
};


const normalizeUnifiedConversationStreamItem = (
    raw: any,
    index: number,
): UnifiedConversationStreamItem | null => {
    if (!raw || typeof raw !== 'object') return null;

    const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload : {};
    const streamType = raw.stream_type ?? raw.streamType ?? raw.type ?? raw.kind ?? null;
    const source = raw.source ?? raw.origin ?? payload.origen ?? null;
    const actorType =
        raw.actor_type ??
        raw.actorType ??
        (raw.es_admin === true || raw.es_admin === 1 || raw.user_id ? 'agent' : null) ??
        (streamType === 'status' || streamType === 'system' ? 'system' : 'citizen');
    const stableId =
        raw.id ??
        raw.item_id ??
        raw.timeline_id ??
        raw.comment_id ??
        payload.id ??
        `${streamType || source || 'stream'}:${index}`;
    const previewText =
        raw.preview_text ??
        raw.previewText ??
        raw.text ??
        raw.comentario ??
        raw.mensaje ??
        payload.preview_text ??
        payload.texto ??
        payload.comentario ??
        payload.mensaje ??
        raw.status ??
        raw.estado ??
        '';
    const isUnread =
        typeof raw.is_unread === 'boolean'
            ? raw.is_unread
            : typeof raw.isUnread === 'boolean'
                ? raw.isUnread
                : false;
    const isRead =
        typeof raw.is_read === 'boolean'
            ? raw.is_read
            : typeof raw.isRead === 'boolean'
                ? raw.isRead
                : !isUnread;

    return {
        id: String(stableId),
        timestamp: raw.timestamp ?? raw.date ?? raw.fecha ?? new Date().toISOString(),
        source: source ? String(source) : null,
        stream_type: streamType ? String(streamType) : null,
        actor_type:
            actorType === 'agent' || actorType === 'system' ? actorType : 'citizen',
        preview_text: String(previewText || '').trim(),
        status: raw.status ?? raw.estado ?? payload.estado ?? null,
        badge: raw.badge ?? raw.operational_status ?? raw.operationalStatus ?? null,
        is_read: Boolean(isRead),
        is_unread: Boolean(isUnread),
        payload: payload as Record<string, unknown>,
        raw,
    };
};

const buildFallbackUnifiedConversationStream = (
    timeline: TicketTimelineEvent[] | undefined,
): UnifiedConversationStreamItem[] => {
    if (!Array.isArray(timeline)) return [];

    return timeline
        .map((evt, index) => {
            const isComment = evt.tipo === 'comentario';
            const actorType = isComment
                ? (evt.es_admin === true || evt.es_admin === 1 || evt.user_id ? 'agent' : 'citizen')
                : 'system';
            const previewText =
                (evt as any).comentario ?? (evt as any).mensaje ?? evt.texto ?? evt.estado ?? evt.tipo;

            return {
                id: `${evt.tipo}:${index}`,
                timestamp: evt.fecha,
                source: isComment ? 'timeline_comment' : 'timeline_event',
                stream_type: evt.tipo,
                actor_type: actorType,
                preview_text: String(previewText || '').trim(),
                status: evt.estado ?? null,
                badge: evt.tipo === 'estado' ? 'status_changed' : evt.tipo,
                is_read: true,
                is_unread: false,
                payload: evt as Record<string, unknown>,
                raw: evt as Record<string, unknown>,
            } as UnifiedConversationStreamItem;
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

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

const resolvePublicTicketAccess = (pin?: string) => {
    const params = new URLSearchParams();
    const normalizedPin = typeof pin === 'string' ? pin.trim() : '';
    const anonId = getOrCreateAnonId();

    if (normalizedPin) {
        params.set('pin', normalizedPin);
        params.set('consulta_pin', normalizedPin);
    }

    if (anonId) {
        params.set('anon_id', anonId);
    }

    return {
        query: params.toString(),
        fetchOptions: {
            skipAuth: true,
            sendAnonId: true,
            sendEntityToken: true,
            pin: normalizedPin || undefined,
        } as const,
    };
};

export const getTickets = async (
  tenantSlug?: string | null,
): Promise<{ tickets: Ticket[] }> => {
  try {
      const params = new URLSearchParams({
        page: '1',
        per_page: TICKET_INBOX_INITIAL_PAGE_SIZE,
        include: 'compact',
      });
      const response = await apiFetch<{ tickets: Ticket[] }>(ticketApiPath(`/tickets?${params.toString()}`), {
      tenantSlug,
      omitTenant: false,
      // Algunos despliegues requieren el tenant para filtrar los tickets
      // correctamente y evitar errores 500 en el backend.
    });
    const tickets = response.tickets || [];

    const ticketsWithAvatars = tickets.map(rawTicket => {
      const ticket = normalizeTicketPayload(rawTicket);
      const collaborationState = normalizeCollaborationState((ticket as any).collaboration_state);
      return {
        ...ticket,
        collaboration_state: collaborationState,
        hasUnreadMessages:
          Boolean(ticket.hasUnreadMessages) ||
          Boolean(collaborationState?.has_unread) ||
          Number(collaborationState?.unread_viewer_count || 0) > 0,
        avatarUrl: ticket.avatarUrl || generateRandomAvatar(ticket.email || ticket.id.toString()),
      };
    });

    return { tickets: ticketsWithAvatars };

  } catch (error) {
    console.error('Error fetching tickets:', error);
    throw error;
  }
};

export const getAssignableAgents = async (
    tipo: 'municipio' | 'pyme',
): Promise<AssignableAgent[]> => {
    const endpoints =
        tipo === 'municipio'
            ? ['/admin/employees', '/empleados', '/municipal/usuarios']
            : ['/admin/employees', '/empleados', '/pyme/usuarios'];

    let lastError: unknown;

    for (const endpoint of endpoints) {
      try {
        const response = await apiFetch<any>(endpoint);
        const collection: any[] = Array.isArray(response)
            ? response
            : response?.empleados ||
              response?.employees ||
              response?.usuarios ||
              response?.users ||
              response?.data ||
              [];

        return collection
            .map(normalizeAssignableAgent)
            .filter((agent): agent is AssignableAgent => Boolean(agent));
      } catch (error) {
        lastError = error;
        const apiErr = error as ApiError;
        if (apiErr?.status && [401, 403].includes(apiErr.status)) {
          break;
        }
      }
    }

    console.warn('No se pudieron cargar agentes asignables; se muestra lista vacia.', lastError);
    return [];
};

export const getTicketById = async (id: string): Promise<Ticket> => {
    try {
        const response = await apiFetch<
            Ticket & { historial?: TicketHistoryEvent[]; mensajes?: Message[] }
        >(ticketApiPath(`/tickets/municipio/${id}`));
        const history = (response as any).history || response.historial || [];
        let messages = normalizeTicketMessages(getInlineTicketMessageSource(response));
        if (!messages.length) {
            try {
                messages = (await getTicketMessages(response.id, response.tipo)).messages;
            } catch (err) {
                console.error(`Error fetching messages for ticket ${id}:`, err);
            }
        }
        const normalizedResponse = normalizeTicketPayload(response);
        return {
            ...normalizedResponse,
            history,
            messages,
            collaboration_state: normalizeCollaborationState((normalizedResponse as any).collaboration_state),
            avatarUrl: normalizedResponse.avatarUrl || generateRandomAvatar(normalizedResponse.email || normalizedResponse.id.toString())
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
        ticketApiPath(`/tickets/municipio/por_numero/${encodeURIComponent(raw)}${pinParam}`),
        ticketApiPath(`/tickets/municipio/por_numero/${encodeURIComponent(clean)}${pinParam}`),
        ticketApiPath(`/tickets/municipio/${encodeURIComponent(clean)}${pinParam}`),
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
                pin,
            });
            const history = (response as any).history || response.historial || [];
            let messages = normalizeTicketMessages(getInlineTicketMessageSource(response));
            if (!messages.length) {
                try {
                    messages = (await getTicketMessages(response.id, response.tipo, {
                        public: true,
                        pin,
                    })).messages;
                } catch (err) {
                    console.error(`Error fetching messages for ticket ${response.id}:`, err);
                }
            }
            const normalizedResponse = normalizeTicketPayload(response);
            return {
                ...normalizedResponse,
                history,
                messages,
                realtime_state: normalizeRealtimeState((normalizedResponse as any).realtime_state),
                collaboration_state: normalizeCollaborationState((normalizedResponse as any).collaboration_state),
                hasUnreadMessages:
                    Boolean((normalizedResponse as any).hasUnreadMessages) ||
                    Boolean(normalizeCollaborationState((normalizedResponse as any).collaboration_state)?.has_unread) ||
                    Number(normalizeCollaborationState((normalizedResponse as any).collaboration_state)?.unread_viewer_count || 0) > 0,
                avatarUrl:
                    normalizedResponse.avatarUrl ||
                    generateRandomAvatar(normalizedResponse.email || normalizedResponse.id.toString()),
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

const shouldBubbleTicketHistoryError = (_error: unknown): boolean => false;

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
        const baseUrl = ticketApiPath(`/tickets/${tipo}/${ticketId}/send-history`);
        const endpoint = pin
            ? `${baseUrl}?pin=${encodeURIComponent(pin)}`
            : baseUrl;
        const baseFetchOptions = pin
            ? { skipAuth: true, sendAnonId: true, sendEntityToken: true }
            : {};

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
        await apiFetch(ticketApiPath(`/tickets/${tipo}/${ticketId}/estado`), {
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
        ticketApiPath(`/tickets/${tipo}/${ticketId}/assign`),
        ticketApiPath(`/tickets/${tipo}/${ticketId}/asignar`),
        ticketApiPath(`/tickets/${tipo}/${ticketId}/asignacion`),
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
            if (apiErr?.status && [400, 401, 403, 422].includes(apiErr.status)) {
                throw err;
            }
        }
    }

    console.error(`No se pudo asignar el ticket ${ticketId}:`, lastError);
    throw lastError || new Error('Error desconocido al asignar el ticket');
};

type TicketMessagesResult = Message[] & {
  messages: Message[];
  realtimeState: TicketRealtimeState | null;
};

export const getTicketMessages = async (
  ticketId: number,
  tipo: 'municipio' | 'pyme',
  opts?: { public?: boolean; pin?: string }
): Promise<TicketMessagesResult> => {
  try {
    const endpointBase =
      tipo === 'municipio'
        ? ticketApiPath(`/tickets/chat/${ticketId}/mensajes`)
        : ticketApiPath(`/tickets/chat/pyme/${ticketId}/mensajes`);
    const publicAccess = opts?.public ? resolvePublicTicketAccess(opts.pin) : null;
    const endpoint = publicAccess?.query
      ? `${endpointBase}?${publicAccess.query}`
      : opts?.pin
        ? `${endpointBase}?pin=${encodeURIComponent(opts.pin)}`
        : endpointBase;
    const fetchOptions = publicAccess?.fetchOptions ?? { sendAnonId: true, sendEntityToken: true };
    const response = await apiFetch<{ mensajes?: any[]; messages?: any[]; realtime_state?: any }>(endpoint, fetchOptions);
    const rawMsgs = response.mensajes || response.messages || [];
    const realtimeState = normalizeRealtimeState((response as any).realtime_state);
    const messages = normalizeTicketMessages(rawMsgs);

    const legacyCompatible = messages as TicketMessagesResult;
    legacyCompatible.messages = messages;
    legacyCompatible.realtimeState = realtimeState;
    return legacyCompatible;
  } catch (error) {
    console.error(`Error fetching messages for ticket ${ticketId}:`, error);
    throw error;
  }
};

export const getTicketTimeline = async (
  ticketId: number,
  tipo: 'municipio' | 'pyme',
  opts?: { public?: boolean; pin?: string }
): Promise<{ estado_chat: string; history: TicketHistoryEvent[]; messages: Message[]; unified_conversation_stream: UnifiedConversationStreamItem[] }> => {
  try {
    const endpointBase = ticketApiPath(`/tickets/${tipo}/${ticketId}/timeline`);
    const publicAccess = opts?.public ? resolvePublicTicketAccess(opts.pin) : null;
    const endpoint = publicAccess?.query
      ? `${endpointBase}?${publicAccess.query}`
      : opts?.pin
      ? `${endpointBase}?pin=${encodeURIComponent(opts.pin)}`
      : endpointBase;
    const fetchOpts = publicAccess?.fetchOptions ?? { sendAnonId: true, sendEntityToken: true };
    const response = await apiFetch<TicketTimelineResponse>(endpoint, fetchOpts);
    const history: TicketHistoryEvent[] = [];
    const messages: Message[] = [];
    const seenMessageKeys = new Set<string>();
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
    const normalizeTimelineMessage = (raw: any, idx: number, source: 'chat_history' | 'timeline'): Message | null => {
      if (!raw || typeof raw !== 'object') return null;
      const content =
        raw.comentario ??
        raw.texto ??
        raw.mensaje ??
        raw.content ??
        '';
      const normalizedContent = String(content || '').trim();
      if (!normalizedContent) return null;
      const timestamp = raw.fecha ?? raw.timestamp ?? raw.created_at ?? new Date().toISOString();
      const id =
        raw.id ??
        raw.comment_id ??
        raw.comentario_id ??
        `${source}:${idx}:${timestamp}:${normalizedContent.slice(0, 64)}`;
      const adminFlag = parseAdminFlag(raw.es_admin);
      const isAgent = adminFlag ?? (
        ['municipio', 'pyme', 'admin', 'agente', 'agent'].includes(String(raw.autor || raw.actor_type || '').toLowerCase()) ||
        !!raw.user_id
      );
      return {
        id,
        author: isAgent ? 'agent' : 'user',
        content: normalizedContent,
        timestamp,
      };
    };
    const appendMessage = (candidate: Message | null) => {
      if (!candidate) return;
      const key = candidate.id !== undefined && candidate.id !== null
        ? `id:${candidate.id}`
        : `fp:${candidate.author}:${candidate.timestamp}:${candidate.content.toLowerCase()}`;
      if (seenMessageKeys.has(key)) return;
      seenMessageKeys.add(key);
      messages.push(candidate);
    };

    const historialChat = Array.isArray((response as any).historial_chat)
      ? (response as any).historial_chat
      : [];
    const hasCanonicalChatHistory = historialChat.length > 0;
    if (hasCanonicalChatHistory) {
      historialChat.forEach((item: any, idx: number) => {
        appendMessage(normalizeTimelineMessage(item, idx, 'chat_history'));
      });
    }

    response.timeline?.forEach((evt, idx) => {
      if (evt.tipo === 'comentario') {
        if (!hasCanonicalChatHistory) {
          appendMessage(normalizeTimelineMessage(evt, idx, 'timeline'));
        }
      } else {
        history.push({
          status: evt.estado || (evt.tipo === 'ticket_creado' ? 'ticket_creado' : ''),
          date: evt.fecha,
          notes: evt.texto || (evt as any).comentario || undefined,
        });
      }
    });
    return {
      estado_chat: response.estado_chat,
      history,
      messages,
      unified_conversation_stream: Array.isArray((response as any).unified_conversation_stream)
        ? (response as any).unified_conversation_stream
            .map((item: any, index: number) => normalizeUnifiedConversationStreamItem(item, index))
            .filter((item: UnifiedConversationStreamItem | null): item is UnifiedConversationStreamItem => Boolean(item))
        : buildFallbackUnifiedConversationStream(response.timeline),
      realtime_state: normalizeRealtimeState((response as any).realtime_state),
    };
  } catch (error) {
    console.error(`Error fetching timeline for ticket ${ticketId}:`, error);
    throw error;
  }
};

export interface LiveChatScheduleStatus {
    contract_version?: string;
    enabled?: boolean;
    available?: boolean;
    description?: string;
    start_time?: string;
    end_time?: string;
    timezone?: string;
    source?: string;
    socket_enabled?: boolean;
    fallback_mode?: string;
}

export const getLiveChatScheduleStatus = async (
    tenantSlug?: string | null,
): Promise<LiveChatScheduleStatus> => {
    const query = new URLSearchParams();
    const slug = typeof tenantSlug === 'string' ? tenantSlug.trim() : '';
    if (slug) {
        query.set('tenant_slug', slug);
        query.set('tenant', slug);
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<LiveChatScheduleStatus>(`/api/live-chat/schedule${suffix}`, {
        sendAnonId: true,
        tenantSlug: slug || undefined,
    });
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

export const updateTicketPresence = async (
    ticketId: number,
    tipo: 'municipio' | 'pyme',
    presenceStatus: 'active' | 'idle' | 'inactive',
    opts?: { public?: boolean; pin?: string }
): Promise<TicketRealtimeState | null> => {
    const endpointBase = ticketApiPath(`/tickets/${tipo}/${ticketId}/presence`);
    const publicAccess = opts?.public ? resolvePublicTicketAccess(opts.pin) : null;
    const endpoint = publicAccess?.query
        ? `${endpointBase}?${publicAccess.query}`
        : opts?.pin
            ? `${endpointBase}?pin=${encodeURIComponent(opts.pin)}`
            : endpointBase;
    const fetchOptions = publicAccess?.fetchOptions ?? { sendAnonId: true, sendEntityToken: true };
    const response = await apiFetch<{ realtime_state?: any }>(endpoint, {
        method: 'POST',
        body: { presence_status: presenceStatus },
        ...fetchOptions,
    });
    return normalizeRealtimeState((response as any).realtime_state);
};

export const updateTicketReadState = async (
    ticketId: number,
    tipo: 'municipio' | 'pyme',
    lastReadCommentId: string | number,
    opts?: { public?: boolean; pin?: string }
): Promise<TicketRealtimeState | null> => {
    const endpointBase = ticketApiPath(`/tickets/${tipo}/${ticketId}/read-state`);
    const publicAccess = opts?.public ? resolvePublicTicketAccess(opts.pin) : null;
    const endpoint = publicAccess?.query
        ? `${endpointBase}?${publicAccess.query}`
        : opts?.pin
            ? `${endpointBase}?pin=${encodeURIComponent(opts.pin)}`
            : endpointBase;
    const fetchOptions = publicAccess?.fetchOptions ?? { sendAnonId: true, sendEntityToken: true };
    const response = await apiFetch<{ realtime_state?: any }>(endpoint, {
        method: 'POST',
        body: { last_read_comment_id: lastReadCommentId },
        ...fetchOptions,
    });
    return normalizeRealtimeState((response as any).realtime_state);
};

export const sendMessage = async (
    ticketId: number,
    tipo: 'municipio' | 'pyme',
    comentario: string,
    files?: File[],
    buttons?: Button[],
    opts?: { public?: boolean; pin?: string }
): Promise<any> => {
    try {
        let body: any;
        const shouldUseJsonBody = Boolean(opts?.public) && (!files || files.length === 0);

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
        // en contexto autenticado mantenemos multipart por compatibilidad.
        // Para contexto público usamos JSON para evitar 415 en responder_ciudadano.
        else {
            body = shouldUseJsonBody
                ? { comentario }
                : (() => {
                    const formData = new FormData();
                    formData.append('comentario', comentario);
                    return formData;
                })();
        }

        const baseEndpoint = opts?.public
            ? (tipo === 'municipio'
                ? ticketApiPath(`/tickets/chat/${ticketId}/responder_ciudadano`)
                : ticketApiPath(`/tickets/chat/pyme/${ticketId}/responder_ciudadano`))
            : ticketApiPath(`/tickets/${tipo}/${ticketId}/responder`);
        const publicAccess = opts?.public ? resolvePublicTicketAccess(opts.pin) : null;
        const endpoint = publicAccess?.query
            ? `${baseEndpoint}?${publicAccess.query}`
            : opts?.pin
            ? `${baseEndpoint}?pin=${encodeURIComponent(opts.pin)}`
            : baseEndpoint;
        const fetchOptions = opts?.public
            ? { method: 'POST', body, ...(publicAccess?.fetchOptions ?? { skipAuth: true, sendAnonId: true, sendEntityToken: true }) }
            : { method: 'POST', body };
        const response = await apiFetch(endpoint, fetchOptions);
        return response;
    } catch (error) {
        console.error(`Error sending message to ticket ${ticketId}:`, error);
        throw error;
    }
};
