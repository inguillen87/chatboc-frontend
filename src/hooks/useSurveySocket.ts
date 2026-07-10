import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketUrl, SOCKET_PATH } from '@/config';
import { safeOn, assertEventSource } from '@/utils/safeOn';
import { SurveyComment, SurveyLivePublicResultsPayload, SurveyLiveResults } from '@/types/encuestas';
import { enterpriseService } from '@/services/enterpriseService';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface UseSurveySocketOptions {
  slug: string;
  tenantSlug?: string | null;
  rooms?: string[];
  joinEvent?: string;
  joinPayloads?: Array<Record<string, unknown>>;
  events?: string[];
  enabled?: boolean;
  onUpdate?: (data: SurveyLiveResults | SurveyLivePublicResultsPayload) => void;
  onComment?: (comment: SurveyComment) => void;
}

const DEFAULT_UPDATE_EVENTS = ['survey_update', 'survey_update_v2', 'survey.vote.created'];
const DEFAULT_COMMENT_EVENTS = ['survey_comment'];

const resolveSurveyRooms = (slug: string, tenantSlug?: string | null, rooms?: string[]) => {
  const explicitRooms = (rooms || [])
    .map((room) => (typeof room === 'string' ? room.trim() : ''))
    .filter(Boolean);
  if (explicitRooms.length > 0) {
    return Array.from(new Set(explicitRooms));
  }
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return [];
  const legacyRoom = `encuesta_${normalizedSlug}`;
  const normalizedTenant = tenantSlug?.trim();
  return normalizedTenant
    ? [`encuesta:${normalizedTenant}:${normalizedSlug}`, legacyRoom]
    : [legacyRoom];
};

const normalizeJoinPayloads = (
  surveyRooms: string[],
  joinPayloads?: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> => {
  const explicitPayloads = (joinPayloads || []).filter((payload) => payload && typeof payload === 'object');
  const source = explicitPayloads.length > 0 ? explicitPayloads : surveyRooms.map((room) => ({ room }));
  const seen = new Set<string>();
  return source.filter((payload) => {
    const key = JSON.stringify(payload);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveUpdateEvents = (events?: string[]) => {
  const explicitEvents = (events || [])
    .map((event) => (typeof event === 'string' ? event.trim() : ''))
    .filter(Boolean);
  const source = explicitEvents.length > 0 ? [...DEFAULT_UPDATE_EVENTS, ...explicitEvents] : DEFAULT_UPDATE_EVENTS;
  return Array.from(new Set(source));
};

export function useSurveySocket({
  slug,
  tenantSlug,
  rooms,
  joinEvent = 'join',
  joinPayloads,
  events,
  enabled = false,
  onUpdate,
  onComment,
}: UseSurveySocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onCommentRef = useRef(onComment);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onCommentRef.current = onComment;
  }, [onUpdate, onComment]);

  useEffect(() => {
    if (!enabled || !slug) return;

    const surveyRooms = resolveSurveyRooms(slug, tenantSlug, rooms);
    const resolvedJoinPayloads = normalizeJoinPayloads(surveyRooms, joinPayloads);
    if (surveyRooms.length === 0 && resolvedJoinPayloads.length === 0) return;
    const updateEvents = resolveUpdateEvents(events);
    const commentEvents = DEFAULT_COMMENT_EVENTS;

    const socketUrl = getSocketUrl();
    const resolveTransportHintKey = (tenant?: string | null) => `chatboc_socket_transport_hint:${tenant || 'default'}`;
    const resolveTransportListKey = (tenant?: string | null) => `chatboc_socket_transports:${tenant || 'default'}`;
    const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
    const defaultPollingOnly = host === 'chatboc.ar' || host.endsWith('.chatboc.ar') || host === 'www.chatboc.ar';
    const hint = safeLocalStorage.getItem(resolveTransportHintKey(slug));
    const rawTransportList = safeLocalStorage.getItem(resolveTransportListKey(slug));
    let transports: Array<'polling' | 'websocket'> = defaultPollingOnly ? ['polling'] : ['websocket', 'polling'];

    if (rawTransportList) {
      try {
        const parsed = JSON.parse(rawTransportList);
        const valid = Array.isArray(parsed)
          ? parsed.filter((item): item is 'polling' | 'websocket' => item === 'polling' || item === 'websocket')
          : [];
        if (valid.length > 0) transports = valid;
      } catch {
        // keep defaults
      }
    } else if (hint === 'polling') {
      transports = ['polling'];
    }

    if (defaultPollingOnly) {
      transports = ['polling'];
    }

    const socket = io(socketUrl, {
      path: SOCKET_PATH,
      transports,
      withCredentials: true,
      auth: { channel: 'web' },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
    });

    socketRef.current = socket;

    assertEventSource(socket, 'survey-socket');

    const handleConnect = () => {
      console.log(`[SurveySocket] Connected. Joining rooms: ${surveyRooms.join(', ')}`);
      void enterpriseService.trackEvent({
        event: 'analytics_socket_connected',
        payload: {
          tenant_slug: tenantSlug || slug,
          route: '/e/:slug',
          build_version: import.meta.env.VITE_APP_VERSION || 'dev',
          error_code: null,
        },
      }, tenantSlug || slug).catch(() => undefined);
      resolvedJoinPayloads.forEach((payload) => {
        socket.emit(joinEvent || 'join', payload);
      });
    };

    const handleDisconnect = () => undefined;

    const handleConnectError = (error: unknown) => {
      const lowered = String((error as any)?.message || '').toLowerCase();
      if (lowered.includes('websocket') || lowered.includes('transport') || lowered.includes('xhr poll error')) {
        safeLocalStorage.setItem(resolveTransportHintKey(slug), 'polling');
        safeLocalStorage.setItem(resolveTransportListKey(slug), JSON.stringify(['polling']));
      }
    };

    const handleUpdate = (data: SurveyLiveResults | SurveyLivePublicResultsPayload) => {
      console.log('[SurveySocket] Received update:', data);
      onUpdateRef.current?.(data);
    };

    const handleComment = (comment: SurveyComment) => {
      console.log('[SurveySocket] Received comment:', comment);
      onCommentRef.current?.(comment);
    };

    safeOn(socket, 'connect', handleConnect);
    safeOn(socket, 'disconnect', handleDisconnect);
    safeOn(socket, 'connect_error', handleConnectError);
    updateEvents.forEach((eventName) => safeOn(socket, eventName, handleUpdate));
    commentEvents.forEach((eventName) => safeOn(socket, eventName, handleComment));

    return () => {
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        updateEvents.forEach((eventName) => socket.off(eventName, handleUpdate));
        commentEvents.forEach((eventName) => socket.off(eventName, handleComment));
        socket.disconnect();
      }
    };
  }, [enabled, events, joinEvent, joinPayloads, rooms, slug, tenantSlug]);

  return socketRef.current;
}
