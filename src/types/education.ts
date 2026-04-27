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
