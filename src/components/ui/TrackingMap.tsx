import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';
import { reportedTrackingPoints, type TrackingMapSources, type TrackingPointRole } from '@/utils/trackingMapPoints';

export interface TrackingMapLabels {
  title: string; description: string; empty: string; unavailable: string;
  fallbackTitle: string; store: string; customer: string; driver: string;
}
const DEFAULT_LABELS: TrackingMapLabels = {
  title: 'Ubicaciones informadas',
  description: 'Se muestran puntos recibidos. No se calculan rutas ni se estima la posición de un móvil.',
  empty: 'Sin ubicación informada para este seguimiento.',
  unavailable: 'El mapa no está disponible. Podés consultar las ubicaciones recibidas a continuación.',
  fallbackTitle: 'Seguimiento por timeline', store: 'Origen', customer: 'Destino', driver: 'Posición informada del móvil',
};
interface TrackingMapProps extends TrackingMapSources {
  className?: string;
  /** Optional backend-owned presentation contract; never keyed by municipality or company. */
  labels?: Partial<TrackingMapLabels>;
}
function reducedMotionRequested(): boolean {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.reduceMotion === 'true' || document.body.dataset.reduceMotion === 'true');
}
export default function TrackingMap({ className, labels: suppliedLabels, ...sources }: TrackingMapProps) {
  const labels = { ...DEFAULT_LABELS };
  for (const key of Object.keys(labels) as Array<keyof TrackingMapLabels>) {
    const value = suppliedLabels?.[key];
    if (typeof value === 'string' && value.trim()) labels[key] = value.trim();
  }
  const points = reportedTrackingPoints(sources);
  const hasPoints = points.length > 0;
  const geometryKey = JSON.stringify(points.map(({ role, lat, lng }) => [role, lat, lng]));
  const labelKey = JSON.stringify(points.map((point) => point.name || labels[point.role]));
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<Partial<Record<TrackingPointRole, maplibregl.Marker>>>({});
  const previousGeometry = useRef('');
  const [mapError, setMapError] = useState(false);
  const titleId = React.useId();
  const descriptionId = React.useId();

  useEffect(() => {
    if (!container.current || !hasPoints || mapError) return;
    let active = true;
    let loaded = false;
    let observer: ResizeObserver | undefined;
    try {
      const center = points.find((point) => point.role === 'customer') || points[0];
      const instance = new maplibregl.Map({ container: container.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [center.lng, center.lat], zoom: 13,
        attributionControl: { compact: true },
      });
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      instance.on('load', () => { loaded = true; });
      instance.on('error', () => { if (active && !loaded) setMapError(true); });
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(() => { if (active) instance.resize(); });
        observer.observe(container.current);
      }
    } catch { setMapError(true); }
    return () => {
      active = false; observer?.disconnect();
      Object.values(markers.current).forEach((marker) => marker?.remove());
      markers.current = {}; previousGeometry.current = '';
      map.current?.remove(); map.current = null;
    };
    // Coordinate/name changes update the existing map below; they do not recreate its provider.
  }, [hasPoints, mapError]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || mapError) return;
    try {
      const present = new Set(points.map((point) => point.role));
      for (const role of ['store', 'customer', 'driver'] as const) {
        if (!present.has(role)) { markers.current[role]?.remove(); delete markers.current[role]; }
      }
      for (const point of points) {
        const label = point.name || labels[point.role];
        let marker = markers.current[point.role];
        if (!marker) {
          const element = document.createElement('div');
          element.className = `marker-${point.role}`;
          Object.assign(element.style, { width: '32px', height: '32px', borderRadius: '50%',
            border: '3px solid white', boxShadow: '0 2px 8px #0006', background: 'hsl(var(--primary, 199 89% 48%))',
            color: 'hsl(var(--primary-foreground, 0 0% 100%))', display: 'grid', placeItems: 'center', fontWeight: '700' });
          element.textContent = point.role === 'store' ? '1' : point.role === 'customer' ? '2' : '3';
          marker = new maplibregl.Marker({ element })
            .setLngLat([point.lng, point.lat])
            .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setText(label))
            .addTo(instance);
          markers.current[point.role] = marker;
        }
        marker.setLngLat([point.lng, point.lat]); marker.getPopup()?.setText(label);
      }
      if (previousGeometry.current !== geometryKey && points.length) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((point) => bounds.extend([point.lng, point.lat]));
        instance.fitBounds(bounds, { padding: 48, maxZoom: 15,
          duration: previousGeometry.current && !reducedMotionRequested() ? 450 : 0, essential: false });
        previousGeometry.current = geometryKey;
      }
    } catch { setMapError(true); }
  }, [geometryKey, labelKey, mapError]);

  const pointList = <ul className="space-y-2 text-xs">
    {points.map((point) => <li key={point.role} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/95 px-3 py-2 text-foreground">
      <span className="font-medium">{point.name || labels[point.role]}</span>
      <span className="tabular-nums">{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</span>
    </li>)}
  </ul>;
  if (!hasPoints || mapError) return <section aria-labelledby={titleId} aria-describedby={descriptionId}
    className={cn('relative h-full w-full overflow-auto rounded-xl border border-dashed bg-muted/30 p-4', className)}
    data-testid={mapError ? 'tracking-map-fallback' : 'tracking-map-empty'}>
    <h3 id={titleId} className="text-sm font-semibold">{mapError ? labels.fallbackTitle : labels.title}</h3>
    <p id={descriptionId} className="my-3 text-xs text-muted-foreground">{mapError ? labels.unavailable : labels.empty}</p>
    {pointList}
  </section>;
  return <section aria-labelledby={titleId} aria-describedby={descriptionId}
    className={cn('relative h-full w-full overflow-hidden rounded-xl border bg-muted', className)} data-testid="tracking-map">
    <div ref={container} className="h-full w-full" />
    <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-5rem)] rounded-xl border bg-background/95 px-3 py-2 text-foreground shadow-sm" data-testid="tracking-map-hud">
      <h3 id={titleId} className="text-xs font-semibold">{labels.title}</h3>
      <p id={descriptionId} className="mt-1 max-w-64 text-[11px]">{labels.description}</p>
    </div>
    <div className="sr-only">{pointList}</div>
  </section>;
}
