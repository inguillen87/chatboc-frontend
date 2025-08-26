import MapLibreMap from "./MapLibreMap";

interface Props {
  lat?: number | null;
  lng?: number | null;
  onSelect?: (lat: number, lng: number, address?: string) => void;
  heatmapData?: { lat: number; lng: number; weight?: number }[];
}

export default function LocationMap({ lat, lng, onSelect, heatmapData }: Props) {
  const center = lat != null && lng != null ? ([lng, lat] as [number, number]) : undefined;
  return (
    <MapLibreMap
      initialCenter={center}
      onSelect={onSelect}
      heatmapData={heatmapData}
    />
  );
}
