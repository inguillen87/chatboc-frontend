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
  actions?: OperationsActionItem[];
  [key: string]: unknown;
}

export interface OperationsOperationalHotspot extends OperationsBucketItem {
  operational_score?: number;
  rank_reason?: string;
  latest_event_at?: string | null;
  top_category?: string | null;
  top_channel?: string | null;
  lat?: number;
  lng?: number;
  signals?: {
    overdue?: number;
    unassigned?: number;
    breached_sla?: number;
    recent_24h?: number;
    tickets?: number;
    surveys?: number;
    analytics_events?: number;
    [key: string]: unknown;
  };
  recommended_action?: OperationsActionItem;
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
  href?: string;
  frontend_path?: string;
  route?: string;
  method?: string;
  action_type?: string;
  target?: Record<string, unknown>;
  template_id?: string;
  payload_template?: Record<string, unknown>;
  body_template?: Record<string, unknown>;
  requires?: string[];
  ui_hint?: string;
  writes_enabled?: boolean;
  [key: string]: unknown;
}

export type OperationsHeatmapAction = OperationsActionItem;

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

export interface OperationsCommerce {
  contract_version?: string;
  summary?: Record<string, unknown>;
  by_state?: OperationsBucketItem[];
  by_origin?: OperationsBucketItem[];
  by_source_model?: OperationsBucketItem[];
  by_request_kind?: OperationsBucketItem[];
  totals_by_currency?: OperationsBucketItem[];
  review_items?: OperationsBucketItem[];
  frontend_contract?: Record<string, unknown>;
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
  access_tenant_scoped?: boolean;
  configuration_scope?: string;
  [key: string]: unknown;
}

export type OperationsQueueLinkSemantics = 'navigation_only' | 'exact_filter';

export type OperationsQueueLinkKey =
  | 'open'
  | 'sla_breached'
  | 'sla_at_risk'
  | 'sla_unknown'
  | 'unassigned'
  | 'ownership_by_owner'
  | 'age_buckets';

export interface OperationsQueueLinkMetadata {
  semantics?: OperationsQueueLinkSemantics;
  exact_filter?: boolean;
}

export interface OperationsQueueLinkContract {
  open?: OperationsQueueLinkMetadata;
  sla_breached?: OperationsQueueLinkMetadata;
  sla_at_risk?: OperationsQueueLinkMetadata;
  sla_unknown?: OperationsQueueLinkMetadata;
  unassigned?: OperationsQueueLinkMetadata;
  ownership_by_owner?: OperationsQueueLinkMetadata;
  age_buckets?: OperationsQueueLinkMetadata;
  reason_code?: string;
  notice?: string;
}

export interface OperationsQueueOwnerBucket {
  assignee_id?: string;
  count?: number;
  href?: string;
  link_semantics?: OperationsQueueLinkSemantics;
  exact_filter?: boolean;
  [key: string]: unknown;
}

export interface OperationsQueueTruthV1 {
  contract_version?: string;
  grain?: string;
  source_models?: string[];
  as_of?: string;
  membership_quality?: {
    contract_version?: 'operations.queue_membership_quality.v1';
    creation_membership?: 'created_at_null_or_lte_as_of';
    null_created_at?: {
      policy?: 'included_with_unknown_age';
      included_records?: number;
    };
    future_created_at?: {
      state?: 'clean' | 'quarantined';
      policy?: 'excluded_from_queue';
      excluded_records?: number;
      by_source_model?: Array<{
        source_model?: string;
        excluded_records?: number;
      }>;
    };
  };
  coverage?: {
    source_records?: number;
    sla?: {
      eligible?: number;
      known?: number;
      unknown?: number;
      non_eligible?: number;
      known_pct?: number | null;
    };
    age?: Record<string, unknown>;
    ownership?: Record<string, unknown>;
    [key: string]: unknown;
  };
  queue_snapshot?: {
    grain?: string;
    as_of?: string;
    summary?: Record<string, unknown>;
    sla?: Record<string, unknown>;
    ownership?: {
      assigned?: number;
      unassigned?: number;
      numerator?: number;
      denominator?: number;
      assignment_rate_pct?: number | null;
      by_owner?: OperationsQueueOwnerBucket[];
      unassigned_href?: string;
      [key: string]: unknown;
    };
    age_buckets?: Array<OperationsBucketItem & {
      href?: string;
      link_semantics?: OperationsQueueLinkSemantics;
      exact_filter?: boolean;
    }>;
    links?: Record<string, string>;
    link_contract?: OperationsQueueLinkContract;
    [key: string]: unknown;
  };
  period_flow?: {
    grain?: string;
    period?: Record<string, unknown>;
    as_of?: string;
    summary?: Record<string, unknown>;
    does_not_measure?: string[];
    [key: string]: unknown;
  };
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
  commerce?: OperationsCommerce;
  live_chat?: OperationsLiveChat;
  employees?: OperationsEmployees;
  maps?: OperationsMaps;
  queue_truth?: OperationsQueueTruthV1;
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
  zone?: string;
  zona?: string;
  status?: string;
  estado?: string;
  severity?: string;
  severidad?: string;
  actions?: OperationsHeatmapAction[];
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

export interface OperationsHeatmapNarrative {
  contract_version?: string;
  state?: string;
  headline?: string;
  body?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  operator_summary?: string;
  empty_state_title?: string;
  empty_state_description?: string;
  primary_cta?: OperationsActionItem;
  [key: string]: unknown;
}

export interface OperationsHeatmapViewportPresetItem {
  id?: string;
  label?: string;
  mode?: string;
  default?: boolean;
  description?: string;
  center?: {
    lat?: number;
    lng?: number;
    [key: string]: unknown;
  };
  zoom?: number;
  pitch?: number;
  bearing?: number;
  radius_km?: number;
  reason_code?: string;
  [key: string]: unknown;
}

export interface OperationsHeatmapViewportContract {
  contract_version?: string;
  default_preset_id?: string;
  camera_constraints?: Record<string, unknown>;
  presets: OperationsHeatmapViewportPresetItem[];
  [key: string]: unknown;
}

export interface OperationsHeatmapLayerStyleContract {
  contract_version?: string;
  palette?: string[];
  style_tokens?: Record<string, unknown>;
  styles?: OperationsBucketItem[];
  layers?: OperationsBucketItem[];
  legend_items?: OperationsBucketItem[];
  [key: string]: unknown;
}

export interface OperationsHeatmapMapLayersContract {
  contract_version?: string;
  provider?: Record<string, unknown>;
  viewport?: Record<string, unknown>;
  category_heatmap?: Record<string, unknown>;
  intensity?: Record<string, unknown>;
  hotspots?: Record<string, unknown>;
  visual_system?: Record<string, unknown>;
  operator_metrics?: Record<string, unknown>;
  layers?: Array<Record<string, unknown>>;
  telemetry?: Record<string, unknown>;
  source_quality?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OperationsHeatmapGeoFeatureCollection {
  type: 'FeatureCollection';
  features: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OperationsHeatmapGeoLayers {
  contract_version?: string;
  provider?: string;
  coordinate_order?: string;
  points?: OperationsHeatmapGeoFeatureCollection;
  cells?: OperationsHeatmapGeoFeatureCollection;
  hotspots?: OperationsHeatmapGeoFeatureCollection;
  /** Official administrative or municipal boundaries. Never synthesized by the client. */
  boundaries?: OperationsHeatmapGeoFeatureCollection;
  categories?: Record<string, OperationsHeatmapGeoFeatureCollection>;
  [key: string]: unknown;
}

export interface OperationsHeatmapPrivacyMetadata {
  mode?: string;
  aggregation?: string;
  minimum_sample_size?: number;
  raw_points_redacted?: boolean;
  coordinate_precision?: string;
  population_source?: string;
  boundaries_source?: string;
  [key: string]: unknown;
}

export interface OperationsHeatmapSourceQuality {
  contract_version?: string;
  sources?: Record<string, Record<string, unknown>>;
  summary?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Server-issued classification for survey responses represented in the
 * operational heatmap. It does not certify administrative boundaries or
 * unrelated point sources.
 */
export interface OperationsHeatmapResponseProvenance {
  contract_version?: string;
  mode?: string;
  server_trusted_classification?: boolean;
  contains_synthetic?: boolean;
  real_responses_included?: number;
  synthetic_responses_included?: number;
  synthetic_responses_excluded?: number;
  unverified_responses_included?: number;
  unverified_responses_excluded?: number;
  synthetic_marker_contract?: string;
  [key: string]: unknown;
}

export interface OperationsHeatmapAILayers {
  contract_version?: string;
  status?: string;
  mode?: string;
  summary?: Record<string, unknown>;
  hf_status?: Record<string, unknown>;
  frontend_contract?: {
    map_engines?: string[];
    layer_groups?: string[];
    [key: string]: unknown;
  };
  layers?: OperationsBucketItem[];
  risk_layers?: OperationsBucketItem[];
  recommendations?: OperationsActionItem[];
  [key: string]: unknown;
}

export interface OperationsHeatmapAIInsights {
  contract_version?: string;
  provider_family?: string;
  mode?: string;
  domain?: string;
  advisory_policy?: Record<string, unknown>;
  thresholds?: Record<string, unknown>;
  hf_status?: Record<string, unknown>;
  groups?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  collection?: Record<string, unknown>;
  recommended_actions?: OperationsActionItem[];
  frontend_contract?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OperationsHeatmapAIStatus {
  contract_version?: string;
  provider_family?: string;
  mode?: string;
  status?: string;
  configured?: boolean;
  zero_shot_enabled?: boolean;
  used_hf?: boolean;
  fallback_reason?: string;
  safe_to_render_without_hf_token?: boolean;
  ai_layers_ready?: boolean;
  map_layer_hints?: string[];
  requires_human_attention?: boolean;
  [key: string]: unknown;
}

export interface OperationsHeatmapGeocodingGuidance {
  contract_version?: string;
  state?: string;
  reason_code?: string;
  candidate_count?: number;
  coverage_percent?: number;
  quality_state?: string;
  backend_external_calls?: string;
  queue_behavior?: string;
  recommended_actions?: OperationsActionItem[];
  [key: string]: unknown;
}

export interface OperationsHeatmapHotspotActionsContract {
  contract_version?: string;
  safe_by_default?: boolean;
  writes_enabled?: boolean;
  quality_state?: string;
  actions: OperationsActionItem[];
  playbook: OperationsActionItem[];
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
    can_render_heatmap?: boolean;
    recommended_views?: string[];
    premium_metadata?: string[] | Record<string, unknown>;
    [key: string]: unknown;
  };
  summary?: Record<string, unknown>;
  bounds?: Record<string, unknown>;
  points: OperationsHeatmapPoint[];
  cells: OperationsBucketItem[];
  hotspots: OperationsBucketItem[];
  operational_hotspots?: OperationsOperationalHotspot[];
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
  geo_layers?: OperationsHeatmapGeoLayers;
  privacy?: OperationsHeatmapPrivacyMetadata;
  map_layers?: OperationsHeatmapMapLayersContract;
  source_quality?: OperationsHeatmapSourceQuality;
  response_provenance?: OperationsHeatmapResponseProvenance;
  spatial_filter?: {
    bbox?: Record<string, unknown> | null;
    applied?: boolean;
    [key: string]: unknown;
  };
  ai_layers?: OperationsHeatmapAILayers;
  ai_insights?: OperationsHeatmapAIInsights;
  ai_status?: OperationsHeatmapAIStatus;
  map_narrative?: OperationsHeatmapNarrative;
  layer_style_contract?: OperationsHeatmapLayerStyleContract;
  viewport_presets?: OperationsHeatmapViewportContract;
  hotspot_actions?: OperationsHeatmapHotspotActionsContract;
  hotspot_playbook?: OperationsActionItem[];
  operator_playbook?: OperationsActionItem[];
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
    guidance?: OperationsHeatmapGeocodingGuidance;
    candidates?: Array<{
      record_id?: string | number;
      ticket_id?: string | number;
      address?: string;
      label?: string;
      category?: string;
      source?: string;
      reason_code?: string;
      actions?: OperationsHeatmapAction[];
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

export interface OperationsAIOpsQueueItem {
  id?: string;
  source?: string;
  source_model?: string;
  record_id?: string | number;
  title?: string;
  priority?: string;
  reason_codes?: string[];
  recommended_action?: OperationsActionItem;
  signals?: Record<string, unknown>;
  pii?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface OperationsAIOpsQueueV1 {
  contract_version?: string;
  request_id?: string;
  enabled?: boolean;
  reason_code?: string;
  agent_display_name?: string;
  tenant?: Record<string, unknown>;
  period?: Record<string, unknown>;
  generated_at?: string;
  summary?: Record<string, unknown>;
  advisory_policy?: Record<string, unknown>;
  items: OperationsAIOpsQueueItem[];
  signals?: Record<string, unknown>;
  model_policy?: Record<string, unknown>;
  frontend_contract?: OperationsFrontendContract;
}

export interface OperationsAIProviderSafeFailure {
  reason_code?: string;
  task?: string;
  error_type?: string;
  [key: string]: unknown;
}

export interface OperationsAIProviderStatusItem {
  provider?: string;
  configured?: boolean;
  key_configured?: boolean;
  enabled?: boolean;
  installed?: boolean;
  install_extras_enabled?: boolean;
  chat_default?: boolean;
  provider_order_enabled?: boolean;
  runtime_status?: string;
  runtime_configured?: boolean;
  credential_status?: string;
  live_verified?: boolean;
  live_verified_at?: string | null;
  quota_depleted?: boolean;
  fallback_behavior?: string;
  mode?: string;
  chat_model?: string;
  zero_shot_enabled?: boolean;
  zero_shot_model?: string;
  embeddings_enabled?: boolean;
  embedding_model?: string;
  vision_enabled?: boolean;
  recommended_uses?: string[];
  required_env?: string[];
  optional_env?: string[];
  last_failure?: OperationsAIProviderSafeFailure;
  [key: string]: unknown;
}

export type OperationsOpenAICapabilityKey =
  | 'chat_responses'
  | 'vision'
  | 'stt'
  | 'tts'
  | 'realtime_voice';

export interface OperationsOpenAICapabilityReadiness {
  key: OperationsOpenAICapabilityKey;
  status: 'blocked' | 'unverified' | 'live_verified';
  runtime_configured: boolean;
  provider_live_verified: boolean;
  live_verified: boolean;
  live_verified_at?: string | null;
  reason_codes: string[];
  configuration_env: string[];
}

export interface OperationsOpenAISuiteReadiness {
  contract_version?: string;
  status: 'blocked' | 'unverified' | 'partially_verified' | 'live_verified';
  key_configured: boolean;
  runtime_configured: boolean;
  provider_verification: {
    status: 'missing' | 'present_unverified' | 'live_verified';
    live_verified: boolean;
    live_verified_at?: string | null;
    scope?: string;
  };
  capability_evidence_available: boolean;
  capabilities: Record<OperationsOpenAICapabilityKey, OperationsOpenAICapabilityReadiness>;
  reason_codes: string[];
}

export interface OperationsAIProviderStatusV1 {
  contract_version?: string;
  request_id?: string;
  generated_at?: string;
  secret_values_exposed?: boolean;
  llm_provider_order: string[];
  readiness?: {
    selected_chat_provider?: string | null;
    chat_runtime_configured?: boolean;
    chat_ready?: boolean;
    specialized_ai_runtime_configured?: boolean;
    specialized_ai_ready?: boolean;
    status?: string;
    warnings?: string[];
    [key: string]: unknown;
  };
  providers: Record<string, OperationsAIProviderStatusItem>;
  openai_suite?: OperationsOpenAISuiteReadiness;
  model_policy?: Record<string, unknown>;
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
