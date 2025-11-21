import type {
  BreakdownResponse,
  CohortsResponse,
  HeatmapResponse,
  OperationsResponse,
  PointsResponse,
  SummaryResponse,
  TemplatesResponse,
  TimeseriesResponse,
  TopResponse,
} from '@/services/analyticsService';

export type DashboardData = {
  summary: SummaryResponse | null;
  timeseries: TimeseriesResponse | null;
  breakdownCategoria: BreakdownResponse | null;
  breakdownCanal: BreakdownResponse | null;
  breakdownEstado: BreakdownResponse | null;
  heatmap: HeatmapResponse | null;
  points: PointsResponse | null;
  topZonas: TopResponse | null;
  operations: OperationsResponse | null;
  cohorts: CohortsResponse | null;
  templates: TemplatesResponse | null;
};
