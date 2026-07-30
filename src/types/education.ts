export type EducationPersona = 'public' | 'family' | 'staff';

export interface EducationNavItem {
  key: string;
  label: string;
  path: string;
  enabledFlag?:
    | 'education_enabled'
    | 'family_portal_enabled'
    | 'documents_enabled'
    | 'attendance_enabled'
    | 'billing_enabled'
    | 'admissions_enabled';
}

export interface EducationStaffFilter {
  id: string;
  label: string;
  query_key?: string;
  query_value?: string;
}

export interface EducationQuickMenuItem {
  id: string;
  label: string;
  intent?: string | null;
  category?: string | null;
  requires_verification?: boolean | null;
  accepted_media?: string[];
  sensitivity_level?: string | null;
  requires_handoff?: boolean | null;
  channel_support?: string[];
  [key: string]: unknown;
}

export interface EducationCaseAlias {
  contract_version?: string;
  id?: string | number | null;
  case_id?: string | number | null;
  ticket_id?: string | number | null;
  school_id?: string | number | null;
  school_name?: string | null;
  student_id?: string | number | null;
  student_name?: string | null;
  guardian_id?: string | number | null;
  guardian_name?: string | null;
  case_type?: string | null;
  taxonomy_label?: string | null;
  status?: string | null;
  sensitivity_level?: string | null;
  requires_handoff?: boolean | null;
  [key: string]: unknown;
}

export interface EducationProfile {
  is_education?: boolean | null;
  vertical?: string | null;
  subvertical?: string | null;
  institution_type?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

export interface EducationPanelSection {
  id: string;
  label?: string | null;
  title?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  path?: string | null;
  [key: string]: unknown;
}

export interface EducationProfileField {
  id: string;
  label?: string | null;
  value?: string | number | boolean | null;
  type?: string | null;
  editable?: boolean | null;
  [key: string]: unknown;
}

export interface EducationWhatsappPlaybook {
  contract_version?: string;
  welcome?: string | null;
  quick_menu?: EducationQuickMenuItem[];
  starter_messages?: Array<string | { id?: string; label?: string; text?: string; intent?: string }>;
  media_intelligence?: Record<string, unknown>;
  routing_rules?: Record<string, unknown> | unknown[];
  safety?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EducationAdminMenu {
  contract_version?: string;
  request_id?: string;
  profile?: EducationProfile | null;
  quick_menu?: EducationQuickMenuItem[];
  taxonomy?: Record<string, unknown>;
  panel_sections?: EducationPanelSection[];
  profile_fields?: EducationProfileField[];
  whatsapp_playbook?: EducationWhatsappPlaybook | null;
  [key: string]: unknown;
}

export interface EducationTenantCapabilities {
  contract_version?: string;
  request_id?: string;
  education_profile?: EducationProfile | null;
  admin_menu?: EducationAdminMenu | null;
  whatsapp_playbook?: EducationWhatsappPlaybook | null;
  [key: string]: unknown;
}

export interface EducationOperationsAction {
  id: string;
  label?: string | null;
  priority?: string | null;
  endpoint?: string | null;
  method?: string | null;
  payload_template?: Record<string, unknown>;
  ui_hint?: string | null;
  [key: string]: unknown;
}

export interface EducationOperationsSummary {
  contract_version?: string;
  request_id?: string;
  status?: string | null;
  tenant_id?: string | number | null;
  tenant_slug?: string | null;
  education_enabled?: boolean | null;
  summary?: Record<string, number | string | boolean | null | undefined>;
  breakdown?: Record<string, Record<string, number> | unknown>;
  next_best_actions?: EducationOperationsAction[];
  [key: string]: unknown;
}

export interface EducationOperationsHeatmapPoint {
  id?: string | number;
  school_case_id?: string | number | null;
  lat: number;
  lng: number;
  weight?: number | null;
  case_type?: string | null;
  channel?: string | null;
  sensitivity_level?: string | null;
  ticket?: {
    type?: string | null;
    id?: string | number | null;
    status?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface EducationOperationsHeatmap {
  contract_version?: string;
  request_id?: string;
  render_contract?: {
    state?: 'ready' | 'empty' | string;
    map_engine?: string | null;
    layers?: string[];
    [key: string]: unknown;
  };
  summary?: Record<string, number | string | boolean | null | undefined>;
  bounds?: Record<string, unknown> | number[] | null;
  points?: EducationOperationsHeatmapPoint[];
  cells?: unknown[];
  hotspots?: unknown[];
  [key: string]: unknown;
}

export interface EducationCasesFilters {
  school_id?: string | number | null;
  campus_id?: string | number | null;
  section_id?: string | number | null;
  student_id?: string | number | null;
  guardian_id?: string | number | null;
  case_type?: string | null;
  channel?: string | null;
  sensitivity_level?: string | null;
  status?: string | null;
  assignee_id?: string | number | null;
  unassigned?: boolean | 0 | 1 | null;
  limit?: string | number | null;
  envelope?: boolean | 0 | 1 | null;
  [key: string]: string | number | boolean | null | undefined;
}

export interface EducationCasesListEnvelope {
  contract_version?: string;
  request_id?: string;
  items: unknown[];
  count?: number;
  limit?: number;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EducationStudentSummary {
  id: string;
  full_name: string;
  course_label?: string | null;
}

export interface EducationFamilyContext {
  guardian_name?: string | null;
  selected_student_name?: string | null;
  selected_student_id?: string | null;
  verification_state?: 'anonymous' | 'known' | 'verified' | 'staff' | null;
  students?: EducationStudentSummary[];
  access_gate?: {
    title?: string;
    description?: string;
    cta_label?: string;
    cta_path?: string;
    loading_label?: string;
  };
}

export interface EducationGuardianLookupPayload {
  tenant_id?: string | number;
  guardian_id?: string | number;
  document_number?: string;
  email?: string;
  phone_number?: string;
  [key: string]: unknown;
}

export interface EducationGuardianVerifyPayload {
  tenant_id?: string | number;
  guardian_id: string | number;
  verification_method: 'in_person' | 'institutional_record' | 'external_identity_provider';
  evidence_ref: string;
  [key: string]: unknown;
}

export interface EducationLinkStudentPayload {
  tenant_id?: string | number;
  guardian_id: string | number;
  student_id: string | number;
  relationship?: string;
  custody_scope?: string;
  can_pickup?: boolean;
  can_receive_billing?: boolean;
  can_receive_sensitive_updates?: boolean;
  status?: string;
  [key: string]: unknown;
}

export interface EducationCaseReplyPayload {
  message?: string;
  body?: string;
  attachments?: unknown[];
  [key: string]: unknown;
}

export interface EducationCaseAssignPayload {
  assignee_id?: string | number;
  assignee_slug?: string;
  [key: string]: unknown;
}

export interface EducationCaseEscalatePayload {
  reason?: string;
  target_queue?: string;
  [key: string]: unknown;
}

export interface EducationShellPayload {
  persona?: EducationPersona;
  title?: string;
  subtitle?: string;
  nav_items?: EducationNavItem[];
  quick_actions?: Array<{ id: string; label: string; path: string }>;
  family_context?: EducationFamilyContext;
  staff_filters?: EducationStaffFilter[];
  staff_sensitivity_filters?: EducationStaffFilter[];
  staff_context_fields?: Array<{ id: string; label: string; value: string }>;
  staff_case_timeline?: Array<{ id: string; label: string; timestamp?: string; kind?: string }>;
  education?: {
    profile?: EducationProfile | null;
    quick_menu?: EducationQuickMenuItem[];
    whatsapp_playbook?: EducationWhatsappPlaybook | null;
    admin_menu?: EducationAdminMenu | null;
    [key: string]: unknown;
  } | null;
}
