export interface AnalyticsOverview {
  conversations?: number;
  open_tickets?: number;
  overdue_tickets?: number;
  response_time?: number;
  survey_responses?: number;
  nps?: number;
  csat?: number;
  handoff_rate?: number;
}

export interface OperationsBucketItem {
  id?: string;
  key?: string;
  label?: string;
  title?: string;
  description?: string;
  value?: number;
  count?: number;
  total?: number;
  current?: number;
  previous?: number;
  direction?: string;
  percent_change?: number;
  percentage?: number;
  endpoint?: string;
  method?: string;
  reason_code?: string;
  ui_hint?: string;
  priority?: string;
  [key: string]: unknown;
}

export interface OperationsTrend {
  id?: string;
  key?: string;
  label?: string;
  current?: number;
  previous?: number;
  direction?: string;
  percent_change?: number;
  [key: string]: unknown;
}

export interface OperationsActionItem {
  id?: string;
  title?: string;
  description?: string;
  priority?: string;
  reason_code?: string;
  endpoint?: string;
  method?: string;
  payload_template?: Record<string, unknown>;
  ui_hint?: string;
  [key: string]: unknown;
}

export interface OperationsAlert {
  id?: string;
  title?: string;
  message?: string;
  description?: string;
  severity?: string;
  reason_code?: string;
  [key: string]: unknown;
}

export interface OperationsBreakdowns {
  summary?: Record<string, unknown>;
  items?: OperationsBucketItem[];
  by_status?: OperationsBucketItem[];
  by_channel?: OperationsBucketItem[];
  by_category?: OperationsBucketItem[];
  by_priority?: OperationsBucketItem[];
  [key: string]: unknown;
}

export interface OperationsLiveChat {
  summary?: Record<string, unknown>;
  active_viewers?: number;
  items?: OperationsBucketItem[];
  [key: string]: unknown;
}

export interface OperationsEmployees {
  summary?: Record<string, unknown>;
  items?: OperationsBucketItem[];
  coverage?: {
    uncovered_categories?: OperationsBucketItem[];
    uncovered_channels?: OperationsBucketItem[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OperationsMaps {
  heatmap?: {
    hotspots?: OperationsBucketItem[];
    points?: OperationsBucketItem[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OperationsFrontendContract {
  render_as?: string;
  primary_refresh_seconds?: number;
  empty_state_behavior?: string;
  labels?: Record<string, string>;
  [key: string]: unknown;
}

export interface OperationsDashboardV1 {
  contract_version?: string;
  request_id?: string;
  tenant?: Record<string, unknown>;
  period?: Record<string, unknown>;
  summary: Record<string, unknown>;
  trends?: {
    items?: OperationsTrend[];
    [key: string]: unknown;
  };
  tickets?: OperationsBreakdowns;
  surveys?: OperationsBreakdowns;
  chats?: OperationsBreakdowns;
  live_chat?: OperationsLiveChat;
  employees?: OperationsEmployees;
  maps?: OperationsMaps;
  alerts: OperationsAlert[];
  next_best_actions: OperationsActionItem[];
  frontend_contract?: OperationsFrontendContract;
}

export interface OperationsHeatmapPoint {
  id?: string | number;
  lat?: number;
  lng?: number;
  weight?: number;
  layer?: string;
  source?: string;
  type?: string;
  label?: string;
  [key: string]: unknown;
}

export interface OperationsHeatmapV1 {
  contract_version?: string;
  request_id?: string;
  tenant?: Record<string, unknown>;
  period?: Record<string, unknown>;
  render_contract?: {
    state?: string;
    map_engine?: string;
    layers?: string[];
    point_format?: Record<string, string>;
    [key: string]: unknown;
  };
  summary?: Record<string, unknown>;
  bounds?: Record<string, unknown>;
  points: OperationsHeatmapPoint[];
  cells: OperationsBucketItem[];
  hotspots: OperationsBucketItem[];
}

export interface OperationsActionCenterV1 {
  contract_version?: string;
  request_id?: string;
  tenant?: Record<string, unknown>;
  period?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  items: OperationsActionItem[];
  alerts: OperationsAlert[];
  trends?: {
    items?: OperationsTrend[];
    [key: string]: unknown;
  };
  frontend_contract?: OperationsFrontendContract;
}

export interface OperationsFreshnessSource {
  key?: string;
  label?: string;
  status?: string;
  reason_code?: string;
  period_count?: number;
  latest_at?: string;
  age_seconds?: number;
  stale_after_seconds?: number;
  recommended_action?: OperationsActionItem;
  [key: string]: unknown;
}

export interface OperationsFreshnessV1 {
  contract_version?: string;
  request_id?: string;
  tenant?: Record<string, unknown>;
  period?: Record<string, unknown>;
  status?: string;
  reason_code?: string;
  summary?: {
    sources?: number;
    fresh_sources?: number;
    stale_sources?: number;
    empty_sources?: number;
    latest_at?: string;
    employee_count?: number;
    has_operational_data?: boolean;
    can_render_dashboard?: boolean;
    can_render_heatmap?: boolean;
    [key: string]: unknown;
  };
  sources: OperationsFreshnessSource[];
  frontend_contract?: OperationsFrontendContract;
}
