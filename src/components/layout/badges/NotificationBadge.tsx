import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useSocket } from '@/context/SocketContext';
import { safeOn } from '@/utils/safeOn';
import { Bell } from 'lucide-react';

interface NotificationBadgeProps {
  initialCount?: number;
  type: 'orders' | 'tickets' | 'generic';
  className?: string;
  showZero?: boolean;
}

const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  initialCount = 0,
  type,
  className,
  showZero = false,
}) => {
  const [count, setCount] = useState(initialCount);
  const [animate, setAnimate] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onOrderEvent = () => {
        if (type === 'orders' || type === 'generic') {
            setCount(prev => prev + 1);
            triggerAnimation();
        }
    };

    const onTicketEvent = () => {
        if (type === 'tickets' || type === 'generic') {
            setCount(prev => prev + 1);
            triggerAnimation();
        }
    };

    // Listen to multiple event variations to ensure coverage
    const orderEvents = ['new_order', 'order_update'];
    const ticketEvents = ['new_ticket', 'ticket_update', 'new_comment', 'new_chat_message'];

    orderEvents.forEach(evt => safeOn(socket, evt, onOrderEvent));
    ticketEvents.forEach(evt => safeOn(socket, evt, onTicketEvent));

    return () => {
      orderEvents.forEach(evt => socket.off(evt, onOrderEvent));
      ticketEvents.forEach(evt => socket.off(evt, onTicketEvent));
    };
  }, [socket, type]);

  const triggerAnimation = () => {
    setAnimate(true);
    setTimeout(() => setAnimate(false), 1000);
  };

  if (!showZero && count === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-xs font-medium text-destructive-foreground ring-1 ring-inset ring-destructive/10 min-w-[1.25rem]",
        animate && "animate-bounce duration-500",
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
};

export default NotificationBadge;
