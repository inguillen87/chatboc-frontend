import MapLibreMap from "@/components/MapLibreMap";

export interface TicketLocation {
  latitud?: number | null;
  longitud?: number | null;
  lat_destino?: number | null;
  lon_destino?: number | null;
  direccion?: string | null;
  esquinas_cercanas?: string | null;
  distrito?: string | null;
  municipio_latitud?: number | null;
  municipio_longitud?: number | null;
}

export const buildFullAddress = (ticket: TicketLocation) => {
  const parts: string[] = [];
  if (ticket.direccion) parts.push(ticket.direccion);
  if (ticket.esquinas_cercanas) parts.push(ticket.esquinas_cercanas);
  if (ticket.distrito) parts.push(ticket.distrito);
  return parts.join(', ');
};

const TicketMap: React.FC<{ ticket: TicketLocation }> = ({ ticket }) => {
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

  const center: [number, number] | undefined = hasCoords
    ? [destLon as number, destLat as number]
    : typeof ticket.municipio_longitud === 'number' &&
      typeof ticket.municipio_latitud === 'number'
      ? [ticket.municipio_longitud, ticket.municipio_latitud]
      : undefined;

  if (!center) return null;

  return (
    <MapLibreMap
      center={center}
      marker={hasCoords ? [destLon as number, destLat as number] : undefined}
      initialZoom={15}
      className="w-full h-[150px] sm:h-[180px] rounded-md overflow-hidden"
    />
  );
};

export default TicketMap;
