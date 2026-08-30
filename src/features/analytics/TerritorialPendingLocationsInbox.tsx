import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  DatabaseZap,
  ExternalLink,
  Filter,
  LocateFixed,
  Map as MapIcon,
  MapPinOff,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/api';

import { getOperationsHeatmapV2 } from './analyticsApi';
import {
  adaptPendingLocationQueue,
  normalizeTerritorialFilter,
  type PendingLocationAction,
  type PendingLocationCandidate,
} from './territorialPendingLocations';

interface TerritorialPendingLocationsInboxProps {
  tenantSlug?: string | null;
  initialFacet?: string | null;
  initialZone?: string | null;
  embedded?: boolean;
}

const statusLabel = (status: string | null) => {
  const normalized = normalizeTerritorialFilter(status);
  if (normalized === 'ready') return 'Lista para revisar';
  if (normalized === 'pending' || normalized === 'queued') return 'Pendiente';
  if (normalized === 'degraded' || normalized === 'partial') return 'Cobertura parcial';
  return status ? status.replace(/[_-]+/g, ' ') : 'Estado no publicado';
};

const actionControl = (action: PendingLocationAction) => {
  const Icon = action.kind === 'approve' ? Check : action.kind === 'reject' ? X : ShieldCheck;
  const variant = action.kind === 'reject' ? 'outline' : action.kind === 'approve' ? 'default' : 'secondary';
  if (action.enabled && action.href) {
    return (
      <Button key={action.kind} asChild size="sm" variant={variant} className="justify-start gap-2">
        <a href={action.href} title={action.reason}>
          <Icon className="h-4 w-4" />
          {action.label}
        </a>
      </Button>
    );
  }
  return (
    <Button key={action.kind} type="button" size="sm" variant={variant} className="justify-start gap-2" disabled title={action.reason}>
      <Icon className="h-4 w-4" />
      {action.label}
    </Button>
  );
};

const PendingLocationDetail = ({ candidate }: { candidate: PendingLocationCandidate | null }) => {
  if (!candidate) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/15 p-6 text-center">
        <LocateFixed className="h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 text-base font-semibold">Seleccioná un caso pendiente</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          La revisión muestra sólo contexto territorial seguro. El domicilio completo permanece protegido en el ticket.
        </p>
      </div>
    );
  }

  return (
    <article aria-labelledby="pending-location-detail-title" className="min-w-0 rounded-xl border bg-background shadow-sm">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Revisión territorial</p>
          <h3 id="pending-location-detail-title" className="mt-1 truncate text-lg font-semibold">
            {candidate.ticketId ? `Reclamo #${candidate.ticketId}` : 'Registro sin ticket publicado'}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{candidate.category}</Badge>
            <Badge variant="outline">{candidate.source}</Badge>
          </div>
        </div>
        {candidate.ticketHref ? (
          <Button asChild size="sm" className="shrink-0 gap-2">
            <a href={candidate.ticketHref}>
              <Ticket className="h-4 w-4" />
              Abrir ticket
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" disabled title="El contrato no publicó la identidad del ticket">
            Abrir ticket
          </Button>
        )}
      </header>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <section className="rounded-lg border bg-muted/15 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <MapPinOff className="h-4 w-4 text-amber-600" />
            Referencia agregada
          </div>
          <p className="mt-2 text-base font-semibold">{candidate.safeAreaLabel}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Domicilio exacto oculto en esta vista para proteger a la persona denunciante.
          </p>
        </section>
        <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Razón de calidad
          </div>
          <p className="mt-2 text-sm font-semibold">{candidate.qualityLabel}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{candidate.qualityDetail}</p>
        </section>
      </div>

      <section className="border-t p-4" aria-labelledby="pending-location-actions-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 id="pending-location-actions-title" className="text-sm font-semibold">Decisión guiada</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Las decisiones sólo se habilitan cuando el backend publica una ruta segura y auditable.
            </p>
          </div>
          <Badge variant="outline" className="w-fit">Sin escritura implícita</Badge>
        </div>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {(['review', 'approve', 'reject'] as const).map((kind, index) => {
            const action = candidate.actions[kind];
            return (
              <li key={kind} className="rounded-lg border bg-muted/10 p-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold">{action.label}</span>
                </div>
                <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{action.reason}</p>
                <div className="mt-2">{actionControl(action)}</div>
              </li>
            );
          })}
        </ol>
      </section>
    </article>
  );
};

export function TerritorialPendingLocationsInbox({
  tenantSlug,
  initialFacet,
  initialZone,
  embedded = false,
}: TerritorialPendingLocationsInboxProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(() => normalizeTerritorialFilter(initialFacet));
  const [zoneFilter, setZoneFilter] = useState(() => normalizeTerritorialFilter(initialZone));
  const [qualityFilter, setQualityFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => setCategoryFilter(normalizeTerritorialFilter(initialFacet)), [initialFacet]);
  useEffect(() => setZoneFilter(normalizeTerritorialFilter(initialZone)), [initialZone]);

  const query = useQuery({
    queryKey: ['territorial-pending-locations', tenantSlug],
    queryFn: () => getOperationsHeatmapV2({ tenantSlug, scope: 'municipio', range: '30d', include_ai: 0, limit: 100 }),
    enabled: Boolean(tenantSlug),
    retry: 0,
    staleTime: 30_000,
  });
  const queue = useMemo(() => adaptPendingLocationQueue(query.data, tenantSlug), [query.data, tenantSlug]);
  const normalizedSearch = normalizeTerritorialFilter(search);

  const categories = useMemo(() => {
    const values = new Map<string, string>();
    queue.candidates.forEach((candidate) => values.set(normalizeTerritorialFilter(candidate.category), candidate.category));
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));
  }, [queue.candidates]);
  const areas = useMemo(() => {
    const values = new Map<string, string>();
    queue.candidates.forEach((candidate) => values.set(normalizeTerritorialFilter(candidate.safeAreaLabel), candidate.safeAreaLabel));
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));
  }, [queue.candidates]);
  const qualityReasons = useMemo(() => {
    const values = new Map<string, string>();
    queue.candidates.forEach((candidate) => values.set(candidate.qualityCode, candidate.qualityLabel));
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es-AR'));
  }, [queue.candidates]);

  const visibleCandidates = useMemo(
    () => queue.candidates.filter((candidate) => {
      const matchesCategory = !categoryFilter || normalizeTerritorialFilter(candidate.category) === categoryFilter;
      const matchesQuality = !qualityFilter || candidate.qualityCode === qualityFilter;
      const matchesZone = !zoneFilter || normalizeTerritorialFilter(candidate.safeAreaLabel).includes(zoneFilter);
      const haystack = normalizeTerritorialFilter([
        candidate.ticketId,
        candidate.category,
        candidate.safeAreaLabel,
        candidate.qualityLabel,
      ].filter(Boolean).join(' '));
      return matchesCategory && matchesQuality && matchesZone && (!normalizedSearch || haystack.includes(normalizedSearch));
    }),
    [categoryFilter, normalizedSearch, qualityFilter, queue.candidates, zoneFilter],
  );
  const selectedCandidate = visibleCandidates.find((candidate) => candidate.id === selectedId) ?? visibleCandidates[0] ?? null;

  const normalInboxHref = tenantSlug
    ? `/perfil?tab=tickets&tenant_slug=${encodeURIComponent(tenantSlug)}&tenant=${encodeURIComponent(tenantSlug)}`
    : '/perfil?tab=tickets';
  const mapHref = tenantSlug
    ? `/perfil?tab=mapas&tenant_slug=${encodeURIComponent(tenantSlug)}&tenant=${encodeURIComponent(tenantSlug)}`
    : '/perfil?tab=mapas';

  return (
    <section
      data-testid="territorial-pending-locations-inbox"
      className={cn(
        'flex min-h-[560px] w-full flex-col overflow-hidden border border-border/70 bg-card/95',
        embedded ? 'rounded-none border-x-0 border-b-0' : 'rounded-xl shadow-xl',
      )}
      aria-labelledby="territorial-pending-locations-title"
    >
      <header className="flex flex-col gap-3 border-b bg-[linear-gradient(110deg,hsl(var(--background)),hsl(var(--primary)/0.07))] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <DatabaseZap className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">CRM territorial</p>
            <h2 id="territorial-pending-locations-title" className="truncate text-xl font-semibold">Ubicaciones pendientes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Revisá calidad territorial sin exponer domicilios en la bandeja agregada.</p>
          </div>
        </div>
        <nav aria-label="Navegación de ubicaciones pendientes" className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="gap-2">
            <a href={normalInboxHref}><ArrowLeft className="h-4 w-4" /> Reclamos</a>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-2">
            <a href={mapHref}><MapIcon className="h-4 w-4" /> Volver al mapa</a>
          </Button>
          <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={cn('h-4 w-4', query.isFetching && 'animate-spin')} /> Actualizar
          </Button>
        </nav>
      </header>

      {query.isLoading ? (
        <div role="status" className="flex min-h-[420px] flex-col items-center justify-center p-6 text-center">
          <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 font-semibold">Recuperando contrato territorial</p>
          <p className="mt-1 text-sm text-muted-foreground">La bandeja no crea filas hasta recibir candidatos verificables.</p>
        </div>
      ) : query.isError ? (
        <div role="alert" className="m-4 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <h3 className="mt-3 text-base font-semibold">No pudimos cargar ubicaciones pendientes</h3>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{getErrorMessage(query.error)}</p>
          <Button type="button" size="sm" className="mt-4 gap-2" onClick={() => void query.refetch()}>
            <RefreshCw className="h-4 w-4" /> Reintentar
          </Button>
        </div>
      ) : queue.state === 'unavailable' || queue.state === 'summary_only' ? (
        <div role="status" className="m-4 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <MapPinOff className="h-8 w-8 text-amber-700 dark:text-amber-300" />
          <h3 className="mt-3 text-base font-semibold">
            {queue.state === 'summary_only' ? 'Hay pendientes, pero falta el detalle seguro' : 'El backend no publicó esta bandeja'}
          </h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
            {queue.state === 'summary_only'
              ? `El contrato informa ${queue.total} ubicaciones pendientes, pero no entregó candidatos identificables. No se inventan filas ni domicilios.`
              : 'La vista territorial sigue disponible, pero todavía no existe un contrato de candidatos para operar desde CRM.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm" variant="outline"><a href={mapHref}>Volver al mapa</a></Button>
            <Button type="button" size="sm" onClick={() => void query.refetch()}>Reintentar contrato</Button>
          </div>
        </div>
      ) : queue.state === 'empty' ? (
        <div role="status" className="m-4 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
          <Check className="h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 text-base font-semibold">No hay ubicaciones pendientes</h3>
          <p className="mt-1 text-sm text-muted-foreground">El contrato territorial no informó casos para revisar con los filtros actuales.</p>
          <Button asChild size="sm" variant="outline" className="mt-4"><a href={mapHref}>Ver cobertura territorial</a></Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b bg-muted/15 px-4 py-2 text-xs" role="status" aria-live="polite">
            <Badge variant="secondary">{queue.total} informadas</Badge>
            <Badge variant="outline">{queue.published} con detalle seguro</Badge>
            {queue.hidden ? <Badge variant="outline">{queue.hidden} sin detalle publicado</Badge> : null}
            <span className="text-muted-foreground">{statusLabel(queue.status)}</span>
            <span className="ml-auto text-muted-foreground">Decisiones de escritura: {queue.writesEnabled ? 'publicadas' : 'no publicadas'}</span>
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)]">
            <aside className="min-h-0 border-b bg-muted/10 lg:border-b-0 lg:border-r" aria-label="Cola de ubicaciones pendientes">
              <div className="border-b p-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><Filter className="h-4 w-4 text-primary" /> Filtros de revisión</div>
                <label className="relative mt-3 block">
                  <span className="sr-only">Buscar caso pendiente</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar ticket, categoría o corredor"
                    className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <label className="text-xs font-medium">
                    Categoría
                    <select
                      aria-label="Filtrar pendientes por categoría"
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="">Todas</option>
                      {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Área agregada
                    <select
                      aria-label="Filtrar pendientes por área agregada"
                      value={zoneFilter}
                      onChange={(event) => setZoneFilter(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="">Todas</option>
                      {zoneFilter && !areas.some(([value]) => value === zoneFilter) ? (
                        <option value={zoneFilter}>{initialZone?.trim() || zoneFilter}</option>
                      ) : null}
                      {areas.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium">
                    Calidad
                    <select
                      aria-label="Filtrar pendientes por calidad"
                      value={qualityFilter}
                      onChange={(event) => setQualityFilter(event.target.value)}
                      className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="">Todas</option>
                      {qualityReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto p-2" role="list" aria-label={`${visibleCandidates.length} ubicaciones visibles`}>
                {visibleCandidates.length ? visibleCandidates.map((candidate) => {
                  const active = selectedCandidate?.id === candidate.id;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      role="listitem"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => setSelectedId(candidate.id)}
                      className={cn(
                        'mb-2 w-full rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                        active ? 'border-primary bg-primary/5 shadow-sm' : 'bg-background hover:border-primary/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{candidate.ticketId ? `Reclamo #${candidate.ticketId}` : 'Registro territorial'}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{candidate.safeAreaLabel}</p>
                        </div>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="max-w-full truncate">{candidate.category}</Badge>
                        <Badge variant="outline" className="max-w-full truncate">{candidate.qualityLabel}</Badge>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-lg border border-dashed p-5 text-center">
                    <p className="text-sm font-semibold">Sin coincidencias</p>
                    <p className="mt-1 text-xs text-muted-foreground">Ajustá búsqueda, categoría o calidad.</p>
                    <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => { setSearch(''); setCategoryFilter(''); setZoneFilter(''); setQualityFilter(''); }}>
                      Limpiar filtros
                    </Button>
                  </div>
                )}
              </div>
            </aside>

            <main className="min-w-0 overflow-y-auto p-3 sm:p-4">
              <PendingLocationDetail candidate={selectedCandidate} />
            </main>
          </div>
        </>
      )}
    </section>
  );
}

export default TerritorialPendingLocationsInbox;
