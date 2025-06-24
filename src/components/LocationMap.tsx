import React, { useEffect, useRef } from "react";

interface LocationMapProps {
  lat?: number | null;
  lng?: number | null;
  onMove?: (lat: number, lng: number) => void;
}

const Maps_API_KEY =
  import.meta.env.VITE_Maps_API_KEY || "AIzaSyDbEoPzFgN5zJsIeywiRE7jRI8xr5ioGNI";

function ensureScriptLoaded(callback: () => void) {
  if (typeof window === "undefined") return;
  if ((window as any).google?.maps) {
    callback();
    return;
  }
  const existing = document.getElementById("chatboc-google-maps");
  if (existing) {
    existing.addEventListener("load", callback);
    return;
  }
  const s = document.createElement("script");
  s.id = "chatboc-google-maps";
  s.src = `https://maps.googleapis.com/maps/api/js?key=${Maps_API_KEY}&libraries=places`;
  s.async = true;
  s.onload = callback;
  document.head.appendChild(s);
}

const LocationMap: React.FC<LocationMapProps> = ({ lat, lng, onMove }) => {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    ensureScriptLoaded(() => {
      if (!ref.current) return;
      if (!mapRef.current) {
        const center =
          lat != null && lng != null ? { lat, lng } : { lat: -34.6037, lng: -58.3816 };
        mapRef.current = new window.google.maps.Map(ref.current, {
          center,
          zoom: lat != null && lng != null ? 15 : 5,
        });
        markerRef.current = new window.google.maps.Marker({
          position: lat != null && lng != null ? center : undefined,
          map: mapRef.current,
          draggable: Boolean(onMove),
        });
        if (onMove && markerRef.current) {
          markerRef.current.addListener("dragend", () => {
            const pos = markerRef.current!.getPosition();
            if (pos) onMove(pos.lat(), pos.lng());
          });
        }
      } else if (lat != null && lng != null) {
        const pos = { lat, lng };
        mapRef.current!.setCenter(pos);
        mapRef.current!.setZoom(15);
        markerRef.current?.setPosition(pos);
        markerRef.current?.setMap(mapRef.current);
      }
    });
  }, [lat, lng, onMove]);

  return <div ref={ref} className="w-full h-48 rounded-md border border-border" />;
};

export default LocationMap;
