import React from 'react';
import { cn } from '@/lib/utils';
import { pickFirstCoordinate } from '@/utils/location';

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

  React.useEffect(() => {
    setSrc(initialSrc);
  }, [initialSrc]);

  React.useEffect(() => {
    setSrc(googleSrc || osmSrc);
  }, [googleSrc, osmSrc]);

  const historyEntries = React.useMemo(
    () => (Array.isArray(history) ? history : []),
    [history],
  );

  const historyStatuses = React.useMemo(
    () =>
      historyEntries
        .map((entry) => normalizeTicketStatus(entry?.status))
        .filter(
          (value): value is AllowedTicketStatus => Boolean(value),
        ),
    [historyEntries],
  );

  const highestHistoryIndex = React.useMemo(() => {
    let highest = -1;
    historyStatuses.forEach((value) => {
      const idx = ALLOWED_TICKET_STATUSES.indexOf(value);
      if (idx > highest) {
        highest = idx;
      }
    });
    return highest;
  }, [historyStatuses]);

  const normalizedStatus = React.useMemo(
    () => normalizeTicketStatus(status),
    [status],
  );

  const resolvedIndex = React.useMemo(() => {
    if (
      normalizedStatus &&
      ALLOWED_TICKET_STATUSES.includes(normalizedStatus)
    ) {
      return ALLOWED_TICKET_STATUSES.indexOf(normalizedStatus);
    }
    return -1;
  }, [normalizedStatus]);

  const effectiveIndex =
    resolvedIndex !== -1 ? resolvedIndex : highestHistoryIndex;

  const resolvedStatus: AllowedTicketStatus | null =
    resolvedIndex !== -1
      ? ALLOWED_TICKET_STATUSES[resolvedIndex]
      : highestHistoryIndex >= 0
        ? ALLOWED_TICKET_STATUSES[highestHistoryIndex]
        : null;

  const progressFraction =
    ALLOWED_TICKET_STATUSES.length > 1 && effectiveIndex >= 0
      ? effectiveIndex / (ALLOWED_TICKET_STATUSES.length - 1)
      : 0;

  const progressPercentage = Math.max(
    0,
    Math.min(100, progressFraction * 100),
  );

  const dispatchedStatusRef = React.useRef<AllowedTicketStatus | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !resolvedStatus) {
      return;
    }

    if (dispatchedStatusRef.current === resolvedStatus) {
      return;
    }

    dispatchedStatusRef.current = resolvedStatus;
    window.dispatchEvent(
      new CustomEvent<AllowedTicketStatus>('route-status', {
        detail: resolvedStatus,
      }),
    );
  }, [resolvedStatus]);

  const statusTimestamps = React.useMemo(() => {
    const map = new Map<AllowedTicketStatus, string | null>();

    historyEntries.forEach((entry) => {
      const normalized = normalizeTicketStatus(entry?.status);
      if (!normalized || map.has(normalized)) {
        return;
      }

      const formatted = formatHistoryDate(pickHistoryDate(entry));
      if (formatted) {
        map.set(normalized, formatted);
      }
    });

    if (createdAtLabel && !map.has('nuevo')) {
      map.set('nuevo', createdAtLabel);
    }

    if (lastUpdatedLabel && resolvedStatus && !map.has(resolvedStatus)) {
      map.set(resolvedStatus, lastUpdatedLabel);
    }

    return map;
  }, [historyEntries, createdAtLabel, lastUpdatedLabel, resolvedStatus]);

  const statusTimeline = React.useMemo(
    () =>
      ALLOWED_TICKET_STATUSES.map((step) => ({
        status: step,
        label: formatTicketStatusLabel(step),
        timestamp: statusTimestamps.get(step) ?? null,
      })),
    [statusTimestamps],
  );

  const resolvedStatusLabel = React.useMemo(() => {
    if (currentStatusLabel) {
      return currentStatusLabel;
    }

    if (resolvedStatus) {
      return formatTicketStatusLabel(resolvedStatus);
    }

    return null;
  }, [currentStatusLabel, resolvedStatus]);

  const formatCoordinatePair = (
    lat?: number | null,
    lon?: number | null,
  ): string | null => {
    if (
      typeof lat === 'number' &&
      Number.isFinite(lat) &&
      typeof lon === 'number' &&
      Number.isFinite(lon)
    ) {
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
    return null;
  };

  const originCoordinatesLabel = formatCoordinatePair(originLat, originLon);
  const destinationCoordinatesLabel = formatCoordinatePair(destLat, destLon);
  const originLabel = ticket.municipio_nombre?.trim() || 'Origen';
  const destinationLabel =
    ticket.direccion?.trim() ||
    ticket.esquinas_cercanas?.trim() ||
    direccionCompleta ||
    'Destino';

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
