// Re-apply stage4Contracts.ts properly
export type SloStatus = 'ok' | 'below_target';

export interface IdentityCoverageAlert {
  channel: string;
  coverage_pct: number;
  target_pct: number;
  gap_pct: number;
  severity: 'low' | 'medium' | 'high';
}

export interface IdentityCoverageResponseV1 {
  contract_version: 'analytics.identity_coverage.v1';
  request_id: string;
  tenant_id: number | null;
  coverage_pct: number;
  slo_status: SloStatus;
  alert_count: number;
  alerts: IdentityCoverageAlert[];
}

export interface WhatsappFunnelStageV1 {
  event_name: string;
  label: string;
  sessions: number;
  unique_contacts: number;
  conversion_from_prev_pct: number | null;
}

export interface WhatsappFunnelResponseV1 {
  contract_version: string;
  tenant_id: number | null;
  scope: string;
  window_minutes: number;
  stages: WhatsappFunnelStageV1[];
}

export interface AnalyticsEventIngestAcceptedAckV1 {
  ok: true;
  contract_version: 'analytics.event_ingest.v1';
  request_id: string;
  accepted: true;
  ignored: false;
  tenant_id: number;
  event_name: string;
  contact_key?: string;
  conversation_id?: string;
  identity_source?: string;
}

export interface AnalyticsEventIngestIgnoredAckV1 {
  ok: true;
  contract_version: 'analytics.event_ingest.v1';
  request_id: string;
  accepted: false;
  ignored: true;
  reason: string;
  tenant_id: number | null;
  event_name: string;
}

export type AnalyticsEventIngestAckV1 =
  | AnalyticsEventIngestAcceptedAckV1
  | AnalyticsEventIngestIgnoredAckV1;

export interface WidgetBootstrapV1 {
  contract_version: 'auth.widget_bootstrap.v1';
  tenant: { id: number; slug: string };
  widget: { token_cookie_name: string; access_minutes: number; renew_days: number };
  jwks: { url?: string };
}

export interface WidgetTokenAckV1 {
  contract_version: 'auth.widget_token.v1';
  token: string;
  expires_in: number;
}

export interface AnalyticsEventSchemaV1 {
  contract_version: 'analytics.event_schema.v1';
  request_id: string;
  tenant_id: number;
  required_dimensions: string[];
  recommended_dimensions: string[];
  canonical_events: string[];
}

export interface PublicTicketStatusV1 {
  contract_version: 'tickets.public_status.v1';
  request_id: string;
  error?: {
    code: number;
    message: string;
  };
  ticket?: {
    nro_ticket: string;
    estado: string;
    categoria?: string;
    subcategoria?: string;
    canal_ingreso?: string;
    fecha_creacion?: string | null;
    ultima_actualizacion?: string | null;
  };
}

export interface TicketWorkflowMetadataV1 {
  contract_version: 'tickets.workflow.v1';
  request_id: string;
  states: string[];
  transitions: Record<string, string[]>;
  final_states: string[];
}

export interface PublicSurveyV1 {
  contract_version: 'encuestas.public.v1';
  encuesta: Record<string, unknown>;
}

export interface PublicSurveyResponseAckV1 {
  contract_version: 'encuestas.public_response.v1';
  success: true;
  respuesta_id: number;
  anon_id: string;
  contact_key?: string;
  conversation_id?: string;
}

export interface TenantEducationProfileV1 {
  is_education: boolean;
  institution_type: 'public' | 'private' | 'general';
  modules: string[];
}

export interface TenantProfilePublicV1 {
  contract_version: 'public.tenant_profile.v1';
  tenant: {
    slug: string;
    tipo?: string;
    rubro_profile?: {
      tenant_type?: string;
      rubro_label?: string;
      rubro_slug?: string;
      education_profile?: TenantEducationProfileV1;
    };
  };
}

export interface WidgetQuickMenuItemV1 {
  id: string;
  label: string;
  intent: string;
  institution_type?: 'public' | 'private' | 'general';
}

export interface PublicWidgetConfigV1 {
  contract_version: 'public.widget_config.v1';
  tenant: { slug: string; tipo?: string };
  widget: Record<string, unknown>;
  builder_config: Record<string, unknown>;
  suppress_global_widget: boolean;
  integration_preview: boolean;
  quick_menu?: WidgetQuickMenuItemV1[];
}
