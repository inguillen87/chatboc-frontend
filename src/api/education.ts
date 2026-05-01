import { ApiError, apiFetch } from '@/utils/api';
import type {
  EducationCaseAssignPayload,
  EducationCaseEscalatePayload,
  EducationCaseReplyPayload,
  EducationFamilyContext,
  EducationGuardianLookupPayload,
  EducationGuardianVerifyPayload,
  EducationLinkStudentPayload,
} from '@/types/education';

type ApiFetchOptions = NonNullable<Parameters<typeof apiFetch>[1]>;
type RequestOptions = Omit<ApiFetchOptions, 'method' | 'body'>;

const shouldTryLegacyEducationEndpoint = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 405 || error.status === 501);

const getWithFallbacks = async <T>(paths: string[], options?: RequestOptions): Promise<T> => {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await apiFetch<T>(path, { method: 'GET', ...options });
    } catch (error) {
      lastError = error;
      if (!shouldTryLegacyEducationEndpoint(error)) {
        break;
      }
    }
  }

  throw lastError ?? new Error('No fue posible consultar el modulo de educacion.');
};

const postWithFallbacks = async <T, TBody>(paths: string[], body: TBody, options?: RequestOptions): Promise<T> => {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await apiFetch<T>(path, { method: 'POST', body, ...options });
    } catch (error) {
      lastError = error;
      if (!shouldTryLegacyEducationEndpoint(error)) {
        break;
      }
    }
  }

  throw lastError ?? new Error('No fue posible contactar el modulo de educacion.');
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const normalizeFamilyContext = (payload: unknown): EducationFamilyContext => {
  const record = asRecord(payload);
  const nested = asRecord(record?.family_context);
  return (nested ?? record ?? {}) as EducationFamilyContext;
};

export const educationApi = {
  lookupGuardian: (payload: EducationGuardianLookupPayload, options?: RequestOptions) =>
    postWithFallbacks<unknown, EducationGuardianLookupPayload>(
      ['/api/v1/education/guardians/lookup', '/api/v1/education/guardian/lookup'],
      payload,
      options,
    ),

  verifyGuardian: (payload: EducationGuardianVerifyPayload, options?: RequestOptions) =>
    postWithFallbacks<unknown, EducationGuardianVerifyPayload>(
      ['/api/v1/education/guardians/verify', '/api/v1/education/guardian/verify'],
      payload,
      options,
    ),

  linkStudent: (payload: EducationLinkStudentPayload, options?: RequestOptions) =>
    postWithFallbacks<unknown, EducationLinkStudentPayload>(
      ['/api/v1/education/guardians/link-student'],
      payload,
      options,
    ),

  getFamilyContext: async (options?: RequestOptions): Promise<EducationFamilyContext> => {
    const response = await getWithFallbacks<unknown>(
      [
        '/api/v1/education/me/family-context',
        '/api/v1/education/family/context',
        '/api/v1/education/family-context',
      ],
      options,
    );
    return normalizeFamilyContext(response);
  },

  getSchool: (schoolId: string | number, options?: RequestOptions) =>
    getWithFallbacks<unknown>([`/api/v1/education/schools/${encodeURIComponent(String(schoolId))}`], options),

  listCampuses: (schoolId: string | number, options?: RequestOptions) =>
    getWithFallbacks<unknown>([`/api/v1/education/schools/${encodeURIComponent(String(schoolId))}/campuses`], options),

  listSections: (schoolId: string | number, options?: RequestOptions) =>
    getWithFallbacks<unknown>([`/api/v1/education/schools/${encodeURIComponent(String(schoolId))}/sections`], options),

  getCase: (caseId: string | number, options?: RequestOptions) =>
    getWithFallbacks<unknown>([`/api/v1/education/cases/${encodeURIComponent(String(caseId))}`], options),

  replyCase: (caseId: string | number, payload: EducationCaseReplyPayload, options?: RequestOptions) =>
    postWithFallbacks<unknown, EducationCaseReplyPayload>(
      [`/api/v1/education/cases/${encodeURIComponent(String(caseId))}/reply`],
      payload,
      options,
    ),

  assignCase: (caseId: string | number, payload: EducationCaseAssignPayload, options?: RequestOptions) =>
    postWithFallbacks<unknown, EducationCaseAssignPayload>(
      [`/api/v1/education/cases/${encodeURIComponent(String(caseId))}/assign`],
      payload,
      options,
    ),

  escalateCase: (caseId: string | number, payload: EducationCaseEscalatePayload, options?: RequestOptions) =>
    postWithFallbacks<unknown, EducationCaseEscalatePayload>(
      [`/api/v1/education/cases/${encodeURIComponent(String(caseId))}/escalate`],
      payload,
      options,
    ),
};
