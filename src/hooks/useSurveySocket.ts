import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketUrl, SOCKET_PATH } from '@/config';
import { safeOn, assertEventSource } from '@/utils/safeOn';
import { SurveyComment, SurveyLiveResults } from '@/types/encuestas';

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
    });

    socketRef.current = socket;

    assertEventSource(socket, 'survey-socket');

    const handleConnect = () => {
      console.log(`[SurveySocket] Connected. Joining room: encuesta_${slug}`);
      socket.emit('join', { room: `encuesta_${slug}` });
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
    safeOn(socket, 'survey_update', handleUpdate);
    safeOn(socket, 'survey_comment', handleComment);

    return () => {
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('survey_update', handleUpdate);
        socket.off('survey_comment', handleComment);
        socket.disconnect();
      }
    };
  }, [slug, enabled]);

  return socketRef.current;
}
