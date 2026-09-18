import { apiFetch, ApiError, isLikelyHtmlErrorBody } from '@/utils/api';
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
  TicketHistoryPagination,
  UnifiedConversationStreamItem,
  TicketTimelineEvent,
} from '@/types/tickets';
import { AttachmentInfo } from '@/types/chat';
import getOrCreateAnonId from '@/utils/anonIdGenerator';
import { normalizeTicketLocation } from '@/utils/location';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';
import { normalizeTicketSla, resolveTicketSlaSource } from '@/utils/ticketSla';
import {
    TERRITORIAL_TICKET_SOURCE_MODELS,
    type TerritorialTicketSourceModel,
} from '@/utils/territorialTicketIdentity';

const ticketApiPath = (path: string): string => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized.startsWith('/api/') ? normalized : `/api${normalized}`;
};

const TICKET_INBOX_INITIAL_PAGE_SIZE = 12;

type TicketEndpointContext = Partial<Ticket> & Record<string, any>;

const readEndpointString = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const isTenantTicketV2 = (ticket?: TicketEndpointContext | null): boolean => {
    if (!ticket || typeof ticket !== 'object') return false;
    const sourceModel = String(ticket.source_model ?? ticket.sourceModel ?? '').toLowerCase();
    const ticketType = String(ticket.ticket_type ?? ticket.ticketType ?? ticket.kind ?? '').toLowerCase();
    const contractVersion = String(ticket.contract_version ?? ticket.contractVersion ?? '').toLowerCase();
    const detailEndpoint = String(ticket.detail_endpoint ?? ticket.detailEndpoint ?? '').toLowerCase();
    const messagesEndpoint = String(ticket.messages_endpoint ?? ticket.messagesEndpoint ?? '').toLowerCase();
    const timelineEndpoint = String(ticket.timeline_endpoint ?? ticket.timelineEndpoint ?? '').toLowerCase();

    return (
        sourceModel === 'tenantticket' ||
        ticketType.includes('tenant_ticket') ||
        ticketType.includes('tenantticket') ||
        contractVersion.startsWith('tickets.v2.') ||
        detailEndpoint.includes('/api/v2/tickets/') ||
        messagesEndpoint.includes('/api/v2/tickets/') ||
        timelineEndpoint.includes('/api/v2/tickets/')
    );
};

const resolveTenantTicketV2Endpoint = (
    ticketId: string | number,
    ticket?: TicketEndpointContext | null,
    suffix?: 'messages' | 'timeline' | 'ai-enrichment' | 'comments',
): string => {
    const endpointKey =
        suffix === 'messages'
            ? 'messages_endpoint'
            : suffix === 'timeline'
              ? 'timeline_endpoint'
              : suffix === 'ai-enrichment'
                ? 'ai_enrichment_endpoint'
                : suffix === 'comments'
                  ? 'comments_endpoint'
                : 'detail_endpoint';
    const camelEndpointKey =
        suffix === 'messages'
            ? 'messagesEndpoint'
            : suffix === 'timeline'
              ? 'timelineEndpoint'
              : suffix === 'ai-enrichment'
                ? 'aiEnrichmentEndpoint'
                : suffix === 'comments'
                  ? 'commentsEndpoint'
                : 'detailEndpoint';
    const explicit = readEndpointString(ticket?.[endpointKey]) || readEndpointString(ticket?.[camelEndpointKey]);
    if (explicit && explicit.startsWith('/') && explicit.includes('/api/v2/tickets/')) {
        return explicit;
    }
    const encodedTicketId = encodeURIComponent(String(ticketId));
    return suffix ? `/api/v2/tickets/${encodedTicketId}/${suffix}` : `/api/v2/tickets/${encodedTicketId}`;
};

const normalizeV2TicketDetailResponse = (
    response: any,
    fallbackTicket?: TicketEndpointContext | null,
): TicketEndpointContext => {
    const record = response && typeof response === 'object' && !Array.isArray(response) ? response : {};
    const candidate =
        record.ticket && typeof record.ticket === 'object'
            ? record.ticket
            : record.item && typeof record.item === 'object'
              ? record.item
              : record.data && typeof record.data === 'object'
                ? record.data
                : record;
    const id = candidate.id ?? record.id ?? fallbackTicket?.id;
    return {
        ...(fallbackTicket || {}),
        ...candidate,
        id,
        tipo: candidate.tipo ?? fallbackTicket?.tipo ?? (candidate.tenant_type === 'pyme' ? 'pyme' : 'municipio'),
        nro_ticket:
            candidate.nro_ticket ??
            candidate.ticket_number ??
            candidate.ticketNumber ??
            record.nro_ticket ??
            fallbackTicket?.nro_ticket ??
            (id !== undefined && id !== null ? `#${id}` : ''),
        asunto:
            candidate.asunto ??
            candidate.title ??
            candidate.categoria ??
            fallbackTicket?.asunto ??
            fallbackTicket?.title ??
            'Ticket',
        estado: candidate.estado ?? candidate.status ?? fallbackTicket?.estado ?? 'nuevo',
        fecha: candidate.fecha ?? candidate.created_at ?? candidate.createdAt ?? fallbackTicket?.fecha ?? new Date().toISOString(),
        source_model: record.source_model ?? candidate.source_model ?? fallbackTicket?.source_model ?? 'TenantTicket',
        ticket_type: record.ticket_type ?? candidate.ticket_type ?? fallbackTicket?.ticket_type ?? 'tenant_ticket',
        contract_version: record.contract_version ?? candidate.contract_version ?? fallbackTicket?.contract_version,
        detail_endpoint:
            record.detail_endpoint ??
            candidate.detail_endpoint ??
            fallbackTicket?.detail_endpoint ??
            (id !== undefined && id !== null ? resolveTenantTicketV2Endpoint(id) : undefined),
        messages_endpoint:
            record.messages_endpoint ??
            candidate.messages_endpoint ??
            fallbackTicket?.messages_endpoint ??
            (id !== undefined && id !== null ? resolveTenantTicketV2Endpoint(id, undefined, 'messages') : undefined),
        timeline_endpoint:
            record.timeline_endpoint ??
            candidate.timeline_endpoint ??
            fallbackTicket?.timeline_endpoint ??
            (id !== undefined && id !== null ? resolveTenantTicketV2Endpoint(id, undefined, 'timeline') : undefined),
        ai_enrichment_endpoint:
            record.ai_enrichment_endpoint ??
            candidate.ai_enrichment_endpoint ??
            fallbackTicket?.ai_enrichment_endpoint ??
            (id !== undefined && id !== null ? resolveTenantTicketV2Endpoint(id, undefined, 'ai-enrichment') : undefined),
        realtime_state: candidate.realtime_state ?? record.realtime_state ?? fallbackTicket?.realtime_state,
        collaboration_state: candidate.collaboration_state ?? record.collaboration_state ?? fallbackTicket?.collaboration_state,
        history: candidate.history ?? record.history ?? candidate.historial ?? record.historial ?? fallbackTicket?.history,
        messages:
            candidate.messages ??
            candidate.mensajes ??
            record.messages ??
            record.mensajes ??
            fallbackTicket?.messages,
    };
};

export interface TicketInboxPagination {
    page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
}

export interface TicketInboxFacetItem {
    value?: string | number | null;
    id?: string | number | null;
    label?: string | null;
    count?: number;
    category_id?: string | number | null;
}

export interface TicketInboxFacets {
    contract_version?: string;
    mode?: string;
    ticket_type?: string;
    total_scoped?: number;
    total_filtered?: number;
    statuses?: TicketInboxFacetItem[];
    categories?: TicketInboxFacetItem[];
    areas?: TicketInboxFacetItem[];
    channels?: TicketInboxFacetItem[];
    agents?: TicketInboxFacetItem[];
    priorities?: TicketInboxFacetItem[];
    sla?: TicketInboxFacetItem[];
    slaStatuses?: TicketInboxFacetItem[];
    unread?: TicketInboxFacetItem[];
}

export interface TicketInboxResponse {
    tickets: Ticket[];
    pagination: TicketInboxPagination;
    summary?: Record<string, unknown>;
    facets?: TicketInboxFacets | null;
}

export interface GetTicketsOptions {
    page?: number;
    perPage?: number;
    q?: string;
    status?: string;
    category?: string;
    categoryId?: string | number;
    channel?: string;
    agent?: string | number;
    unassigned?: boolean;
    priority?: string;
    sla?: string;
    unread?: string;
    quiet?: boolean;
}

const normalizeTicketPagination = (
    pagination: any,
    fallbackPage: number,
    fallbackPerPage: number,
    fallbackLoaded: number,
): TicketInboxPagination => {
    const totalItems = Number(pagination?.total_items ?? pagination?.total ?? fallbackLoaded);
    const totalPages = Number(pagination?.total_pages ?? pagination?.pages ?? 1);
    return {
        page: Number(pagination?.page ?? fallbackPage) || fallbackPage,
        per_page: Number(pagination?.per_page ?? fallbackPerPage) || fallbackPerPage,
        total_items: Number.isFinite(totalItems) ? totalItems : fallbackLoaded,
        total_pages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
        has_next: Boolean(pagination?.has_next),
        has_prev: Boolean(pagination?.has_prev),
    };
};

const normalizeTicketAssignment = <T extends Ticket>(ticket: T): Partial<Ticket> => {
    const rawTicket = ticket as T & {
        asignado_a?: unknown;
        asignado_a_id?: unknown;
        assignee?: unknown;
    };
    const asAssigneeRecord = (value: unknown): Record<string, unknown> | null =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null;
    const canonicalAssignee = asAssigneeRecord(rawTicket.assignedAgent);
    const nestedAssignee =
        canonicalAssignee ??
        asAssigneeRecord(rawTicket.asignado_a) ??
        asAssigneeRecord(rawTicket.assignee);
    const assignedId =
        rawTicket.assignedAgentId ??
        rawTicket.assigned_agent_id ??
        rawTicket.assigned_user_id ??
        rawTicket.asigned_user_id ??
        rawTicket.asignado_a_id ??
        nestedAssignee?.id ??
        nestedAssignee?.user_id ??
        null;

    if (
        (typeof assignedId !== 'string' && typeof assignedId !== 'number') ||
        String(assignedId).trim() === ''
    ) {
        return {};
    }

    const assignedName = String(
        nestedAssignee?.nombre_usuario ??
        nestedAssignee?.nombre ??
        nestedAssignee?.name ??
        nestedAssignee?.email ??
        `Agente ${assignedId}`,
    ).trim();
    const assignedEmail = String(
        nestedAssignee?.email ??
        nestedAssignee?.email_usuario ??
        '',
    ).trim();

    return {
        assignedAgent: {
            ...canonicalAssignee,
            id: assignedId,
            nombre_usuario: assignedName || `Agente ${assignedId}`,
            email: assignedEmail,
        },
        assignedAgentId: assignedId,
        assigned_agent_id: assignedId,
        assigned_user_id: assignedId,
    };
};

const normalizeTicketPayload = <T extends Ticket>(ticket: T): T => {
    const location = normalizeTicketLocation(ticket);
    const assignment = normalizeTicketAssignment(ticket);
    const slaSource = resolveTicketSlaSource(ticket);
    return {
        ...ticket,
        ...location,
        ...assignment,
        ...(slaSource ? { sla: normalizeTicketSla(slaSource) } : {}),
    };
};

const applyConsentedAvatar = <T extends Partial<Ticket> & Record<string, any>>(ticket: T): T => {
    const userRecord =
        ticket.user && typeof ticket.user === 'object'
            ? (ticket.user as unknown as Record<string, unknown>)
            : undefined;
    const contactRecord =
        ticket.contact && typeof ticket.contact === 'object'
            ? (ticket.contact as unknown as Record<string, unknown>)
            : undefined;
    const whatsappProfileRecord =
        ticket.nombre_y_avatar_whatsapp && typeof ticket.nombre_y_avatar_whatsapp === 'object'
            ? (ticket.nombre_y_avatar_whatsapp as unknown as Record<string, unknown>)
            : undefined;
    const personalRecord =
        ticket.informacion_personal_vecino && typeof ticket.informacion_personal_vecino === 'object'
            ? (ticket.informacion_personal_vecino as unknown as Record<string, unknown>)
            : undefined;
    const resolved = resolveConsentedAvatar(ticket, contactRecord, whatsappProfileRecord, personalRecord, userRecord);

    return {
        ...ticket,
        avatarUrl: resolved.avatarUrl,
        avatar_source: resolved.source || ticket.avatar_source,
        avatar_consent: resolved.consented || undefined,
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
        const actorType = String(
            m.actor_type ??
            m.author_type ??
            m.authorType ??
            m.actorType ??
            '',
        ).toLowerCase();
        const isAgentMessage =
            actorType
                ? ['agent', 'admin', 'municipio', 'pyme', 'operator', 'staff', 'system'].includes(actorType)
                : parseAdminFlag(m.es_admin ?? m.esAdmin ?? m.is_admin ?? m.isAdmin);

        return {
            id: m.id ?? m.comentario_id ?? m.comment_id ?? idx,
            author: isAgentMessage ? 'agent' : 'user',
            agentName: m.nombre_agente || m.agentName || m.autor_nombre || m.author_name,
            content: m.content || m.body || m.texto || m.mensaje || m.comentario || '',
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
        viewer_key: raw.viewer_key ?? raw.viewerKey ?? null,
        viewer_user_id: raw.viewer_user_id ?? raw.viewerUserId ?? raw.user_id ?? raw.userId ?? null,
        viewer_anon_id: raw.viewer_anon_id ?? raw.viewerAnonId ?? raw.anon_id ?? raw.anonId ?? null,
        viewer_role: raw.viewer_role ?? raw.viewerRole ?? raw.role ?? null,
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
                payload: evt as unknown as Record<string, unknown>,
                raw: evt as unknown as Record<string, unknown>,
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
    const resolvedAvatar = resolveConsentedAvatar(raw as Record<string, unknown>);

    return {
        id: id ?? nombre ?? email ?? 'agente',
        nombre_usuario: nombre || 'Agente',
        email: email || 'desconocido@chatboc.local',
        avatarUrl: resolvedAvatar.avatarUrl,
        avatar_source: resolvedAvatar.source || raw.avatar_source || raw.avatarSource || raw.profile_picture_source,
        avatar_consent: resolvedAvatar.consented || undefined,
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
            omitCredentials: true,
            isWidgetRequest: true,
            sendAnonId: true,
            sendEntityToken: true,
            pin: normalizedPin || undefined,
        } as const,
    };
};

export const getTickets = async (
  tenantSlug?: string | null,
  options: GetTicketsOptions = {},
): Promise<TicketInboxResponse> => {
  try {
      const page = Math.max(1, Number(options.page || 1) || 1);
      const perPage = Math.max(1, Number(options.perPage || TICKET_INBOX_INITIAL_PAGE_SIZE) || TICKET_INBOX_INITIAL_PAGE_SIZE);
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        include: 'compact',
      });
      const appendFilterParam = (key: string, value?: string | number | null) => {
        if (value === undefined || value === null) return;
        const normalized = String(value).trim();
        if (!normalized || normalized === 'all' || normalized === 'todos') return;
        params.set(key, normalized);
      };
      appendFilterParam('q', options.q);
      appendFilterParam('estado', options.status);
      appendFilterParam('categoria', options.category);
      appendFilterParam('categoria_id', options.categoryId);
      appendFilterParam('channel', options.channel);
      appendFilterParam('assigned_agent', options.agent);
      appendFilterParam('priority', options.priority);
      appendFilterParam('sla', options.sla);
      appendFilterParam('unread', options.unread);
      if (options.unassigned) {
        params.set('unassigned', 'true');
      }
      const response = await apiFetch<{
        tickets: Ticket[];
        pagination?: TicketInboxPagination;
        summary?: Record<string, unknown>;
        facets?: TicketInboxFacets | null;
      }>(ticketApiPath(`/tickets?${params.toString()}`), {
      tenantSlug,
      omitTenant: false,
      suppressPanel401Redirect: true,
      omitCredentials: true,
      omitChatSessionId: true,
      // Algunos despliegues requieren el tenant para filtrar los tickets
      // correctamente y evitar errores 500 en el backend.
    });
    const tickets = response.tickets || [];

    const ticketsWithAvatars = tickets.map(rawTicket => {
      const ticket = applyConsentedAvatar(normalizeTicketPayload(rawTicket));
      const collaborationState = normalizeCollaborationState((ticket as any).collaboration_state);
      return {
        ...ticket,
        collaboration_state: collaborationState,
        hasUnreadMessages:
          Boolean(ticket.hasUnreadMessages) ||
          Boolean(collaborationState?.has_unread) ||
          Number(collaborationState?.unread_viewer_count || 0) > 0,
      };
    });

    return {
        tickets: ticketsWithAvatars,
        pagination: normalizeTicketPagination(response.pagination, page, perPage, ticketsWithAvatars.length),
        summary: response.summary,
        facets: response.facets || null,
    };

  } catch (error) {
    if (!options.quiet) {
      console.error('Error fetching tickets:', error);
    }
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

export interface TicketDetailOptions {
    ticket?: TicketEndpointContext | null;
    tenantSlug?: string | null;
    quiet?: boolean;
}

export interface TicketInboxTargetOptions {
    tenantSlug?: string | null;
    perPage?: number;
    sourceModel?: TicketInboxSourceModel;
}

export const TICKET_INBOX_SOURCE_MODELS = TERRITORIAL_TICKET_SOURCE_MODELS;

export type TicketInboxSourceModel = TerritorialTicketSourceModel;

export const isTicketInboxSourceModel = (value: unknown): value is TicketInboxSourceModel =>
    typeof value === 'string' &&
    TICKET_INBOX_SOURCE_MODELS.includes(value as TicketInboxSourceModel);

export const getTicketById = async (id: string, opts?: TicketDetailOptions): Promise<Ticket> => {
    try {
        if (isTenantTicketV2(opts?.ticket)) {
            const endpoint = resolveTenantTicketV2Endpoint(id, opts?.ticket);
            const response = await apiFetch<any>(endpoint, {
                tenantSlug: opts?.tenantSlug || opts?.ticket?.tenant_slug || undefined,
            });
            const normalizedRaw = normalizeV2TicketDetailResponse(response, opts?.ticket);
            const normalizedResponse = applyConsentedAvatar(
                normalizeTicketPayload(normalizedRaw as Ticket),
            );
            let messages = normalizeTicketMessages(getInlineTicketMessageSource(normalizedRaw));
            if (!messages.length) {
                try {
                    messages = (await getTicketMessages(
                        Number(normalizedResponse.id),
                        normalizedResponse.tipo,
                        {
                            quiet: true,
                            ticket: normalizedResponse,
                            tenantSlug: opts?.tenantSlug || normalizedResponse.tenant_slug,
                        },
                    )).messages;
                } catch (_err) {
                    messages = [];
                }
            }
            return {
                ...normalizedResponse,
                history: (normalizedRaw.history || []) as TicketHistoryEvent[],
                messages,
                realtime_state: normalizeRealtimeState((normalizedResponse as any).realtime_state),
                collaboration_state: normalizeCollaborationState((normalizedResponse as any).collaboration_state),
            };
        }

        const legacyType = opts?.ticket?.tipo === 'pyme' ? 'pyme' : 'municipio';
        const response = await apiFetch<
            Ticket & { historial?: TicketHistoryEvent[]; mensajes?: Message[] }
        >(ticketApiPath(`/tickets/${legacyType}/${encodeURIComponent(String(id))}`), {
            tenantSlug: opts?.tenantSlug || opts?.ticket?.tenant_slug || undefined,
        });
        const normalizedResponse = applyConsentedAvatar(normalizeTicketPayload(response));
        const history = (response as any).history || response.historial || [];
        let messages = normalizeTicketMessages(getInlineTicketMessageSource(response));
        if (!messages.length) {
            try {
                messages = (await getTicketMessages(response.id, response.tipo, {
                    quiet: true,
                    ticket: normalizedResponse,
                    tenantSlug: opts?.tenantSlug || normalizedResponse.tenant_slug,
                })).messages;
            } catch (_err) {
                messages = [];
            }
        }
        return {
            ...normalizedResponse,
            history,
            messages,
            collaboration_state: normalizeCollaborationState((normalizedResponse as any).collaboration_state),
        };
    } catch (error) {
        if (!opts?.quiet) {
            console.error(`Error fetching ticket ${id}:`, error);
        }
        throw error;
    }
};

export const getInboxTicketById = async (
    id: string | number,
    options: TicketInboxTargetOptions = {},
): Promise<Ticket> => {
    const normalizedId = String(id).trim();
    const numericId = Number(normalizedId);
    if (!normalizedId || String(id) !== normalizedId) {
        throw new ApiError('El identificador del ticket no es valido', 400);
    }

    if (options.sourceModel !== undefined && !isTicketInboxSourceModel(options.sourceModel)) {
        throw new ApiError('El origen del ticket no es valido', 400, {
            code: 'invalid_ticket_source_model',
        });
    }

    if (options.sourceModel) {
        const sourceModel = options.sourceModel;
        const exactTicketContext: TicketEndpointContext = sourceModel === 'TenantTicket'
            ? {
                tipo: 'municipio',
                source_model: sourceModel,
                ticket_type: 'tenant_ticket',
                contract_version: 'tickets.v2.detail',
                detail_endpoint: `/api/v2/tickets/${encodeURIComponent(normalizedId)}`,
            }
            : {
                tipo: sourceModel === 'PymeTicket' ? 'pyme' : 'municipio',
                source_model: sourceModel,
            };
        const ticket = await getTicketById(normalizedId, {
            tenantSlug: options.tenantSlug,
            quiet: true,
            ticket: exactTicketContext,
        });
        return {
            ...ticket,
            source_model: sourceModel,
        };
    }

    if (!Number.isSafeInteger(numericId)) {
        throw new ApiError('El identificador del ticket no es valido', 400);
    }

    const normalizeCandidateId = (value: unknown): number | null => {
        if (value === undefined || value === null) return null;
        const candidate = String(value).trim().replace(/^#/, '').replace(/^M-/i, '').replace(/^P-/i, '');
        if (!candidate) return null;
        const parsed = Number(candidate);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const matchesTarget = (ticket: Ticket) =>
        [ticket.id, (ticket as any).ticket_id]
            .map(normalizeCandidateId)
            .some((candidateId) => candidateId === numericId);

    const findAcrossInboxPages = async (q?: string): Promise<Ticket | null> => {
        const perPage = Math.max(1, Number(options.perPage || 50) || 50);
        const visitedPages = new Set<number>();
        let page = 1;

        while (!visitedPages.has(page)) {
            visitedPages.add(page);
            const response = await getTickets(options.tenantSlug, {
                page,
                perPage,
                quiet: true,
                ...(q ? { q } : {}),
            });
            const match = response.tickets.find(matchesTarget);
            if (match) return match;

            const pagination = response.pagination;
            if (!pagination?.has_next) return null;
            const nextPage = Math.max(page + 1, Number(pagination.page || page) + 1);
            page = nextPage;
        }

        return null;
    };

    const matchedTicket =
        await findAcrossInboxPages(normalizedId) ||
        await findAcrossInboxPages();

    if (!matchedTicket) {
        throw new ApiError('El ticket solicitado no existe o no esta disponible', 404, {
            code: 'ticket_not_found',
        });
    }

    return getTicketById(String(matchedTicket.id), {
        tenantSlug: options.tenantSlug,
        quiet: true,
        ticket: matchedTicket,
    });
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
                        quiet: true,
                    })).messages;
                } catch (_err) {
                    messages = [];
                }
            }
            const normalizedResponse = applyConsentedAvatar(normalizeTicketPayload(response));
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
            };
        } catch (err) {
            const apiErr = err as ApiError;
            if (apiErr?.status === 400 && !pin) {
                throw new ApiError('El PIN es obligatorio', 400, apiErr.body);
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
    channels?: Iterable<unknown>;
    notifyChannels?: Iterable<unknown>;
    sendEmail?: boolean;
    sendSms?: boolean;
    notify?: { email?: boolean; sms?: boolean };
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

export type TicketReplyDeliveryStatus = {
    contract_version: string;
    event_id?: string | number;
    legacy_contract_version?: string;
    mode: 'real_message' | 'timeline_only' | 'internal_event' | string;
    channel: string;
    status: string;
    reason: string;
    external_dispatch: boolean;
    socket_emitted: boolean;
    recipient_room_emitted: boolean;
    recipient_presence_confirmed: boolean;
    recipient_read_confirmed: boolean;
    reply_comment_ids: number[];
    latest_reply_comment_id?: number;
    timeline_updated: boolean;
    reply_status: string;
    admin_surface?: string;
    operator_message?: string;
    delivery_mode?: string;
    evidence_stage?: string;
    recipient_available?: boolean;
    final_delivery?: {
        contract_version?: string;
        status?: string;
        authoritative_source?: string;
        provider_message_id?: string | null;
        provider_status?: string | null;
        error_code?: string | null;
        updated_at?: string | null;
    };
    idempotency?: Record<string, unknown>;
    outbox?: Record<string, unknown>;
    delivery_results: {
        email: boolean;
        sms: boolean;
        whatsapp: boolean;
        socket: boolean;
    };
};

const normalizeDeliveryBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    return ['1', 'true'].includes(String(value ?? '').trim().toLowerCase());
};

export const normalizeTicketReplyDelivery = (raw: unknown): TicketReplyDeliveryStatus | null => {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const payload = raw as Record<string, any>;
    const rawFinalDelivery = payload.final_delivery && typeof payload.final_delivery === 'object'
        ? payload.final_delivery as Record<string, any>
        : {};
    const rawResults = payload.delivery_results && typeof payload.delivery_results === 'object'
        ? payload.delivery_results as Record<string, any>
        : {};
    const rawSkipped = payload.delivery_skipped && typeof payload.delivery_skipped === 'object'
        ? payload.delivery_skipped as Record<string, any>
        : {};

    const socketEmitted = normalizeDeliveryBoolean(payload.socket_emitted) || normalizeDeliveryBoolean(rawResults.socket);
    const replyCommentIds = Array.isArray(payload.reply_comment_ids)
        ? payload.reply_comment_ids
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isInteger(value) && value > 0)
        : [];
    const latestReplyCommentId = Number(payload.latest_reply_comment_id || 0);

    return {
        contract_version: String(payload.contract_version || 'tickets.agent_reply_delivery.v1'),
        event_id: payload.reply_event_id ?? payload.event_id,
        legacy_contract_version: payload.legacy_contract_version
            ? String(payload.legacy_contract_version)
            : undefined,
        mode: String(payload.mode || 'timeline_only') as TicketReplyDeliveryStatus['mode'],
        channel: String(payload.channel || 'crm'),
        status: String(payload.status || 'saved_to_crm'),
        reason: String(payload.reason || 'unknown'),
        external_dispatch: normalizeDeliveryBoolean(payload.external_dispatch),
        socket_emitted: socketEmitted,
        recipient_room_emitted: normalizeDeliveryBoolean(payload.recipient_room_emitted),
        recipient_presence_confirmed: normalizeDeliveryBoolean(payload.recipient_presence_confirmed),
        recipient_read_confirmed: normalizeDeliveryBoolean(payload.recipient_read_confirmed),
        reply_comment_ids: replyCommentIds,
        latest_reply_comment_id: Number.isInteger(latestReplyCommentId) && latestReplyCommentId > 0
            ? latestReplyCommentId
            : replyCommentIds.at(-1),
        timeline_updated: normalizeDeliveryBoolean(payload.timeline_updated),
        reply_status: String(payload.reply_status || 'saved_to_timeline'),
        admin_surface: payload.admin_surface ? String(payload.admin_surface) : undefined,
        operator_message: payload.operator_message ? String(payload.operator_message) : undefined,
        delivery_mode: payload.delivery_mode ? String(payload.delivery_mode) : undefined,
        evidence_stage: payload.evidence_stage ? String(payload.evidence_stage) : undefined,
        recipient_available: typeof payload.recipient_available === 'boolean'
            ? payload.recipient_available
            : rawSkipped.whatsapp === 'contact_phone_missing'
              ? false
              : undefined,
        final_delivery: Object.keys(rawFinalDelivery).length
            ? {
                contract_version: rawFinalDelivery.contract_version ? String(rawFinalDelivery.contract_version) : undefined,
                status: rawFinalDelivery.status ? String(rawFinalDelivery.status) : undefined,
                authoritative_source: rawFinalDelivery.authoritative_source
                    ? String(rawFinalDelivery.authoritative_source)
                    : undefined,
                provider_message_id: rawFinalDelivery.provider_message_id == null
                    ? null
                    : String(rawFinalDelivery.provider_message_id),
                provider_status: rawFinalDelivery.provider_status == null
                    ? null
                    : String(rawFinalDelivery.provider_status),
                error_code: rawFinalDelivery.error_code == null ? null : String(rawFinalDelivery.error_code),
                updated_at: rawFinalDelivery.updated_at == null ? null : String(rawFinalDelivery.updated_at),
            }
            : undefined,
        idempotency: payload.idempotency && typeof payload.idempotency === 'object'
            ? payload.idempotency as Record<string, unknown>
            : undefined,
        outbox: payload.outbox && typeof payload.outbox === 'object'
            ? payload.outbox as Record<string, unknown>
            : undefined,
        delivery_results: {
            email: normalizeDeliveryBoolean(rawResults.email),
            sms: normalizeDeliveryBoolean(rawResults.sms),
            whatsapp: normalizeDeliveryBoolean(rawResults.whatsapp),
            socket: socketEmitted,
        },
    };
};

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

export interface UpdateTicketStatusOptions {
    ticket?: TicketEndpointContext | null;
    expectedStatus?: TicketStatus | string | null;
}

export const updateTicketStatus = async (
    ticketId: number,
    tipo: 'municipio' | 'pyme',
    estado: TicketStatus,
    options: UpdateTicketStatusOptions = {},
): Promise<Partial<Ticket>> => {
    try {
        if (isTenantTicketV2(options.ticket)) {
            const response = await apiFetch(resolveTenantTicketV2Endpoint(ticketId, options.ticket), {
                method: 'PATCH',
                body: {
                    status: estado,
                    ...(options.expectedStatus ? { expected_status: options.expectedStatus } : {}),
                },
            });
            return normalizeTicketPayload(
                normalizeV2TicketDetailResponse(response, options.ticket) as Ticket,
            );
        }

        const response = await apiFetch(ticketApiPath(`/tickets/${tipo}/${ticketId}/estado`), {
            method: 'PUT',
            body: {
                estado,
                ...(options.expectedStatus ? { expected_estado: options.expectedStatus } : {}),
            },
        });
        return normalizeTicketPayload(response as Ticket);
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

export interface TicketMessagesOptions {
  public?: boolean;
  pin?: string;
  quiet?: boolean;
  ticket?: TicketEndpointContext | null;
  tenantSlug?: string | null;
}

const extractErrorBodyText = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (typeof error.body === 'string') return error.body;
    if (error.body && typeof error.body === 'object') {
      const record = error.body as Record<string, unknown>;
      for (const key of ['html', 'text', 'message', 'error', 'detail']) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) return value;
      }
    }
  }
  return error instanceof Error ? error.message : String(error ?? '');
};

export const isLegacyHtmlGatewayError = (error: unknown): boolean => {
  if (!(error instanceof ApiError)) return false;
  if (![500, 502, 503, 504].includes(error.status)) return false;
  return isLikelyHtmlErrorBody(error.body) || isLikelyHtmlErrorBody(extractErrorBodyText(error));
};

const isGatewayUnavailableText = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('bad gateway') ||
    normalized.includes('gateway timeout') ||
    normalized.includes('service unavailable') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network error') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed') ||
    normalized.includes('connection refused') ||
    normalized.includes('temporarily unavailable')
  );
};

export const isTicketAiEnrichmentUnavailable = (error: unknown): boolean => {
  if (isLegacyHtmlGatewayError(error)) return true;

  if (error instanceof ApiError) {
    if ([500, 502, 503, 504].includes(error.status)) return true;
    return isGatewayUnavailableText(error.message) || isGatewayUnavailableText(extractErrorBodyText(error));
  }

  if (error instanceof TypeError) {
    return isGatewayUnavailableText(error.message);
  }

  if (error instanceof Error) {
    return isGatewayUnavailableText(error.message);
  }

  return isGatewayUnavailableText(String(error ?? ''));
};

export const summarizeTicketFetchError = (error: unknown): Record<string, unknown> => {
  if (error instanceof ApiError) {
    return {
      name: error.name,
      status: error.status,
      requestId: error.requestId,
      reason: isTicketAiEnrichmentUnavailable(error) ? 'advisory_ai_enrichment_unavailable' : 'api_error',
      message: error.message,
    };
  }
  return {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error ?? 'unknown_error'),
  };
};

export const getTicketMessages = async (
  ticketId: number,
  tipo: 'municipio' | 'pyme',
  opts?: TicketMessagesOptions
): Promise<TicketMessagesResult> => {
  try {
    if (isTenantTicketV2(opts?.ticket) && !opts?.public) {
      const endpoint = resolveTenantTicketV2Endpoint(ticketId, opts?.ticket, 'messages');
      const response = await apiFetch<{ mensajes?: any[]; messages?: any[]; realtime_state?: any }>(endpoint, {
        tenantSlug: opts?.tenantSlug || opts?.ticket?.tenant_slug || undefined,
      });
      const rawMsgs = response.mensajes || response.messages || [];
      const realtimeState = normalizeRealtimeState((response as any).realtime_state);
      const messages = normalizeTicketMessages(rawMsgs);
      const legacyCompatible = messages as TicketMessagesResult;
      legacyCompatible.messages = messages;
      legacyCompatible.realtimeState = realtimeState;
      return legacyCompatible;
    }

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
    if (!opts?.quiet && !isLegacyHtmlGatewayError(error)) {
      console.error(`Error fetching messages for ticket ${ticketId}:`, error);
    }
    throw error;
  }
};

export interface TicketTimelineResult {
  estado_chat: string;
  history: TicketHistoryEvent[];
  messages: Message[];
  unified_conversation_stream: UnifiedConversationStreamItem[];
  realtime_state?: TicketRealtimeState | null;
  pagination: TicketHistoryPagination;
  has_more: boolean;
  next_cursor: string | null;
}

export const getTicketTimeline = async (
  ticketId: number,
  tipo: 'municipio' | 'pyme',
  opts?: {
    public?: boolean;
    pin?: string;
    quiet?: boolean;
    ticket?: TicketEndpointContext | null;
    tenantSlug?: string | null;
    cursor?: string | null;
    limit?: number;
  }
): Promise<TicketTimelineResult> => {
  try {
    const useTenantV2 = isTenantTicketV2(opts?.ticket) && !opts?.public;
    const endpointBase = useTenantV2
      ? resolveTenantTicketV2Endpoint(ticketId, opts?.ticket, 'timeline')
      : ticketApiPath(`/tickets/${tipo}/${ticketId}/timeline`);
    const publicAccess = !useTenantV2 && opts?.public ? resolvePublicTicketAccess(opts.pin) : null;
    const endpointWithAccess = publicAccess?.query
      ? `${endpointBase}?${publicAccess.query}`
      : !useTenantV2 && opts?.pin
      ? `${endpointBase}?pin=${encodeURIComponent(opts.pin)}`
      : endpointBase;
    const requestedLimit = Number.isFinite(Number(opts?.limit))
      ? Math.min(100, Math.max(1, Math.trunc(Number(opts?.limit))))
      : 50;
    const historyQuery = new URLSearchParams();
    historyQuery.set('limit', String(requestedLimit));
    const requestedCursor = typeof opts?.cursor === 'string' ? opts.cursor.trim() : '';
    if (requestedCursor) historyQuery.set('cursor', requestedCursor);
    const endpoint = `${endpointWithAccess}${endpointWithAccess.includes('?') ? '&' : '?'}${historyQuery.toString()}`;
    const fetchOpts = useTenantV2
      ? { tenantSlug: opts?.tenantSlug || opts?.ticket?.tenant_slug || undefined }
      : publicAccess?.fetchOptions ?? { sendAnonId: true, sendEntityToken: true };
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
    const responsePagination = response.pagination && typeof response.pagination === 'object'
      ? response.pagination
      : null;
    const nextCursor = typeof responsePagination?.next_cursor === 'string'
      ? responsePagination.next_cursor
      : typeof response.next_cursor === 'string'
        ? response.next_cursor
        : null;
    const hasMore = Boolean(responsePagination?.has_more ?? response.has_more) && Boolean(nextCursor);
    const pagination: TicketHistoryPagination = {
      contract_version: responsePagination?.contract_version || 'conversation.history.cursor.v1',
      direction: responsePagination?.direction || 'older',
      order: responsePagination?.order || 'chronological_asc',
      limit: Number(responsePagination?.limit) || requestedLimit,
      returned_count: Number(responsePagination?.returned_count) || undefined,
      has_more: hasMore,
      next_cursor: nextCursor,
    };
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
      pagination,
      has_more: hasMore,
      next_cursor: nextCursor,
    };
  } catch (error) {
    if (!opts?.quiet && !isLegacyHtmlGatewayError(error)) {
      console.error(`Error fetching timeline for ticket ${ticketId}:`, error);
    }
    throw error;
  }
};

export const getTenantTicketAiEnrichment = async <T = unknown>(
  ticketId: string | number,
  payload: Record<string, unknown> = {},
  tenantSlug?: string | null,
  ticket?: TicketEndpointContext | null,
): Promise<T> => {
  const endpoint = resolveTenantTicketV2Endpoint(ticketId, ticket, 'ai-enrichment');
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: payload,
    tenantSlug: tenantSlug || ticket?.tenant_slug || undefined,
    suppressInvalidJsonWarning: true,
  });
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
    opts?: {
        public?: boolean;
        pin?: string;
        ticket?: TicketEndpointContext | null;
        tenantSlug?: string | null;
        visibility?: 'internal' | 'public';
    }
): Promise<any> => {
    try {
        const hasFiles = Boolean(files && files.length > 0);
        const hasButtons = Boolean(buttons && buttons.length > 0);
        const isAuthenticatedTenantV2 = isTenantTicketV2(opts?.ticket) && !opts?.public;
        const shouldUseTenantV2Comment =
            isAuthenticatedTenantV2 && opts?.visibility === 'internal' && !hasFiles && !hasButtons;

        if (shouldUseTenantV2Comment) {
            const endpoint = resolveTenantTicketV2Endpoint(ticketId, opts?.ticket, 'comments');
            const response = await apiFetch<any>(endpoint, {
                method: 'POST',
                body: {
                    body: comentario,
                    visibility: 'internal',
                },
                tenantSlug: opts?.tenantSlug || opts?.ticket?.tenant_slug || undefined,
            });
            const responseComment =
                response?.comment && typeof response.comment === 'object'
                    ? {
                        ...response.comment,
                        author_type: response.comment.author_type ?? 'agent',
                        actor_type: response.comment.actor_type ?? 'agent',
                        es_admin: response.comment.es_admin ?? true,
                      }
                    : response?.comment;
            return responseComment
                ? {
                    ...response,
                    comment: responseComment,
                  }
                : response;
        }

        if (isAuthenticatedTenantV2) {
            throw new ApiError(
                opts?.visibility === 'internal'
                    ? 'Los comentarios internos con adjuntos o botones no están publicados por este contrato.'
                    : 'Las respuestas externas de TenantTicket deben usar la acción omnicanal reply autorizada.',
                409,
                {
                    code: opts?.visibility === 'internal'
                        ? 'tenant_ticket_internal_comment_payload_unsupported'
                        : 'tenant_ticket_external_reply_requires_v2_action',
                },
            );
        }

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
            body = {
                comentario,
                interactive: interactiveMessage.interactive,
                buttons,
            };
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
                : ticketApiPath(`/tickets/chat/pyme/${ticketId}/responder_cliente`))
            : ticketApiPath(`/tickets/${tipo}/${ticketId}/responder`);
        const publicAccess = opts?.public ? resolvePublicTicketAccess(opts.pin) : null;
        const endpoint = publicAccess?.query
            ? `${baseEndpoint}?${publicAccess.query}`
            : opts?.pin
            ? `${baseEndpoint}?pin=${encodeURIComponent(opts.pin)}`
            : baseEndpoint;
        const fetchOptions = opts?.public
            ? { method: 'POST' as const, body, ...(publicAccess?.fetchOptions ?? { skipAuth: true, sendAnonId: true, sendEntityToken: true }) }
            : { method: 'POST' as const, body };
        const response = await apiFetch(endpoint, fetchOptions);
        return response;
    } catch (error) {
        console.error(`Error sending message to ticket ${ticketId}:`, error);
        throw error;
    }
};
