export type SurveyTipo = 'opinion' | 'votacion' | 'sondeo' | 'planificacion';
export type PreguntaTipo = 'opcion_unica' | 'multiple' | 'abierta' | 'rating_emoji';

export interface SurveyPreguntaOpcion {
  id: number;
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
  id: number;
  texto: string;
  votos: number;
}

export interface SurveyLiveQuestionResult {
  tipo: string;
  opciones: SurveyLiveOptionResult[];
}

export interface SurveyLiveResults {
  total_respuestas: number;
  preguntas: Record<string, SurveyLiveQuestionResult>;
}

export interface SurveyLiveTimelineMinute {
  minute?: string;
  timestamp?: string;
  label?: string;
  respuestas?: number;
  value?: number;
}

export interface SurveyLiveMomentum {
  last_10m?: number;
  previous_10m?: number;
  trend?: 'subiendo' | 'estable' | 'bajando' | string;
  delta?: number;
}

export interface SurveyLiveKpis {
  responses_last_hour?: number;
  participation_per_minute?: number;
  heatmap_coverage_cells?: number;
  leader?: string;
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

export interface SurveyLivePublicQuestionOption {
  value?: string;
  votos?: number;
  porcentaje?: number;
}

export interface SurveyLivePublicQuestion {
  id?: string | number;
  texto?: string;
  opciones?: SurveyLivePublicQuestionOption[];
}

export interface SurveyLivePublicResultsPayload {
  total_respuestas?: number;
  preguntas?: SurveyLivePublicQuestion[];
  timeline_minute?: SurveyLiveTimelineMinute[];
  momentum?: SurveyLiveMomentum;
  kpis?: SurveyLiveKpis;
  heatmap?: SurveyLiveHeatmap;
  ai_summary?: string;
  updated_at?: string;
}

export interface SurveyPublic {
  id?: number;
  slug: string;
  titulo: string;
  descripcion?: string;
  tipo: SurveyTipo;
  inicio_at: string;
  fin_at: string;
  politica_unicidad: 'por_dni' | 'por_phone' | 'por_ip' | 'por_cookie' | 'libre';
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
    opcion_ids?: number[];
    texto_libre?: string | null;
  }>;
  utm_source?: string;
  utm_campaign?: string;
  canal?: 'qr' | 'web' | 'whatsapp' | 'email';
  metadata?: SurveyAnalyticsMetadata;
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
      id?: number;
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
  opcion_id: number;
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
}

export interface SurveyAnalyticsHeatmap {
  points: SurveyHeatmapPoint[];
  cells?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
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
  kpis?: Record<string, unknown>;
  kpis_executive?: Record<string, SurveyExecutiveKpi>;
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
