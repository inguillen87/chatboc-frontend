import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ManagerOptions, SocketOptions } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import { useUser } from './useUser';
import { apiFetch, resolveTenantSlug } from '@/utils/api';
import { safeOn, assertEventSource } from '@/utils/safeOn';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { getSocketUrl, SOCKET_PATH } from '@/config';

interface TicketUpdate {
  ticket_id: number;
  estado: string;
  mensaje?: string | null;
}

interface UseTicketUpdatesOptions {
  onNewTicket?: (data: any) => void;
  onNewComment?: (data: any) => void;
}

const normalizeSocketUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^wss?:\/\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http/i, 'ws');
  }
  return undefined;
};

const sanitizeSocketPath = (value?: string) => {
  const normalized = value?.trim().replace(/\/+$|\s+/g, '') || '/socket.io';
  if (!normalized) return '/socket.io';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || '';
const socketPath = sanitizeSocketPath(import.meta.env.VITE_SOCKET_PATH || SOCKET_PATH || '/socket.io');

const resolveSocketUrl = (): string | undefined => {
  const fromEnv = normalizeSocketUrl(rawSocketUrl);
  if (fromEnv) return fromEnv;

  const fromConfig = normalizeSocketUrl(getSocketUrl());
  if (fromConfig) return fromConfig;

  if (typeof window !== 'undefined') {
    return normalizeSocketUrl(window.location.origin.replace(/^http/i, 'ws'));
  }

  return undefined;
};

const SOCKET_URL = resolveSocketUrl();

export default function useTicketUpdates(options: UseTicketUpdatesOptions = {}) {
  const { onNewTicket, onNewComment } = options;
  const newTicketRef = useRef<UseTicketUpdatesOptions['onNewTicket']>(onNewTicket);
  const newCommentRef = useRef<UseTicketUpdatesOptions['onNewComment']>(onNewComment);
  const { user } = useUser();

  // Keep listeners synced with the latest callbacks without re-subscribing
  useEffect(() => {
    newTicketRef.current = onNewTicket;
  }, [onNewTicket]);

  useEffect(() => {
    newCommentRef.current = onNewComment;
  }, [onNewComment]);

  useEffect(() => {
    const tenantSlug = resolveTenantSlug(user?.tenantSlug);
    if (!user || !tenantSlug) return;

    let socket: Socket | null = null;
    let active = true;

    const handleConnect = () => {
      console.log('Socket.io connected successfully');
    };
    const handleDisconnect = () => {
      console.log('Socket.io disconnected');
    };
    const handleNewTicket = (data: any) => {
      newTicketRef.current?.(data);
      toast({
        title: `Nuevo Ticket #${data.nro_ticket}`,
        description: data.asunto,
      });
    };
    const handleNewComment = (data: any) => {
      newCommentRef.current?.(data);
      toast({
        title: `Nuevo Comentario en Ticket #${data.ticketId}`,
        description: data.comment.comentario,
      });
    };
    const handleConnectError = (err: any) => {
      console.error('Socket.io connection error:', err);
      socket?.close();
    };

    const initSocket = async () => {
      let shouldConnect = true;

      try {
        const settings = await apiFetch<{ ticket?: boolean }>('/notifications', {
          isWidgetRequest: false,
          omitCredentials: false,
          tenantSlug,
        });
        if (!active) return;

        if (settings && typeof settings.ticket === 'boolean') {
          shouldConnect = settings.ticket !== false;
        }
      } catch (err) {
        console.warn('Falling back to realtime tickets without notification settings', err);
        shouldConnect = true;
      }

      if (!active || !shouldConnect) {
        return;
      }

      const token =
        safeLocalStorage.getItem('authToken') ||
        safeLocalStorage.getItem('chatAuthToken');

      const socketOptions: Partial<ManagerOptions & SocketOptions> = {
        transports: ['websocket'],
        withCredentials: true,
        path: socketPath,
      };

      if (token) {
        socketOptions.auth = { token };
      }

      socket = io(SOCKET_URL ?? undefined, socketOptions);

      assertEventSource(socket, 'ticket-socket');

      safeOn(socket, 'connect', handleConnect);
      safeOn(socket, 'disconnect', handleDisconnect);
      safeOn(socket, 'new_ticket', handleNewTicket);
      safeOn(socket, 'new_comment', handleNewComment);
      safeOn(socket, 'connect_error', handleConnectError);
    };

    initSocket();

    // Limpieza al desmontar el componente
    return () => {
      active = false;
      if (socket) {
        socket.off?.('connect', handleConnect);
        socket.off?.('disconnect', handleDisconnect);
        socket.off?.('new_ticket', handleNewTicket);
        socket.off?.('new_comment', handleNewComment);
        socket.off?.('connect_error', handleConnectError);
        socket.disconnect();
      }
    };
  }, [user]);
}
