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
  label?: string;
  title?: string;
  description?: string;
  priority?: string;
  reason_code?: string;
  endpoint?: string;
  method?: string;
  template_id?: string;
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
  live_control_room?: {
    contract_version?: string;
    enabled?: boolean;
    state?: string;
    summary?: Record<string, unknown>;
    monitors?: OperationsBucketItem[];
    actions?: OperationsActionItem[];
    realtime?: Record<string, unknown>;
    frontend_contract?: Record<string, unknown>;
    [key: string]: unknown;
  };
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
  ai_brief?: OperationsAIBriefV1;
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
  category?: string;
  categoria?: string;
  channel?: string;
  canal?: string;
  gender?: string;
  genero?: string;
  sexo?: string;
  age?: string | number;
  edad?: string | number;
  age_range?: string;
  rango_edad?: string;
  barrio?: string;
  distrito?: string;
  status?: string;
  estado?: string;
  severity?: string;
  severidad?: string;
  [key: string]: unknown;
}

export interface OperationsHeatmapFacet {
  key: string;
  field: string;
  query_param: string;
  label: string;
  ui_hint?: string;
  items: OperationsBucketItem[];
  [key: string]: unknown;
}

export interface OperationsHeatmapDemographics {
  source?: string;
  gender: OperationsBucketItem[];
  age_ranges: OperationsBucketItem[];
  known_gender_points?: number;
  known_age_points?: number;
  unknown_gender_points?: number;
  unknown_age_points?: number;
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
  facets: OperationsHeatmapFacet[];
  category_layers: OperationsBucketItem[];
  demographics?: OperationsHeatmapDemographics;
  quality?: {
    contract_version?: string;
    state?: string;
    label?: string;
    reason_code?: string;
    coverage_rate?: number;
    coverage_percent?: number;
    visible_points?: number;
    total_ticket_records?: number;
    ticket_records_with_coordinates?: number;
    ticket_records_without_coordinates?: number;
    pending_geocode?: number;
    can_render_heatmap?: boolean;
    empty_state_action?: Record<string, unknown>;
    [key: string]: unknown;
  };
  realtime?: {
    contract_version?: string;
    poll_seconds?: number;
    socket_namespace?: string;
    socket_events?: string[];
    latest_event_at?: string | null;
    sources?: string[];
    [key: string]: unknown;
  };
  legend?: Record<string, unknown>;
  map_experience?: {
    contract_version?: string;
    preferred_visualization?: string;
    map_engines?: string[];
    layer_groups?: string[];
    empty_state_behavior?: string;
    supports_reduced_motion?: boolean;
    [key: string]: unknown;
  };
  geocoding?: {
    contract_version?: string;
    status?: string;
    reason_code?: string;
    candidate_count?: number;
    candidates?: Array<{
      record_id?: string | number;
      ticket_id?: string | number;
      address?: string;
      label?: string;
      category?: string;
      source?: string;
      reason_code?: string;
      [key: string]: unknown;
    }>;
    recommended_action?: OperationsActionItem;
    [key: string]: unknown;
  };
  segments?: Record<string, OperationsBucketItem[]>;
  applied_filters?: Record<string, unknown>;
  filters_applied?: Record<string, unknown>;
  ui?: {
    labels?: Record<string, string>;
    [key: string]: unknown;
  };
  frontend_contract?: OperationsFrontendContract;
}

export interface PublicMapConfigV1 {
  contract_version?: string;
  provider?: string;
  available_providers?: string[];
  provider_aliases?: Record<string, unknown>;
  style_url?: string;
  style_url_source?: string;
  style_url_warning?: string | null;
  maptiler_key?: string;
  google_maps_key?: string;
  [key: string]: unknown;
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

export interface OperationsAIBriefV1 {
  contract_version?: string;
  request_id?: string;
  tenant?: Record<string, unknown>;
  period?: Record<string, unknown>;
  generated_at?: string;
  source_contract?: string;
  severity?: string;
  headline?: string;
  narrative?: string;
  risk_level?: string;
  dominant_intent?: string;
  dominant_intent_label?: string;
  sentiment?: string;
  priority?: Record<string, unknown>;
  requires_human_attention?: boolean;
  requires_location_focus?: boolean;
  top_action?: OperationsActionItem;
  focus_items: OperationsBucketItem[];
  signals?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  alerts?: OperationsAlert[];
  model_policy?: Record<string, unknown>;
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
