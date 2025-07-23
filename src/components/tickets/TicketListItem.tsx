import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { Ticket } from '@/pages/TicketsPanel';

interface TicketListItemProps {
  ticket: Ticket;
  isSelected?: boolean;
  onSelect: () => void;
}

export const TicketListItem: React.FC<TicketListItemProps> = ({ ticket, isSelected, onSelect }) => {
  const statusStyles: { [key: string]: string } = {
    'nuevo': 'bg-blue-500',
    'en_proceso': 'bg-yellow-500',
    'resuelto': 'bg-green-500',
    'cerrado': 'bg-gray-500',
  };

  return (
    <motion.div
      onClick={onSelect}
      className={cn(
        "cursor-pointer p-3 rounded-lg border-l-4",
        isSelected ? "bg-accent border-primary" : "bg-card border-transparent hover:bg-accent/50"
      )}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex justify-between items-start">
        <p className="font-semibold text-sm truncate pr-2">{ticket.asunto}</p>
        <Badge className={cn("text-xs text-white", statusStyles[ticket.estado])}>{ticket.estado}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{ticket.nombre_usuario}</p>
      <p className="text-xs text-muted-foreground mt-1">{new Date(ticket.fecha).toLocaleString()}</p>
    </motion.div>
  );
};
