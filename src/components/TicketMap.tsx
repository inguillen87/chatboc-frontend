import React from 'react';
import { cn } from '@/lib/utils';
import { pickFirstCoordinate } from '@/utils/location';
import type { TicketHistoryEvent } from '@/types/tickets';
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

export const buildFullAddress = (ticket: TicketLocation) => {
  const parts: string[] = [];
  const addPart = (value?: string | null) => {
    if (typeof value !== 'string') {
      return;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    parts.push(trimmed);
  };

  addPart(ticket.direccion);
  addPart(ticket.esquinas_cercanas);
  addPart(ticket.distrito);

  const municipioNombre =
    typeof ticket.municipio_nombre === 'string'
      ? ticket.municipio_nombre.trim()
      : '';

  if (
    ticket.tipo !== 'pyme' &&
    municipioNombre &&
    !parts.some((part) =>
      part.toLowerCase().includes(municipioNombre.toLowerCase()),
    )
  ) {
    parts.push(municipioNombre);
  }

  return parts.join(', ');
};

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

interface TicketMapProps {
  ticket: TicketLocation;
  className?: string;
  hideTitle?: boolean;
  title?: React.ReactNode;
  heightClassName?: string;
  showAddressHint?: boolean;
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
  title = 'Ubicación aproximada',
  heightClassName,
  showAddressHint = true,
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
    <div className={cn('mb-6', className)}>
      {!hideTitle && title && (
        <h4 className="font-semibold mb-2">{title}</h4>
      )}
      <div className={cn('relative w-full overflow-hidden rounded', heightClasses)}>
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
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="pointer-events-auto rounded-lg bg-background/80 p-3 text-xs shadow-md backdrop-blur-sm sm:text-sm">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Origen
              </p>
              <p className="font-semibold text-foreground">{originLabel}</p>
              {originCoordinatesLabel && (
                <p className="text-[11px] text-muted-foreground">
                  {originCoordinatesLabel}
                </p>
              )}
            </div>
            <div className="pointer-events-auto rounded-lg bg-background/80 p-3 text-xs shadow-md backdrop-blur-sm sm:text-sm">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Destino
              </p>
              <p className="font-semibold text-foreground">
                {destinationLabel}
              </p>
              {destinationCoordinatesLabel && (
                <p className="text-[11px] text-muted-foreground">
                  {destinationCoordinatesLabel}
                </p>
              )}
            </div>
          </div>
          <div className="pointer-events-auto rounded-xl bg-background/85 p-3 text-[11px] shadow-lg backdrop-blur-sm sm:text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
              <span className="font-semibold text-foreground">
                Seguimiento del reclamo
              </span>
              {resolvedStatusLabel && (
                <span className="text-foreground">{resolvedStatusLabel}</span>
              )}
              {estimatedTime && (
                <span>
                  ETA{' '}
                  <span className="text-foreground">{estimatedTime}</span>
                </span>
              )}
            </div>
            <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ease-out"
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
                      completed ? 'bg-primary shadow-sm' : 'bg-muted/80',
                    )}
                    style={{ left: `${position}%` }}
                  />
                );
              })}
              <div
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg transition-all duration-500 ease-out"
                style={{ left: `${progressPercentage}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {statusTimeline.map((item) => (
                <div
                  key={item.status}
                  className="rounded-lg bg-muted/40 px-2 py-2"
                >
                  <p className="text-xs font-semibold text-foreground sm:text-sm">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.timestamp || '—'}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              {createdAtLabel && (
                <span>
                  Creado:{' '}
                  <span className="text-foreground">{createdAtLabel}</span>
                </span>
              )}
              {lastUpdatedLabel && (
                <span>
                  Actualizado:{' '}
                  <span className="text-foreground">{lastUpdatedLabel}</span>
                </span>
              )}
            </div>
          </div>
        </div>
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
