import { useId, useMemo } from 'react';
import { Activity, Layers3, MapPin, Radio } from 'lucide-react';

import type { SurveyLiveHeatmap } from '@/types/encuestas';

type HeatmapDatum = {
  id: string;
  x: number;
  y: number;
  value: number;
  label?: string;
  channel?: string;
  kind: 'point' | 'cell';
};

type HeatmapSummaryItem = {
  label: string;
  value: number;
};

interface SurveyLiveHeatmapPreviewProps {
  heatmap?: SurveyLiveHeatmap | null;
  title?: string;
  subtitle?: string;
  pointsLabel?: string;
  cellsLabel?: string;
  emptyLabel?: string;
}

const VIEWBOX_WIDTH = 640;
const VIEWBOX_HEIGHT = 320;
const CELL_COLUMNS = 8;
const CELL_ROWS = 4;

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const readNumber = (item: Record<string, unknown>, keys: string[], fallback = Number.NaN) => {
  for (const key of keys) {
    const value = toFiniteNumber(item[key], Number.NaN);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

const readString = (item: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const datumValue = (item: Record<string, unknown>) =>
  Math.max(1, readNumber(item, ['value', 'respuestas', 'votos', 'count', 'total', 'weight', 'intensity'], 1));

const scaleCoordinates = <T extends { item: Record<string, unknown>; index: number; lat: number; lng: number }>(
  points: T[],
  kind: HeatmapDatum['kind'],
): HeatmapDatum[] => {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.0001, maxLat - minLat);
  const lngSpan = Math.max(0.0001, maxLng - minLng);

  return points.map(({ item, index, lat, lng }) => ({
    id: `${kind}-${readString(item, ['id', 'cellId', 'cell_id']) ?? index}`,
    x: 56 + ((lng - minLng) / lngSpan) * 528,
    y: 52 + (1 - (lat - minLat) / latSpan) * 214,
    value: datumValue(item),
    label: readString(item, ['barrio', 'zona', 'ciudad', 'label', 'name', 'categoria', 'cellId', 'cell_id']),
    channel: readString(item, ['canal', 'channel', 'source']),
    kind,
  }));
};

const normalizeGeoPoints = (heatmap: SurveyLiveHeatmap): HeatmapDatum[] => {
  const points = (heatmap.points ?? []).slice(0, 28);
  const numericPoints = points
    .map((point, index) => ({
      point,
      index,
      lat: readNumber(point, ['lat', 'latitude', 'centroid_lat']),
      lng: readNumber(point, ['lng', 'lon', 'longitude', 'centroid_lng', 'centroid_lon']),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (!numericPoints.length) {
    return points.map((point, index) => ({
      id: `point-${index}`,
      x: 70 + ((index * 87) % 500),
      y: 62 + ((index * 53) % 190),
      value: datumValue(point),
      label: readString(point, ['barrio', 'zona', 'ciudad', 'label', 'name', 'categoria']),
      channel: readString(point, ['canal', 'channel', 'source']),
      kind: 'point',
    }));
  }

  return scaleCoordinates(
    numericPoints.map(({ point, index, lat, lng }) => ({ item: point, index, lat, lng })),
    'point',
  );
};

const normalizeCells = (heatmap: SurveyLiveHeatmap): HeatmapDatum[] => {
  const cells = (heatmap.cells ?? []).slice(0, CELL_COLUMNS * CELL_ROWS);
  const numericCells = cells
    .map((cell, index) => ({
      item: cell,
      index,
      lat: readNumber(cell, ['lat', 'latitude', 'centroid_lat']),
      lng: readNumber(cell, ['lng', 'lon', 'longitude', 'centroid_lng', 'centroid_lon']),
    }))
    .filter((cell) => Number.isFinite(cell.lat) && Number.isFinite(cell.lng));

  if (numericCells.length) return scaleCoordinates(numericCells, 'cell');

  return cells.map((cell, index) => {
    const column = index % CELL_COLUMNS;
    const row = Math.floor(index / CELL_COLUMNS);
    return {
      id: `cell-${readString(cell, ['id', 'cellId', 'cell_id']) ?? index}`,
      x: 50 + column * 67,
      y: 48 + row * 52,
      value: datumValue(cell),
      label: readString(cell, ['barrio', 'zona', 'ciudad', 'label', 'name', 'categoria', 'cellId', 'cell_id']),
      channel: readString(cell, ['canal', 'channel', 'source']),
      kind: 'cell',
    };
  });
};

const summarizeBy = (items: HeatmapDatum[], picker: (item: HeatmapDatum) => string | undefined): HeatmapSummaryItem[] => {
  const totals = new Map<string, number>();
  items.forEach((item) => {
    const label = picker(item);
    if (!label) return;
    totals.set(label, (totals.get(label) ?? 0) + item.value);
  });
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
};

export function SurveyLiveHeatmapPreview({
  heatmap,
  title = 'Mapa de calor ciudadano',
  subtitle = 'Actividad geolocalizada de respuestas en vivo',
  pointsLabel = 'Puntos',
  cellsLabel = 'Celdas',
  emptyLabel = 'Sin actividad geolocalizada para los filtros actuales',
}: SurveyLiveHeatmapPreviewProps) {
  const reactId = useId();
  const svgId = reactId.replace(/:/g, '');
  const gridId = `${svgId}-survey-heatmap-grid`;
  const pointGradientId = `${svgId}-survey-heatmap-point`;
  const routeGradientId = `${svgId}-survey-heatmap-route`;
  const radarGradientId = `${svgId}-survey-heatmap-radar`;
  const cellGradientId = `${svgId}-survey-heatmap-cell`;

  const points = useMemo(() => (heatmap ? normalizeGeoPoints(heatmap) : []), [heatmap]);
  const cells = useMemo(() => (heatmap ? normalizeCells(heatmap) : []), [heatmap]);
  const allData = useMemo(() => [...points, ...cells], [points, cells]);
  const topZones = useMemo(() => summarizeBy(allData, (item) => item.label), [allData]);
  const topChannels = useMemo(() => summarizeBy(allData, (item) => item.channel), [allData]);
  const maxValue = Math.max(1, ...points.map((point) => point.value), ...cells.map((cell) => cell.value));
  const hasData = points.length > 0 || cells.length > 0;
  const totalSignal = allData.reduce((sum, item) => sum + item.value, 0);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-950 text-slate-50 shadow-sm"
      aria-label={title}
      data-testid="survey-live-heatmap-preview"
    >
      <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-200">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs text-slate-300">{subtitle}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
            {pointsLabel}: <strong className="text-white">{heatmap?.points?.length ?? 0}</strong>
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
            {cellsLabel}: <strong className="text-white">{heatmap?.cells?.length ?? 0}</strong>
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
            Zonas: <strong className="text-white">{topZones.length}</strong>
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
            Senal: <strong className="text-white">{totalSignal}</strong>
          </span>
        </div>
      </div>

      <div className="relative aspect-[2/1] min-h-[230px]">
        <svg className="h-full w-full" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img">
          <defs>
            <pattern id={gridId} width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="1" />
            </pattern>
            <radialGradient id={pointGradientId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(253, 224, 71, 0.95)" />
              <stop offset="42%" stopColor="rgba(16, 185, 129, 0.7)" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0)" />
            </radialGradient>
            <radialGradient id={radarGradientId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.22)" />
              <stop offset="55%" stopColor="rgba(34, 211, 238, 0.08)" />
              <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
            </radialGradient>
            <linearGradient id={cellGradientId} x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(45, 212, 191, 0.82)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0.34)" />
            </linearGradient>
            <linearGradient id={routeGradientId} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#facc15" />
            </linearGradient>
          </defs>

          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#020617" />
          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill={`url(#${gridId})`} />
          <circle cx="320" cy="160" r="150" fill={`url(#${radarGradientId})`} opacity="0.78" />
          {hasData ? (
            <g data-testid="survey-live-heatmap-radar" transform="translate(320 160)">
              <path d="M0 0 L144 -16 A145 145 0 0 1 144 16 Z" fill="rgba(34, 211, 238, 0.18)">
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
              </path>
              <circle r="62" fill="none" stroke="rgba(103, 232, 249, 0.16)" strokeWidth="1" />
              <circle r="112" fill="none" stroke="rgba(103, 232, 249, 0.12)" strokeWidth="1" />
            </g>
          ) : null}
          <path
            d="M58 244 C150 104 262 258 346 116 C424 12 506 92 584 56"
            fill="none"
            stroke={`url(#${routeGradientId})`}
            strokeDasharray="7 12"
            strokeLinecap="round"
            strokeWidth="2"
            opacity="0.36"
          />
          {hasData ? (
            <circle r="4" fill="#67e8f9" opacity="0.95">
              <animateMotion dur="6.5s" repeatCount="indefinite" path="M58 244 C150 104 262 258 346 116 C424 12 506 92 584 56" />
            </circle>
          ) : null}

          {cells.map((cell) => {
            const intensity = clamp(cell.value / maxValue, 0.12, 1);
            return (
              <g key={cell.id}>
                <rect
                  x={cell.x}
                  y={cell.y}
                  width="54"
                  height="40"
                  rx="10"
                  fill={`url(#${cellGradientId})`}
                  opacity={0.16 + intensity * 0.56}
                  stroke={`rgba(167, 243, 208, ${0.16 + intensity * 0.45})`}
                  strokeWidth="1"
                >
                  <title>{`${cell.label || 'Zona'}: ${cell.value}`}</title>
                </rect>
                {intensity > 0.55 ? (
                  <circle cx={cell.x + 27} cy={cell.y + 20} r={16 + intensity * 10} fill="none" stroke="#a7f3d0" strokeWidth="1" opacity="0.28" />
                ) : null}
              </g>
            );
          })}

          {points.map((point, index) => {
            const intensity = clamp(point.value / maxValue, 0.18, 1);
            const radius = 16 + intensity * 25;
            return (
              <g key={point.id}>
                <circle cx={point.x} cy={point.y} r={radius} fill={`url(#${pointGradientId})`} opacity={0.44 + intensity * 0.38} />
                <circle cx={point.x} cy={point.y} r={5 + intensity * 4} fill="#f8fafc" stroke="#34d399" strokeWidth="2">
                  <title>{`${point.label || 'Respuesta'}${point.channel ? ` - ${point.channel}` : ''}: ${point.value}`}</title>
                </circle>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={10 + intensity * 8}
                  fill="none"
                  stroke="#67e8f9"
                  strokeDasharray="3 5"
                  strokeWidth="1"
                  opacity={0.55}
                  className={index % 2 === 0 ? 'animate-pulse' : ''}
                />
              </g>
            );
          })}

          {!hasData ? (
            <g>
              <rect x="142" y="116" width="356" height="86" rx="22" fill="rgba(15, 23, 42, 0.82)" stroke="rgba(148, 163, 184, 0.28)" />
              <text x="320" y="151" textAnchor="middle" fill="#e2e8f0" fontSize="15" fontWeight="700">
                {emptyLabel}
              </text>
              <text x="320" y="176" textAnchor="middle" fill="#94a3b8" fontSize="12">
                Ajusta filtros o espera nuevas respuestas en vivo.
              </text>
            </g>
          ) : null}
        </svg>

        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 backdrop-blur">
            <Radio className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
            En vivo
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 backdrop-blur">
            <Activity className="h-3.5 w-3.5 text-emerald-200" aria-hidden="true" />
            Intensidad por volumen de respuestas
          </span>
        </div>
      </div>

      {hasData ? (
        <div
          className="grid gap-3 border-t border-white/10 bg-white/[0.03] p-4 text-xs text-slate-200 md:grid-cols-[1.2fr_0.8fr]"
          data-testid="survey-live-heatmap-operational-summary"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <Layers3 className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
              Zonas activas
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(topZones.length ? topZones : [{ label: 'Actividad geolocalizada', value: totalSignal }]).map((zone) => (
                <div key={zone.label} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
                  <p className="truncate font-medium text-white">{zone.label}</p>
                  <p className="text-[11px] text-slate-400">{zone.value} senales ponderadas</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Canales</p>
            <div className="flex flex-wrap gap-2">
              {(topChannels.length ? topChannels : [{ label: 'sin canal', value: totalSignal }]).map((channel) => (
                <span key={channel.label} className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1">
                  {channel.label}: <strong className="text-white">{channel.value}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default SurveyLiveHeatmapPreview;
