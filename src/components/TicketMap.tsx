import React from 'react';

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
  if (ticket.direccion) parts.push(ticket.direccion);
  if (ticket.esquinas_cercanas) parts.push(ticket.esquinas_cercanas);
  if (ticket.distrito) parts.push(ticket.distrito);
  if (
    ticket.tipo !== 'pyme' &&
    ticket.municipio_nombre &&
    !parts.some(p =>
      p.toLowerCase().includes(ticket.municipio_nombre!.toLowerCase())
    )
  ) {
    parts.push(ticket.municipio_nombre);
  }
  return parts.join(', ');
};

const TicketMap: React.FC<{ ticket: TicketLocation }> = ({ ticket }) => {
  const direccionCompleta = buildFullAddress(ticket);
  const destLat =
    typeof ticket.lat_destino === 'number'
      ? ticket.lat_destino
      : typeof ticket.latitud === 'number'
        ? ticket.latitud
        : undefined;
  const destLon =
    typeof ticket.lon_destino === 'number'
      ? ticket.lon_destino
      : typeof ticket.longitud === 'number'
        ? ticket.longitud
        : undefined;
  const hasCoords =
    typeof destLat === 'number' &&
    typeof destLon === 'number' &&
    (destLat !== 0 || destLon !== 0);
  const originLat =
    typeof ticket.lat_actual === 'number' && ticket.lat_actual !== 0
      ? ticket.lat_actual
      : typeof ticket.lat_origen === 'number' && ticket.lat_origen !== 0
        ? ticket.lat_origen
        : typeof ticket.origen_latitud === 'number' && ticket.origen_latitud !== 0
          ? ticket.origen_latitud
          : ticket.municipio_latitud;
  const originLon =
    typeof ticket.lon_actual === 'number' && ticket.lon_actual !== 0
      ? ticket.lon_actual
      : typeof ticket.lon_origen === 'number' && ticket.lon_origen !== 0
        ? ticket.lon_origen
        : typeof ticket.origen_longitud === 'number' && ticket.origen_longitud !== 0
          ? ticket.origen_longitud
          : ticket.municipio_longitud;
  const hasOrigin =
    typeof originLat === 'number' &&
    typeof originLon === 'number' &&
    (originLat !== 0 || originLon !== 0);
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

  return (
    <div className="mb-6">
      <h4 className="font-semibold mb-2">Ubicación aproximada</h4>
      <div className="w-full rounded overflow-hidden h-[150px] sm:h-[180px]">
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
      {direccionCompleta && (
        <div className="text-xs mt-1 text-muted-foreground truncate">
          {direccionCompleta}
        </div>
      )}
    </div>
  );
};

export default TicketMap;