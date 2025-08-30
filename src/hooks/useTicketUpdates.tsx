import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import { useUser } from './useUser';
import { apiFetch } from '@/utils/api';
import { safeOn, assertEventSource } from '@/utils/safeOn';

interface TicketUpdate {
  ticket_id: number;
  estado: string;
  mensaje?: string | null;
}

interface UseTicketUpdatesOptions {
  onNewTicket?: (data: any) => void;
  onNewComment?: (data: any) => void;
}

// Asegúrate de que esta URL coincida con tu servidor de Socket.io
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function useTicketUpdates(options: UseTicketUpdatesOptions = {}) {
  const { onNewTicket, onNewComment } = options;
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    let socket: Socket | null = null;
    let active = true;

    const initSocket = async () => {
      try {
        // Opcional: Verifica si el usuario tiene activadas las notificaciones
        const settings = await apiFetch<{ ticket: boolean }>('/notifications');
        if (!active || !settings || !settings.ticket) return;

        // Inicializa la conexión de Socket.io
        socket = io(SOCKET_URL, {
          transports: ['websocket'], // Forzar websockets
          withCredentials: true, // Para enviar cookies si es necesario
        });

        assertEventSource(socket, 'ticket-socket');

        const handleConnect = () => {
          console.log('Socket.io connected successfully');
        };
        const handleDisconnect = () => {
          console.log('Socket.io disconnected');
        };
        const handleNewTicket = (data: any) => {
          onNewTicket?.(data);
          toast({
            title: `Nuevo Ticket #${data.nro_ticket}`,
            description: data.asunto,
          });
        };
        const handleNewComment = (data: any) => {
          onNewComment?.(data);
          toast({
            title: `Nuevo Comentario en Ticket #${data.ticketId}`,
            description: data.comment.comentario,
          });
        };
        const handleConnectError = (err: any) => {
          console.error('Socket.io connection error:', err);
          socket?.close();
        };

        safeOn(socket, 'connect', handleConnect);
        safeOn(socket, 'disconnect', handleDisconnect);
        safeOn(socket, 'new_ticket', handleNewTicket);
        safeOn(socket, 'new_comment', handleNewComment);
        safeOn(socket, 'connect_error', handleConnectError);

      } catch (err) {
        console.error('Failed to initialize ticket notifications', err);
      }
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
