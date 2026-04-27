import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { V2Ticket } from './ticketTypes';

export default function TicketDetailDrawer({ ticket }: { ticket: V2Ticket | null }) {
  if (!ticket) return null;
  return (
    <Card>
      <CardHeader><CardTitle>{ticket.title}</CardTitle></CardHeader>
      <CardContent className="text-sm text-muted-foreground">Estado: {ticket.status}</CardContent>
    </Card>
  );
}
