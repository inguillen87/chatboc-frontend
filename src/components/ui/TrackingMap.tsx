import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';

interface MapPoint {
    lat: number;
    lng: number;
    name?: string;
}

interface TrackingMapProps {
    storeLocation?: MapPoint | null;
    customerLocation?: MapPoint | null;
    driverLocation?: MapPoint;
    showDriverMarker?: boolean;
    status: string;
    className?: string;
}

const isValidPoint = (point?: { lat: number; lng: number } | null) =>
    Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng));

const ACTIVE_ROUTE_STATUSES = new Set([
    'en_proceso',
    'enviado',
    'shipped',
    'en_camino',
    'asignado',
    'validando',
]);

const statusLabelFor = (status: string) => {
    const normalized = status.replace(/[_-]+/g, ' ').trim();
    if (!normalized) return 'Seguimiento activo';
    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

function TrackingMapTelemetryOverlay({
    hasRoute,
    showDriver,
    status,
}: {
    hasRoute: boolean;
    showDriver: boolean;
    status: string;
}) {
    const reactId = React.useId();
    const svgId = reactId.replace(/:/g, '');
    const gridId = `${svgId}-tracking-map-grid`;
    const radarId = `${svgId}-tracking-map-radar`;
    const routeId = `${svgId}-tracking-map-route`;
    const modeLabel = hasRoute ? 'Ruta operativa' : 'Punto validado';
    const signalLabel = showDriver ? 'Movil en campo' : 'Mesa operativa';
    const statusLabel = statusLabelFor(status);

    return (
        <div
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            data-testid="tracking-map-telemetry"
        >
            <svg
                aria-hidden="true"
                className="h-full w-full opacity-95 mix-blend-screen"
                viewBox="0 0 600 360"
                preserveAspectRatio="none"
            >
                <defs>
                    <pattern id={gridId} width="38" height="38" patternUnits="userSpaceOnUse">
                        <path d="M38 0H0V38" fill="none" stroke="rgba(125, 211, 252, 0.16)" strokeWidth="1" />
                    </pattern>
                    <radialGradient id={radarId} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(250, 204, 21, 0.34)" />
                        <stop offset="52%" stopColor="rgba(34, 211, 238, 0.16)" />
                        <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
                    </radialGradient>
                    <linearGradient id={routeId} x1="0%" x2="100%" y1="0%" y2="0%">
                        <stop offset="0%" stopColor="#22d3ee" />
                        <stop offset="52%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#facc15" />
                    </linearGradient>
                </defs>
                <rect width="600" height="360" fill="rgba(2, 6, 23, 0.22)" />
                <rect width="600" height="360" fill={`url(#${gridId})`} opacity="0.72" />
                <path
                    d="M0 280 C120 216 230 232 330 172 C438 106 494 112 600 56"
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.2)"
                    strokeDasharray="8 18"
                    strokeLinecap="round"
                    strokeWidth="2"
                />
                {hasRoute ? (
                    <g data-testid="tracking-map-route">
                        <path
                            d="M74 286 C172 188 280 210 388 130 C464 74 528 86 560 54"
                            fill="none"
                            stroke={`url(#${routeId})`}
                            strokeDasharray="10 14"
                            strokeLinecap="round"
                            strokeWidth="3"
                        >
                            <animate attributeName="stroke-dashoffset" from="0" to="-120" dur="5.2s" repeatCount="indefinite" />
                        </path>
                        <circle r="6" fill="#facc15">
                            <animateMotion
                                dur="5.2s"
                                repeatCount="indefinite"
                                path="M74 286 C172 188 280 210 388 130 C464 74 528 86 560 54"
                            />
                        </circle>
                    </g>
                ) : null}
                <g transform={hasRoute ? 'translate(560 54)' : 'translate(300 170)'}>
                    <circle r="86" fill={`url(#${radarId})`} opacity="0.85" />
                    <path d="M0 0 L82 -10 A82 82 0 0 1 82 10 Z" fill="rgba(34, 211, 238, 0.23)">
                        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8.5s" repeatCount="indefinite" />
                    </path>
                    <circle r="34" fill="none" stroke="#fef3c7" strokeWidth="1.4" opacity="0.72">
                        <animate attributeName="r" values="24;66;24" dur="4.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.18;0.78;0.18" dur="4.8s" repeatCount="indefinite" />
                    </circle>
                    <path d="M-62 0H-24M24 0H62M0 -62V-24M0 24V62" stroke="#f8fafc" strokeWidth="1.4" strokeLinecap="round" opacity="0.82" />
                    <circle r="8" fill="#020617" stroke="#facc15" strokeWidth="2.2" />
                </g>
            </svg>
            <div
                className="absolute bottom-3 left-3 max-w-[min(20rem,calc(100%-1.5rem))] rounded-2xl border border-white/15 bg-slate-950/88 px-3 py-2 text-xs text-white shadow-2xl backdrop-blur"
                data-testid="tracking-map-hud"
                role="status"
                aria-live="polite"
            >
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_5px_rgba(52,211,153,0.18)]" />
                    <span className="font-semibold">{modeLabel}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-300">
                    <span>{statusLabel}</span>
                    <span aria-hidden="true">-</span>
                    <span>{signalLabel}</span>
                </div>
            </div>
        </div>
    );
}

export default function TrackingMap({
    storeLocation = null,
    customerLocation = null,
    driverLocation,
    showDriverMarker = true,
    status,
    className
}: TrackingMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const storeMarker = useRef<maplibregl.Marker | null>(null);
    const customerMarker = useRef<maplibregl.Marker | null>(null);
    const driverMarker = useRef<maplibregl.Marker | null>(null);
    const [mapError, setMapError] = useState<string | null>(null);

    const buildMarkerElement = (kind: 'store' | 'customer' | 'driver') => {
        const element = document.createElement('div');

        if (kind === 'store') {
            element.className = 'marker-store flex items-center justify-center w-10 h-10 bg-slate-950 rounded-full shadow-md border-2 border-cyan-300 text-cyan-200';
            element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>`;
            return element;
        }

        if (kind === 'customer') {
            element.className = 'marker-customer flex items-center justify-center w-10 h-10 bg-amber-300 rounded-full shadow-md border-2 border-white text-slate-950';
            element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
            return element;
        }

        element.className = 'marker-driver flex items-center justify-center w-12 h-12 bg-emerald-300 rounded-full shadow-xl border-2 border-white text-slate-950 z-50 animate-bounce-slow';
        element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-5a1 1 0 0 0-1 1v3.15"/><path d="M12 17.5V14a2 2 0 0 0-2-2H6"/><path d="M18 5h-3.5a1 1 0 0 0-1 1v4"/><path d="M15.5 5.5 12 9"/><path d="M18.5 14a2 2 0 0 0-1.5 2.45"/></svg>`;
        return element;
    };

    const hasRoute = isValidPoint(storeLocation) && isValidPoint(customerLocation);
    const shouldShowDriver = showDriverMarker && ACTIVE_ROUTE_STATUSES.has(status);

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        const primaryLocation = customerLocation || storeLocation || { lat: -34.6037, lng: -58.3816, name: 'Ubicacion' };

        try {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
                center: [primaryLocation.lng, primaryLocation.lat],
                zoom: 13,
                attributionControl: false
            });

            map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
            map.current.on('error', (event) => {
                console.warn('Tracking map warning', event?.error || event);
            });
        } catch (error) {
            console.warn('Tracking map unavailable', error);
            setMapError('map_unavailable');
        }

        return () => {
            storeMarker.current?.remove();
            customerMarker.current?.remove();
            driverMarker.current?.remove();
            storeMarker.current = null;
            customerMarker.current = null;
            driverMarker.current = null;
            map.current?.remove();
            map.current = null;
        };
    }, []);

    useEffect(() => {
        if (!map.current || mapError) return;

        try {
            const mapInstance = map.current;

            if (isValidPoint(storeLocation)) {
                if (!storeMarker.current) {
                    storeMarker.current = new maplibregl.Marker({ element: buildMarkerElement('store') })
                        .setLngLat([storeLocation.lng, storeLocation.lat])
                        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setText(storeLocation.name || 'Origen'))
                        .addTo(mapInstance);
                }
                storeMarker.current.setLngLat([storeLocation.lng, storeLocation.lat]);
                storeMarker.current.getPopup()?.setText(storeLocation.name || 'Origen');
            } else if (storeMarker.current) {
                storeMarker.current.remove();
                storeMarker.current = null;
            }

            if (isValidPoint(customerLocation)) {
                if (!customerMarker.current) {
                    customerMarker.current = new maplibregl.Marker({ element: buildMarkerElement('customer') })
                        .setLngLat([customerLocation.lng, customerLocation.lat])
                        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setText(customerLocation.name || 'Destino'))
                        .addTo(mapInstance);
                }
                customerMarker.current.setLngLat([customerLocation.lng, customerLocation.lat]);
                customerMarker.current.getPopup()?.setText(customerLocation.name || 'Destino');
            } else if (customerMarker.current) {
                customerMarker.current.remove();
                customerMarker.current = null;
            }

            if (shouldShowDriver) {
                let progress = 0.1;
                if (['enviado', 'shipped', 'en_camino'].includes(status)) progress = 0.6;

                const driverStart = storeLocation || customerLocation || { lat: -34.6037, lng: -58.3816 };
                const driverEnd = customerLocation || storeLocation || driverStart;
                const dLat = driverLocation?.lat ?? driverStart.lat + (driverEnd.lat - driverStart.lat) * progress;
                const dLng = driverLocation?.lng ?? driverStart.lng + (driverEnd.lng - driverStart.lng) * progress;

                if (!driverMarker.current) {
                    driverMarker.current = new maplibregl.Marker({ element: buildMarkerElement('driver') })
                        .setLngLat([dLng, dLat])
                        .addTo(mapInstance);
                } else {
                    driverMarker.current.setLngLat([dLng, dLat]);
                }
            } else if (driverMarker.current) {
                driverMarker.current.remove();
                driverMarker.current = null;
            }

            const bounds = new maplibregl.LngLatBounds();
            const points = [storeLocation, customerLocation].filter(isValidPoint) as Array<{ lat: number; lng: number }>;
            if (points.length === 0) {
                const currentDriver = driverMarker.current?.getLngLat();
                if (currentDriver) {
                    mapInstance.easeTo({ center: [currentDriver.lng, currentDriver.lat], zoom: 14, duration: 800 });
                }
                return;
            }

            points.forEach((point) => bounds.extend([point.lng, point.lat]));
            const driverPosition = driverMarker.current?.getLngLat();
            if (driverPosition) {
                bounds.extend([driverPosition.lng, driverPosition.lat]);
            }

            mapInstance.fitBounds(bounds, {
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
                maxZoom: 15,
                duration: 1500
            });
        } catch (error) {
            console.warn('Error updating tracking map', error);
            setMapError('map_update_failed');
        }
    }, [storeLocation, customerLocation, driverLocation, status, mapError, shouldShowDriver]);

    if (mapError) {
        const fallbackPoints = [
            storeLocation ? { label: storeLocation.name || 'Origen', ...storeLocation } : null,
            customerLocation ? { label: customerLocation.name || 'Destino', ...customerLocation } : null,
            driverLocation ? { label: 'Ubicacion actual', ...driverLocation } : null
        ].filter(isValidPoint) as Array<{ label: string; lat: number; lng: number }>;

        return (
            <div
                className={cn("relative w-full h-full rounded-xl overflow-hidden border border-dashed border-slate-300 bg-slate-50 p-4", className)}
                data-testid="tracking-map-fallback"
            >
                <div className="flex h-full flex-col justify-between gap-4">
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Seguimiento por timeline</p>
                        <p className="mt-1 text-xs text-slate-500">
                            El mapa no esta disponible en este navegador, pero el seguimiento continua activo.
                        </p>
                    </div>
                    <div className="space-y-2 text-xs text-slate-600">
                        {fallbackPoints.map((point) => (
                            <div key={`${point.label}-${point.lat}-${point.lng}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                                <span className="font-medium text-slate-700">{point.label}</span>
                                <span>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn("relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-slate-700/60 bg-slate-950", className)}
            data-testid="tracking-map"
        >
            <div ref={mapContainer} className="w-full h-full" />
            <TrackingMapTelemetryOverlay hasRoute={hasRoute} showDriver={shouldShowDriver} status={status} />
            <div className="absolute bottom-1 right-1 z-20 rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] text-slate-300 backdrop-blur pointer-events-none">
                (c) OpenStreetMap
            </div>
        </div>
    );
}
