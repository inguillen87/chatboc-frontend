import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ManagerOptions, SocketOptions } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import { useUser } from './useUser';
import { apiFetch, resolveTenantSlug } from '@/utils/api';
import { safeOn, assertEventSource } from '@/utils/safeOn';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { getSocketUrl } from '@/config';

interface TicketUpdate {
  ticket_id: number;
  estado: string;
  mensaje?: string | null;
}

interface UseTicketUpdatesOptions {
  onNewTicket?: (data: any) => void;
  onNewComment?: (data: any) => void;
}

const normalizeSocketUrl = (value: string): string | undefined => {
  if (!value) return undefined;
  if (/^wss?:\/\//i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^http/i, 'ws');
  }
  return undefined;
};

const rawSocketUrl = import.meta.env.VITE_SOCKET_URL || '';
<<<<<<< HEAD
const SOCKET_URL = normalizeSocketUrl(rawSocketUrl);
=======
const ENV_SOCKET_URL = normalizeSocketUrl(rawSocketUrl);
>>>>>>> 4dd1699b96df0d6a19db75d9db52a61284ae689d

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
<<<<<<< HEAD
    const tenantSlug = resolveTenantSlug(user?.tenantSlug);
=======
    const tenantSlug = resolveTenantSlug(user?.tenantSlug || (user as any)?.tenant_slug);
>>>>>>> 4dd1699b96df0d6a19db75d9db52a61284ae689d
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
      if (err?.message?.includes('400') || err?.description?.includes('400') || err?.data?.status === 400) {
        if (socket?.io) {
          socket.io.opts.reconnection = false;
        }
      }
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
        path: '/socket.io',
        reconnectionAttempts: 3,
        reconnectionDelayMax: 5000,
      };

      if (token) {
        socketOptions.auth = { token };
      }

      const resolvedSocketUrl = (() => {
        if (ENV_SOCKET_URL) return ENV_SOCKET_URL;
        try {
          const derived = getSocketUrl();
          return normalizeSocketUrl(derived) ?? derived;
        } catch (err) {
          console.error('Unable to resolve socket URL', err);
          return undefined;
        }
      })();

      if (!resolvedSocketUrl) {
        console.warn('Socket URL not available; skipping ticket updates connection.');
        return;
      }

      socket = io(resolvedSocketUrl, socketOptions);

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
