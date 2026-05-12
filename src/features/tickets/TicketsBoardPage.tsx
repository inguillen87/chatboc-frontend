import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock3, RefreshCw, Ticket, UserRound } from 'lucide-react';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getErrorMessage } from '@/utils/api';

import TicketSlaBadge from './TicketSlaBadge';
import { listV2Tickets } from './ticketsApi';
import type { V2Ticket } from './ticketTypes';

const normalizeLabel = (value?: string | null) => (value && value.trim() ? value.trim() : 'Sin dato');

const countBy = (items: V2Ticket[], selector: (item: V2Ticket) => string | undefined | null) =>
  items.reduce<Record<string, number>>((acc, item) => {
    const key = normalizeLabel(selector(item));
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

const getTicketMeta = (ticket: V2Ticket) =>
  [ticket.priority, ticket.channel, ticket.category, ticket.assignee_name].filter(Boolean).join(' / ');

const getSchoolCaseLabel = (ticket: V2Ticket) =>
  ticket.school_case?.case_type || ticket.school_case?.status || ticket.school_case?.school_name || null;

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
    staleTime: 30_000,
  });

  const items = ticketsQuery.data ?? [];
  const statusCounts = countBy(items, (ticket) => ticket.status);
  const channelCounts = countBy(items, (ticket) => ticket.channel);
  const breachedCount = items.filter((ticket) => ticket.sla_state === 'breached').length;
  const assignedCount = items.filter((ticket) => ticket.assignee_name).length;
  const statusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const channelEntries = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]);

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
            <Button type="button" variant="outline" onClick={() => void ticketsQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tickets v2</p>
          <h1 className="text-2xl font-semibold tracking-tight">Bandeja operativa</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Vista tenant-aware con SLA, prioridad y canales normalizados para operar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isOnline ? <Badge variant="destructive">Offline</Badge> : null}
          {ticketsQuery.isFetching ? <Badge variant="secondary">Actualizando</Badge> : null}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Ticket className="h-4 w-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              SLA vencido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{breachedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <UserRound className="h-4 w-4" />
              Asignados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{assignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Estados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{statusEntries.length}</p>
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <ViewState status="empty" description="No hay tickets para los filtros actuales." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-3" aria-label="Lista de tickets">
            {items.map((ticket) => {
              const meta = getTicketMeta(ticket);
              const schoolCaseLabel = getSchoolCaseLabel(ticket);

              return (
                <article key={ticket.id} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{normalizeLabel(ticket.status)}</Badge>
                        <TicketSlaBadge state={ticket.sla_state} />
                        {schoolCaseLabel ? <Badge variant="secondary">{schoolCaseLabel}</Badge> : null}
                      </div>
                      <h2 className="break-words text-base font-semibold leading-6">{ticket.title}</h2>
                      {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">#{ticket.id}</p>
                  </div>
                  {ticket.updated_at ? <p className="mt-3 text-xs text-muted-foreground">Actualizado: {ticket.updated_at}</p> : null}
                </article>
              );
            })}
          </section>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estados</CardTitle>
                <CardDescription>Distribucion segun los valores publicados para este tenant.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusEntries.map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">{status}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Canales</CardTitle>
                <CardDescription>Lectura directa del contrato de tickets.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {channelEntries.map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">{channel}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
