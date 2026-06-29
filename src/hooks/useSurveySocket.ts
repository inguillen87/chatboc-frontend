import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketUrl, SOCKET_PATH } from '@/config';
import { safeOn, assertEventSource } from '@/utils/safeOn';
import { SurveyComment, SurveyLivePublicResultsPayload, SurveyLiveResults } from '@/types/encuestas';
import { enterpriseService } from '@/services/enterpriseService';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface UseSurveySocketOptions {
  slug: string;
  enabled?: boolean;
  onUpdate?: (data: SurveyLiveResults | SurveyLivePublicResultsPayload) => void;
  onComment?: (comment: SurveyComment) => void;
}

export function useSurveySocket({ slug, enabled = false, onUpdate, onComment }: UseSurveySocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onCommentRef = useRef(onComment);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
    onCommentRef.current = onComment;
  }, [onUpdate, onComment]);

  useEffect(() => {
    if (!enabled || !slug) return;

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
      console.log(`[SurveySocket] Connected. Joining room: encuesta_${slug}`);
      void enterpriseService.trackEvent({
        event: 'analytics_socket_connected',
        payload: {
          tenant_slug: slug,
          route: '/e/:slug',
          build_version: import.meta.env.VITE_APP_VERSION || 'dev',
          error_code: null,
        },
      }, slug).catch(() => undefined);
      socket.emit('join', { room: `encuesta_${slug}` });
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
    safeOn(socket, 'survey_update', handleUpdate);
    safeOn(socket, 'survey_update_v2', handleUpdate);
    safeOn(socket, 'survey_comment', handleComment);

    return () => {
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        socket.off('survey_update', handleUpdate);
        socket.off('survey_update_v2', handleUpdate);
        socket.off('survey_comment', handleComment);
        socket.disconnect();
      }
    };
  }, [slug, enabled]);

  return socketRef.current;
}
