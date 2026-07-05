import React from 'react';
import { cn } from '@/lib/utils';
import { pickFirstCoordinate } from '@/utils/location';
import { buildFullAddress } from '@/utils/ticketLocationAddress';
import type { TicketHistoryEvent } from '@/types/tickets';
import { ExternalLink, LocateFixed, MapPin, Navigation, RadioTower } from 'lucide-react';
import {
  ALLOWED_TICKET_STATUSES,
  AllowedTicketStatus,
  formatTicketStatusLabel,
  normalizeTicketStatus,
} from '@/utils/ticketStatus';
import { formatHistoryDate, pickHistoryDate } from '@/utils/ticketHistory';

export interface TicketLocation {
  latitud?: number | null;
  longitud?: number | null;
  lat_destino?: number | null;
  lon_destino?: number | null;
  lat_origen?: number | null;
  lon_origen?: number | null;
  lat_actual?: number | null;
  lon_actual?: number | null;
  direccion?: string | null;
  esquinas_cercanas?: string | null;
  distrito?: string | null;
  municipio_nombre?: string | null;
  tipo?: 'pyme' | 'municipio';
  origen_latitud?: number | null;
  origen_longitud?: number | null;
  municipio_latitud?: number | null;
  municipio_longitud?: number | null;
}

export { buildFullAddress };

const pickFirstNonEmptyString = (
  ...values: Array<string | null | undefined>
) => {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const trimmed = value.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

const formatCoordinatePair = (
  lat?: number,
  lon?: number,
): string | null => {
  if (
    typeof lat !== 'number' ||
    Number.isNaN(lat) ||
    typeof lon !== 'number' ||
    Number.isNaN(lon)
  ) {
    return null;
  }

  const latFixed = lat.toFixed(5);
  const lonFixed = lon.toFixed(5);
  return `${latFixed}, ${lonFixed}`;
};

type TimelineItem = {
  status: AllowedTicketStatus;
  label: string;
  timestamp: string | null;
};

type OverlayPoint = {
  x: number;
  y: number;
};

const ROUTE_ORIGIN_POINT: OverlayPoint = { x: 88, y: 188 };
const ROUTE_DESTINATION_POINT: OverlayPoint = { x: 286, y: 76 };
const SINGLE_DESTINATION_POINT: OverlayPoint = { x: 188, y: 122 };
const ROUTE_PATH = 'M88 188 C134 118 214 146 286 76';

const getMapsLink = (
  lat: number | undefined,
  lon: number | undefined,
  address: string,
) => {
  if (typeof lat === 'number' && typeof lon === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }

  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  return null;
};

const resolveLocationQuality = (
  hasCoords: boolean,
  hasAddress: boolean,
  hasRoute: boolean,
) => {
  if (hasRoute) {
    return {
      label: 'Ruta estimada',
      detail: 'Origen y destino disponibles',
      tone: 'text-emerald-100 border-emerald-300/30 bg-emerald-500/15',
    };
  }

  if (hasCoords) {
    return {
      label: 'GPS validado',
      detail: 'Coordenadas listas para operar',
      tone: 'text-cyan-100 border-cyan-300/30 bg-cyan-500/15',
    };
  }

  if (hasAddress) {
    return {
      label: 'Direccion detectada',
      detail: 'Pendiente de coordenadas precisas',
      tone: 'text-amber-100 border-amber-300/30 bg-amber-500/15',
    };
  }

  return {
    label: 'Sin ubicacion',
    detail: 'Esperando direccion o GPS',
    tone: 'text-slate-200 border-white/15 bg-slate-950/45',
  };
};

const TicketMapTelemetryOverlay = ({
  hasRoute,
}: {
  hasRoute: boolean;
}) => {
  const reactId = React.useId();
  const svgId = reactId.replace(/:/g, '');
  const gridId = `${svgId}-ticket-map-grid`;
  const radarId = `${svgId}-ticket-map-radar`;
  const routeId = `${svgId}-ticket-map-route`;
  const destinationPoint = hasRoute
    ? ROUTE_DESTINATION_POINT
    : SINGLE_DESTINATION_POINT;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-testid="ticket-map-telemetry"
    >
      <svg
        className="h-full w-full opacity-95 mix-blend-screen"
        viewBox="0 0 360 240"
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={gridId} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="rgba(125, 211, 252, 0.18)" strokeWidth="1" />
          </pattern>
          <radialGradient id={radarId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(250, 204, 21, 0.26)" />
            <stop offset="55%" stopColor="rgba(34, 211, 238, 0.12)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
          </radialGradient>
          <linearGradient id={routeId} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="48%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
        </defs>
        <rect width="360" height="240" fill="rgba(2, 6, 23, 0.16)" />
        <rect width="360" height="240" fill={`url(#${gridId})`} opacity="0.58" />
        {hasRoute ? (
          <g data-testid="ticket-map-route-overlay">
            <path
              d={ROUTE_PATH}
              fill="none"
              stroke={`url(#${routeId})`}
              strokeDasharray="6 10"
              strokeLinecap="round"
              strokeWidth="2.4"
              opacity="0.9"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-96" dur="4.8s" repeatCount="indefinite" />
            </path>
            <circle r="4.8" fill="#facc15">
              <animateMotion dur="4.8s" repeatCount="indefinite" path={ROUTE_PATH} />
            </circle>
            <circle cx={ROUTE_ORIGIN_POINT.x} cy={ROUTE_ORIGIN_POINT.y} r="8" fill="#020617" stroke="#38bdf8" strokeWidth="2" />
          </g>
        ) : null}
        <g transform={`translate(${destinationPoint.x} ${destinationPoint.y})`}>
          <circle r="54" fill={`url(#${radarId})`} opacity="0.82" />
          <path d="M0 0 L54 -8 A54 54 0 0 1 54 8 Z" fill="rgba(34, 211, 238, 0.23)">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />
          </path>
          <circle r="28" fill="none" stroke="#fde68a" strokeWidth="1.2" opacity="0.72">
            <animate attributeName="r" values="18;44;18" dur="4.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.22;0.78;0.22" dur="4.5s" repeatCount="indefinite" />
          </circle>
          <path d="M-44 0H-18M18 0H44M0 -44V-18M0 18V44" stroke="#f8fafc" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
          <circle r="7" fill="#020617" stroke="#facc15" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
};

interface TicketMapProps {
  ticket: TicketLocation;
  className?: string;
  hideTitle?: boolean;
  title?: React.ReactNode;
  heightClassName?: string;
  showAddressHint?: boolean;
  showOverlay?: boolean;
  status?: string | null;
  history?: TicketHistoryEvent[] | null;
  estimatedTime?: string | null;
  createdAtLabel?: string | null;
  lastUpdatedLabel?: string | null;
  currentStatusLabel?: string | null;
}

const TicketMap: React.FC<TicketMapProps> = ({
  ticket,
  className,
  hideTitle = false,
  title = 'Ubicacion aproximada',
  heightClassName,
  showAddressHint = true,
  showOverlay = true,
  status,
  history,
  estimatedTime,
  createdAtLabel,
  lastUpdatedLabel,
  currentStatusLabel,
}) => {
  const direccionCompleta = buildFullAddress(ticket);
  const destLat = pickFirstCoordinate(ticket.lat_destino, ticket.latitud);
  const destLon = pickFirstCoordinate(ticket.lon_destino, ticket.longitud);
  const hasCoords =
    typeof destLat === 'number' && typeof destLon === 'number';
  const originLat = pickFirstCoordinate(
    ticket.lat_actual,
    ticket.lat_origen,
    ticket.origen_latitud,
    ticket.municipio_latitud,
  );
  const originLon = pickFirstCoordinate(
    ticket.lon_actual,
    ticket.lon_origen,
    ticket.origen_longitud,
    ticket.municipio_longitud,
  );
  const hasOrigin =
    typeof originLat === 'number' && typeof originLon === 'number';
  const hasRoute = hasCoords && hasOrigin;
  const mapsLink = getMapsLink(destLat, destLon, direccionCompleta);
  const locationQuality = resolveLocationQuality(
    hasCoords,
    Boolean(direccionCompleta),
    hasRoute,
  );

  // Primary map is Google Maps; fallback to OpenStreetMap if it fails
  const googleSrc = hasRoute
    ? `https://maps.google.com/maps?f=d&source=s_d&saddr=${originLat},${originLon}&daddr=${destLat},${destLon}&output=embed`
    : hasCoords
      ? `https://maps.google.com/maps?q=${destLat},${destLon}&z=15&output=embed`
      : direccionCompleta
        ? `https://maps.google.com/maps?q=${encodeURIComponent(direccionCompleta)}&z=15&output=embed`
        : '';
  const osmSrc = hasRoute
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${originLat},${originLon};${destLat},${destLon}`
    : hasCoords
      ? `https://www.openstreetmap.org/export/embed.html?mlat=${destLat}&mlon=${destLon}&marker=${destLat},${destLon}&zoom=15&layer=mapnik`
      : direccionCompleta
        ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(direccionCompleta)}`
        : '';

  const initialSrc = React.useMemo(
    () => googleSrc || osmSrc || '',
    [googleSrc, osmSrc],
  );
  const [src, setSrc] = React.useState(initialSrc);

  const originCoordinatesLabel = React.useMemo(
    () => formatCoordinatePair(originLat, originLon),
    [originLat, originLon],
  );

  const destinationCoordinatesLabel = React.useMemo(
    () => formatCoordinatePair(destLat, destLon),
    [destLat, destLon],
  );

  const originLabel = React.useMemo(() => {
    const candidate = pickFirstNonEmptyString(ticket.municipio_nombre);
    if (candidate) {
      return candidate;
    }

    if (originCoordinatesLabel) {
      return originCoordinatesLabel;
    }

    return '—';
  }, [ticket.municipio_nombre, originCoordinatesLabel]);

  const destinationLabel = React.useMemo(() => {
    if (direccionCompleta) {
      return direccionCompleta;
    }

    if (destinationCoordinatesLabel) {
      return destinationCoordinatesLabel;
    }

    return '—';
  }, [direccionCompleta, destinationCoordinatesLabel]);

  const historyTimeline = React.useMemo(() => {
    if (!Array.isArray(history)) {
      return [] as TimelineItem[];
    }

    return history
      .map((entry) => {
        const normalized = normalizeTicketStatus(entry?.status);
        if (!normalized) {
          return null;
        }

        const timestamp = formatHistoryDate(pickHistoryDate(entry));

        const timelineItem: TimelineItem = {
          status: normalized,
          label: formatTicketStatusLabel(normalized),
          timestamp,
        };

        return timelineItem;
      })
      .filter((item): item is TimelineItem => Boolean(item));
  }, [history]);

  const historyStatuses = React.useMemo(
    () => historyTimeline.map((item) => item.status),
    [historyTimeline],
  );

  const highestHistoryIndex = React.useMemo(
    () =>
      historyStatuses.reduce((acc, value) => {
        const idx = ALLOWED_TICKET_STATUSES.indexOf(value);
        return idx > acc ? idx : acc;
      }, -1),
    [historyStatuses],
  );

  const currentStatusNormalized = React.useMemo(() => {
    const normalized = normalizeTicketStatus(status);
    if (normalized) {
      return normalized;
    }

    return historyStatuses[historyStatuses.length - 1] ?? null;
  }, [status, historyStatuses]);

  const effectiveIndex = React.useMemo(() => {
    if (!currentStatusNormalized) {
      return -1;
    }

    return ALLOWED_TICKET_STATUSES.indexOf(currentStatusNormalized);
  }, [currentStatusNormalized]);

  const resolvedIndex =
    effectiveIndex === -1 ? highestHistoryIndex : effectiveIndex;

  const progressPercentage = React.useMemo(() => {
    if (resolvedIndex < 0) {
      return 0;
    }

    if (ALLOWED_TICKET_STATUSES.length <= 1) {
      return 100;
    }

    const raw =
      (resolvedIndex / (ALLOWED_TICKET_STATUSES.length - 1)) * 100;
    return Math.min(100, Math.max(0, raw));
  }, [resolvedIndex]);

  const resolvedStatusLabel = React.useMemo(() => {
    if (currentStatusLabel) {
      return currentStatusLabel;
    }

    if (currentStatusNormalized) {
      return formatTicketStatusLabel(currentStatusNormalized);
    }

    return null;
  }, [currentStatusLabel, currentStatusNormalized]);

  const statusTimeline = React.useMemo(() => {
    const seen = new Set<AllowedTicketStatus>();
    const timeline: TimelineItem[] = [];

    historyTimeline.forEach((item) => {
      if (seen.has(item.status)) {
        return;
      }
      seen.add(item.status);
      timeline.push(item);
    });

    if (currentStatusNormalized && !seen.has(currentStatusNormalized)) {
      timeline.push({
        status: currentStatusNormalized,
        label: formatTicketStatusLabel(currentStatusNormalized),
        timestamp: null,
      });
    }

    return timeline;
  }, [historyTimeline, currentStatusNormalized]);

  React.useEffect(() => {
    setSrc(initialSrc);
  }, [initialSrc]);

  if (!src) return null;

  const heightClasses = heightClassName ?? 'h-[150px] sm:h-[180px]';

  return (
    <div className={cn('mb-6', className)} data-testid="ticket-map">
      {!hideTitle && title && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="font-semibold">{title}</h4>
          {mapsLink ? (
            <a
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
              href={mapsLink}
              target="_blank"
              rel="noreferrer"
            >
              Abrir mapa
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      )}
      <div className={cn('relative w-full overflow-hidden rounded-xl border border-border/70 bg-slate-950 shadow-sm', heightClasses)}>
        <iframe
          className="absolute inset-0 h-full w-full"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          title={
            typeof title === 'string' ? title : 'Mapa del reclamo'
          }
          src={src}
          onError={() => {
            if (src !== osmSrc) {
              setSrc(osmSrc);
            }
          }}
        />
        {showOverlay ? <TicketMapTelemetryOverlay hasRoute={hasRoute} /> : null}
        {showOverlay && (
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="pointer-events-auto rounded-xl border border-white/15 bg-slate-950/82 p-3 text-xs text-slate-100 shadow-md backdrop-blur-sm sm:text-sm">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-300">
                  <Navigation className="h-3 w-3" aria-hidden="true" />
                  Origen
                </div>
                <p className="font-semibold text-white">{originLabel}</p>
                {originCoordinatesLabel && (
                  <p className="text-[11px] text-slate-300">
                    {originCoordinatesLabel}
                  </p>
                )}
              </div>
              <div className="pointer-events-auto rounded-xl border border-white/15 bg-slate-950/82 p-3 text-xs text-slate-100 shadow-md backdrop-blur-sm sm:text-sm">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-300">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  Destino
                </div>
                <p className="font-semibold text-white">
                  {destinationLabel}
                </p>
                {destinationCoordinatesLabel && (
                  <p className="text-[11px] text-slate-300">
                    {destinationCoordinatesLabel}
                  </p>
                )}
              </div>
            </div>
            <div
              className="pointer-events-auto rounded-2xl border border-white/15 bg-slate-950/88 p-3 text-[11px] text-slate-300 shadow-lg backdrop-blur-sm sm:text-xs"
              data-testid="ticket-map-operational-panel"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold', locationQuality.tone)}>
                  <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
                  {locationQuality.label}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-slate-200">
                  <RadioTower className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
                  {locationQuality.detail}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                <span className="font-semibold text-white">
                  Seguimiento del reclamo
                </span>
                {resolvedStatusLabel && (
                  <span className="text-white">{resolvedStatusLabel}</span>
                )}
                {estimatedTime && (
                  <span>
                    ETA{' '}
                    <span className="text-white">{estimatedTime}</span>
                  </span>
                )}
              </div>
              <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
                {ALLOWED_TICKET_STATUSES.map((step, idx) => {
                  const position =
                    ALLOWED_TICKET_STATUSES.length > 1
                      ? (idx / (ALLOWED_TICKET_STATUSES.length - 1)) * 100
                      : 0;
                  const completed = idx <= effectiveIndex && effectiveIndex >= 0;
                  return (
                    <div
                      key={step}
                      className={cn(
                        'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-colors',
                        completed ? 'bg-emerald-300 shadow-sm' : 'bg-slate-500/80',
                      )}
                      style={{ left: `${position}%` }}
                    />
                  );
                })}
                <div
                  className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 bg-amber-300 text-slate-950 shadow-lg transition-all duration-500 ease-out"
                  style={{ left: `${progressPercentage}%` }}
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {statusTimeline.map((item) => (
                  <div
                    key={item.status}
                    className="rounded-xl border border-white/10 bg-white/[0.055] px-2 py-2"
                  >
                    <p className="text-xs font-semibold text-white sm:text-sm">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      {item.timestamp || '—'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                {createdAtLabel && (
                  <span>
                    Creado:{' '}
                    <span className="text-white">{createdAtLabel}</span>
                  </span>
                )}
                {lastUpdatedLabel && (
                  <span>
                    Actualizado:{' '}
                    <span className="text-white">{lastUpdatedLabel}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {direccionCompleta && showAddressHint && (
        <div className="text-xs mt-1 text-muted-foreground truncate">
          {direccionCompleta}
        </div>
      )}
    </div>
  );
};

export default TicketMap;
