import { useEffect, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useSocket } from '@/context/SocketContext';
import { safeOn } from '@/utils/safeOn';

interface UseTicketUpdatesOptions {
  onNewTicket?: (data: any) => void;
  onNewComment?: (data: any) => void;
}

export default function useTicketUpdates(options: UseTicketUpdatesOptions = {}) {
  const { onNewTicket, onNewComment } = options;
  const newTicketRef = useRef<UseTicketUpdatesOptions['onNewTicket']>(onNewTicket);
  const newCommentRef = useRef<UseTicketUpdatesOptions['onNewComment']>(onNewComment);

  const { socket } = useSocket();

  // Keep listeners synced with the latest callbacks without re-subscribing
  useEffect(() => {
    newTicketRef.current = onNewTicket;
  }, [onNewTicket]);

  useEffect(() => {
    newCommentRef.current = onNewComment;
  }, [onNewComment]);

  useEffect(() => {
    if (!socket) return;

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

    safeOn(socket, 'new_ticket', handleNewTicket);
    safeOn(socket, 'new_comment', handleNewComment);

    return () => {
      socket.off('new_ticket', handleNewTicket);
      socket.off('new_comment', handleNewComment);
    };
  }, [socket]);
}
