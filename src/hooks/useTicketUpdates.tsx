import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';
import { useUser } from './useUser';
import { apiFetch } from '@/utils/api';
import { getSocketUrl } from '@/config';

interface TicketUpdate {
  ticket_id: number;
  estado: string;
  mensaje?: string | null;
}

export default function useTicketUpdates() {
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
        const socketUrl = getSocketUrl();
        socket = io(socketUrl, {
          transports: ['websocket'], // Forzar websockets
          withCredentials: true, // Para enviar cookies si es necesario
        });

        socket.on('connect', () => {
          console.log('Socket.io connected successfully');
        });

        socket.on('disconnect', () => {
          console.log('Socket.io disconnected');
        });

        // Escucha eventos de actualización de tickets
        socket.on('new_ticket', (data: any) => {
          toast({
            title: `Nuevo Ticket #${data.nro_ticket}`,
            description: data.asunto,
          });
        });

        socket.on('new_comment', (data: any) => {
          toast({
            title: `Nuevo Comentario en Ticket #${data.ticketId}`,
            description: data.comment.comentario,
          });
        });

        socket.on('connect_error', (err) => {
          console.error('Socket.io connection error:', err);
          socket?.close();
        });

      } catch (err) {
        console.error('Failed to initialize ticket notifications', err);
      }
    };

    initSocket();

    // Limpieza al desmontar el componente
    return () => {
      active = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);
}
