import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import MapLibreMap from '@/components/MapLibreMap';
import { HeatPoint } from '@/services/statsService';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  type InsightItem = { label: string; count: number; weight: number; percentage: number };

  const insights = useMemo(() => {
    if (heatmapData.length === 0) {
      return null;
    }

    const totalPoints = heatmapData.length;
    const totalWeight = heatmapData.reduce((sum, point) => sum + (point.weight ?? 1), 0);
    const averageWeight = totalPoints > 0 ? totalWeight / totalPoints : 0;

    const buildBreakdown = (getter: (point: HeatPoint) => string | null | undefined): InsightItem[] => {
      const acc = new Map<string, { count: number; weight: number }>();
      heatmapData.forEach((point) => {
        const label = getter(point);
        if (!label) return;
        const current = acc.get(label) ?? { count: 0, weight: 0 };
        current.count += 1;
        current.weight += point.weight ?? 1;
        acc.set(label, current);
      });
      return Array.from(acc.entries())
        .map(([label, value]) => ({
          label,
          count: value.count,
          weight: Number(value.weight.toFixed(2)),
          percentage: totalWeight > 0 ? Number(((value.weight / totalWeight) * 100).toFixed(2)) : 0,
        }))
        .sort((a, b) => b.weight - a.weight);
    };

    const recencyBuckets = {
      last7d: 0,
      last30d: 0,
      older: 0,
      sinDato: 0,
    };

    heatmapData.forEach((point) => {
      if (!point.last_ticket_at) {
        recencyBuckets.sinDato += 1;
        return;
      }
      const lastAt = new Date(point.last_ticket_at).getTime();
      if (Number.isNaN(lastAt)) {
        recencyBuckets.sinDato += 1;
        return;
      }
      const ageDays = (Date.now() - lastAt) / (1000 * 60 * 60 * 24);
      if (ageDays <= 7) {
        recencyBuckets.last7d += 1;
      } else if (ageDays <= 30) {
        recencyBuckets.last30d += 1;
      } else {
        recencyBuckets.older += 1;
      }
    });

    const recency = Object.entries(recencyBuckets).map(([label, count]) => ({
      label,
      count,
      weight: count,
      percentage: totalPoints > 0 ? Number(((count / totalPoints) * 100).toFixed(2)) : 0,
    }));

    return {
      totalPoints,
      totalWeight: Number(totalWeight.toFixed(2)),
      averageWeight,
      categories: buildBreakdown((point) => point.categoria),
      barrios: buildBreakdown((point) => point.barrio),
      tipos: buildBreakdown((point) => point.tipo_ticket),
      estados: buildBreakdown((point) => point.estado),
      severidades: buildBreakdown((point) => point.severidad),
      recency,
    };
  }, [heatmapData]);

  const mapCenter = useMemo(() => {
    if (adminLocation) return adminLocation;

    if (initialHeatmapData.length > 0) {
      const totalWeight = initialHeatmapData.reduce((sum, t) => sum + (t.weight || 1), 0);
      if (totalWeight > 0) {
        const avgLat = initialHeatmapData.reduce((sum, t) => sum + t.lat * (t.weight || 1), 0) / totalWeight;
        const avgLng = initialHeatmapData.reduce((sum, t) => sum + t.lng * (t.weight || 1), 0) / totalWeight;
        if (Number.isFinite(avgLat) && Number.isFinite(avgLng)) {
            return [avgLng, avgLat] as [number, number];
        }
      }
    }
    return [-64.5, -34.5] as [number, number]; // Default to center of Argentina
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

  const initialZoom = adminLocation || heatmapData.length > 0 ? 12 : 4;

  const renderInsightList = (title: string, items: InsightItem[] | undefined) => {
    if (!items || items.length === 0) return null;
    return (
      <div className="space-y-2 rounded-lg border border-border/60 bg-background/80 p-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <ul className="space-y-1 text-xs">
          {items.slice(0, 5).map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2">
              <span className="truncate text-foreground">{item.label}</span>
              <span className="flex items-center gap-2 font-mono text-muted-foreground">
                <span>{item.count.toLocaleString('es-AR')}</span>
                <span>{item.percentage.toFixed(2)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

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

        {insights ? (
          <div className="space-y-4 rounded-xl border border-dashed border-border/70 bg-muted/40 p-4">
            <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-background/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Puntos geolocalizados</p>
                <p className="text-2xl font-semibold text-foreground">
                  {insights.totalPoints.toLocaleString('es-AR')}
                </p>
              </div>
              <div className="rounded-lg bg-background/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Intensidad acumulada</p>
                <p className="text-2xl font-semibold text-foreground">
                  {insights.totalWeight.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-lg bg-background/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Promedio por punto</p>
                <p className="text-2xl font-semibold text-foreground">{insights.averageWeight.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-background/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recencia (≤7d)</p>
                <p className="text-2xl font-semibold text-foreground">
                  {insights.recency.find((item) => item.label === 'last7d')?.percentage.toFixed(2) ?? '0.00'}%
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {renderInsightList('Categorías', insights.categories)}
              {renderInsightList('Barrios', insights.barrios)}
              {renderInsightList('Tipos de ticket', insights.tipos)}
              {renderInsightList('Estados', insights.estados)}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {renderInsightList('Severidad', insights.severidades)}
              {renderInsightList('Recencia', insights.recency)}
            </div>
          </div>
        ) : null}

        <MapLibreMap
          center={mapCenter}
          initialZoom={initialZoom}
          heatmapData={heatmapData}
          adminLocation={adminLocation}
          onSelect={onSelect}
          className="h-[600px] rounded-lg"
          fitToBounds={boundsCoordinates.length > 0 ? boundsCoordinates : undefined}
        />
        {heatmapData.length === 0 && (
          <Alert variant="default" className="border-border/60 border-dashed bg-muted/40">
            <AlertTitle>No hay datos georreferenciados</AlertTitle>
            <AlertDescription>
              El backend no devolvió puntos para el mapa de calor con los filtros actuales. Revisá los filtros o consultá al equipo
              responsable de los datos para confirmar que se estén enviando ubicaciones.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalyticsHeatmap;
