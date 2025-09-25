import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import MapLibreMap from '@/components/MapLibreMap';
import { HeatPoint } from '@/services/statsService';

interface HeatmapProps {
  initialHeatmapData: HeatPoint[];
  adminLocation?: [number, number];
  availableCategories: string[];
  availableBarrios: string[];
  availableTipos: string[];
  onSelect?: (lat: number, lon: number, address?: string) => void;
}

export const AnalyticsHeatmap: React.FC<HeatmapProps> = ({
  initialHeatmapData,
  adminLocation,
  availableCategories,
  availableBarrios,
  availableTipos,
  onSelect,
}) => {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBarrios, setSelectedBarrios] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);

  const heatmapData = useMemo(() => {
    return initialHeatmapData.filter(
      (t) =>
        (selectedTipos.length === 0 || (t.tipo_ticket && selectedTipos.includes(t.tipo_ticket))) &&
        (selectedCategories.length === 0 || (t.categoria && selectedCategories.includes(t.categoria))) &&
        (selectedBarrios.length === 0 || (t.barrio && selectedBarrios.includes(t.barrio)))
    );
  }, [initialHeatmapData, selectedTipos, selectedCategories, selectedBarrios]);

  const mapCenter = useMemo(() => {
    if (initialHeatmapData.length > 0) {
      const totalWeight = initialHeatmapData.reduce((sum, t) => sum + (t.weight || 1), 0);
      if (totalWeight > 0) {
        const avgLat = initialHeatmapData.reduce((sum, t) => sum + t.lat * (t.weight || 1), 0) / totalWeight;
        const avgLng = initialHeatmapData.reduce((sum, t) => sum + t.lng * (t.weight || 1), 0) / totalWeight;
        return [avgLng, avgLat] as [number, number];
      }
    }
    return adminLocation;
  }, [initialHeatmapData, adminLocation]);

  const boundsCoordinates = useMemo(() => {
    const coords = heatmapData
      .map((point) => [point.lng, point.lat] as [number, number])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

    if (
      adminLocation &&
      Number.isFinite(adminLocation[0]) &&
      Number.isFinite(adminLocation[1])
    ) {
      coords.push(adminLocation);
    }

    return coords;
  }, [heatmapData, adminLocation]);


  const FilterGroup: React.FC<{ title: string; items: string[]; selected: string[]; onSelectedChange: (selected: string[]) => void }> = ({ title, items, selected, onSelectedChange }) => {
    if (items.length === 0) return null;

    return (
      <div>
        <Label className="text-muted-foreground text-sm mb-2 block font-semibold">{title}</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {items.map((item) => (
            <label key={item} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <Checkbox
                checked={selected.includes(item)}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  onSelectedChange(
                    isChecked
                      ? [...selected, item]
                      : selected.filter((i) => i !== item)
                  );
                }}
              />
              {item}
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card shadow-xl rounded-xl border border-border backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">
          Ubicación y Mapa de Calor de Actividad
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-border">
            <FilterGroup title="Tipos de Ticket" items={availableTipos} selected={selectedTipos} onSelectedChange={setSelectedTipos} />
            <FilterGroup title="Categorías" items={availableCategories} selected={selectedCategories} onSelectedChange={setSelectedCategories} />
            <FilterGroup title="Barrios" items={availableBarrios} selected={selectedBarrios} onSelectedChange={setSelectedBarrios} />
        </div>

        <MapLibreMap
          center={mapCenter}
          heatmapData={heatmapData}
          adminLocation={adminLocation}
          onSelect={onSelect}
          className="h-[600px] rounded-lg"
          fitToBounds={boundsCoordinates.length > 0 ? boundsCoordinates : undefined}
          fallbackEnabled={false}
        />
      </CardContent>
    </Card>
  );
};

export default AnalyticsHeatmap;
