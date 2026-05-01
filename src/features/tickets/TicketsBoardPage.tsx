import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { listV2Tickets } from './ticketsApi';
import TicketSlaBadge from './TicketSlaBadge';
import { ViewState } from '@/components/app-shell/ViewState';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getErrorMessage } from '@/utils/api';

export default function TicketsBoardPage() {
  const { currentSlug } = useTenant();
  const { isOnline } = useNetworkStatus();
  const ticketsQuery = useQuery({
    queryKey: ['v2-tickets', currentSlug],
    queryFn: async () => {
      const response = await listV2Tickets(currentSlug);
      return response?.items ?? [];
    },
    retry: 0,
  });

  const items = ticketsQuery.data ?? [];

  if (!isOnline && items.length === 0) {
    return (
      <div className="p-4">
        <ViewState status="offline" description="La lista se va a actualizar cuando vuelva la conexion." />
      </div>
    );
  }

  if (ticketsQuery.isLoading) {
    return (
      <div className="p-4">
        <ViewState status="loading" description="Sincronizando tickets y estados operativos." />
      </div>
    );
  }

  if (ticketsQuery.isError) {
    return (
      <div className="p-4">
        <ViewState
          status="error"
          description={getErrorMessage(ticketsQuery.error, 'No se pudo cargar la bandeja de tickets.')}
          action={
            <button className="rounded-md border px-3 py-2 text-sm" type="button" onClick={() => void ticketsQuery.refetch()}>
              Reintentar
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tickets</h1>
          <p className="text-sm text-muted-foreground">Vista operativa tenant-aware con SLA y prioridad.</p>
        </div>
        {ticketsQuery.isFetching ? <span className="text-xs text-muted-foreground">Actualizando...</span> : null}
      </div>
      {items.length === 0 ? <ViewState status="empty" description="No hay tickets para los filtros actuales." /> : null}
      {items.map((ticket) => (
        <div key={ticket.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="font-medium">{ticket.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[ticket.status, ticket.priority, ticket.channel, ticket.category, ticket.assignee_name].filter(Boolean).join(' / ')}
            </p>
          </div>
          <TicketSlaBadge state={ticket.sla_state} />
        </div>
      ))}
    </div>
  );
}
