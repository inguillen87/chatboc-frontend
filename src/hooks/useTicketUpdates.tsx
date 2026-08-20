import { useEffect, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useSocket } from '@/context/SocketContext';
import useTicketRealtime from '@/hooks/useTicketRealtime';
import { safeOn } from '@/utils/safeOn';
import {
  isTenantTicketCollectionInvalidation,
  TENANT_TICKET_INVALIDATION_CONTRACT_VERSION,
} from '@/utils/tenantTicketInvalidation';

interface UseTicketUpdatesOptions {
  onNewTicket?: (data: any) => void;
  onNewComment?: (data: any) => void;
  onUnreadChanged?: (data: any) => void;
  onCollectionInvalidated?: (data: unknown) => void;
}

export default function useTicketUpdates(options: UseTicketUpdatesOptions = {}) {
  const { onNewTicket, onNewComment, onUnreadChanged, onCollectionInvalidated } = options;
  const newTicketRef = useRef<UseTicketUpdatesOptions['onNewTicket']>(onNewTicket);
  const newCommentRef = useRef<UseTicketUpdatesOptions['onNewComment']>(onNewComment);
  const unreadChangedRef = useRef<UseTicketUpdatesOptions['onUnreadChanged']>(onUnreadChanged);
  const collectionInvalidatedRef = useRef<UseTicketUpdatesOptions['onCollectionInvalidated']>(onCollectionInvalidated);

  const { socket } = useSocket();

  // Keep listeners synced with the latest callbacks without re-subscribing
  useEffect(() => {
    newTicketRef.current = onNewTicket;
  }, [onNewTicket]);

  useEffect(() => {
    newCommentRef.current = onNewComment;
  }, [onNewComment]);

  useEffect(() => {
    unreadChangedRef.current = onUnreadChanged;
  }, [onUnreadChanged]);

  useEffect(() => {
    collectionInvalidatedRef.current = onCollectionInvalidated;
  }, [onCollectionInvalidated]);

  useTicketRealtime({
    onRawEvent: (eventName, data) => {
      if (eventName === 'ticket.unread.changed') {
        unreadChangedRef.current?.(data);
      }
      if (eventName === 'conversation.message.created' || eventName === 'legacy.new_chat_message') {
        newCommentRef.current?.(data);
      }
    },
  });

  useEffect(() => {
    if (!socket) return;

    const handleNewTicket = (data: any) => {
      newTicketRef.current?.(data);
      toast({
        title: `Nuevo Ticket #${data.nro_ticket}`,
        description: data.asunto,
      });
    };

    const handleTicketUpdate = (data: any) => {
      if (isTenantTicketCollectionInvalidation(data)) {
        collectionInvalidatedRef.current?.(data);
        return;
      }
      if (
        data &&
        typeof data === 'object' &&
        data.contract_version === TENANT_TICKET_INVALIDATION_CONTRACT_VERSION
      ) {
        return;
      }
      newTicketRef.current?.(data);
    };

    const handleNewComment = (data: any) => {
      newCommentRef.current?.(data);
      toast({
        title: `Nuevo Comentario en Ticket #${data.ticketId}`,
        description: data.comment.comentario,
      });
    };

    const handleUnreadChanged = (data: any) => {
      unreadChangedRef.current?.(data);
    };

    safeOn(socket, 'new_ticket', handleNewTicket);
    safeOn(socket, 'ticket_update', handleTicketUpdate);
    safeOn(socket, 'new_comment', handleNewComment);
    safeOn(socket, 'ticket.unread.changed', handleUnreadChanged);

    return () => {
      socket.off('new_ticket', handleNewTicket);
      socket.off('ticket_update', handleTicketUpdate);
      socket.off('new_comment', handleNewComment);
      socket.off('ticket.unread.changed', handleUnreadChanged);
    };
  }, [socket]);
}
