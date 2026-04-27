const parseEnvFlag = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
};

export const FEATURE_ENCUESTAS = parseEnvFlag(import.meta.env.VITE_FEATURE_ENCUESTAS, true);

export const EDUCATION_FEATURE_FLAGS = {
  education_enabled: parseEnvFlag(import.meta.env.VITE_FEATURE_EDUCATION_ENABLED, false),
  family_portal_enabled: parseEnvFlag(import.meta.env.VITE_FEATURE_FAMILY_PORTAL_ENABLED, false),
  documents_enabled: parseEnvFlag(import.meta.env.VITE_FEATURE_DOCUMENTS_ENABLED, false),
  attendance_enabled: parseEnvFlag(import.meta.env.VITE_FEATURE_ATTENDANCE_ENABLED, false),
  billing_enabled: parseEnvFlag(import.meta.env.VITE_FEATURE_BILLING_ENABLED, false),
  admissions_enabled: parseEnvFlag(import.meta.env.VITE_FEATURE_ADMISSIONS_ENABLED, false),
} as const;

export type FeatureFlag = 'encuestas' | keyof typeof EDUCATION_FEATURE_FLAGS;
export type EducationFeatureFlag = keyof typeof EDUCATION_FEATURE_FLAGS;

export const isEducationFlagEnabled = (flag: EducationFeatureFlag): boolean => EDUCATION_FEATURE_FLAGS[flag];

export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  if (flag === 'encuestas') return FEATURE_ENCUESTAS;
  return EDUCATION_FEATURE_FLAGS[flag] ?? false;
};
