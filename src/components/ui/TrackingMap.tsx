import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';

interface TrackingMapProps {
    storeLocation?: { lat: number; lng: number; name?: string };
    customerLocation?: { lat: number; lng: number; name?: string };
    driverLocation?: { lat: number; lng: number };
    status: string;
    className?: string;
}

export default function TrackingMap({
    storeLocation = { lat: -34.6037, lng: -58.3816, name: 'Tienda' }, // Obelisco default
    customerLocation = { lat: -34.5826, lng: -58.4069, name: 'Vos' }, // Palermo default (approx)
    driverLocation,
    status,
    className
}: TrackingMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const storeMarker = useRef<maplibregl.Marker | null>(null);
    const customerMarker = useRef<maplibregl.Marker | null>(null);
    const driverMarker = useRef<maplibregl.Marker | null>(null);

    // Initial Map Setup
    useEffect(() => {
        if (!mapContainer.current) return;
        if (map.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
            center: [storeLocation.lng, storeLocation.lat],
            zoom: 13,
            attributionControl: false
        });

        map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        // Store Marker (Shop Icon)
        const storeEl = document.createElement('div');
        storeEl.className = 'marker-store flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-md border-2 border-indigo-500 text-indigo-500';
        storeEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>`;

        storeMarker.current = new maplibregl.Marker({ element: storeEl })
            .setLngLat([storeLocation.lng, storeLocation.lat])
            .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setText(storeLocation.name || 'Tienda'))
            .addTo(map.current);

        // Customer Marker (House/User Icon)
        const customerEl = document.createElement('div');
        customerEl.className = 'marker-customer flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-full shadow-md border-2 border-white text-white';
        customerEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

        customerMarker.current = new maplibregl.Marker({ element: customerEl })
            .setLngLat([customerLocation.lng, customerLocation.lat])
            .setPopup(new maplibregl.Popup({ offset: 25, closeButton: false }).setText(customerLocation.name || 'Destino'))
            .addTo(map.current);

    }, []);

    // Update locations and fit bounds
    useEffect(() => {
        if (!map.current) return;

        const mapInstance = map.current;

        // Driver Marker (Car/Bike Icon) - Only if status warrants it
        const showDriver = ['en_proceso', 'enviado', 'shipped'].includes(status);

        if (showDriver) {
            // Interpolate driver position based on status if not provided
            // "en_proceso" -> near store (10%)
            // "enviado" -> halfway (50%) or animated

            let progress = 0.1;
            if (status === 'enviado' || status === 'shipped') progress = 0.6;

            const dLat = driverLocation?.lat ?? storeLocation.lat + (customerLocation.lat - storeLocation.lat) * progress;
            const dLng = driverLocation?.lng ?? storeLocation.lng + (customerLocation.lng - storeLocation.lng) * progress;

            if (!driverMarker.current) {
                const driverEl = document.createElement('div');
                driverEl.className = 'marker-driver flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-xl border-2 border-green-500 text-green-600 z-50 animate-bounce-slow';
                // Bike icon
                driverEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h-5a1 1 0 0 0-1 1v3.15"/><path d="M12 17.5V14a2 2 0 0 0-2-2H6"/><path d="M18 5h-3.5a1 1 0 0 0-1 1v4"/><path d="M15.5 5.5 12 9"/><path d="M18.5 14a2 2 0 0 0-1.5 2.45"/></svg>`;

                driverMarker.current = new maplibregl.Marker({ element: driverEl })
                    .setLngLat([dLng, dLat])
                    .addTo(mapInstance);
            } else {
                driverMarker.current.setLngLat([dLng, dLat]);
            }
        } else {
            if (driverMarker.current) {
                driverMarker.current.remove();
                driverMarker.current = null;
            }
        }

        // Fit Bounds
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([storeLocation.lng, storeLocation.lat]);
        bounds.extend([customerLocation.lng, customerLocation.lat]);

        if (driverMarker.current) {
             const pos = driverMarker.current.getLngLat();
             bounds.extend([pos.lng, pos.lat]);
        }

        try {
            mapInstance.fitBounds(bounds, {
                padding: { top: 50, bottom: 50, left: 50, right: 50 },
                maxZoom: 15,
                duration: 1500
            });
        } catch (e) {
            console.warn("Error fitting bounds", e);
        }

    }, [storeLocation, customerLocation, driverLocation, status]);

    return (
        <div className={cn("relative w-full h-full rounded-xl overflow-hidden shadow-inner border border-gray-100 bg-slate-50", className)}>
            <div ref={mapContainer} className="w-full h-full" />
            <div className="absolute bottom-1 right-1 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-gray-400 z-10 pointer-events-none">
                © OpenStreetMap
            </div>
        </div>
    );
}
