import React, { useEffect, useRef } from "react";

interface LocationMapProps {
  lat?: number | null;
  lng?: number | null;
  onMove?: (lat: number, lng: number) => void;
  heatmapData?: { lat: number; lng: number }[];
}

const Maps_API_KEY = import.meta.env.VITE_Maps_API_KEY || "";

function ensureScriptLoaded(callback: () => void) {
  if (typeof window === "undefined") return;

  const checkReady = () => {
    if (
      window.google &&
      window.google.maps &&
      window.google.maps.Map &&
      window.google.maps.marker &&
      window.google.maps.marker.AdvancedMarkerElement &&
      window.google.maps.visualization
    ) {
      callback();
    } else {
      // If script is loaded but libraries not ready, poll
      const intervalId = setInterval(() => {
        if (
          window.google &&
          window.google.maps &&
          window.google.maps.Map &&
          window.google.maps.marker &&
          window.google.maps.marker.AdvancedMarkerElement &&
          window.google.maps.visualization
        ) {
          clearInterval(intervalId);
          callback();
        }
      }, 100);
    }
  };

  if (
    window.google &&
    window.google.maps &&
    window.google.maps.Map &&
    window.google.maps.marker &&
    window.google.maps.marker.AdvancedMarkerElement &&
    window.google.maps.visualization
  ) {
    // Already loaded and ready
    callback();
    return;
  }

  const existingScript = document.getElementById("chatboc-google-maps");
  if (existingScript && (existingScript as any)._isLoaded) {
    // Script tag exists and has loaded, check if API objects are ready
    checkReady();
    return;
  } if (existingScript) {
    // Script tag exists but might still be loading, add listener and also poll
    existingScript.addEventListener("load", checkReady);
    checkReady(); // check immediately in case it loaded between getElementById and addEventListener
    return;
  }

  const script = document.createElement("script");
  script.id = "chatboc-google-maps";
  script.src = `https://maps.googleapis.com/maps/api/js?key=${Maps_API_KEY}&v=weekly&libraries=places,marker,visualization`;
  script.async = true;
  script.defer = true; // Defer execution until HTML parsing is complete
  script.onload = () => {
    (script as any)._isLoaded = true; // Mark as loaded
    checkReady();
  };
  script.onerror = () => {
    console.error("Google Maps script failed to load.");
    // Potentially call a user-facing error handler here
  };
  document.head.appendChild(script);
}

const LocationMap: React.FC<LocationMapProps> = ({ lat, lng, onMove, heatmapData }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    ensureScriptLoaded(() => {
      if (!ref.current) return;

      if (!mapRef.current) {
        const center =
          lat != null && lng != null ? { lat, lng } : { lat: -34.6037, lng: -58.3816 };
        mapRef.current = new window.google.maps.Map(ref.current, {
          center,
          zoom: lat != null && lng != null ? 15 : 5,
          mapId: "CHATBOC_MAP_ID", // Add Map ID for Advanced Markers
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

      // Heatmap Layer Logic - runs on every update
      if (mapRef.current) {
        if (heatmapData && heatmapData.length > 0) {
          const points = heatmapData.map(
            (p) => new window.google.maps.LatLng(p.lat, p.lng)
          );
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
          // If no data, ensure heatmap is not shown
          heatmapRef.current.setMap(null);
        }
      }
    });
  }, [lat, lng, onMove, heatmapData]);

  // Added flex-grow and min-h-[200px] (or other suitable min-height)
  return <div ref={ref} className="w-full rounded-md border border-border flex-grow min-h-[200px]" />; 
};

export default LocationMap;
