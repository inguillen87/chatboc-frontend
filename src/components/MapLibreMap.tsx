import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HeatPoint } from "@/services/statsService";
import type { Map, LngLatLike } from "maplibre-gl";

type Props = {
  center?: [number, number]; // [lon, lat]
  initialZoom?: number;
  onSelect?: (lat: number, lon: number, address?: string) => void;
  heatmapData?: HeatPoint[];
  showHeatmap?: boolean;
  marker?: [number, number];
  className?: string;
  provider?: "maplibre" | "google";
};

// Function to safely add a layer
const addLayer = (map: Map, layer: any) => {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
};

export default function MapLibreMap({
  center,
  initialZoom = 12,
  onSelect,
  heatmapData = [],
  showHeatmap = true,
  marker,
  className,
  provider = "maplibre",
}: Props) {
  if (provider === "google") {
    const query = center ? `${center[1]},${center[0]}` : "0,0";
    const url = `https://maps.google.com/maps?q=${query}&z=${initialZoom}&output=embed`;
    return (
      <iframe
        src={url}
        className={cn("w-full rounded-2xl overflow-hidden", className ?? "h-[500px]")}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const libRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const apiKey = import.meta.env.VITE_MAPTILER_KEY;

  // Effect for map initialization and cleanup
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return; // Initialize only once

    let isMounted = true;
    let map: Map;

    const initMap = async () => {
      try {
        const maplibre = (await import("maplibre-gl")).default;
        libRef.current = maplibre;

        if (!isMounted || !mapContainerRef.current) return;

        const styleUrl = apiKey
          ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`
          : "https://demotiles.maplibre.org/style.json";

        map = new maplibre.Map({
          container: mapContainerRef.current,
          style: styleUrl,
          center: center ?? [0, 0],
          zoom: initialZoom,
        });

        mapRef.current = map;

        map.addControl(new maplibre.NavigationControl(), "top-right");

        map.on('load', () => {
          if (!isMounted) return;

          map.addSource("points", {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [],
            },
          });

          addLayer(map, {
            id: "tickets-heat",
            type: "heatmap",
            source: "points",
            maxzoom: 15,
            paint: {
              "heatmap-weight": ["get", "weight"],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
              "heatmap-opacity": 0.6,
            },
          });

          addLayer(map, {
            id: "tickets-circles",
            type: "circle",
            source: "points",
            minzoom: 14,
            paint: {
              "circle-radius": 6,
              "circle-color": "#3b82f6",
              "circle-opacity": 0.9,
            },
          });

          // Set initial visibility based on prop
          map.setLayoutProperty("tickets-heat", "visibility", showHeatmap ? "visible" : "none");
          map.setLayoutProperty("tickets-circles", "visibility", showHeatmap ? "none" : "visible");
        });

        if (onSelect) {
          map.on('click', (e) => {
            const { lng, lat } = e.lngLat;
            onSelect(lat, lng);
          });
        }

        map.on('click', 'tickets-circles', (e) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const coords = (feature.geometry as any).coordinates.slice();
          const { id, ticket, categoria, direccion, distrito } = feature.properties || {};

          while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
          }

          const lines = [
            `<p>Ticket #${ticket ?? id}</p>`,
            categoria ? `<p>Categoría: ${categoria}</p>` : '',
            distrito ? `<p>Distrito: ${distrito}</p>` : '',
            direccion ? `<p>Dirección: ${direccion}</p>` : '',
            `<a href="/chat/${id}" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">Ver ticket</a>`,
          ].filter(Boolean);

          new libRef.current.Popup()
            .setLngLat(coords as LngLatLike)
            .setHTML(`<div class="text-sm">${lines.join('')}</div>`)
            .addTo(map);
        });

        // Add a fallback for missing images to prevent errors
        map.on('styleimagemissing', (e) => {
          const id = e.id;
          if (!map.hasImage(id)) {
            const empty = { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) };
            map.addImage(id, empty as any);
          }
        });

      } catch (error) {
        console.error("Failed to initialize map:", error);
      }
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once

  // Effect for updating map center
  useEffect(() => {
    const map = mapRef.current;
    if (map && center && !Number.isNaN(center[0]) && !Number.isNaN(center[1])) {
      map.flyTo({ center, zoom: initialZoom });
    }
  }, [center]);

  // Effect for updating heatmap data
  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("points");
    if (!map || !source || !map.isStyleLoaded()) {
      // If map/source not ready, retry after a short delay
      const timeoutId = setTimeout(() => {
        const updatedSource = map?.getSource("points");
        if(updatedSource && typeof (updatedSource as any).setData === 'function'){
           const geojson = {
            type: "FeatureCollection",
            features: heatmapData.map((p) => ({
              type: "Feature",
              properties: { weight: p.weight ?? 1, id: p.id, ticket: p.ticket, categoria: p.categoria, direccion: p.direccion, distrito: p.distrito },
              geometry: { type: "Point", coordinates: [p.lng, p.lat] },
            })),
          };
          (updatedSource as any).setData(geojson);
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }

    if (source && typeof (source as any).setData === 'function') {
      const geojson = {
        type: "FeatureCollection",
        features: heatmapData.map((p) => ({
          type: "Feature",
          properties: { weight: p.weight ?? 1, id: p.id, ticket: p.ticket, categoria: p.categoria, direccion: p.direccion, distrito: p.distrito },
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        })),
      };
      (source as any).setData(geojson);
    }
  }, [heatmapData]);

  // Effect for toggling layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    map.setLayoutProperty("tickets-heat", "visibility", showHeatmap ? "visible" : "none");
    map.setLayoutProperty("tickets-circles", "visibility", showHeatmap ? "none" : "visible");
  }, [showHeatmap]);

  // Effect for pulsing heatmap intensity
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showHeatmap) return;
    let frame: number;
    const animate = () => {
      const t = (Date.now() % 2000) / 2000;
      const intensity = 1 + 0.5 * Math.sin(t * Math.PI * 2);
      map.setPaintProperty("tickets-heat", "heatmap-intensity", intensity);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [showHeatmap]);

  // Effect for adding/updating municipality marker
  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map) return;
    if (marker) {
      if (markerRef.current) {
        markerRef.current.setLngLat(marker);
      } else if (maplibre) {
        const el = document.createElement("div");
        el.className = "home-marker";
        el.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        `;
        markerRef.current = new maplibre.Marker({ element: el })
          .setLngLat(marker)
          .addTo(map);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [marker]);

  return (
    <div
      ref={mapContainerRef}
      className={cn("w-full rounded-2xl overflow-hidden", className ?? "h-[500px]")}
    />
  );
}
