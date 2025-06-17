import React from 'react';

interface TicketLocation {
  latitud?: number | null;
  longitud?: number | null;
  direccion?: string | null;
  municipio_nombre?: string | null;
  tipo?: 'pyme' | 'municipio';
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
    typeof ticket.latitud === 'number' && typeof ticket.longitud === 'number';
  const mapSrc = hasCoords
    ? `https://www.google.com/maps?q=${ticket.latitud},${ticket.longitud}&output=embed`
    : `https://www.google.com/maps?q=${encodeURIComponent(direccionCompleta)}&output=embed`;
  return ticket.direccion || hasCoords ? (
    <div className="mb-6">
      <h4 className="font-semibold mb-2">Ubicación aproximada</h4>
      <div className="w-full rounded overflow-hidden" style={{ height: 180 }}>
        <iframe
          width="100%"
          height="180"
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
