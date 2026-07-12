export type SurveyTipo = 'opinion' | 'votacion' | 'sondeo' | 'planificacion';
export type PreguntaTipo = 'opcion_unica' | 'multiple' | 'abierta' | 'rating_emoji';
export type SurveyOptionId = number | string;

export interface SurveyPreguntaOpcion {
  id: SurveyOptionId;
  orden: number;
  texto: string;
  valor?: string;
}

export interface SurveyPregunta {
  id: number;
  orden: number;
  tipo: PreguntaTipo;
  texto: string;
  obligatoria: boolean;
  min_selecciones?: number;
  max_selecciones?: number;
  opciones?: SurveyPreguntaOpcion[];
}

export interface SurveyChannelAsset {
  canal?: string;
  titulo?: string | null;
  descripcion?: string | null;
  imagen?: string | null;
  imagen_url?: string | null;
  image?: string | null;
  image_url?: string | null;
  header?: string | null;
  header_image_url?: string | null;
  portada_url?: string | null;
  footer?: string | null;
  nota?: string | null;
  texto?: string | null;
  [key: string]: unknown;
}

export interface SurveyLiveOptionResult {
  id: SurveyOptionId;
  texto: string;
  votos: number;
}

export interface SurveyLiveQuestionResult {
  tipo: string;
  opciones: SurveyLiveOptionResult[];
}

export interface SurveyLiveResults {
  contract_version?: string;
  result_version?: number | string;
  snapshot_version?: string;
  updated_at?: string;
  total_respuestas: number;
  preguntas: Record<string, SurveyLiveQuestionResult>;
  realtime?: SurveyRealtimeContract;
}

export interface SurveyLiveTimelineMinute {
  minute?: string;
  timestamp?: string;
  label?: string;
  total?: number;
  respuestas?: number;
  value?: number;
}

export interface SurveyLiveMomentum {
  window_minutes?: number;
  last_window?: number;
  previous_window?: number;
  last_10m?: number;
  previous_10m?: number;
  trend?: 'subiendo' | 'estable' | 'bajando' | string;
  delta?: number;
}

export interface SurveyLiveKpis {
  responses_last_hour?: number;
  participation_per_minute?: number;
  heatmap_coverage_cells?: number;
  leader?: unknown;
  leader_label?: string | null;
  active_filters?: Record<string, unknown>;
}

export interface SurveyLiveTelemetry {
  has_responses?: boolean;
  responses_total?: number;
  responses_last_hour?: number;
  participation_per_minute?: number;
  trend?: string;
  polling_interval_ms?: number;
  active_filters?: Record<string, unknown>;
}

export interface SurveyAiSignal {
  contract_version?: string;
  provider_family?: string;
  mode?: string;
  hf_status?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  collection?: Record<string, unknown>;
  recommended_actions?: Array<Record<string, unknown>>;
  advisory_policy?: Record<string, unknown>;
  frontend_contract?: Record<string, unknown>;
}

export interface SurveySecurityContract {
  contract_version?: string;
  provider?: string;
  surface?: string;
  status?: string;
  configured?: boolean;
  enforced?: boolean;
  required?: boolean;
  token_header?: string;
  token_fields?: string[];
  retryable?: boolean;
  reset_required?: boolean;
  reason?: string;
}

export interface SurveyFrontendContract {
  contract_version?: string;
  render_as?: string;
  security_provider?: string;
  auth_mode?: 'anonymous' | 'optional' | 'required';
  identity?: {
    mode?: 'anonymous' | 'optional' | 'required';
    provider?: string;
    [key: string]: unknown;
  };
  turnstile?: {
    enabled?: boolean;
    required?: boolean;
    status?: string;
    surface?: string;
    token_header?: string;
    token_fields?: string[];
    can_retry?: boolean;
    reset_required?: boolean;
  };
  can_retry?: boolean;
  reset_turnstile?: boolean;
  [key: string]: unknown;
}

export interface SurveyLiveHeatmapPoint {
  lat?: number;
  lng?: number;
  value?: number;
  respuestas?: number;
  barrio?: string;
  canal?: string;
  [key: string]: unknown;
}

export interface SurveyLiveHeatmapCell {
  id?: string;
  lat?: number;
  lng?: number;
  value?: number;
  respuestas?: number;
  barrio?: string;
  canal?: string;
  [key: string]: unknown;
}

export interface SurveyLiveHeatmap {
  points?: SurveyLiveHeatmapPoint[];
  cells?: SurveyLiveHeatmapCell[];
  metadata?: Record<string, unknown>;
}

export interface SurveyLiveAnalyticsRange {
  contract_version?: 'surveys.analytics_range.v1' | string;
  mode?: 'preset' | 'custom' | 'all_time' | string;
  preset?: 'last_60m' | 'today' | 'last_24h' | null;
  label?: string;
  timezone?: string;
  desde?: string | null;
  hasta?: string | null;
  duration_minutes?: number | null;
}

export interface SurveyProductSurface {
  name?: string;
  scope?: string;
  supports?: string[];
  [key: string]: unknown;
}

export interface SurveyRealtimeEventContract {
  name?: string;
  contract_version?: string;
  [key: string]: unknown;
}

export interface SurveyRealtimeSocketContract {
  enabled?: boolean;
  path?: string;
  join_event?: string;
  join_payload?: Record<string, unknown>;
  join_payloads?: Array<Record<string, unknown>>;
  events?: Array<SurveyRealtimeEventContract | string>;
  [key: string]: unknown;
}

export interface SurveyRealtimeContract {
  contract_version?: string;
  enabled?: boolean;
  room?: string | null;
  primary_room?: string | null;
  legacy_room?: string | null;
  rooms?: string[];
  socket?: SurveyRealtimeSocketContract;
  polling?: Record<string, unknown>;
  versioning?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SurveyLivePublicQuestionOption {
  id?: SurveyOptionId;
  label?: string;
  texto?: string;
  value?: string;
  votos?: number;
  porcentaje?: number;
}

export interface SurveyLivePublicQuestion {
  id?: string | number;
  tipo?: string;
  texto?: string;
  titulo?: string;
  total_votos?: number;
  opciones?: SurveyLivePublicQuestionOption[];
}

export interface SurveyLivePublicResultsPayload {
  contract_version?: string;
  result_version?: number | string;
  snapshot_version?: string;
  request_id?: string;
  slug?: string;
  slug_publico?: string;
  total_respuestas?: number;
  analytics_range?: SurveyLiveAnalyticsRange;
  preguntas?: SurveyLivePublicQuestion[];
  timeline_minute?: SurveyLiveTimelineMinute[];
  momentum?: SurveyLiveMomentum;
  kpis?: SurveyLiveKpis;
  heatmap?: SurveyLiveHeatmap;
  realtime?: SurveyRealtimeContract;
  live_telemetry?: SurveyLiveTelemetry;
  ai_summary?: string;
  ai_insights?: string[];
  ai_signal?: SurveyAiSignal;
  ai_layers?: Record<string, unknown>;
  operator_recommendations?: Array<Record<string, unknown>>;
  render_contract?: {
    preferred_visualization?: string;
    product_surface?: SurveyProductSurface;
    supports?: string[];
    polling_interval_ms?: number;
    empty_state?: string;
    filter_keys?: string[];
    map_experience?: string;
  };
  ui_actions?: Array<Record<string, unknown>>;
  operations?: SurveyOperationsContract;
  admin_operations?: SurveyOperationsContract;
  updated_at?: string;
}

export interface SurveyPublic {
  id?: number;
  slug: string;
  slug_publico?: string;
  canonical_slug?: string;
  requested_slug?: string;
  slug_alias_used?: boolean;
  url_publica?: string;
  share_url?: string;
  public_api_endpoint?: string;
  titulo: string;
  descripcion?: string;
  tipo: SurveyTipo;
  inicio_at: string;
  fin_at: string;
  politica_unicidad: 'por_dni' | 'por_phone' | 'por_ip' | 'por_cookie' | 'por_usuario' | 'libre';
  auth_mode?: 'anonymous' | 'optional' | 'required';
  anonimo_permitido?: boolean;
  requiere_datos_contacto?: boolean;
  preguntas: SurveyPregunta[];
  portada_url?: string | null;
  imagen_portada?: string | null;
  header_image_url?: string | null;
  cover_image_url?: string | null;
  banner_url?: string | null;
  municipio_id?: number | string | null;
  municipio_nombre?: string | null;
  municipio_slug?: string | null;
  canales?: SurveyChannelAsset[] | Record<string, SurveyChannelAsset | undefined>;
  recursos?: Record<string, unknown>;
  difusion?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  branding?: Record<string, unknown>;

  // New fields for Live Voting
  es_votacion_envivo?: boolean;
  mostrar_resultados_envivo?: boolean;
  permitir_comentarios?: boolean;
  commentConfig?: SurveyCommentConfig;
  puntos_recompensa?: number;
  resultados_envivo?: SurveyLiveResults;
  security?: SurveySecurityContract;
  frontend_contract?: SurveyFrontendContract;

  [key: string]: unknown;
}

export interface SurveyComment {
  id: number;
  texto: string;
  nombre_autor?: string | null;
  fecha: string;
  user_id?: number | null;
  anon_id?: string | null;
  auth_user_id?: string | null;
  auth_provider?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  picture?: string | null;
  profile_picture_url?: string | null;
  avatar_source?: string | null;
  avatarSource?: string | null;
  profile_picture_source?: string | null;
  avatar_consent?: boolean | string | number | null;
  avatarConsent?: boolean | string | number | null;
  profile_picture_consent?: boolean | string | number | null;
  avatar_policy?: string | null;
  likes?: number;
}

export interface SurveyCommentConfig {
  requiresSocialToken?: boolean;
  acceptedModes?: string[];
}

export type SurveyLocationPrecision = 'gps' | 'manual' | 'estimada';

export interface SurveyLocationMetadata {
  pais?: string;
  provincia?: string;
  ciudad?: string;
  barrio?: string;
  codigoPostal?: string;
  lat?: number;
  lng?: number;
  precision?: SurveyLocationPrecision;
  origen?: 'gps' | 'usuario' | 'ip' | 'backend';
}

export interface SurveyDemographicMetadata {
  genero?: string;
  generoDescripcion?: string;
  rangoEtario?: string;
  nivelEducativo?: string;
  situacionLaboral?: string;
  ocupacion?: string;
  tiempoResidencia?: string;
  ubicacion?: SurveyLocationMetadata;
}

export interface SurveyAnalyticsMetadata {
  demographics?: SurveyDemographicMetadata;
  answeredQuestions?: number;
  totalQuestions?: number;
  submittedAt?: string;
  canal?: string;
}

export interface PublicResponsePayload {
  dni?: string | null;
  phone?: string | null;
  respuestas: Array<{
    pregunta_id: number;
    opcion_ids?: SurveyOptionId[];
    texto_libre?: string | null;
  }>;
  utm_source?: string;
  utm_campaign?: string;
  canal?: 'qr' | 'web' | 'whatsapp' | 'email';
  metadata?: SurveyAnalyticsMetadata;
  turnstile_token?: string;
}

export interface SurveyAdmin extends SurveyPublic {
  id: number;
  estado: 'borrador' | 'publicada' | 'cerrada' | 'archivada';
  created_at?: string;
  updated_at?: string;
  anonimato?: boolean;
  unica_por_persona?: boolean;
}

export interface SurveyDraftPayload {
  titulo: string;
  slug?: string;
  descripcion?: string;
  tipo: SurveyTipo;
  inicio_at?: string | null;
  fin_at?: string | null;
  politica_unicidad: SurveyPublic['politica_unicidad'];
  anonimato: boolean;
  requiere_datos_contacto: boolean;
  preguntas: Array<{
    id?: number;
    orden: number;
    tipo: PreguntaTipo;
    texto: string;
    obligatoria: boolean;
    min_selecciones?: number | null;
    max_selecciones?: number | null;
    opciones?: Array<{
      id?: SurveyOptionId;
      orden: number;
      texto: string;
      valor?: string;
    }>;
  }>;

  es_votacion_envivo?: boolean;
  mostrar_resultados_envivo?: boolean;
  permitir_comentarios?: boolean;
  puntos_recompensa?: number;
}

export interface SurveyListResponse {
  data: SurveyAdmin[];
  meta?: {
    total: number;
    draftCount?: number;
    activeCount?: number;
  };
}

export interface SurveySummaryOptionBreakdown {
  opcion_id: SurveyOptionId;
  texto: string;
  respuestas: number;
  porcentaje: number;
}

export interface SurveySummaryPregunta {
  pregunta_id: number;
  texto: string;
  total_respuestas: number;
  opciones: SurveySummaryOptionBreakdown[];
}

export interface SurveyDemographicBreakdownItem {
  clave?: string | null;
  etiqueta?: string | null;
  respuestas: number;
  porcentaje?: number;
}

export type SurveyDemographicBreakdowns = {
  [key: string]: SurveyDemographicBreakdownItem[] | undefined;
  genero?: SurveyDemographicBreakdownItem[];
  generos?: SurveyDemographicBreakdownItem[];
  rango_etario?: SurveyDemographicBreakdownItem[];
  rangos_etarios?: SurveyDemographicBreakdownItem[];
  rangoEtario?: SurveyDemographicBreakdownItem[];
  rangosEtarios?: SurveyDemographicBreakdownItem[];
  pais?: SurveyDemographicBreakdownItem[];
  paises?: SurveyDemographicBreakdownItem[];
  provincia?: SurveyDemographicBreakdownItem[];
  provincias?: SurveyDemographicBreakdownItem[];
  ciudad?: SurveyDemographicBreakdownItem[];
  ciudades?: SurveyDemographicBreakdownItem[];
  barrio?: SurveyDemographicBreakdownItem[];
  barrios?: SurveyDemographicBreakdownItem[];
};

export interface SurveySummary {
  total_respuestas: number;
  participantes_unicos: number;
  tasa_completitud: number;
  preguntas: SurveySummaryPregunta[];
  canales?: Array<{ canal: string; respuestas: number }>;
  utms?: Array<{ fuente: string; campania?: string; respuestas: number }>;
  demografia?: SurveyDemographicBreakdowns;
}


export interface SurveyForecast {
  projected_total?: number;
  current_rate?: number;
  confidence?: number;
  window_minutes?: number;
  horizon_minutes?: number;
}

export interface SurveyAlert {
  id?: string | number;
  severity?: 'high' | 'medium' | 'info' | string;
  title?: string;
  message?: string;
  action?: string;
}

export interface SurveyBrief {
  summary?: string;
  highlights?: string[];
  recommendations?: string[];
}


export interface SurveySegmentCompareBucket {
  question_id?: number | string;
  question_text?: string;
  segment_a?: number;
  segment_b?: number;
  delta?: number;
}

export interface SurveySegmentMeta {
  label?: string;
  filters?: Record<string, unknown>;
  count?: number;
  coverage?: number;
  [key: string]: unknown;
}

export interface SurveySegmentsCompare {
  segment_a_label?: string;
  segment_b_label?: string;
  segment_a?: { meta?: SurveySegmentMeta; [key: string]: unknown };
  segment_b?: { meta?: SurveySegmentMeta; [key: string]: unknown };
  comparison_meta?: Record<string, unknown>;
  buckets?: SurveySegmentCompareBucket[];
}

export interface SurveySegmentSuggestion {
  label?: string;
  filters?: Record<string, string | number | boolean>;
  count?: number;
  coverage?: number;
  [key: string]: unknown;
}

export interface SurveySegmentsSuggestions {
  dimensions?: Record<string, SurveySegmentSuggestion[]>;
  [key: string]: unknown;
}

export interface SurveyAnomalySignal {
  id?: string | number;
  type?: string;
  detail?: string;
  score?: number;
  why_it_matters?: string;
  recommended_action?: string;
  affected_segment?: string;
  confidence?: number | string;
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  timestamp?: string;
}

export interface SurveyAnomalies {
  risk_score?: number;
  risk_level?: 'bajo' | 'medio' | 'alto' | string;
  severity?: 'low' | 'medium' | 'high' | 'critical' | string;
  signals?: SurveyAnomalySignal[];
  top_anomalies?: SurveyAnomalySignal[];
}

export interface SurveyTimeseriesPoint {
  fecha: string;
  respuestas: number;
}

export interface SurveyHeatmapPoint {
  lat: number;
  lng: number;
  respuestas: number;
  categoria?: string;
  canal?: string;
  [key: string]: unknown;
}

export interface SurveyAnalyticsHeatmap {
  points: SurveyHeatmapPoint[];
  cells?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  headline?: string;
  legend?: Record<string, unknown> | Array<Record<string, unknown>>;
  empty_state?: string | Record<string, unknown>;
  recommended_action?: string | Record<string, unknown>;
  render_contract?: Record<string, unknown>;
  map?: Record<string, unknown>;
  map_experience?: Record<string, unknown>;
  category_layers?: Record<string, unknown>;
  ai_layers?: Record<string, unknown>;
  quality?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SurveyExecutiveSummary {
  headline?: string;
  one_liner?: string;
  focus_points?: string[];
  alert_count?: number;
  projected_additional?: number;
  [key: string]: unknown;
}

export interface SurveyVisualBlueprint {
  charts?: Array<Record<string, unknown>>;
  tables?: Array<Record<string, unknown>>;
  frontend_contract?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SurveyDashboardModules {
  summary?: SurveySummary;
  timeseries?: SurveyTimeseriesPoint[];
  heatmap?: SurveyAnalyticsHeatmap;
  forecast?: SurveyForecast;
  alerts?: SurveyAlert[];
  brief?: SurveyBrief;
  segments_compare?: SurveySegmentsCompare;
  anomalies?: SurveyAnomalies;
  publication?: SurveyPublicationContract;
  [key: string]: unknown;
}

export interface SurveyPublicationLinks {
  public_page_path?: string;
  public_url?: string;
  share_url?: string;
  copy_url?: string;
  copy_text?: string;
  public_api_endpoint?: string;
  respond_endpoint?: string;
  live_results_endpoint?: string;
  results_endpoint?: string;
  legacy_public_api_endpoint?: string;
  legacy_live_results_endpoint?: string;
  qr_endpoint?: string;
  qr_image_url?: string;
  whatsapp_share_url?: string;
  [key: string]: unknown;
}

export interface SurveyPublicationAction {
  id?: string;
  label?: string;
  ui_hint?: string;
  href?: string | null;
  frontend_path?: string | null;
  route?: string | null;
  share_url?: string | null;
  enabled?: boolean;
  requires_auth?: boolean;
  requires_role?: string[];
  [key: string]: unknown;
}

export interface SurveyOperationsSurface {
  id?: string;
  label?: string;
  route?: string | null;
  frontend_path?: string | null;
  href?: string | null;
  required_roles?: string[];
  actions?: SurveyPublicationAction[];
  [key: string]: unknown;
}

export interface SurveyOperationsContract {
  contract_version?: string;
  survey_id?: number | string | null;
  public_token?: string | null;
  tenant_slug?: string | null;
  status?: string | null;
  is_live_vote?: boolean;
  live_results_enabled?: boolean;
  comments_enabled?: boolean;
  responses_count?: number;
  admin_surface?: SurveyOperationsSurface;
  analytics_surface?: SurveyOperationsSurface & {
    endpoint?: string | null;
    heatmap_route?: string | null;
    heatmap_href?: string | null;
    moderation_route?: string | null;
    moderation_href?: string | null;
  };
  public_surface?: Record<string, unknown>;
  realtime?: SurveyRealtimeContract;
  [key: string]: unknown;
}

export interface SurveyPublicationContract {
  contract_version?: string;
  encuesta_id?: number | string;
  tenant_id?: number | string | null;
  tenant_slug?: string | null;
  slug_publico?: string | null;
  canonical_slug?: string | null;
  estado?: string | null;
  public_state?: string;
  is_published?: boolean;
  has_public_link?: boolean;
  is_live_vote?: boolean;
  live_results_enabled?: boolean;
  requires_identity?: boolean;
  anonymous_allowed?: boolean;
  links?: SurveyPublicationLinks;
  actions?: SurveyPublicationAction[];
  operations?: SurveyOperationsContract;
  admin_operations?: SurveyOperationsContract;
  [key: string]: unknown;
}


export interface SurveyAdminTemplateTab {
  key?: string;
  label?: string;
  description?: string;
  [key: string]: unknown;
}

export interface SurveyAdminTemplateDataset {
  key?: string;
  label?: string;
  description?: string;
  kind?: string;
  items?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface SurveyAdminTemplateDecisionCard {
  key?: string;
  title?: string;
  summary?: string;
  priority?: string | number;
  evidence?: string[];
  [key: string]: unknown;
}

export interface SurveyAdminTemplateMapLayer {
  key?: string;
  label?: string;
  type?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface SurveyAdminTemplate {
  title?: string;
  description?: string;
  layout_version?: string;
  tabs?: SurveyAdminTemplateTab[];
  stack?: Record<string, unknown>;
  chart_stack?: { recommended?: string[]; [key: string]: unknown };
  datasets?: SurveyAdminTemplateDataset[] | Record<string, unknown>;
  decision_cards?: SurveyAdminTemplateDecisionCard[];
  map_layers?: SurveyAdminTemplateMapLayer[];
  visual_modules?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface SurveyExecutiveKpi {
  value?: string | number;
  trend?: string | number;
  status?: string;
  explanation?: string;
  [key: string]: unknown;
}

export interface SurveyDashboardBundle {
  executive_summary?: SurveyExecutiveSummary;
  visual_blueprint?: SurveyVisualBlueprint;
  admin_template?: SurveyAdminTemplate;
  modules?: SurveyDashboardModules;
  survey_publication?: SurveyPublicationContract;
  operations?: SurveyOperationsContract;
  admin_operations?: SurveyOperationsContract;
  public_links?: SurveyPublicationLinks;
  kpis?: Record<string, unknown>;
  kpis_executive?: Record<string, SurveyExecutiveKpi>;
  frontend_render_contract?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SurveyAnalyticsFilters {
  desde?: string;
  hasta?: string;
  canal?: string;
  utm_source?: string;
  utm_campaign?: string;
  genero?: string;
  rango_etario?: string;
  pais?: string;
  provincia?: string;
  ciudad?: string;
  barrio?: string;
  bbox?: string | [number, number, number, number] | null;
}

export interface SurveyResponseAnswer {
  pregunta?: string;
  opcion?: string;
  opciones?: string[];
  respuesta?: string;
  texto?: string;
  texto_libre?: string;
  valor?: string;
  resumen?: string;
}

export interface SurveyResponseRecord {
  id?: number | string;
  respuesta_id?: number | string;
  respondido_at?: string | null;
  creado_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  canal?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
  origen?: string | null;
  metadata?: Record<string, unknown> | null;
  respuestas?: SurveyResponseAnswer[];
  resumen?: Array<{ pregunta?: string; respuesta?: string }> | string | null;
}

export interface SurveyResponseList {
  data: SurveyResponseRecord[];
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

export interface SurveyResponseFilters {
  limit?: number;
  offset?: number;
  canal?: string;
  utm_source?: string;
  utm_campaign?: string;
}

export interface SurveySnapshot {
  id: number;
  etiqueta: string;
  creado_at: string;
  publicado_at?: string | null;
  rango?: string | null;
  resumen?: SurveySummary;
}

export interface SnapshotCreatePayload {
  rango?: string;
}

export interface SnapshotPublishPayload {
  snapshot_id: number;
}

export interface SnapshotVerifyPayload {
  respuesta_id: number;
  snapshot_id: number;
}
