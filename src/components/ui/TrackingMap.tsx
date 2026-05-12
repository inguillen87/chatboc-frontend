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
    status: string;
    className?: string;
}

const isValidPoint = (point?: { lat: number; lng: number } | null) =>
    Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng));

export default function TrackingMap({
    storeLocation = null,
    customerLocation = null,
    driverLocation,
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
            element.className = 'marker-store flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-md border-2 border-indigo-500 text-indigo-500';
            element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>`;
            return element;
        }

        if (kind === 'customer') {
            element.className = 'marker-customer flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-full shadow-md border-2 border-white text-white';
            element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
            return element;
        }

        element.className = 'marker-driver flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-xl border-2 border-green-500 text-green-600 z-50 animate-bounce-slow';
        element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-5a1 1 0 0 0-1 1v3.15"/><path d="M12 17.5V14a2 2 0 0 0-2-2H6"/><path d="M18 5h-3.5a1 1 0 0 0-1 1v4"/><path d="M15.5 5.5 12 9"/><path d="M18.5 14a2 2 0 0 0-1.5 2.45"/></svg>`;
        return element;
    };

    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        const primaryLocation = customerLocation || storeLocation || { lat: -34.6037, lng: -58.3816, name: 'Ubicacion' };

        try {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
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

            const showDriver = ['en_proceso', 'enviado', 'shipped', 'en_camino'].includes(status);
            if (showDriver) {
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
    }, [storeLocation, customerLocation, driverLocation, status, mapError]);

    if (mapError) {
        const fallbackPoints = [
            storeLocation ? { label: storeLocation.name || 'Origen', ...storeLocation } : null,
            customerLocation ? { label: customerLocation.name || 'Destino', ...customerLocation } : null,
            driverLocation ? { label: 'Ubicacion actual', ...driverLocation } : null
        ].filter(isValidPoint) as Array<{ label: string; lat: number; lng: number }>;

        return (
            <div className={cn("relative w-full h-full rounded-xl overflow-hidden border border-dashed border-slate-300 bg-slate-50 p-4", className)}>
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
        <div className={cn("relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-gray-100 bg-slate-50", className)}>
            <div ref={mapContainer} className="w-full h-full" />
            <div className="absolute bottom-1 right-1 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-gray-400 z-10 pointer-events-none">
                (c) OpenStreetMap
            </div>
        </div>
    );
}
