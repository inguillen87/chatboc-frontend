import MapProviderMap from "@/components/MapProviderMap";
import type { MapLibreMapProps } from "@/components/MapLibreMap";

export default function LazyMapLibreMap(props: MapLibreMapProps) {
  return <MapProviderMap {...props} />;
}
