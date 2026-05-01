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
  document_number?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface EducationGuardianVerifyPayload {
  guardian_id?: string | number;
  verification_code?: string;
  code?: string;
  [key: string]: unknown;
}

export interface EducationLinkStudentPayload {
  guardian_id?: string | number;
  student_id?: string | number;
  relationship?: string;
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
}
