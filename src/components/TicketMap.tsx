import MapLibreMap from "@/components/MapLibreMap";

export interface TicketLocation {
  latitud?: number | string | null;
  longitud?: number | string | null;
  lat_destino?: number | string | null;
  lon_destino?: number | string | null;
  direccion?: string | null;
  esquinas_cercanas?: string | null;
  distrito?: string | null;
  municipio_latitud?: number | string | null;
  municipio_longitud?: number | string | null;
}

export const buildFullAddress = (ticket: TicketLocation) => {
  const parts: string[] = [];
  if (ticket.direccion) parts.push(ticket.direccion);
  if (ticket.esquinas_cercanas) parts.push(ticket.esquinas_cercanas);
  if (ticket.distrito) parts.push(ticket.distrito);
  return parts.join(', ');
};

const TicketMap: React.FC<{ ticket: TicketLocation }> = ({ ticket }) => {
  const parse = (v?: number | string | null): number | undefined => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const parsed = parseFloat(v);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const destLat = parse(ticket.lat_destino) ?? parse(ticket.latitud);
  const destLon = parse(ticket.lon_destino) ?? parse(ticket.longitud);
  const hasCoords =
    typeof destLat === 'number' &&
    typeof destLon === 'number' &&
    (destLat !== 0 || destLon !== 0);

  const muniLon = parse(ticket.municipio_longitud);
  const muniLat = parse(ticket.municipio_latitud);

  const center: [number, number] | undefined = hasCoords
    ? [destLon as number, destLat as number]
    : typeof muniLon === 'number' && typeof muniLat === 'number'
      ? [muniLon, muniLat]
      : undefined;

  if (!center) return null;

  return (
    <MapLibreMap
      center={center}
      marker={hasCoords ? [destLon as number, destLat as number] : undefined}
      initialZoom={15}
      className="w-full h-[200px] sm:h-[240px] rounded-md overflow-hidden"
    />
  );
};

export default TicketMap;
