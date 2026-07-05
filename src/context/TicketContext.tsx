import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { Ticket, User } from '@/types/tickets';
import { getTickets, type TicketInboxPagination } from '@/services/ticketService';
import useTicketUpdates from '@/hooks/useTicketUpdates';
import { mapToKnownCategory } from '@/utils/category';
import { useUser } from '@/hooks/useUser';
import { ApiError, resolveTenantSlug } from '@/utils/api';
import { apiClient } from '@/api/client';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';
import { getNextOperationalTicket } from '@/utils/ticketOperationalQueue';


interface TicketInboxFilters {
  search: string;
  channel: string;
  status: string;
  area: string;
  agent: string;
  priority: string;
  sla: string;
  unread: string;
}

interface TicketFilterOptions {
  channels: string[];
  statuses: Array<{ value: string; label: string }>;
  areas: string[];
  agents: Array<{ id: string; label: string }>;
  priorities: string[];
  slaStatuses: string[];
  unreadModes: Array<{ value: string; label: string }>;
}

interface TicketRealtimeActivity {
  pending: number;
  lastLabel: string | null;
  lastAt: string | null;
}

const DEFAULT_TICKET_FILTERS: TicketInboxFilters = {
  search: '',
  channel: 'all',
  status: 'all',
  area: 'all',
  agent: 'all',
  priority: 'all',
  sla: 'all',
  unread: 'all',
};

const resolveServerTicketFilters = (filters: TicketInboxFilters) => {
  const serverFilters: {
    q?: string;
    status?: string;
    category?: string;
    channel?: string;
    agent?: string;
    unassigned?: boolean;
    priority?: string;
    sla?: string;
    unread?: string;
  } = {};
  const search = filters.search.trim();
  if (search) {
    serverFilters.q = search;
  }
  if (filters.status !== 'all') {
    serverFilters.status = filters.status;
  }
  if (filters.area !== 'all') {
    serverFilters.category = filters.area;
  }
  if (filters.channel !== 'all') {
    serverFilters.channel = filters.channel;
  }
  if (filters.agent !== 'all') {
    if (filters.agent === 'unassigned') {
      serverFilters.unassigned = true;
    } else {
      serverFilters.agent = filters.agent;
    }
  }
  if (filters.priority !== 'all') {
    serverFilters.priority = filters.priority;
  }
  if (filters.sla !== 'all') {
    serverFilters.sla = filters.sla;
  }
  if (filters.unread !== 'all') {
    serverFilters.unread = filters.unread;
  }
  return serverFilters;
};

const TICKET_FETCH_TIMEOUT_MS = 45000;
const TICKET_INBOX_CACHE_VERSION = 1;
const TICKET_INBOX_CACHE_TTL_MS = 10 * 60 * 1000;

interface TicketInboxCachePayload {
  version: number;
  cached_at: number;
  tenant_slug: string;
  viewer_key: string;
  tickets: Ticket[];
  pagination: TicketInboxPagination | null;
  selected_ticket_id: number | string | null;
}

const sanitizeCacheSegment = (value: string) =>
  encodeURIComponent(value.trim().toLowerCase()).replace(/%/g, '_');

const resolveTicketInboxViewerKey = (profile: {
  id?: unknown;
  rol?: unknown;
  categoria_id?: unknown;
  categoria_ids?: unknown[];
  categorias?: Array<{ id?: unknown; nombre?: unknown }>;
}) => {
  const role = String(profile.rol || 'unknown').trim().toLowerCase();
  const userId = profile.id !== undefined && profile.id !== null ? String(profile.id) : 'anonymous';
  const categoryIds = [
    profile.categoria_id,
    ...(Array.isArray(profile.categoria_ids) ? profile.categoria_ids : []),
    ...(Array.isArray(profile.categorias) ? profile.categorias.map((category) => category?.id) : []),
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim())
    .map((value) => String(value).trim().toLowerCase())
    .sort();
  return `${role}:${userId}:cats:${categoryIds.join(',') || 'all'}`;
};

const buildTicketInboxCacheKey = (tenantSlug: string, viewerKey: string) =>
  `chatboc:ticket-inbox:v${TICKET_INBOX_CACHE_VERSION}:${sanitizeCacheSegment(tenantSlug)}:${sanitizeCacheSegment(viewerKey)}`;

const readCachedTicketInbox = (cacheKey: string): TicketInboxCachePayload | null => {
  try {
    const raw = safeSessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TicketInboxCachePayload>;
    if (parsed.version !== TICKET_INBOX_CACHE_VERSION) return null;
    if (!Array.isArray(parsed.tickets)) return null;
    if (!parsed.cached_at || Date.now() - Number(parsed.cached_at) > TICKET_INBOX_CACHE_TTL_MS) {
      safeSessionStorage.removeItem(cacheKey);
      return null;
    }
    return {
      version: TICKET_INBOX_CACHE_VERSION,
      cached_at: Number(parsed.cached_at),
      tenant_slug: String(parsed.tenant_slug || ''),
      viewer_key: String(parsed.viewer_key || ''),
      tickets: parsed.tickets as Ticket[],
      pagination: (parsed.pagination as TicketInboxPagination | null) || null,
      selected_ticket_id: parsed.selected_ticket_id ?? null,
    };
  } catch {
    safeSessionStorage.removeItem(cacheKey);
    return null;
  }
};

const writeCachedTicketInbox = (
  cacheKey: string,
  payload: Omit<TicketInboxCachePayload, 'version' | 'cached_at'>,
) => {
  try {
    safeSessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        ...payload,
        version: TICKET_INBOX_CACHE_VERSION,
        cached_at: Date.now(),
      }),
    );
  } catch {
    // Best-effort UX cache. Never block the live CRM if browser storage is unavailable.
  }
};

const mergeTicketPages = (currentTickets: Ticket[], nextTickets: Ticket[]): Ticket[] => {
  const byId = new Map<number, Ticket>();
  currentTickets.forEach((ticket) => byId.set(ticket.id, ticket));
  nextTickets.forEach((ticket) => {
    byId.set(ticket.id, {
      ...(byId.get(ticket.id) || {}),
      ...ticket,
    });
  });
  return Array.from(byId.values());
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const resolveUserTenantSlug = (user: any): string | null => {
  const candidates = [
    user?.tenantSlug,
    user?.tenant_slug,
    user?.tenant?.slug,
    user?.tenant?.tenant_slug,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

const readStoredTenantSlug = (): string | null => {
  try {
    const stored = safeLocalStorage.getItem('tenantSlug');
    return stored?.trim() || null;
  } catch {
    return null;
  }
};

export interface TicketInboxErrorDetails {
  status?: number;
  reasonCode?: string;
  actionHint?: string;
  requestId?: string;
  requiredCapabilities?: string[];
  currentScope?: Record<string, unknown>;
  accessContract?: Record<string, unknown>;
}

const asErrorRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readErrorString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const resolveTicketFetchErrorDetails = (err: unknown): TicketInboxErrorDetails | null => {
  if (!(err instanceof ApiError)) return null;
  const body = asErrorRecord(err.body);
  if (!body) {
    return {
      status: err.status,
      requestId: err.requestId,
    };
  }

  const requiredCapabilities = Array.isArray(body.required_capabilities)
    ? body.required_capabilities.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined;

  return {
    status: err.status,
    reasonCode: readErrorString(body.reason_code, body.code) ?? undefined,
    actionHint: readErrorString(body.action_hint, body.action) ?? undefined,
    requestId: readErrorString(body.request_id, err.requestId) ?? undefined,
    requiredCapabilities,
    currentScope: asErrorRecord(body.current_scope) ?? undefined,
    accessContract: asErrorRecord(body.access_contract) ?? undefined,
  };
};

const resolveTicketFetchErrorMessage = (err: unknown, cacheWasApplied = false): string => {
  let message = 'Error al obtener los tickets.';
  if (err instanceof ApiError) {
    const body = asErrorRecord(err.body);
    const bodyError = asErrorRecord(body?.error);
    const bodyMessage = readErrorString(
      body?.message,
      body?.mensaje,
      typeof body?.error === 'string' ? body.error : undefined,
      bodyError?.message,
      bodyError?.mensaje,
    );
    if (err.status === 401) {
      message = 'La sesion del panel no esta activa. Inicia sesion para ver y responder reclamos.';
    } else if (err.status === 403) {
      const isMachineForbiddenCode = bodyMessage
        ? ['forbidden', 'access_denied', 'permission_denied'].includes(bodyMessage.trim().toLowerCase())
        : false;
      message =
        (!isMachineForbiddenCode ? bodyMessage : null) ||
        'Tu usuario no tiene permisos para abrir la bandeja de reclamos de este tenant.';
    } else if (err.status >= 500) {
      message = 'Ocurrio un error en el servidor.';
    } else if (bodyMessage) {
      message = bodyMessage;
    }
  } else if (err instanceof Error && err.message.includes('tardo demasiado')) {
    message = 'La bandeja de reclamos tardo demasiado en responder. Revisa la conexion y reintenta.';
  }

  return cacheWasApplied
    ? `${message} Mostrando datos guardados; pueden estar desactualizados.`
    : message;
};

interface TicketContextType {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  selectTicket: (ticketId: number | null) => void;
  updateTicket: (ticketId: number, updates: Partial<Ticket>) => void;
  loading: boolean;
  error: string | null;
  errorDetails: TicketInboxErrorDetails | null;
  ticketsByCategory: { [key: string]: Ticket[] };
  filters: TicketInboxFilters;
  setFilters: React.Dispatch<React.SetStateAction<TicketInboxFilters>>;
  filterOptions: TicketFilterOptions;
  filteredTickets: Ticket[];
  refreshTickets: () => Promise<void>;
  pagination: TicketInboxPagination | null;
  hasMoreTickets: boolean;
  loadingMoreTickets: boolean;
  loadMoreTickets: () => Promise<void>;
  realtimeActivity: TicketRealtimeActivity;
  clearRealtimeActivity: () => void;
}

const TicketContext = createContext<TicketContextType | undefined>(undefined);


const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeUnreadDelta = (payload: any) => {
  if (!payload || typeof payload !== 'object') return null;
  const collaborationState =
    payload.collaboration_state && typeof payload.collaboration_state === 'object'
      ? payload.collaboration_state
      : {};

  const ticketId =
    payload.ticket_id ??
    payload.ticketId ??
    payload.id ??
    payload.ticket?.id ??
    null;

  if (ticketId === null || ticketId === undefined) return null;

  const unreadCount = toFiniteNumber(
    payload.unread_count ?? payload.unreadCount ?? collaborationState.unread_count,
  );
  const unreadViewerCount = toFiniteNumber(
    payload.unread_viewer_count ??
      payload.unreadViewerCount ??
      collaborationState.unread_viewer_count,
  );
  const activeViewerCount = toFiniteNumber(
    payload.active_viewers_count ??
      payload.activeViewersCount ??
      collaborationState.active_viewers_count,
  );
  const idleViewerCount = toFiniteNumber(
    payload.idle_viewer_count ??
      payload.idleViewerCount ??
      collaborationState.idle_viewer_count,
  );

  return {
    ticketId: Number(ticketId),
    collaboration_state: {
      latest_comment_id:
        payload.latest_comment_id ??
        payload.latestCommentId ??
        collaborationState.latest_comment_id ??
        null,
      latest_read_at:
        payload.latest_read_at ??
        payload.latestReadAt ??
        collaborationState.latest_read_at ??
        null,
      unread_count: unreadCount,
      has_unread:
        Boolean(payload.has_unread ?? payload.hasUnread) || unreadCount > 0,
      unread_viewer_count: unreadViewerCount,
      active_viewers_count: activeViewerCount,
      idle_viewer_count: idleViewerCount,
      idle_window_minutes: toFiniteNumber(
        payload.idle_window_minutes ??
          payload.idleWindowMinutes ??
          collaborationState.idle_window_minutes,
      ),
    },
    hasUnreadMessages: unreadCount > 0 || unreadViewerCount > 0,
  };
};

const groupTicketsByCategory = (tickets: Ticket[]) => {
  const groups: { [key: string]: Ticket[] } = {};
  const resolved: Ticket[] = [];

  tickets.forEach((ticket) => {
    const status = ticket.estado?.toLowerCase();
    if (status && ['resuelto', 'cerrado'].includes(status)) {
      resolved.push(ticket);
      return;
    }
    const category = ticket.categoria || 'General';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push({ ...ticket, categoria: category });
  });

  if (resolved.length > 0) {
    groups['Resueltos'] = resolved;
  }

  return groups;
};


const normalizeFilterValue = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const prettifyWorkflowStateLabel = (state: string): string =>
  state
    .split('_')
    .filter(Boolean)
    .map((chunk) => `${chunk[0]?.toUpperCase() ?? ''}${chunk.slice(1)}`)
    .join(' ');

const resolveAreaLabel = (ticket: Ticket): string => {
  return (
    ticket.distrito ||
    ticket.categoria_principal ||
    ticket.categoria_secundaria ||
    ticket.categoria_simple ||
    ticket.categoria ||
    'General'
  );
};

const resolveAgentFilterId = (ticket: Ticket): string => {
  const candidate = ticket.assignedAgent?.id ?? ticket.assignedAgentId ?? ticket.assigned_agent_id ?? null;
  return candidate === null || candidate === undefined ? '' : String(candidate);
};

const resolveSlaFilterValue = (ticket: Ticket): string => normalizeFilterValue(ticket.sla_status || 'sin_sla');
const hasUnreadState = (ticket: Ticket): boolean =>
  Boolean(
    ticket.hasUnreadMessages ||
      ticket.collaboration_state?.has_unread ||
      (typeof ticket.collaboration_state?.unread_count === 'number' && ticket.collaboration_state.unread_count > 0) ||
      (typeof ticket.collaboration_state?.unread_viewer_count === 'number' && ticket.collaboration_state.unread_viewer_count > 0),
  );

const normalizeAssignedAgent = (ticket: any): User | undefined => {
  const candidate =
    ticket?.assignedAgent ||
    ticket?.assigned_agent ||
    ticket?.assigned_user ||
    ticket?.agente_asignado ||
    ticket?.agenteAsignado ||
    ticket?.agente ||
    ticket?.responsable ||
    ticket?.usuario_asignado ||
    ticket?.usuarioAsignado;

  const resolveAgentFromPayload = (payload: any): User | undefined => {
    if (!payload || typeof payload !== 'object') return undefined;

    const id =
      payload.id ??
      payload.user_id ??
      payload.usuario_id ??
      payload.userId ??
      payload.usuarioId ??
      payload.assigned_user_id;
    const nombre =
      payload.nombre_usuario ||
      payload.nombre ||
      payload.name ||
      payload.display_name ||
      payload.username;

    const email = payload.email || payload.email_usuario || payload.emailUsuario;

    if (id === undefined && !nombre) return undefined;
    const resolvedAvatar = resolveConsentedAvatar(payload as Record<string, unknown>);

    return {
      id: id ?? nombre ?? email ?? 'agent',
      nombre_usuario: nombre || 'Agente',
      email: email || 'desconocido@chatboc.local',
      avatarUrl: resolvedAvatar.avatarUrl,
      avatar_source: resolvedAvatar.source || payload.avatar_source || payload.avatarSource || payload.profile_picture_source,
      avatar_consent: resolvedAvatar.consented || undefined,
      phone: payload.phone || payload.telefono,
      categoria_ids: payload.categoria_ids,
      categorias: payload.categorias,
    };
  };

  const resolved = resolveAgentFromPayload(candidate);
  if (resolved) return resolved;

  const directId =
    ticket?.assigned_user_id ||
    ticket?.assignedAgentId ||
    ticket?.assigned_agent_id ||
    ticket?.asigned_user_id;

  if (directId !== undefined) {
    return {
      id: directId,
      nombre_usuario:
        ticket?.assigned_user_name ||
        ticket?.assignedUserName ||
        ticket?.agente_asignado_nombre ||
        'Agente asignado',
      email:
        ticket?.assigned_user_email ||
        ticket?.assignedUserEmail ||
        'desconocido@chatboc.local',
    };
  }

  return undefined;
};

const normalizeTicketForInbox = (ticket: Ticket): Ticket => {
  const assignedAgent = normalizeAssignedAgent(ticket);
  return {
    ...ticket,
    categoria: mapToKnownCategory(ticket.categoria, ticket.categories),
    assignedAgent,
    assignedAgentId:
      ticket.assignedAgentId ||
      ticket.assigned_agent_id ||
      ticket.assigned_user_id ||
      (assignedAgent ? assignedAgent.id : undefined),
  } as Ticket;
};

export const TicketProvider: React.FC<{ children: ReactNode; tenantSlugOverride?: string | null }> = ({
  children,
  tenantSlugOverride,
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMoreTickets, setLoadingMoreTickets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<TicketInboxErrorDetails | null>(null);
  const [pagination, setPagination] = useState<TicketInboxPagination | null>(null);
  const [filters, setFilters] = useState<TicketInboxFilters>(DEFAULT_TICKET_FILTERS);
  const [workflowStatuses, setWorkflowStatuses] = useState<Array<{ value: string; label: string }>>([]);
  const [realtimeActivity, setRealtimeActivity] = useState<TicketRealtimeActivity>({
    pending: 0,
    lastLabel: null,
    lastAt: null,
  });
  const { user } = useUser();
  const { currentSlug } = useTenant();
  const userTenantSlug = React.useMemo(
    () => resolveUserTenantSlug(user),
    [
      user?.tenantSlug,
      user?.tenant_slug,
      user?.tenant?.slug,
      user?.tenant?.tenant_slug,
    ],
  );
  const userCategoryIdsKey = React.useMemo(
    () => JSON.stringify(user?.categoria_ids || []),
    [user?.categoria_ids],
  );
  const userCategoriesKey = React.useMemo(
    () =>
      JSON.stringify(
        (user?.categorias || []).map((category: any) => ({
          id: category?.id ?? null,
          nombre: category?.nombre ?? null,
        })),
      ),
    [user?.categorias],
  );
  const userAccessProfile = React.useMemo(
    () => ({
      id: user?.id,
      rol: user?.rol,
      categoria_id: user?.categoria_id,
      categoria_ids: user?.categoria_ids || [],
      categorias: user?.categorias || [],
    }),
    [
      user?.id,
      user?.rol,
      user?.categoria_id,
      userCategoryIdsKey,
      userCategoriesKey,
    ],
  );
  const activeTenantSlug = React.useMemo(
    () =>
      resolveTenantSlug(
        tenantSlugOverride ?? userTenantSlug ?? currentSlug ?? readStoredTenantSlug(),
        undefined,
        { persist: false },
      ),
    [currentSlug, tenantSlugOverride, userTenantSlug],
  );
  const serverTicketFilters = React.useMemo(
    () => resolveServerTicketFilters(filters),
    [
      filters.agent,
      filters.area,
      filters.channel,
      filters.priority,
      filters.search,
      filters.sla,
      filters.status,
      filters.unread,
    ],
  );
  const serverTicketFiltersActive = Object.values(serverTicketFilters).some(Boolean);

  const bumpRealtimeActivity = useCallback((label: string) => {
    setRealtimeActivity((current) => ({
      pending: current.pending + 1,
      lastLabel: label,
      lastAt: new Date().toISOString(),
    }));
  }, []);

  const clearRealtimeActivity = useCallback(() => {
    setRealtimeActivity({
      pending: 0,
      lastLabel: null,
      lastAt: null,
    });
  }, []);

  const filterTicketsForUser = useCallback(
    (list: Ticket[]): Ticket[] => {
      const role = (userAccessProfile.rol || '').toString().toLowerCase();
      const isSuperAdmin = role.includes('super_admin');
      const shouldRestrict = !isSuperAdmin && role.includes('empleado');

      if (!shouldRestrict) return list;

      const userId = userAccessProfile.id;
      const normalizeId = (value: unknown) =>
        value === undefined || value === null ? null : String(value);

      const allowedCategoryIds = new Set<number>();
      const allowedCategoryNames = new Set<string>();

      const collectUserCategory = (value: unknown) => {
        if (value === undefined || value === null) return;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          allowedCategoryIds.add(Number(numeric));
        }
        const label = String(value).trim().toLowerCase();
        if (label) {
          allowedCategoryNames.add(label);
        }
      };

      collectUserCategory(userAccessProfile.categoria_id);
      (userAccessProfile.categoria_ids || []).forEach(collectUserCategory);
      (userAccessProfile.categorias || []).forEach((cat) => {
        collectUserCategory(cat?.id);
        if (cat?.nombre) {
          allowedCategoryNames.add(cat.nombre.toLowerCase().trim());
        }
      });

      const hasCategoryRestrictions =
        allowedCategoryIds.size > 0 || allowedCategoryNames.size > 0;

      if (!hasCategoryRestrictions) {
        return list;
      }

      return list.filter((ticket) => {
        const matchesAssignee =
          userId !== undefined && userId !== null &&
          [ticket.assignedAgentId, ticket.assigned_agent_id, ticket.assignedAgent?.id]
            .map(normalizeId)
            .some((id) => id !== null && id === normalizeId(userId));

        const ticketCategoryIds = new Set<number>();
        const ticketCategoryNames = new Set<string>();

        const collectTicketCategory = (value: unknown) => {
          if (value === undefined || value === null) return;
          const numeric = Number(value);
          if (Number.isFinite(numeric)) {
            ticketCategoryIds.add(Number(numeric));
          }
          const label = String(value).trim().toLowerCase();
          if (label) {
            ticketCategoryNames.add(label);
          }
        };

        [
          ticket.categoria_principal,
          ticket.categoria_secundaria,
          ticket.categoria_simple,
          ticket.categoria,
          ticket.categoria_id,
        ].forEach(collectTicketCategory);
        (ticket.categories || []).forEach(collectTicketCategory);
        (ticket.categoria_ids || []).forEach(collectTicketCategory);
        (ticket.categorias || []).forEach((cat) => {
          collectTicketCategory(cat?.id);
          collectTicketCategory(cat?.nombre);
        });

        const matchesCategoryById =
          allowedCategoryIds.size > 0 &&
          Array.from(ticketCategoryIds).some((id) => allowedCategoryIds.has(id));
        const matchesCategoryByName =
          allowedCategoryNames.size > 0 &&
          Array.from(ticketCategoryNames).some((name) => allowedCategoryNames.has(name));

        const matchesCategory = matchesCategoryById || matchesCategoryByName;

        return matchesAssignee || matchesCategory;
      });
    },
    [userAccessProfile]
  );

  const fetchTickets = useCallback(async () => {
    const tenantSlug = activeTenantSlug;
    const viewerKey = resolveTicketInboxViewerKey(userAccessProfile);
    const useCache = !serverTicketFiltersActive;

    if (!tenantSlug) {
      setError(null);
      setErrorDetails(null);
      setTickets([]);
      setSelectedTicket(null);
      setPagination(null);
      setLoading(false);
      return;
    }

    const cacheKey = buildTicketInboxCacheKey(tenantSlug, viewerKey);
    const cachedInbox = readCachedTicketInbox(cacheKey);
    let cacheWasApplied = false;

    if (useCache && cachedInbox?.tickets?.length) {
      const cachedTickets = filterTicketsForUser(
        cachedInbox.tickets.map(normalizeTicketForInbox),
      );
      if (cachedTickets.length > 0) {
        cacheWasApplied = true;
        setTickets((current) => (current.length > 0 ? current : cachedTickets));
        setPagination((current) => current || cachedInbox.pagination || null);
        setSelectedTicket((current) => {
          if (current) return current;
          const cachedSelected = cachedTickets.find(
            (ticket) => String(ticket.id) === String(cachedInbox.selected_ticket_id),
          );
          return cachedSelected || getNextOperationalTicket(cachedTickets);
        });
      }
    }

    setLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const apiResponse = await withTimeout(
        getTickets(tenantSlug, { page: 1, ...serverTicketFilters }),
        TICKET_FETCH_TIMEOUT_MS,
        'La bandeja de reclamos tardo demasiado en responder.',
      );
      const fetchedTickets = (apiResponse as any)?.tickets;

      if (Array.isArray(fetchedTickets)) {
        const normalizedTickets = fetchedTickets.map(normalizeTicketForInbox);
        const filteredTickets = filterTicketsForUser(normalizedTickets);
        const nextOperationalTicket = getNextOperationalTicket(filteredTickets);
        const nextPagination = (apiResponse as any)?.pagination || null;
        setTickets(filteredTickets);
        setPagination(nextPagination);
        setSelectedTicket((prev) => {
          if (prev) {
            const refreshed = filteredTickets.find((ticket) => ticket.id === prev.id);
            if (refreshed) return refreshed;
          }
          return nextOperationalTicket;
        });
        writeCachedTicketInbox(cacheKey, {
          tenant_slug: tenantSlug,
          viewer_key: viewerKey,
          tickets: filteredTickets.slice(0, 50),
          pagination: nextPagination,
          selected_ticket_id: nextOperationalTicket?.id ?? null,
        });
      } else {
        console.warn("La respuesta de la API no contiene un array de tickets:", apiResponse);
        if (!cacheWasApplied) {
          setTickets([]);
          setPagination(null);
        }
      }
      setError(null);
      setErrorDetails(null);
    } catch (err) {
      console.error('Error fetching tickets:', err);
      const nextError = resolveTicketFetchErrorMessage(err, cacheWasApplied);
      const nextErrorDetails = resolveTicketFetchErrorDetails(err);
      if (cacheWasApplied) {
        setError(nextError);
        setErrorDetails(nextErrorDetails);
        return;
      }
      setError(nextError);
      setErrorDetails(nextErrorDetails);
      setTickets([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [activeTenantSlug, filterTicketsForUser, serverTicketFilters, serverTicketFiltersActive, userAccessProfile]);

  const loadMoreTickets = useCallback(async () => {
    if (!activeTenantSlug || loadingMoreTickets || !pagination?.has_next) return;
    const nextPage = Math.max(1, Number(pagination.page || 1) + 1);

    setLoadingMoreTickets(true);
    try {
      const apiResponse = await withTimeout(
        getTickets(activeTenantSlug, {
          page: nextPage,
          perPage: pagination.per_page || undefined,
          ...serverTicketFilters,
        }),
        TICKET_FETCH_TIMEOUT_MS,
        'La bandeja de reclamos tardo demasiado en cargar mas resultados.',
      );
      const fetchedTickets = (apiResponse as any)?.tickets;
      if (Array.isArray(fetchedTickets)) {
        const normalizedTickets = fetchedTickets.map(normalizeTicketForInbox);
        const filteredTickets = filterTicketsForUser(normalizedTickets);
        setTickets((current) => mergeTicketPages(current, filteredTickets));
        setPagination((apiResponse as any)?.pagination || null);
        setSelectedTicket((prev) => prev || getNextOperationalTicket(filteredTickets));
      }
    } catch (err) {
      console.error('Error loading more tickets:', err);
      setError('No se pudieron cargar mas reclamos. Reintenta en unos segundos.');
    } finally {
      setLoadingMoreTickets(false);
    }
  }, [activeTenantSlug, filterTicketsForUser, loadingMoreTickets, pagination, serverTicketFilters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkflowMetadata = async () => {
      try {
        const metadata = await apiClient.getTicketWorkflowMetadata(activeTenantSlug ?? undefined);
        if (cancelled) return;
        const normalized = metadata.states
          .map((state, index) => ({
            value: normalizeFilterValue(state),
            label: prettifyWorkflowStateLabel(state),
            order: index,
          }))
          .filter((state) => Boolean(state.value))
          .sort((a, b) => a.order - b.order)
          .map(({ value, label }) => ({ value, label }));
        setWorkflowStatuses(normalized);
      } catch {
        if (!cancelled) {
          setWorkflowStatuses([]);
        }
      }
    };

    loadWorkflowMetadata();
    return () => {
      cancelled = true;
    };
  }, [activeTenantSlug]);

  const selectTicket = useCallback((ticketId: number | null) => {
    if (ticketId === null) {
        setSelectedTicket(null);
        return;
    }
    const ticket = tickets.find(t => t.id === ticketId);
    setSelectedTicket(ticket || null);
  }, [tickets]);

  const updateTicket = useCallback((ticketId: number, updates: Partial<Ticket>) => {
    setTickets(prevTickets =>
      prevTickets.map(ticket =>
        ticket.id === ticketId ? { ...ticket, ...updates } : ticket
      )
    );
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedTicket]);

  const upsertTicket = useCallback((rawTicket: Ticket): boolean => {
    const normalizedTicket = normalizeTicketForInbox(rawTicket);
    const filtered = filterTicketsForUser([normalizedTicket]);
    if (!filtered.length) return false;

    setTickets((prevTickets) => {
      const nextTicket = filtered[0];
      const existingIndex = prevTickets.findIndex((ticket) => ticket.id === nextTicket.id);
      if (existingIndex === -1) {
        return [nextTicket, ...prevTickets];
      }
      const nextTickets = [...prevTickets];
      nextTickets[existingIndex] = {
        ...nextTickets[existingIndex],
        ...nextTicket,
      };
      return nextTickets;
    });

    setSelectedTicket((prev) => {
      if (!prev || prev.id !== normalizedTicket.id) return prev;
      return {
        ...prev,
        ...normalizedTicket,
      };
    });

    return true;
  }, [filterTicketsForUser]);

  useTicketUpdates({
    onNewTicket: (data) => {
      // Optimistic addition if we have enough data, otherwise fetch
      if (data && data.ticket && typeof data.ticket === 'object') {
        const newTicket = {
            ...data.ticket,
            categoria: mapToKnownCategory(data.ticket.categoria, data.ticket.categories),
            // Default fields if missing
            estado: data.ticket.estado || 'nuevo',
            priority: data.ticket.priority || 'medium',
        } as Ticket;

        if (upsertTicket(newTicket)) {
            bumpRealtimeActivity(`Nuevo reclamo #${newTicket.nro_ticket || newTicket.id}`);
            return;
        }
      }
      fetchTickets();
    },
    onNewComment: (data) => {
      // Si la data incluye cambios de estado u otros campos del ticket, actualizarlos
      const ticketPayload = data?.ticket && typeof data.ticket === 'object' ? data.ticket : null;
      if (ticketPayload) {
        upsertTicket(ticketPayload as Ticket);
      }

      if (data && data.ticket_id) {
          const updates: Partial<Ticket> = {};
          if (data.estado) updates.estado = data.estado;
          if (Object.keys(updates).length > 0) {
            updateTicket(data.ticket_id, updates);
          }
          bumpRealtimeActivity(`Nueva actividad en #${data.nro_ticket || data.ticket_id}`);
      }
    },
    onUnreadChanged: (data) => {
      const normalized = normalizeUnreadDelta(data);
      if (!normalized || !Number.isFinite(normalized.ticketId)) return;
      updateTicket(normalized.ticketId, {
        collaboration_state: normalized.collaboration_state,
        hasUnreadMessages: normalized.hasUnreadMessages,
      });
      if (normalized.hasUnreadMessages) {
        bumpRealtimeActivity(`Mensajes sin leer en #${normalized.ticketId}`);
      }
    },
  });


  const filterOptions = React.useMemo<TicketFilterOptions>(() => {
    const channels = Array.from(new Set(tickets.map((ticket) => normalizeFilterValue(ticket.channel)).filter(Boolean))).sort();
    const discoveredStatuses = Array.from(new Set(tickets.map((ticket) => normalizeFilterValue(ticket.estado)).filter(Boolean))).sort();
    const statuses = workflowStatuses.length > 0
      ? workflowStatuses
      : discoveredStatuses.map((status) => ({ value: status, label: status }));
    const areas = Array.from(
      new Set(tickets.map((ticket) => resolveAreaLabel(ticket).trim()).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b));
    const priorities = Array.from(new Set(tickets.map((ticket) => normalizeFilterValue(ticket.priority)).filter(Boolean))).sort();
    const slaStatuses = Array.from(new Set(tickets.map((ticket) => resolveSlaFilterValue(ticket)).filter(Boolean))).sort();

    const agentMap = new Map<string, string>();
    const hasUnassignedTickets = tickets.some((ticket) => !resolveAgentFilterId(ticket));
    tickets.forEach((ticket) => {
      const id = resolveAgentFilterId(ticket);
      if (!id) return;
      const label =
        ticket.assignedAgent?.nombre_usuario ||
        ticket.assignedAgent?.email ||
        String(ticket.assignedAgentId || ticket.assigned_agent_id || id);
      if (!agentMap.has(id)) {
        agentMap.set(id, label);
      }
    });

    return {
      channels,
      statuses,
      areas,
      priorities,
      slaStatuses,
      unreadModes: [
        { value: 'all', label: 'Lectura: todos' },
        { value: 'unread', label: 'Lectura: no leídos' },
        { value: 'read', label: 'Lectura: leídos' },
      ],
      agents: [
        ...(hasUnassignedTickets ? [{ id: 'unassigned', label: 'Sin responsable' }] : []),
        ...Array.from(agentMap.entries())
          .map(([id, label]) => ({ id, label }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ],
    };
  }, [tickets, workflowStatuses]);

  const filteredTickets = React.useMemo(() => {
    return tickets.filter((ticket) => {
      if (filters.channel !== 'all' && normalizeFilterValue(ticket.channel) !== filters.channel) return false;
      if (filters.status !== 'all' && normalizeFilterValue(ticket.estado) !== filters.status) return false;
      if (filters.priority !== 'all' && normalizeFilterValue(ticket.priority) !== filters.priority) return false;
      if (filters.sla !== 'all') {
        const slaValue = resolveSlaFilterValue(ticket);
        if (filters.sla === 'risk') {
          const priority = normalizeFilterValue(ticket.priority);
          const isRisk =
            slaValue.includes('breach') ||
            slaValue.includes('venc') ||
            slaValue.includes('overdue') ||
            priority.includes('alta') ||
            priority.includes('urgent') ||
            priority.includes('urgente');
          if (!isRisk) return false;
        } else if (slaValue !== filters.sla) {
          return false;
        }
      }
      if (filters.area !== 'all' && normalizeFilterValue(resolveAreaLabel(ticket)) !== normalizeFilterValue(filters.area)) return false;
      if (filters.agent !== 'all') {
        const agentId = resolveAgentFilterId(ticket);
        if (filters.agent === 'unassigned') {
          if (agentId) return false;
        } else if (agentId !== filters.agent) {
          return false;
        }
      }
      if (filters.unread === 'unread' && !hasUnreadState(ticket)) return false;
      if (filters.unread === 'read' && hasUnreadState(ticket)) return false;
      return true;
    });
  }, [tickets, filters]);

  useEffect(() => {
    setSelectedTicket((current) => {
      if (!current) return current;
      const visibleTicket = filteredTickets.find((ticket) => ticket.id === current.id);
      if (visibleTicket) return visibleTicket;
      if (loading && filteredTickets.length === 0) return current;
      return getNextOperationalTicket(filteredTickets);
    });
  }, [filteredTickets, loading, tickets]);

  const ticketsByCategory = groupTicketsByCategory(filteredTickets);

  const value = {
    tickets,
    selectedTicket,
    selectTicket,
    updateTicket,
    loading,
    error,
    errorDetails,
    ticketsByCategory,
    filters,
    setFilters,
    filterOptions,
    filteredTickets,
    refreshTickets: fetchTickets,
    pagination,
    hasMoreTickets: Boolean(pagination?.has_next),
    loadingMoreTickets,
    loadMoreTickets,
    realtimeActivity,
    clearRealtimeActivity,
  };

  return <TicketContext.Provider value={value}>{children}</TicketContext.Provider>;
};

export const useTickets = () => {
  const context = useContext(TicketContext);
  if (context === undefined) {
    throw new Error('useTickets must be used within a TicketProvider');
  }
  return context;
};
