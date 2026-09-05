export type SurveyTipo = 'opinion' | 'votacion' | 'sondeo' | 'planificacion';
export type PreguntaTipo = 'opcion_unica' | 'multiple' | 'abierta' | 'rating_emoji';
export type SurveyOptionId = number | string;

export interface SurveyConditionalShowIfV1 {
  question_order: number;
  option_order: number;
}

export interface SurveyConditionalLogicV1 {
  version: 1;
  show_if: SurveyConditionalShowIfV1;
}

export interface SurveyConditionalOptionSelectedV2 {
  kind: 'option_selected';
  question_ref: string;
  option_ref: string;
}

export interface SurveyConditionalGroupV2 {
  kind: 'group';
  operator: 'and' | 'or';
  children: SurveyConditionalNodeV2[];
}

export type SurveyConditionalNodeV2 =
  | SurveyConditionalOptionSelectedV2
  | SurveyConditionalGroupV2;

export interface SurveyConditionalLogicV2 {
  version: 2;
  show_if: SurveyConditionalGroupV2;
}

export type SurveyConditionalLogic = SurveyConditionalLogicV1 | SurveyConditionalLogicV2;

export interface SurveyPreguntaOpcion {
  id: SurveyOptionId;
  /** Stable canonical identity used by durable survey documents. */
  option_ref?: string | null;
  orden: number;
  texto: string;
  valor?: string;
}

export interface SurveyPregunta {
  id: number;
  /** Stable canonical identity used by durable survey documents. */
  question_ref?: string | null;
  /** Backend-native alias for question_ref; both must match when supplied. */
  logical_ref?: string | null;
  orden: number;
  tipo: PreguntaTipo;
  texto: string;
  obligatoria: boolean;
  min_selecciones?: number;
  max_selecciones?: number;
  opciones?: SurveyPreguntaOpcion[];
  conditional_logic?: SurveyConditionalLogic | null;
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

export interface SurveyResponseProvenance {
  contract_version: 'surveys.response_provenance.v1';
  mode: 'real' | 'synthetic';
  server_trusted_classification: true;
  contains_synthetic: boolean;
  real_responses_included: number;
  synthetic_responses_included: number;
  synthetic_responses_excluded: number;
  unverified_responses_included?: number;
  unverified_responses_excluded?: number;
  synthetic_marker_contract: 'surveys.demo_seeding.v1';
}

export interface SurveyLiveResults {
  contract_version?: string;
  result_version?: number | string;
  snapshot_version?: string;
  updated_at?: string;
  seeded_responses?: number;
  interactive_demo_responses?: number;
  total_respuestas: number;
  preguntas: Record<string, SurveyLiveQuestionResult>;
  realtime?: SurveyRealtimeContract;
  data_provenance?: SurveyResponseProvenance;
  response_provenance?: SurveyResponseProvenance;
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
  eligibility?: SurveyPublicEligibilityContract | null;
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

export interface SurveyHeatmapJurisdiction {
  contract_version?: string;
  country?: string | null;
  province?: string | null;
  municipality?: string | null;
  display_name?: string | null;
  center?:
    | {
        lat?: number | string;
        lng?: number | string;
        lon?: number | string;
        [key: string]: unknown;
      }
    | [number, number]
    | null;
  coordinate_reference?: string | null;
  coordinate_source?: string | null;
  [key: string]: unknown;
}

export type SurveyAdminJurisdictionScopeStatus = 'compatible' | 'conflict' | 'unverified';

export interface SurveyJurisdictionSummary {
  contract_version?: 'surveys.jurisdiction_guard.v1' | string;
  readiness_included?: boolean;
  jurisdiction_ref?: string | null;
  tenant_jurisdiction_ref?: string | null;
  survey_jurisdiction_ref?: string | null;
  content_origin?: string | null;
  content_origin_ref?: string | null;
  scope_status?: SurveyAdminJurisdictionScopeStatus | string;
  scope_reason_code?: string | null;
  tenant_verified_ref?: string | null;
  content_review_included?: boolean;
  ready?: boolean;
  reason_code?: string | null;
  [key: string]: unknown;
}

export interface SurveyAdminJurisdictionScope {
  contract_version: 'surveys.admin_jurisdiction_scope.v1';
  status: SurveyAdminJurisdictionScopeStatus;
  compatible: boolean | null;
  reason_code: string;
  action_hint: string | null;
  tenant_verified_ref: string | null;
  survey_ref: string | null;
  authoritative_source: 'server_owned_persisted_refs';
  content_review_included: false;
}

export interface SurveyAdminScopeContract {
  contract_version: 'surveys.admin_scope.v1';
  jurisdiction: SurveyAdminJurisdictionScope;
  separation: {
    required: boolean;
    reason_code: string | null;
  };
}

export interface SurveyLiveHeatmap {
  points?: SurveyLiveHeatmapPoint[];
  cells?: SurveyLiveHeatmapCell[];
  source?: string;
  jurisdiction?: SurveyHeatmapJurisdiction | string | null;
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
  seeded_responses?: number;
  interactive_demo_responses?: number;
  total_respuestas?: number;
  data_provenance?: SurveyResponseProvenance;
  response_provenance?: SurveyResponseProvenance;
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
  /** Authoritative tenant selector required when public slugs are reused across organizations. */
  tenant_slug?: string | null;
  /** Server-owned public tenant identity used for white-label presentation. */
  tenant?: {
    slug: string;
    nombre: string;
    branding?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
  /** Durable builder document that materialized this survey, when applicable. */
  document_ref?: string | null;
  slug: string;
  slug_publico?: string;
  canonical_slug?: string;
  requested_slug?: string;
  slug_alias_used?: boolean;
  url_publica?: string;
  share_url?: string;
  public_api_endpoint?: string;
  /** Revision of the question graph rendered to this participant. */
  instrument_revision?: number;
  titulo: string;
  descripcion?: string;
  tipo: SurveyTipo;
  inicio_at: string;
  fin_at: string | null;
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
  governance?: SurveyPublicGovernanceContract;
  jurisdiction?: SurveyJurisdictionSummary;

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
  /** Stable client-generated key reused only while retrying the same logical submission. */
  submission_id: string;
  /** Echoes the public instrument revision so stale forms fail explicitly. */
  instrument_revision?: number;
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
  privacy_consent?: boolean;
  privacy_policy_version?: string;
  governance?: {
    release_id: number;
    snapshot_sha256: string;
    eligibility_policy_version: string;
    consent_policy_version: string;
    consent_accepted: true;
    eligibility_acknowledged: true;
  };
}

export type SurveyEligibilityMode =
  | 'open'
  | 'self_attested'
  | 'institution_attested'
  | 'manual_review';

export interface SurveyPublicEligibilityTransport {
  kind: 'http_header';
  header_name: 'X-Survey-Eligibility-Credential';
  meta_flow_supported: false;
}

export interface SurveyPublicEligibilityContract {
  contract_version: 'surveys.public_eligibility.v1';
  policy_version: string;
  mode: SurveyEligibilityMode;
  credential_required: boolean;
  gate_status: 'attestation_only' | 'ready' | 'unavailable';
  intake_available: boolean;
  decision: 'not_evaluated' | 'credential_pending' | 'unavailable';
  transport: SurveyPublicEligibilityTransport | null;
  blocked_reason_code: string | null;
  privacy_assurance: 'attestation_only' | 'pseudonymous_internal_linkability';
  subject_identifier_exposed: false;
  plaintext_credential_persisted: false;
  persist_client_side: false;
  ballot_secrecy_certified: false;
  regulated_election_certified: false;
  result_certified: false;
  assurance_level: 'attestation_only' | 'human_reviewed_opaque_grant';
  authority_binding: null | 'operator_attested_v1';
  eligible_population: null;
  participation_rate: null;
  abstentions: null;
  denominator_status: {
    available: false;
    reason_code: 'survey_eligible_population_not_sealed';
  };
}

export interface SurveyEligibilityAckExpectation {
  contractVersion: 'surveys.public_eligibility.v1';
  releaseId: number;
  policyVersion: string;
  mode: 'institution_attested' | 'manual_review';
}

/** Runtime-only transport options. The credential must never be copied into PublicResponsePayload. */
export interface PublicSurveySubmitOptions {
  eligibilityCredential?: string;
  eligibilityExpectation?: SurveyEligibilityAckExpectation;
}

export interface SurveyAdmin extends SurveyPublic {
  id: number;
  estado: 'borrador' | 'publicada' | 'cerrada' | 'archivada';
  created_at?: string;
  updated_at?: string;
  anonimato?: boolean;
  unica_por_persona?: boolean;
  structure_guard?: {
    contract_version?: 'surveys.structure_guard.v1' | string;
    revision: number;
    locked: boolean;
    locked_at?: string | null;
  };
  metricas?: SurveyAdminMetrics;
  admin_lifecycle?: SurveyAdminLifecycle;
  admin_scope?: SurveyAdminScopeContract;
}

export interface SurveyAdminMetrics {
  total_respuestas: number;
  respuestas_ultimas_24h: number;
  respuestas_con_coordenadas: number;
  participantes_unicos: number;
  ultima_respuesta_at: string | null;
  canales?: Record<string, number>;
  utm?: Array<Record<string, unknown>>;
}

export type SurveyAdminInstrumentKind = 'survey' | 'voting';
export type SurveyAdminLifecyclePhase =
  | 'draft'
  | 'scheduled'
  | 'collecting'
  | 'live_voting'
  | 'window_ended'
  | 'closed'
  | 'archived'
  | 'unknown';

export interface SurveyAdminLifecycleAction {
  method: 'POST';
  endpoint: string;
  enabled: boolean;
  confirmation_required?: boolean;
  irreversible?: boolean;
  required_capabilities?: string[];
  disabled_reason_code?: string | null;
  next_action?: string | null;
}

export interface SurveyAdminLifecycle {
  contract_version: 'surveys.admin_lifecycle.v1';
  instrument_kind: SurveyAdminInstrumentKind;
  phase: SurveyAdminLifecyclePhase;
  persisted_state: SurveyAdmin['estado'] | string;
  accepts_responses: boolean;
  operational_block: {
    reason_code: 'survey_jurisdiction_binding_conflict';
    action_hint: 'separate_and_review_foreign_jurisdiction_instrument';
  } | null;
  jurisdiction: {
    status: SurveyAdminJurisdictionScopeStatus;
    reason_code: string;
    content_review_included: false;
  };
  government_survey_evidence_gate?: {
    contract_version: 'surveys.government_evidence_gate.v1' | string;
    required: boolean;
    ready: boolean;
    reason_code: string;
    next_action: string | null;
  };
  schedule: {
    opens_at: string | null;
    closes_at: string | null;
    evaluated_at: string;
  };
  participation: {
    responses: number;
    unique_participants: number;
    responses_last_24h: number;
    last_response_at: string | null;
    eligible_population: number | null;
    participation_rate: number | null;
    abstentions: number | null;
    denominator_status: {
      available: boolean;
      reason_code: string | null;
    };
  };
  capabilities: {
    can_publish: boolean;
    can_close: boolean;
    can_delete: boolean;
    can_share: boolean;
    can_view_results: boolean;
  };
  actions: {
    publish: SurveyAdminLifecycleAction;
    close: SurveyAdminLifecycleAction;
  };
}

export type SurveyGovernanceReleaseStatus = 'draft' | 'published' | 'closed';

export interface SurveyGovernanceEligibilityPolicy {
  contract_version?: string;
  policy_version: string;
  mode: 'open' | 'self_attested' | 'institution_attested' | 'manual_review' | string;
  declarations: string[];
  human_review_required: boolean;
  automated_decision: boolean;
  stores_roster_or_pii?: boolean;
  decision_state?: string;
}

export interface SurveyGovernanceConsentPolicy {
  contract_version?: string;
  policy_version: string;
  public_text?: string;
  text_sha256: string;
  content_format?: 'plain_text' | string;
  normalization?: 'unicode_nfc_lf_trim_v1' | string;
  required: boolean;
  stores_public_text?: boolean;
  records_participant_input?: boolean;
}

export interface SurveyGovernanceDecisionRules {
  contract_version?: string;
  quorum: {
    type: 'none' | 'minimum_responses' | 'minimum_percentage' | string;
    value: number | null;
  };
  tie: { procedure: string };
  challenge: {
    enabled: boolean;
    window_hours: number | null;
    procedure: string;
  };
  human_review_required: boolean;
  declarative_only: boolean;
  computed_outcome?: null;
}

export interface SurveyGovernancePolicy {
  eligibility?: SurveyGovernanceEligibilityPolicy;
  consent?: SurveyGovernanceConsentPolicy;
  decision_rules?: SurveyGovernanceDecisionRules;
}

export interface SurveyGovernanceClosureManifest {
  contract_version: 'surveys.closure_manifest.v1';
  tenant_id: number;
  survey_id: number;
  release_id: number;
  release_version: number;
  snapshot_sha256: string;
  policy_sha256: string;
  response_count: number;
  response_set_sha256: string;
  human_review_reference_sha256: string;
  closed_at: string;
  assurance: {
    scope: 'local_database_closure_integrity';
    regulated_election_certified: false;
    result_certified: false;
    external_anchor_verified: false;
  };
}

export interface SurveyGovernanceClosure {
  manifest_sha256: string;
  manifest: SurveyGovernanceClosureManifest;
}

export interface SurveyGovernanceRelease {
  ok?: boolean;
  contract_version: 'surveys.governance_release.v1' | string;
  release_id: number;
  survey_id: number;
  version_number: number;
  status: SurveyGovernanceReleaseStatus;
  snapshot_sha256: string;
  policy_sha256: string;
  governance?: SurveyGovernancePolicy;
  published_at?: string | null;
  closed_at?: string | null;
  closure?: SurveyGovernanceClosure | null;
  completeness?: {
    public_consent?: {
      complete?: boolean;
      reason_code?: string | null;
      content_format?: string;
      normalization?: string;
    };
  };
  capabilities?: {
    can_publish?: boolean;
    can_close?: boolean;
  };
  idempotency?: {
    persisted?: boolean;
    replayed?: boolean;
    disposition?: string;
  };
  assurance?: {
    scope?: string;
    regulated_election_certified?: boolean;
    result_certified?: boolean;
    external_verification?: string;
  };
}

export interface SurveyGovernanceReleaseList {
  ok?: boolean;
  contract_version: 'surveys.governance_releases.v1' | string;
  tenant: {
    id: number;
    slug: string;
  };
  survey_id: number;
  survey_state?: SurveyAdmin['estado'] | string;
  active_release_id?: number | null;
  latest_release_id?: number | null;
  capabilities?: {
    read?: boolean;
    manage?: boolean;
    plan_allows_write?: boolean;
    create_release?: boolean;
    required_for_mutation?: string;
  };
  items: SurveyGovernanceRelease[];
  total: number;
}

export interface SurveyPublicGovernanceContract {
  contract_version?: 'surveys.public_governance.v1' | string;
  mode?: 'legacy' | 'governed_release' | string;
  release_required?: boolean;
  active_release?: SurveyGovernanceRelease | null;
  latest_release?: SurveyGovernanceRelease | null;
  eligibility?: SurveyPublicEligibilityContract | null;
  accepting_responses?: boolean;
  blocked_reason_code?: string | null;
  regulated_election_certified?: boolean;
  result_certified?: boolean;
}

export interface SurveyGovernanceReleaseCreatePayload {
  eligibility_policy: {
    policy_version: string;
    mode: 'open' | 'self_attested' | 'institution_attested' | 'manual_review';
    declarations: string[];
    human_review_required: true;
    automated_decision: false;
  };
  consent_policy: {
    policy_version: string;
    public_text: string;
    text_sha256: string;
    required: true;
  };
  decision_rules: {
    quorum: {
      type: 'none' | 'minimum_responses' | 'minimum_percentage';
      value: number | null;
    };
    tie: { procedure: 'human_review' | 'runoff' | 'declared_tie' };
    challenge: {
      enabled: boolean;
      window_hours: number | null;
      procedure: 'human_review';
    };
    human_review_required: true;
    declarative_only: true;
  };
}

export interface SurveyDraftPayload {
  /** Optimistic concurrency token supplied by the admin read contract. */
  expected_structure_revision?: number;
  /** Stable durable-builder document identity, preserved across admin edits. */
  document_ref?: string | null;
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
    question_ref?: string | null;
    /** Backend-native alias for question_ref; both must match when supplied. */
    logical_ref?: string | null;
    orden: number;
    tipo: PreguntaTipo;
    texto: string;
    obligatoria: boolean;
    min_selecciones?: number | null;
    max_selecciones?: number | null;
    conditional_logic?: SurveyConditionalLogic | null;
    opciones?: Array<{
      id?: SurveyOptionId;
      option_ref?: string | null;
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
  contract_version?: 'surveys.admin_list.v2' | string;
  tenant?: { id: number | null; slug: string | null };
  freshness?: {
    generated_at: string;
    source: string;
    synthetic: boolean;
  };
  data_provenance?: SurveyResponseProvenance;
  data_quality?: SurveyAdminDataQuality;
  executive_summary?: SurveyAdminExecutiveOverview;
  overview?: SurveyAdminOverview;
  pagination?: SurveyListPagination;
  meta?: {
    total: number;
    draftCount?: number;
    activeCount?: number;
  };
}

export interface SurveyAdminListParams {
  estado?: SurveyAdmin['estado'];
  limit?: number;
  cursor?: string;
  page?: number;
}

export interface SurveyListPagination {
  contract_version: 'surveys.pagination.v1';
  limit: number;
  page: number | null;
  cursor: string | null;
  next_cursor: string | null;
  next_page: number | null;
  has_more: boolean;
  returned: number;
  total_items: number;
  ordering: 'id_desc';
}

export interface SurveyAdminOverview {
  total: number;
  por_estado: Record<string, number>;
  activas: number;
  con_respuestas: number;
  total_respuestas: number;
  respuestas_con_coordenadas: number;
  respuestas_ultimas_24h: number;
  accepting_responses: number;
  por_tipo_instrumento: Partial<Record<SurveyAdminInstrumentKind, number>>;
  participation_denominator: {
    available: boolean;
    reason_code: string | null;
  };
  jurisdiccion?: SurveyAdminJurisdictionAggregate;
  politica_agregacion?: SurveyAdminAggregatePolicy;
  alcance_operativo?: SurveyAdminOperationalScope;
}

export interface SurveyAdminAggregationScope {
  mode: 'returned_page';
  returned_items: number;
  query_total_items: number;
  complete_for_query: boolean;
}

export interface SurveyAdminJurisdictionAggregate {
  contract_version: 'surveys.admin_jurisdiction_aggregate.v1';
  aggregation_scope: SurveyAdminAggregationScope;
  compatible: number;
  conflict: number;
  unverified: number;
  separation_required: number;
  review_required: number;
  authoritative_source: 'server_owned_persisted_refs';
  title_inference_used: false;
  content_review_included: false;
}

export interface SurveyAdminAggregatePolicy {
  contract_version: 'surveys.admin_aggregate_policy.v1';
  general_scope: {
    included_jurisdiction_statuses: SurveyAdminJurisdictionScopeStatus[];
    conflict_instruments_included: number;
  };
  operational_scope: {
    included_jurisdiction_statuses: SurveyAdminJurisdictionScopeStatus[];
    excluded_jurisdiction_statuses: SurveyAdminJurisdictionScopeStatus[];
    unverified_is_compatible: false;
  };
}

export interface SurveyAdminGeolocationCoverage {
  available: boolean;
  numerator: number;
  denominator: number | null;
  percentage: number | null;
  reason_code: string | null;
}

export interface SurveyAdminOperationalScope {
  contract_version: 'surveys.admin_operational_scope.v1';
  aggregation_scope: SurveyAdminAggregationScope;
  selection: SurveyAdminAggregatePolicy['operational_scope'];
  instruments: {
    included: number;
    excluded_conflict: number;
    active: number;
    accepting_responses: number;
    with_responses: number;
    surveys: number;
    votings: number;
    governed: number;
  };
  participation: {
    real_responses: number;
    responses_last_24h: number;
    eligible_population: null;
    participation_rate: null;
  };
  territorial: {
    responses_with_coordinates: number;
    geolocation_coverage: SurveyAdminGeolocationCoverage;
  };
}

export interface SurveyAdminLimitation {
  reason_code: string;
  impact: string;
}

export interface SurveyAdminExecutiveOverview {
  contract_version: 'surveys.admin_executive_overview.v1';
  aggregation_scope: SurveyAdminAggregationScope;
  instruments: {
    returned: number;
    active: number;
    accepting_responses: number;
    with_responses: number;
    surveys: number;
    votings: number;
    governed: number;
  };
  jurisdiction: SurveyAdminJurisdictionAggregate;
  aggregate_policy: SurveyAdminAggregatePolicy;
  operational_scope: SurveyAdminOperationalScope;
  participation: {
    real_responses: number;
    responses_last_24h: number;
    eligible_population: null;
    participation_rate: null;
  };
  territorial: {
    responses_with_coordinates: number;
    geolocation_coverage: SurveyAdminGeolocationCoverage;
  };
  assurance: {
    regulated_election_certified: false;
    result_certified: false;
    external_verification: 'not_performed';
  };
  limitations: SurveyAdminLimitation[];
}

export interface SurveyAdminDataQuality {
  contract_version: 'surveys.admin_data_quality.v1';
  aggregation_scope: SurveyAdminAggregationScope;
  geolocation_coverage: SurveyAdminGeolocationCoverage;
  jurisdiction: SurveyAdminJurisdictionAggregate;
  response_provenance: SurveyResponseProvenance;
  limitations: SurveyAdminLimitation[];
}

export interface SurveySummaryOptionBreakdown {
  opcion_id: SurveyOptionId;
  texto: string;
  respuestas: number;
  conteo?: number;
  value?: number;
  porcentaje: number;
  respuestas_seleccionaron?: number;
  porcentaje_total_encuesta?: number;
  porcentaje_elegibles?: number;
  porcentaje_respuestas_pregunta?: number;
}

export interface SurveySummaryPregunta {
  pregunta_id: number;
  texto: string;
  tipo?: string;
  tipo_interno?: string;
  total_respuestas: number;
  respuestas_elegibles?: number;
  respuestas_respondidas?: number;
  tasa_respuesta_elegible?: number;
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
  data_provenance?: SurveyResponseProvenance;
  response_provenance?: SurveyResponseProvenance;
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

export interface SurveyAnalyticsProvenance {
  source: 'backend' | 'mixed' | 'frontend_demo_fallback';
  synthetic: boolean;
  affected_modules: Array<'summary' | 'timeseries' | 'heatmap'>;
  disclaimer?: string;
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
  data_provenance?: SurveyResponseProvenance;
  response_provenance?: SurveyResponseProvenance;
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

export type SurveyAnchorStatus =
  | 'draft'
  | 'simulated'
  | 'unverified'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export interface SurveySnapshot {
  contract_version: 'surveys.anchor.v2' | string;
  id: number;
  snapshot_id: number;
  encuesta_id: number;
  tenant_id: number;
  algo: string;
  root_hash: string;
  total_respuestas: number;
  desde_at: string;
  hasta_at: string;
  created_at?: string | null;
  created_by?: number | null;
  anchor_status: SurveyAnchorStatus;
  stored_anchor_status?: string;
  anchor_at?: string | null;
  tx_id?: string | null;
  chain?: string | null;
  is_simulated: boolean;
  published: boolean;
  externally_anchored: boolean;
  externally_verified: boolean;
  verification_status: 'unverified' | string;
  integrity_scope: 'local_merkle_snapshot' | string;
  assurance_notice: string;
}

export interface SurveySnapshotListResponse {
  contract_version: 'surveys.anchor.v2' | string;
  encuesta_id: number;
  snapshots: SurveySnapshot[];
}

export interface SnapshotCreatePayload {
  desde: string;
  hasta: string;
}

export interface SnapshotSimulationResponse extends SurveySnapshot {
  ok: true;
  operation: 'local_simulation';
}

export interface SnapshotVerificationResult {
  ok: boolean;
  contract_version: 'surveys.anchor.v2' | string;
  encuesta_id: number;
  snapshot_id: number;
  respuesta_id: number;
  root_hash: string;
  content_hash: string;
  proof: string[];
  included: boolean;
  local_proof_valid: boolean;
  valido: false;
  verified: false;
  externally_verified: false;
  verification_status: 'local_only' | 'invalid' | string;
  integrity_scope: 'local_merkle_snapshot' | string;
  assurance_notice: string;
}
