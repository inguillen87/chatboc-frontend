import React from 'react';
import MapProviderMap from '@/components/MapProviderMap';
import type {MapLibreMapProps} from '@/components/MapLibreMap';
export default function ObservedMap(props:MapLibreMapProps){
  return <><output className="sr-only" data-testid="geography-observed" data-count={props.heatmapData?.length||0} data-lat={props.heatmapData?.[0]?.lat} data-redacted={String(props.evidence?.rawPointsRedacted||false)}>Datos del mapa sintético</output><MapProviderMap {...props}/></>;
}
