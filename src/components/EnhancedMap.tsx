import React from 'react';
import MapLibreMap from './MapLibreMap';
import GoogleMap from './GoogleMap';

export type MapProvider = 'maplibre' | 'google';

export interface MarkerData {
  lat: number;
  lng: number;
  [key: string]: any;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight?: number;
}

interface Props {
  provider: MapProvider;
  center?: { lat: number; lng:number };
  markers?: MarkerData[];
  heatmapData?: HeatmapPoint[];
  showHeatmap?: boolean;
  className?: string;
  onSelect?: (lat: number, lng: number, address?: string) => void;
}

const EnhancedMap: React.FC<Props> = ({
  provider,
  center,
  markers,
  heatmapData,
  showHeatmap = true,
  className,
  onSelect,
}) => {
  if (provider === 'maplibre') {
    const maplibreCenter = center ? [center.lng, center.lat] as [number, number] : undefined;

    // MapLibreMap does not have a separate markers prop, it gets them from heatmapData
    // and decides to show them based on zoom level. We will pass heatmapData as is.
    return (
      <MapLibreMap
        center={maplibreCenter}
        heatmapData={heatmapData}
        showHeatmap={showHeatmap}
        className={className}
        onSelect={onSelect}
      />
    );
  }

  if (provider === 'google') {
    return (
      <GoogleMap
        center={center}
        markers={markers}
        heatmapData={heatmapData}
        className={className}
      />
    );
  }

  return <div>Invalid map provider selected.</div>;
};

export default EnhancedMap;
