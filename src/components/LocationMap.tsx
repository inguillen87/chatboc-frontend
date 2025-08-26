import React, { useEffect, useRef } from "react";
import { loadGoogleMapsApi } from "@/utils/mapsLoader";

interface LocationMapProps {
  lat?: number | null;
  lng?: number | null;
  onMove?: (lat: number, lng: number) => void;
  heatmapData?: { lat: number; lng: number; weight?: number }[];
}

const LocationMap: React.FC<LocationMapProps> = ({ lat, lng, onMove, heatmapData }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMapsApi(["marker", "visualization"]) // ensure required libraries
      .then(() => {
        if (cancelled || !ref.current) return;
        if (!mapRef.current) {
          const center =
            lat != null && lng != null ? { lat, lng } : { lat: -34.6037, lng: -58.3816 };
          mapRef.current = new window.google.maps.Map(ref.current, {
            center,
            zoom: lat != null && lng != null ? 15 : 5,
            mapId: "CHATBOC_MAP_ID",
          });
          markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
            position: lat != null && lng != null ? center : undefined,
            map: mapRef.current!,
            draggable: Boolean(onMove),
          });
          if (onMove && markerRef.current) {
            markerRef.current.addListener("dragend", () => {
              const pos = markerRef.current!.position;
              if (pos) onMove(pos.lat(), pos.lng());
            });
          }
        } else if (lat != null && lng != null) {
          const pos = { lat, lng };
          mapRef.current!.setCenter(pos);
          mapRef.current!.setZoom(15);
          if (markerRef.current) {
            markerRef.current.position = pos;
            markerRef.current.map = mapRef.current!;
          }
        }

        if (mapRef.current) {
          if (heatmapData && heatmapData.length > 0) {
            const points = heatmapData.map((p) => ({
              location: new window.google.maps.LatLng(p.lat, p.lng),
              weight: p.weight ?? 1,
            }));
            if (!heatmapRef.current) {
              heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
                data: points,
                map: mapRef.current!,
              });
              heatmapRef.current.set("radius", 30);
              heatmapRef.current.set("opacity", 0.8);
            } else {
              heatmapRef.current.setData(points);
              heatmapRef.current.setMap(mapRef.current!);
            }
          } else if (heatmapRef.current) {
            heatmapRef.current.setMap(null);
          }
        }
      })
      .catch((err) => {
        console.error("Google Maps script failed to load:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, onMove, heatmapData]);

  // Added flex-grow and min-h-[200px] (or other suitable min-height)
  return <div ref={ref} className="w-full rounded-md border border-border flex-grow min-h-[200px]" />; 
};

export default LocationMap;
