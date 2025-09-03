import React from 'react';

interface TicketLocation {
  latitud?: number | null;
  longitud?: number | null;
  direccion?: string | null;
  municipio_nombre?: string | null;
  tipo?: 'pyme' | 'municipio';
  origen_latitud?: number | null;
  origen_longitud?: number | null;
  municipio_latitud?: number | null;
  municipio_longitud?: number | null;
}

const buildFullAddress = (ticket: TicketLocation) => {
  const direccion = ticket.direccion || '';
  if (
    ticket.tipo !== 'pyme' &&
    ticket.municipio_nombre &&
    !direccion.toLowerCase().includes(ticket.municipio_nombre.toLowerCase())
  ) {
    return `${direccion ? `${direccion}, ` : ''}${ticket.municipio_nombre}`;
  }
  return direccion;
};

const TicketMap: React.FC<{ ticket: TicketLocation }> = ({ ticket }) => {
  const direccionCompleta = buildFullAddress(ticket);
  const hasCoords =
    typeof ticket.latitud === 'number' &&
    typeof ticket.longitud === 'number' &&
    (ticket.latitud !== 0 || ticket.longitud !== 0);
  const originLat =
    typeof ticket.origen_latitud === 'number' && ticket.origen_latitud !== 0
      ? ticket.origen_latitud
      : ticket.municipio_latitud;
  const originLon =
    typeof ticket.origen_longitud === 'number' && ticket.origen_longitud !== 0
      ? ticket.origen_longitud
      : ticket.municipio_longitud;
  const hasOrigin =
    typeof originLat === 'number' &&
    typeof originLon === 'number' &&
    (originLat !== 0 || originLon !== 0);
  const hasRoute = hasCoords && hasOrigin;
  const mapSrc = hasRoute
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${originLat},${originLon};${ticket.latitud},${ticket.longitud}`
    : hasCoords
      ? `https://www.openstreetmap.org/export/embed.html?mlat=${ticket.latitud}&mlon=${ticket.longitud}&marker=${ticket.latitud},${ticket.longitud}&zoom=15&layer=mapnik`
      : direccionCompleta
        ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(direccionCompleta)}`
        : '';
  return mapSrc ? (
    <div className="mb-6">
      <h4 className="font-semibold mb-2">Ubicación aproximada</h4>
      {/* Responsive height for the map container */}
      <div className="w-full rounded overflow-hidden h-[150px] sm:h-[180px]">
        <iframe
          width="100%"
          height="100%" // Make iframe fill the container
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          src={mapSrc}
        />
      </div>
      {direccionCompleta && (
        <div className="text-xs mt-1 text-muted-foreground truncate">
          {direccionCompleta}
        </div>
      )}
    </div>
  ) : null;
};

export default TicketMap;
