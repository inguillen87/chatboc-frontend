import MapLibreMap from "./MapLibreMap";

interface Props {
  lat?: number | null;
  lng?: number | null;
  onMove?: (lat: number, lng: number) => void;
  heatmapData?: { lat: number; lng: number; weight?: number }[];
}

export default function LocationMap({ lat, lng, onMove, heatmapData }: Props) {
  const center = lat != null && lng != null ? ([lng, lat] as [number, number]) : undefined;
  return (
    <MapLibreMap
      initialCenter={center}
      onSelect={(la, lo) => onMove?.(la, lo)}
      heatmapData={heatmapData}
    />
  );
}
