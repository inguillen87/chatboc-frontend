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
}

const TicketMap: React.FC<TicketMapProps> = ({
  ticket,
  className,
  hideTitle = false,
  title = 'Ubicación aproximada',
  heightClassName,
  showAddressHint = true,
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

  const [src, setSrc] = React.useState(googleSrc || osmSrc);

  if (!src) return null;

  const heightClasses = heightClassName ?? 'h-[150px] sm:h-[180px]';

  return (
    <div className={cn('mb-6', className)}>
      {!hideTitle && title && (
        <h4 className="font-semibold mb-2">{title}</h4>
      )}
      <div className={cn('w-full rounded overflow-hidden', heightClasses)}>
        <iframe
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          src={src}
          onError={() => {
            if (src !== osmSrc) {
              setSrc(osmSrc);
            }
          }}
        />
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