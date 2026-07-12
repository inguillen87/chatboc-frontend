import type {
  SurveyAnalyticsRangePreset,
  SurveyLiveRequestParams,
} from '@/hooks/useSurveyLiveResults';

export const SURVEY_ANALYTICS_RANGE_OPTIONS: ReadonlyArray<{
  value: SurveyAnalyticsRangePreset;
  label: string;
}> = [
  { value: 'last_60m', label: 'Últimos 60 minutos' },
  { value: 'today', label: 'Hoy (desde las 00:00)' },
  { value: 'last_24h', label: 'Últimas 24 horas' },
];

export type SurveyAnalyticsRangeSelection = SurveyAnalyticsRangePreset | 'custom';

const isRangePreset = (value: unknown): value is SurveyAnalyticsRangePreset =>
  SURVEY_ANALYTICS_RANGE_OPTIONS.some((option) => option.value === value);

export const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const createDefaultSurveyLiveRequestParams = (
  rangeTimezone = getBrowserTimeZone(),
): SurveyLiveRequestParams => ({
  include_heatmap: 1,
  range_preset: 'last_60m',
  range_timezone: rangeTimezone,
  momentum_window_minutes: 10,
  max_points: 800,
  max_cells: 120,
});

export const normalizeStoredSurveyLiveRequestParams = (
  value: unknown,
  rangeTimezone = getBrowserTimeZone(),
): SurveyLiveRequestParams => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createDefaultSurveyLiveRequestParams(rangeTimezone);
  }

  const parsed = value as SurveyLiveRequestParams;
  const customRange = typeof parsed.desde === 'string' && typeof parsed.hasta === 'string';
  const rangePreset = isRangePreset(parsed.range_preset)
    ? parsed.range_preset
    : customRange
      ? undefined
      : 'last_60m';
  const legacyMomentum =
    typeof parsed.window_minutes === 'number' && parsed.window_minutes >= 5 && parsed.window_minutes <= 30
      ? parsed.window_minutes
      : undefined;

  return {
    include_heatmap: parsed.include_heatmap === 0 ? 0 : 1,
    ...(rangePreset ? { range_preset: rangePreset } : {}),
    ...(customRange ? { desde: parsed.desde, hasta: parsed.hasta } : {}),
    range_timezone:
      typeof parsed.range_timezone === 'string' && parsed.range_timezone.trim()
        ? parsed.range_timezone.trim()
        : rangeTimezone,
    momentum_window_minutes:
      typeof parsed.momentum_window_minutes === 'number'
        ? parsed.momentum_window_minutes
        : legacyMomentum ?? 10,
    max_points: typeof parsed.max_points === 'number' ? parsed.max_points : 800,
    max_cells: typeof parsed.max_cells === 'number' ? parsed.max_cells : 120,
    canal: parsed.canal,
    barrio: parsed.barrio,
    ciudad: parsed.ciudad,
    provincia: parsed.provincia,
  };
};

export const selectSurveyAnalyticsRange = (
  current: SurveyLiveRequestParams,
  selection: SurveyAnalyticsRangeSelection,
  now = new Date(),
): SurveyLiveRequestParams => {
  if (selection !== 'custom') {
    return {
      ...current,
      range_preset: selection,
      desde: undefined,
      hasta: undefined,
    };
  }

  const hasta = new Date(now);
  const desde = new Date(hasta.getTime() - 60 * 60 * 1000);
  return {
    ...current,
    range_preset: undefined,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
  };
};

const pad = (value: number) => String(value).padStart(2, '0');

export const toLocalDateTimeInputValue = (isoValue?: string) => {
  if (!isoValue) return '';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const fromLocalDateTimeInputValue = (value: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
