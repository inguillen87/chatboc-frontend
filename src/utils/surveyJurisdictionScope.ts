import type {
  SurveyAdmin,
  SurveyAdminJurisdictionScopeStatus,
} from '@/types/encuestas';

export type SurveyJurisdictionScopeSource =
  | 'admin_scope'
  | 'jurisdiction_summary'
  | 'jurisdiction_detail'
  | 'lifecycle_fallback'
  | 'missing';

export interface SurveyJurisdictionScopeResolution {
  classification: SurveyAdminJurisdictionScopeStatus;
  compatible: boolean;
  separationRequired: boolean;
  source: SurveyJurisdictionScopeSource;
  reasonCode: string;
}

const SCOPE_STATUSES = new Set<SurveyAdminJurisdictionScopeStatus>([
  'compatible',
  'conflict',
  'unverified',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const hasOwn = (record: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(record, key);

const asStatus = (value: unknown): SurveyAdminJurisdictionScopeStatus | null =>
  typeof value === 'string' && SCOPE_STATUSES.has(value as SurveyAdminJurisdictionScopeStatus)
    ? (value as SurveyAdminJurisdictionScopeStatus)
    : null;

const asReasonCode = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const normalizeRef = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const unresolved = (
  source: SurveyJurisdictionScopeSource,
  reasonCode: string,
): SurveyJurisdictionScopeResolution => ({
  classification: 'unverified',
  compatible: false,
  separationRequired: false,
  source,
  reasonCode,
});

const resolved = (
  classification: SurveyAdminJurisdictionScopeStatus,
  source: SurveyJurisdictionScopeSource,
  reasonCode: string,
): SurveyJurisdictionScopeResolution => ({
  classification,
  compatible: classification === 'compatible',
  separationRequired: classification === 'conflict',
  source,
  reasonCode,
});

const resolveStatusWithRefs = ({
  status,
  compatibleValue,
  tenantRef,
  surveyRef,
  separationRequired,
  source,
  reasonCode,
}: {
  status: SurveyAdminJurisdictionScopeStatus;
  compatibleValue?: unknown;
  tenantRef: unknown;
  surveyRef: unknown;
  separationRequired?: unknown;
  source: SurveyJurisdictionScopeSource;
  reasonCode: string;
}): SurveyJurisdictionScopeResolution => {
  const normalizedTenantRef = normalizeRef(tenantRef);
  const normalizedSurveyRef = normalizeRef(surveyRef);

  if (status === 'compatible') {
    if (
      (compatibleValue !== undefined && compatibleValue !== true) ||
      separationRequired === true ||
      !normalizedTenantRef ||
      !normalizedSurveyRef ||
      normalizedTenantRef !== normalizedSurveyRef
    ) {
      return unresolved(source, 'survey_jurisdiction_contract_inconsistent');
    }
    return resolved('compatible', source, reasonCode);
  }

  if (status === 'conflict') {
    if (
      (compatibleValue !== undefined && compatibleValue !== false) ||
      separationRequired === false ||
      !normalizedTenantRef ||
      !normalizedSurveyRef ||
      normalizedTenantRef === normalizedSurveyRef ||
      reasonCode !== 'survey_jurisdiction_binding_conflict'
    ) {
      return unresolved(source, 'survey_jurisdiction_contract_inconsistent');
    }
    return resolved('conflict', source, reasonCode);
  }

  if (
    (compatibleValue !== undefined && compatibleValue !== null) ||
    separationRequired === true
  ) {
    return unresolved(source, 'survey_jurisdiction_contract_inconsistent');
  }
  return unresolved(source, reasonCode);
};

const resolveAdminScope = (survey: SurveyAdmin): SurveyJurisdictionScopeResolution | null => {
  if (!hasOwn(survey, 'admin_scope')) return null;
  const scope = survey.admin_scope as unknown;
  if (!isRecord(scope) || scope.contract_version !== 'surveys.admin_scope.v1') {
    return unresolved('admin_scope', 'survey_admin_scope_contract_invalid');
  }

  const jurisdiction = scope.jurisdiction;
  const separation = scope.separation;
  if (
    !isRecord(jurisdiction) ||
    jurisdiction.contract_version !== 'surveys.admin_jurisdiction_scope.v1' ||
    jurisdiction.authoritative_source !== 'server_owned_persisted_refs' ||
    jurisdiction.content_review_included !== false ||
    !isRecord(separation) ||
    typeof separation.required !== 'boolean'
  ) {
    return unresolved('admin_scope', 'survey_admin_scope_contract_invalid');
  }

  const status = asStatus(jurisdiction.status);
  const reasonCode = asReasonCode(jurisdiction.reason_code);
  if (!status || !reasonCode) {
    return unresolved('admin_scope', 'survey_admin_scope_contract_invalid');
  }

  return resolveStatusWithRefs({
    status,
    compatibleValue: jurisdiction.compatible,
    tenantRef: jurisdiction.tenant_verified_ref,
    surveyRef: jurisdiction.survey_ref,
    separationRequired: separation.required,
    source: 'admin_scope',
    reasonCode,
  });
};

const resolveJurisdictionSummary = (
  survey: SurveyAdmin,
): SurveyJurisdictionScopeResolution | null => {
  const jurisdiction = survey.jurisdiction as unknown;
  if (!isRecord(jurisdiction) || !hasOwn(jurisdiction, 'scope_status')) return null;
  if (
    jurisdiction.contract_version !== 'surveys.jurisdiction_guard.v1' ||
    jurisdiction.content_review_included !== false
  ) {
    return unresolved('jurisdiction_summary', 'survey_jurisdiction_summary_contract_invalid');
  }

  const status = asStatus(jurisdiction.scope_status);
  const reasonCode = asReasonCode(jurisdiction.scope_reason_code);
  if (!status || !reasonCode) {
    return unresolved('jurisdiction_summary', 'survey_jurisdiction_summary_contract_invalid');
  }

  return resolveStatusWithRefs({
    status,
    tenantRef: jurisdiction.tenant_verified_ref ?? jurisdiction.tenant_jurisdiction_ref,
    surveyRef: jurisdiction.jurisdiction_ref ?? jurisdiction.survey_jurisdiction_ref,
    source: 'jurisdiction_summary',
    reasonCode,
  });
};

const resolveJurisdictionDetail = (
  survey: SurveyAdmin,
): SurveyJurisdictionScopeResolution | null => {
  const jurisdiction = survey.jurisdiction as unknown;
  if (!isRecord(jurisdiction) || jurisdiction.readiness_included !== true) return null;
  if (jurisdiction.contract_version !== 'surveys.jurisdiction_guard.v1') {
    return unresolved('jurisdiction_detail', 'survey_jurisdiction_detail_contract_invalid');
  }

  const tenantRef = normalizeRef(jurisdiction.tenant_jurisdiction_ref);
  const surveyRef = normalizeRef(jurisdiction.survey_jurisdiction_ref);
  const reasonCode = asReasonCode(jurisdiction.reason_code) ?? 'survey_jurisdiction_scope_unverified';
  if (tenantRef && surveyRef) {
    return resolveStatusWithRefs({
      status: tenantRef === surveyRef ? 'compatible' : 'conflict',
      tenantRef,
      surveyRef,
      source: 'jurisdiction_detail',
      reasonCode: tenantRef === surveyRef ? 'survey_jurisdiction_compatible' : 'survey_jurisdiction_binding_conflict',
    });
  }

  return unresolved('jurisdiction_detail', reasonCode);
};

const resolveLifecycleFallback = (
  survey: SurveyAdmin,
): SurveyJurisdictionScopeResolution | null => {
  const reasonCode = survey.admin_lifecycle?.actions.publish.disabled_reason_code?.trim() || null;
  if (reasonCode === 'survey_jurisdiction_binding_conflict') {
    return resolved('conflict', 'lifecycle_fallback', reasonCode);
  }
  if (
    reasonCode?.startsWith('survey_jurisdiction_') ||
    reasonCode?.startsWith('survey_tenant_jurisdiction_')
  ) {
    return unresolved('lifecycle_fallback', reasonCode);
  }
  return null;
};

const conflictsWith = (
  strongest: SurveyJurisdictionScopeResolution,
  weaker: SurveyJurisdictionScopeResolution | null,
) =>
  weaker !== null &&
  strongest.classification !== 'unverified' &&
  weaker.classification !== 'unverified' &&
  strongest.classification !== weaker.classification;

/**
 * Resolve the server-owned jurisdiction boundary without reading human copy.
 * Missing, malformed or contradictory contracts are deliberately unverified.
 */
export const resolveSurveyJurisdictionScope = (
  survey: SurveyAdmin,
): SurveyJurisdictionScopeResolution => {
  const adminScope = resolveAdminScope(survey);
  const summary = resolveJurisdictionSummary(survey);
  const detail = resolveJurisdictionDetail(survey);
  const lifecycle = resolveLifecycleFallback(survey);

  if (adminScope) {
    if (
      conflictsWith(adminScope, summary) ||
      conflictsWith(adminScope, detail) ||
      conflictsWith(adminScope, lifecycle)
    ) {
      return unresolved('admin_scope', 'survey_jurisdiction_contract_contradiction');
    }
    return adminScope;
  }

  if (summary) {
    if (conflictsWith(summary, detail) || conflictsWith(summary, lifecycle)) {
      return unresolved('jurisdiction_summary', 'survey_jurisdiction_contract_contradiction');
    }
    return summary;
  }

  if (detail) {
    if (conflictsWith(detail, lifecycle)) {
      return unresolved('jurisdiction_detail', 'survey_jurisdiction_contract_contradiction');
    }
    return detail;
  }

  return lifecycle ?? unresolved('missing', 'survey_jurisdiction_scope_missing');
};

export const isSurveyJurisdictionCompatible = (survey: SurveyAdmin) =>
  resolveSurveyJurisdictionScope(survey).classification === 'compatible';

export const isSurveyJurisdictionConflict = (survey: SurveyAdmin) =>
  resolveSurveyJurisdictionScope(survey).classification === 'conflict';
