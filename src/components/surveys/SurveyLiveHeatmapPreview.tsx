import { Activity, MapPin, Radio } from 'lucide-react';

import type { SurveyLiveHeatmap } from '@/types/encuestas';

type HeatmapDatum = {
  id: string;
  x: number;
  y: number;
  value: number;
  label?: string;
  channel?: string;
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

const datumValue = (item: Record<string, unknown>) =>
  Math.max(1, toFiniteNumber(item.value ?? item.respuestas ?? item.weight, 1));

const normalizeGeoPoints = (heatmap: SurveyLiveHeatmap): HeatmapDatum[] => {
  const points = (heatmap.points ?? []).slice(0, 28);
  const numericPoints = points
    .map((point, index) => ({
      point,
      index,
      lat: toFiniteNumber(point.lat, Number.NaN),
      lng: toFiniteNumber(point.lng, Number.NaN),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (!numericPoints.length) {
    return points.map((point, index) => ({
      id: `point-${index}`,
      x: 70 + ((index * 87) % 500),
      y: 62 + ((index * 53) % 190),
      value: datumValue(point),
      label: typeof point.barrio === 'string' ? point.barrio : undefined,
      channel: typeof point.canal === 'string' ? point.canal : undefined,
    }));
  }

  const lats = numericPoints.map((point) => point.lat);
  const lngs = numericPoints.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.0001, maxLat - minLat);
  const lngSpan = Math.max(0.0001, maxLng - minLng);

  return numericPoints.map(({ point, index, lat, lng }) => ({
    id: `point-${index}`,
    x: 56 + ((lng - minLng) / lngSpan) * 528,
    y: 52 + (1 - (lat - minLat) / latSpan) * 214,
    value: datumValue(point),
    label: typeof point.barrio === 'string' ? point.barrio : undefined,
    channel: typeof point.canal === 'string' ? point.canal : undefined,
  }));
};

const normalizeCells = (heatmap: SurveyLiveHeatmap): HeatmapDatum[] =>
  (heatmap.cells ?? []).slice(0, CELL_COLUMNS * CELL_ROWS).map((cell, index) => {
    const column = index % CELL_COLUMNS;
    const row = Math.floor(index / CELL_COLUMNS);
    return {
      id: String(cell.id ?? `cell-${index}`),
      x: 50 + column * 67,
      y: 48 + row * 52,
      value: datumValue(cell),
      label: typeof cell.barrio === 'string' ? cell.barrio : undefined,
      channel: typeof cell.canal === 'string' ? cell.canal : undefined,
    };
  });

export function SurveyLiveHeatmapPreview({
  heatmap,
  title = 'Mapa de calor ciudadano',
  subtitle = 'Actividad geolocalizada de respuestas en vivo',
  pointsLabel = 'Puntos',
  cellsLabel = 'Celdas',
  emptyLabel = 'Sin actividad geolocalizada para los filtros actuales',
}: SurveyLiveHeatmapPreviewProps) {
  const points = heatmap ? normalizeGeoPoints(heatmap) : [];
  const cells = heatmap ? normalizeCells(heatmap) : [];
  const maxValue = Math.max(1, ...points.map((point) => point.value), ...cells.map((cell) => cell.value));
  const hasData = points.length > 0 || cells.length > 0;

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
        <div className="grid grid-cols-2 gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
            {pointsLabel}: <strong className="text-white">{heatmap?.points?.length ?? 0}</strong>
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-200">
            {cellsLabel}: <strong className="text-white">{heatmap?.cells?.length ?? 0}</strong>
          </span>
        </div>
      </div>

      <div className="relative aspect-[2/1] min-h-[230px]">
        <svg className="h-full w-full" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} role="img">
          <defs>
            <pattern id="survey-heatmap-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="1" />
            </pattern>
            <radialGradient id="survey-heatmap-point" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(253, 224, 71, 0.95)" />
              <stop offset="42%" stopColor="rgba(16, 185, 129, 0.7)" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0)" />
            </radialGradient>
            <linearGradient id="survey-heatmap-route" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#facc15" />
            </linearGradient>
          </defs>

          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#020617" />
          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="url(#survey-heatmap-grid)" />
          <path
            d="M58 244 C150 104 262 258 346 116 C424 12 506 92 584 56"
            fill="none"
            stroke="url(#survey-heatmap-route)"
            strokeDasharray="7 12"
            strokeLinecap="round"
            strokeWidth="2"
            opacity="0.36"
          />

          {cells.map((cell) => {
            const intensity = clamp(cell.value / maxValue, 0.12, 1);
            return (
              <rect
                key={cell.id}
                x={cell.x}
                y={cell.y}
                width="54"
                height="40"
                rx="10"
                fill={`rgba(16, 185, 129, ${0.16 + intensity * 0.52})`}
                stroke={`rgba(167, 243, 208, ${0.16 + intensity * 0.45})`}
                strokeWidth="1"
              >
                <title>{`${cell.label || 'Zona'}: ${cell.value}`}</title>
              </rect>
            );
          })}

          {points.map((point, index) => {
            const intensity = clamp(point.value / maxValue, 0.18, 1);
            const radius = 16 + intensity * 25;
            return (
              <g key={point.id}>
                <circle cx={point.x} cy={point.y} r={radius} fill="url(#survey-heatmap-point)" opacity={0.44 + intensity * 0.38} />
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
    </section>
  );
}

export default SurveyLiveHeatmapPreview;
