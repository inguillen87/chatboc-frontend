import React, { useMemo, useRef } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpRight, Clock3, Filter, Inbox, Loader2, RefreshCw, Ticket, UserRound } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTenant } from '@/context/TenantContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getErrorMessage } from '@/utils/api';

import {
  OPERATIONAL_QUEUE_AGE_BUCKETS,
  OPERATIONAL_QUEUE_DEFAULT_LIMIT,
  OPERATIONAL_QUEUE_SLA_STATES,
  OPERATIONAL_QUEUE_SOURCE_MODELS,
  OperationalQueueContractError,
  assertOperationalQueuePageChain,
  buildOperationalQueueSearchParams,
  getOperationalQueuePage,
  operationalQueueQueryKey,
  parseOperationalQueueSearchParams,
  type OperationalQueueAgeBucket,
  type OperationalQueueFilters,
  type OperationalQueueItem,
  type OperationalQueuePage,
  type OperationalQueueSlaState,
  type OperationalQueueSourceModel,
} from './operationalQueueApi';

const SLA_LABELS: Record<OperationalQueueSlaState, string> = {
  breached: 'Vencido',
  at_risk: 'En riesgo',
  unknown: 'Sin evidencia',
  healthy: 'En plazo',
  not_eligible: 'No aplica',
};

const AGE_LABELS: Record<OperationalQueueAgeBucket, string> = {
  lt_1h: 'Menos de 1 hora',
  '1h_4h': '1 a 4 horas',
  '4h_24h': '4 a 24 horas',
  '1d_3d': '1 a 3 dias',
  '3d_7d': '3 a 7 dias',
  gte_7d: '7 dias o mas',
  unknown: 'Antiguedad desconocida',
};

const SOURCE_LABELS: Record<OperationalQueueSourceModel, string> = {
  TenantTicket: 'Ticket unificado',
  MunicipioTicket: 'Reclamo municipal',
  PymeTicket: 'Caso de empresa',
};

const OPTIONAL_FILTER = '__all__';

const formatTimestamp = (value: string | null) => {
  if (!value) return 'Sin fecha verificable';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
};

const valueFromForm = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const buildFiltersFromForm = (form: HTMLFormElement): URLSearchParams => {
  const formData = new FormData(form);
  const search = new URLSearchParams({ queue: 'open' });
  ['sla', 'age', 'assignee', 'source_model', 'category'].forEach((key) => {
    const rawValue = valueFromForm(formData, key);
    const value = key === 'category' ? rawValue.toLowerCase() : rawValue;
    if (value && value !== OPTIONAL_FILTER) search.set(key, value);
  });
  const limit = valueFromForm(formData, 'limit');
  search.set('limit', limit || String(OPERATIONAL_QUEUE_DEFAULT_LIMIT));
  return search;
};

const getItemMeta = (item: OperationalQueueItem) =>
  [item.category, item.channel, item.priority].filter((value): value is string => Boolean(value)).join(' / ');

const buildTicketWorkspaceHref = (tenantSlug: string, item: OperationalQueueItem) => {
  const search = new URLSearchParams({
    ticket_id: item.source_id,
    source_model: item.source_model,
    focus: 'operational_queue',
  });
  return `/t/${encodeURIComponent(tenantSlug)}/tickets?${search.toString()}`;
};

function QueueFilters({
  filters,
  limit,
  formKey,
  onApply,
  onReset,
}: {
  filters: OperationalQueueFilters;
  limit: number;
  formKey: string;
  onApply: (form: HTMLFormElement) => void;
  onReset: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-4 w-4" />
          Filtros operativos
        </CardTitle>
        <CardDescription>La URL conserva solamente los filtros canonicos de la bandeja v1.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          key={formKey}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            onApply(event.currentTarget);
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="queue-sla">SLA</Label>
            <select
              id="queue-sla"
              name="sla"
              defaultValue={filters.sla ?? OPTIONAL_FILTER}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value={OPTIONAL_FILTER}>Todos</option>
              {OPERATIONAL_QUEUE_SLA_STATES.map((state) => (
                <option key={state} value={state}>{SLA_LABELS[state]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="queue-age">Antiguedad</Label>
            <select
              id="queue-age"
              name="age"
              defaultValue={filters.age ?? OPTIONAL_FILTER}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value={OPTIONAL_FILTER}>Todas</option>
              {OPERATIONAL_QUEUE_AGE_BUCKETS.map((bucket) => (
                <option key={bucket} value={bucket}>{AGE_LABELS[bucket]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="queue-source">Origen</Label>
            <select
              id="queue-source"
              name="source_model"
              defaultValue={filters.source_model ?? OPTIONAL_FILTER}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value={OPTIONAL_FILTER}>Todos</option>
              {OPERATIONAL_QUEUE_SOURCE_MODELS.map((source) => (
                <option key={source} value={source}>{SOURCE_LABELS[source]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="queue-assignee">Asignado</Label>
            <Input
              id="queue-assignee"
              name="assignee"
              defaultValue={filters.assignee ?? ''}
              placeholder="ID o unassigned"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="queue-category">Categoria</Label>
            <Input
              id="queue-category"
              name="category"
              defaultValue={filters.category ?? ''}
              placeholder="Categoria exacta"
              maxLength={100}
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="queue-limit">Por pagina</Label>
            <select
              id="queue-limit"
              name="limit"
              defaultValue={String(limit)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {![10, 25, 50, 100].includes(limit) ? <option value={limit}>{limit}</option> : null}
              {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-6">
            <Button type="submit">Aplicar filtros</Button>
            <Button type="button" variant="outline" onClick={onReset}>Limpiar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function TicketsBoardPage() {
  const queryClient = useQueryClient();
  const { currentSlug } = useTenant();
  const { tenant: routeTenant } = useParams<{ tenant?: string }>();
  const { isOnline } = useNetworkStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawSearch = searchParams.toString();
  const searchState = useMemo(
    () => parseOperationalQueueSearchParams(new URLSearchParams(rawSearch)),
    [rawSearch],
  );
  const tenantSlug = routeTenant?.trim() || currentSlug?.trim() || '';
  const filterKey = buildOperationalQueueSearchParams(searchState.filters, searchState.limit).toString();
  const queryEnabled = Boolean(tenantSlug) && searchState.errors.length === 0;
  const queueKey = operationalQueueQueryKey(tenantSlug || '__missing_tenant__', searchState.filters, searchState.limit);
  const queueIdentity = JSON.stringify(queueKey);
  const acceptedChainsRef = useRef(new Map<string, readonly OperationalQueuePage[]>());

  const queueQuery = useInfiniteQuery({
    queryKey: queueKey,
    queryFn: async ({ pageParam, client }) => {
      const page = await getOperationalQueuePage({
        tenantSlug,
        filters: searchState.filters,
        cursor: pageParam,
        limit: searchState.limit,
      });
      const cached = client.getQueryData<{ pages: OperationalQueuePage[] }>(queueKey);
      const previousPages = pageParam === null
        ? []
        : acceptedChainsRef.current.get(queueIdentity) ?? cached?.pages ?? [];
      if (pageParam !== null) {
        const expectedCursor = previousPages[previousPages.length - 1]?.page.next_cursor;
        if (!expectedCursor || expectedCursor !== pageParam) {
          throw new OperationalQueueContractError('cursor de pagina no coincide con la pagina aceptada anterior');
        }
      }
      const nextChain = [...previousPages, page];
      assertOperationalQueuePageChain(nextChain);
      acceptedChainsRef.current.set(queueIdentity, nextChain);
      return page;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.page.has_more ? lastPage.page.next_cursor ?? undefined : undefined,
    enabled: queryEnabled,
    retry: 0,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const pageCount = query.state.data?.pages.length ?? 0;
      return isOnline && pageCount === 1 ? 30_000 : false;
    },
  });

  const pages = queueQuery.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const firstPage = pages[0];
  const autoRefreshEnabled = queryEnabled && isOnline && pages.length === 1;
  const refreshFromFirstPage = () => {
    acceptedChainsRef.current.delete(queueIdentity);
    return queryClient.resetQueries({ queryKey: queueKey, exact: true });
  };

  const filtersCard = (
    <QueueFilters
      filters={searchState.filters}
      limit={searchState.limit}
      formKey={filterKey}
      onApply={(form) => setSearchParams(buildFiltersFromForm(form), { replace: true })}
      onReset={() => setSearchParams(
        buildOperationalQueueSearchParams({ queue: 'open' }, OPERATIONAL_QUEUE_DEFAULT_LIMIT),
        { replace: true },
      )}
    />
  );

  const header = (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operacion tenant-aware</p>
        <h1 className="text-2xl font-semibold tracking-tight">Bandeja operativa</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Casos abiertos de las fuentes autorizadas, ordenados por fecha de creacion y con estado vivo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!isOnline ? <Badge variant="destructive">Sin conexion</Badge> : null}
        {queryEnabled && pages.length > 0 ? (
          <Badge variant="outline">
            {!isOnline
              ? 'Actualizacion pausada sin conexion'
              : autoRefreshEnabled
                ? 'Auto cada 30 s'
                : 'Actualizacion manual con varias paginas'}
          </Badge>
        ) : null}
        {queueQuery.isFetching && !queueQuery.isFetchingNextPage ? <Badge variant="secondary">Actualizando</Badge> : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!queryEnabled || !isOnline || queueQuery.isFetching}
          onClick={() => void refreshFromFirstPage()}
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar desde el inicio
        </Button>
      </div>
    </header>
  );

  if (!tenantSlug) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        {header}
        {filtersCard}
        <ViewState status="error" title="Falta el tenant" description="No se consulto la bandeja porque no hay un tenant activo." />
      </div>
    );
  }

  if (searchState.errors.length > 0) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        {header}
        {filtersCard}
        <ViewState
          status="error"
          title="Filtros no validos"
          description={searchState.errors.join(' ')}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => setSearchParams(
                buildOperationalQueueSearchParams({ queue: 'open' }, OPERATIONAL_QUEUE_DEFAULT_LIMIT),
                { replace: true },
              )}
            >
              Limpiar URL
            </Button>
          }
        />
      </div>
    );
  }

  if (!isOnline && !queueQuery.data) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        {header}
        {filtersCard}
        <ViewState status="offline" description="La bandeja se actualizara cuando vuelva la conexion." />
      </div>
    );
  }

  if (queueQuery.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        {header}
        {filtersCard}
        <ViewState status="loading" description="Sincronizando la cola abierta y sus estados operativos." />
      </div>
    );
  }

  if (queueQuery.isError && !queueQuery.data) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        {header}
        {filtersCard}
        <ViewState
          status="error"
          description={getErrorMessage(queueQuery.error, 'No se pudo cargar la bandeja operativa.')}
          action={
            <Button type="button" variant="outline" onClick={() => void refreshFromFirstPage()}>
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
      {header}
      {filtersCard}

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" aria-label="Consistencia de datos">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Lectura operativa viva, no snapshot historico</p>
            <p>
              Los casos con fecha de creacion quedan anclados al {formatTimestamp(firstPage?.as_of ?? null)}. Los casos
              sin fecha se incluyen al final como calidad desconocida. Estado, asignacion y SLA se leen en vivo en cada
              pagina y pueden cambiar durante la navegacion.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Inbox className="h-4 w-4" />
              Cargados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{items.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Registros recibidos en {pages.length} pagina{pages.length === 1 ? '' : 's'}.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <UserRound className="h-4 w-4" />
              Alcance aplicado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-semibold">
              {firstPage?.access_scope.mode === 'employee_categories' ? 'Categorias autorizadas' : 'Todo el tenant'}
            </p>
            {firstPage?.access_scope.mode === 'employee_categories' ? (
              <p className="mt-1 text-xs text-muted-foreground">{firstPage.access_scope.category_count} categorias en el alcance.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {items.length === 0 ? (
        <ViewState status="empty" description="No hay casos abiertos para los filtros actuales." />
      ) : (
        <section className="space-y-3" aria-label="Lista de casos abiertos">
          {items.map((item) => {
            const meta = getItemMeta(item);
            return (
              <article key={item.queue_id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{item.status}</Badge>
                      <Badge variant={item.sla.state === 'breached' ? 'destructive' : 'secondary'}>
                        {SLA_LABELS[item.sla.state]}
                      </Badge>
                      <Badge variant="secondary">{AGE_LABELS[item.age_bucket]}</Badge>
                    </div>
                    <h2 className="break-words text-base font-semibold leading-6">{item.title}</h2>
                    {meta ? <p className="text-sm text-muted-foreground">{meta}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_LABELS[item.source_model]} / ID {item.source_id}
                      {item.assignee_id ? ` / Asignado a ${item.assignee_id}` : ' / Sin asignar'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-3 text-left text-xs text-muted-foreground sm:items-end sm:text-right">
                    <div>
                      <p>Creado: {formatTimestamp(item.created_at)}</p>
                      {item.updated_at ? <p className="mt-1">Actualizado: {formatTimestamp(item.updated_at)}</p> : null}
                    </div>
                    <Button asChild size="sm">
                      <Link to={buildTicketWorkspaceHref(tenantSlug, item)}>
                        Abrir caso
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {queueQuery.isRefetchError ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="status">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
            <p className="text-sm text-amber-950">
              No se pudo actualizar la lectura viva. Se conservan los {items.length} registros previamente cargados.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => void refreshFromFirstPage()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar actualizacion
          </Button>
        </div>
      ) : null}

      {queueQuery.isFetchNextPageError ? (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm">No se pudo cargar la pagina siguiente. Los {items.length} registros ya cargados se conservan.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void queueQuery.fetchNextPage()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar pagina
          </Button>
        </div>
      ) : null}

      {queueQuery.hasNextPage && !queueQuery.isFetchNextPageError ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={queueQuery.isFetching}
            onClick={() => void queueQuery.fetchNextPage()}
          >
            {queueQuery.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            {queueQuery.isFetchingNextPage ? 'Cargando pagina' : 'Cargar mas'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
