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
}
