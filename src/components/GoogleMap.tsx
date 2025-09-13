import React from 'react';
import { GoogleMap, useLoadScript, Marker, HeatmapLayer } from '@react-google-maps/api';

const libraries: ('visualization' | 'drawing' | 'geometry' | 'localContext' | 'places')[] = ['visualization'];

interface Props {
  center?: { lat: number; lng: number };
  markers?: { lat: number; lng: number }[];
  heatmapData?: { lat: number; lng: number; weight?: number }[];
  className?: string;
}

const GoogleMapComponent: React.FC<Props> = ({ center, markers, heatmapData, className }) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_Maps_API_KEY,
    libraries,
  });

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
  };

  if (loadError) {
    return <div>Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div>Loading Maps...</div>;
  }

  const heatmapDataGoogle = heatmapData?.map(point => ({
    location: new window.google.maps.LatLng(point.lat, point.lng),
    weight: point.weight || 1,
  }));

  return (
    <div className={className} style={mapContainerStyle}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={12}
      >
        {markers?.map((marker, index) => (
          <Marker key={index} position={marker} />
        ))}
        {heatmapDataGoogle && (
          <HeatmapLayer data={heatmapDataGoogle} />
        )}
      </GoogleMap>
    </div>
  );
};

export default GoogleMapComponent;
