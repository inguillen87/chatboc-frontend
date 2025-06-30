import React, { useEffect, useRef, useState } from "react";
import { loadGoogleMapsApi } from "@/utils/mapsLoader";

interface LocationMapProps {
  lat?: number | null;
  lng?: number | null;
  onMove?: (lat: number, lng: number) => void;
}

const LocationMap: React.FC<LocationMapProps> = ({ lat, lng, onMove }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null
  );
  const [mapsApi, setMapsApi] = useState<typeof google.maps | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMapsApi(["marker", "places"])
      .then((api) => {
        setMapsApi(api.maps);
      })
      .catch((err) => {
        console.error("Failed to load Google Maps API for LocationMap:", err);
        setError(
          "Error al cargar el mapa. Por favor, verifique su conexión y la configuración de la API de Google Maps."
        );
      });
  }, []);

  useEffect(() => {
    if (!mapsApi || !ref.current) return;

    if (!mapRef.current) {
      const center =
        lat != null && lng != null
          ? { lat, lng }
          : { lat: -34.6037, lng: -58.3816 }; // Default to Buenos Aires

      mapRef.current = new mapsApi.Map(ref.current, {
        center,
        zoom: lat != null && lng != null ? 15 : 5,
        mapId: "CHATBOC_MAP_ID", // Required for Advanced Markers
      });

      // Ensure AdvancedMarkerElement is available
      if (mapsApi.marker && mapsApi.marker.AdvancedMarkerElement) {
        markerRef.current = new mapsApi.marker.AdvancedMarkerElement({
          position: lat != null && lng != null ? center : undefined,
          map: mapRef.current!,
          gmpDraggable: Boolean(onMove), // Note: property is gmpDraggable
        });

        if (onMove && markerRef.current) {
          markerRef.current.addListener("dragend", () => {
            const advancedMarker = markerRef.current as google.maps.marker.AdvancedMarkerElement;
            const pos = advancedMarker.position;
             if (pos && typeof pos.lat === 'number' && typeof pos.lng === 'number') {
              onMove(pos.lat, pos.lng);
            } else if (pos && typeof (pos as google.maps.LatLng).lat === 'function') {
              // Fallback for LatLng object if type is not inferred correctly
              onMove((pos as google.maps.LatLng).lat(), (pos as google.maps.LatLng).lng());
            }
          });
        }
      } else {
        console.warn("AdvancedMarkerElement not available. Marker will not be shown.");
        // Fallback or error handling if AdvancedMarkerElement is not part of the loaded 'marker' library.
        // This might happen if the 'marker' library version doesn't include it by default.
      }

    } else if (lat != null && lng != null) {
      const pos = { lat, lng };
      mapRef.current!.setCenter(pos);
      mapRef.current!.setZoom(15);
      if (markerRef.current) {
        // Type assertion for position
        (markerRef.current as google.maps.marker.AdvancedMarkerElement).position = pos;
        // Ensure map is still set if it was somehow unset
        if (!markerRef.current.map) {
            markerRef.current.map = mapRef.current;
        }
      }
    }
  }, [mapsApi, lat, lng, onMove]);

  if (error) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full h-96 rounded-md border border-border"
      aria-label="Mapa de ubicación"
    />
  );
};

export default LocationMap;
