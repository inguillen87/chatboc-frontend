import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketUrl, SOCKET_PATH } from '@/config';
import { safeOn, assertEventSource } from '@/utils/safeOn';
import { SurveyComment, SurveyLiveResults } from '@/types/encuestas';
import { enterpriseService } from '@/services/enterpriseService';

interface UseSurveySocketOptions {
  slug: string;
  enabled?: boolean;
  onUpdate?: (data: SurveyLiveResults) => void;
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
    const socket = io(socketUrl, {
      path: SOCKET_PATH,
      transports: ['websocket', 'polling'],
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

    const handleDisconnect = () => {
      void enterpriseService.trackEvent({
        event: 'analytics_socket_disconnected',
        payload: {
          tenant_slug: slug,
          route: '/e/:slug',
          build_version: import.meta.env.VITE_APP_VERSION || 'dev',
          error_code: 'socket_disconnect',
        },
      }, slug).catch(() => undefined);
    };

    const handleUpdate = (data: SurveyLiveResults) => {
      console.log('[SurveySocket] Received update:', data);
      onUpdateRef.current?.(data);
    };

    const handleComment = (comment: SurveyComment) => {
      console.log('[SurveySocket] Received comment:', comment);
      onCommentRef.current?.(comment);
    };

    safeOn(socket, 'connect', handleConnect);
    safeOn(socket, 'disconnect', handleDisconnect);
    safeOn(socket, 'survey_update', handleUpdate);
    safeOn(socket, 'survey_comment', handleComment);

    return () => {
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('survey_update', handleUpdate);
        socket.off('survey_comment', handleComment);
        socket.disconnect();
      }
    };
  }, [slug, enabled]);

  return socketRef.current;
}
