import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { listV2Tickets } from './ticketsApi';
import TicketSlaBadge from './TicketSlaBadge';

export default function TicketsBoardPage() {
  const { currentSlug } = useTenant();
  const ticketsQuery = useQuery({
    queryKey: ['v2-tickets', currentSlug],
    queryFn: async () => {
      const response = await listV2Tickets(currentSlug);
      return response?.items ?? [];
    },
    retry: 0,
  });

  const items = ticketsQuery.data ?? [];

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-xl font-semibold">Tickets</h1>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Sin tickets para mostrar.</p> : null}
      {items.map((ticket) => (
        <div key={ticket.id} className="flex items-center justify-between rounded border p-3">
          <div>
            <p className="font-medium">{ticket.title}</p>
            <p className="text-xs text-muted-foreground">{ticket.status}</p>
          </div>
          <TicketSlaBadge state={ticket.sla_state} />
        </div>
      ))}
    </div>
  );
}
