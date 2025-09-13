import React, { useEffect, useRef, useState } from 'react';

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
  tiempo_estimado?: string | null;
  eta?: string | null;
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
  const eta = ticket.tiempo_estimado || ticket.eta;

  // -------- MapLibre dynamic map for active routes ---------
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const animRef = useRef<number>();
  const routeRef = useRef<[number, number][]>([]); // [lon, lat]
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(
    hasOrigin ? [originLon as number, originLat as number] : null
  );

  // initialize map when route is available
  useEffect(() => {
    if (!hasRoute || mapRef.current || !mapContainer.current) return;

    let isMounted = true;

    (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (!isMounted || !mapContainer.current) return;

      const map = new maplibre.Map({
        container: mapContainer.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [originLon as number, originLat as number],
        zoom: 13,
      });

      mapRef.current = map;

      map.on('load', () => {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [] },
          },
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#2563eb', 'line-width': 4 },
        });
        markerRef.current = new maplibre.Marker().setLngLat([originLon as number, originLat as number]).addTo(map);
        routeRef.current = [[originLon as number, originLat as number]];
      });
    })();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [hasRoute, originLat, originLon]);

  // helper for distance in km using haversine formula
  const distanceKm = (a: [number, number], b: [number, number]) => {
    const toRad = (n: number) => (n * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  // fetch periodic position updates
  useEffect(() => {
    if (!hasRoute || !ticket || !(ticket as any).id) return;
    const id: any = (ticket as any).id;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${id}/posicion`);
        const data = await res.json();
        const lat = Number(data.lat ?? data.latitud);
        const lon = Number(data.lon ?? data.longitud);
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          // update ticket and local state
          (ticket as any).lat_actual = lat;
          (ticket as any).lon_actual = lon;
          setCurrentPos([lon, lat]);
          routeRef.current.push([lon, lat]);

          const map = mapRef.current;
          const source = map?.getSource('route') as any;
          if (source) {
            source.setData({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: routeRef.current },
            });
          }

          // animate marker
          const prev = routeRef.current[routeRef.current.length - 2];
          if (prev && markerRef.current) {
            const start = prev;
            const end = [lon, lat];
            if (animRef.current) cancelAnimationFrame(animRef.current);
            const duration = 1000;
            const startTime = performance.now();
            const animate = (time: number) => {
              const t = Math.min((time - startTime) / duration, 1);
              const currLon = start[0] + (end[0] - start[0]) * t;
              const currLat = start[1] + (end[1] - start[1]) * t;
              markerRef.current.setLngLat([currLon, currLat]);
              if (t < 1) {
                animRef.current = requestAnimationFrame(animate);
              }
            };
            animRef.current = requestAnimationFrame(animate);
          }

          // dispatch status events
          const dest = [destLon as number, destLat as number] as [number, number];
          const dist = distanceKm([lon, lat], dest);
          const status = dist < 0.05 ? 'llegado' : 'en_camino';
          window.dispatchEvent(new CustomEvent('route-status', { detail: status }));
        }
      } catch (e) {
        console.error('position fetch failed', e);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [hasRoute, ticket, destLat, destLon]);

  // update map center when current position changes
  useEffect(() => {
    if (!currentPos || !mapRef.current) return;
    mapRef.current.setCenter(currentPos);
  }, [currentPos]);

  // ---------- Fallback static map for no route ----------
  const googleSrc = hasRoute
    ? ''
    : hasCoords
      ? `https://maps.google.com/maps?q=${destLat},${destLon}&z=15&output=embed`
      : direccionCompleta
        ? `https://maps.google.com/maps?q=${encodeURIComponent(direccionCompleta)}&z=15&output=embed`
        : '';
  const osmSrc = hasRoute
    ? ''
    : hasCoords
      ? `https://www.openstreetmap.org/export/embed.html?mlat=${destLat}&mlon=${destLon}&marker=${destLat},${destLon}&zoom=15&layer=mapnik`
      : direccionCompleta
        ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(direccionCompleta)}`
        : '';
  const [src, setSrc] = useState(googleSrc || osmSrc);

  if (hasRoute) {
    return (
      <div className="mb-6">
        <h4 className="font-semibold mb-2">Ubicación aproximada</h4>
        <div ref={mapContainer} className="w-full rounded overflow-hidden h-[150px] sm:h-[180px]" />
        {direccionCompleta && (
          <div className="text-xs mt-1 text-muted-foreground truncate">
            {direccionCompleta}
          </div>
        )}
        {(hasRoute || eta) && (
          <div className="text-xs mt-1 text-muted-foreground">
            {eta ? `Tiempo estimado de llegada: ${eta}` : 'Cuadrilla en camino'}
          </div>
        )}
      </div>
    );
  }

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
      {eta && (
        <div className="text-xs mt-1 text-muted-foreground">
          {`Tiempo estimado de llegada: ${eta}`}
        </div>
      )}
    </div>
  );
};

export default TicketMap;
