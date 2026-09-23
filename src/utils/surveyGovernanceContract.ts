import type {
  SurveyAnalyticsProvenance,
  SurveyGovernanceClosureManifest,
  SurveyGovernanceRelease,
  SurveyGovernanceReleaseList,
  SurveyResponseProvenance,
} from '@/types/encuestas';

const RELEASE_LIST_CONTRACT = 'surveys.governance_releases.v1';
const RELEASE_CONTRACT = 'surveys.governance_release.v1';
const CLOSURE_MANIFEST_CONTRACT = 'surveys.closure_manifest.v1';
const RESPONSE_PROVENANCE_CONTRACT = 'surveys.response_provenance.v1';
const DEMO_SEEDING_CONTRACT = 'surveys.demo_seeding.v1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const RELEASE_STATUSES = new Set(['draft', 'published', 'closed']);

export const SURVEY_RESULT_EVIDENCE_MIN_COHORT_SIZE = 5;

type SurveyGovernanceContractErrorKind = 'absent' | 'malformed';

export class SurveyGovernanceContractError extends Error {
  readonly kind: SurveyGovernanceContractErrorKind;

  constructor(kind: SurveyGovernanceContractErrorKind) {
    super(
      kind === 'absent'
        ? 'El backend no expuso el contrato versionado de gobernanza. Las acciones quedaron bloqueadas.'
        : 'El backend devolvió un contrato de gobernanza inconsistente. Las acciones quedaron bloqueadas.',
    );
    this.name = 'SurveyGovernanceContractError';
    this.kind = kind;
    Object.setPrototypeOf(this, SurveyGovernanceContractError.prototype);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

export const validateSurveyGovernanceReleaseList = (
  value: unknown,
  expected: { surveyId: number; tenantSlug: string; tenantId?: number },
): SurveyGovernanceReleaseList => {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'contract_version')) {
    throw new SurveyGovernanceContractError('absent');
  }
  if (value.contract_version !== RELEASE_LIST_CONTRACT) {
    throw new SurveyGovernanceContractError('malformed');
  }
  const tenantSlug = expected.tenantSlug.trim();
  const tenant = value.tenant;
  const items = value.items;
  const capabilities = value.capabilities;
  if (
    !tenantSlug ||
    value.ok !== true ||
    !isRecord(tenant) ||
    !isPositiveSafeInteger(tenant.id) ||
    (expected.tenantId !== undefined && tenant.id !== expected.tenantId) ||
    typeof tenant.slug !== 'string' ||
    tenant.slug.trim().toLowerCase() !== tenantSlug.toLowerCase() ||
    value.survey_id !== expected.surveyId ||
    !Array.isArray(items) ||
    !isNonNegativeSafeInteger(value.total) ||
    value.total !== items.length ||
    !isRecord(capabilities) ||
    capabilities.read !== true ||
    capabilities.manage !== true ||
    typeof capabilities.plan_allows_write !== 'boolean' ||
    typeof capabilities.create_release !== 'boolean' ||
    capabilities.required_for_mutation !== 'survey.governance.manage'
  ) {
    throw new SurveyGovernanceContractError('malformed');
  }

  const releaseIds = new Set<number>();
  const versionNumbers = new Set<number>();
  let previousVersion = Number.POSITIVE_INFINITY;
  const publishedReleaseIds: number[] = [];
  for (const item of items) {
    if (
      !isRecord(item) ||
      item.contract_version !== RELEASE_CONTRACT ||
      item.survey_id !== expected.surveyId ||
      !isPositiveSafeInteger(item.release_id) ||
      !isPositiveSafeInteger(item.version_number) ||
      item.version_number >= previousVersion ||
      releaseIds.has(item.release_id) ||
      versionNumbers.has(item.version_number) ||
      !RELEASE_STATUSES.has(String(item.status)) ||
      typeof item.snapshot_sha256 !== 'string' ||
      !SHA256_PATTERN.test(item.snapshot_sha256) ||
      typeof item.policy_sha256 !== 'string' ||
      !SHA256_PATTERN.test(item.policy_sha256) ||
      !isRecord(item.assurance) ||
      item.assurance.regulated_election_certified !== false ||
      item.assurance.result_certified !== false ||
      !isRecord(item.capabilities) ||
      typeof item.capabilities.can_publish !== 'boolean' ||
      typeof item.capabilities.can_close !== 'boolean'
    ) {
      throw new SurveyGovernanceContractError('malformed');
    }
    releaseIds.add(item.release_id);
    versionNumbers.add(item.version_number);
    previousVersion = item.version_number;
    if (item.status === 'published') publishedReleaseIds.push(item.release_id);
  }

  const expectedLatestReleaseId = items.length > 0
    ? (items[0] as Record<string, unknown>).release_id
    : null;
  if (
    publishedReleaseIds.length > 1 ||
    value.active_release_id !== (publishedReleaseIds[0] ?? null) ||
    value.latest_release_id !== expectedLatestReleaseId
  ) {
    throw new SurveyGovernanceContractError('malformed');
  }

  return value as unknown as SurveyGovernanceReleaseList;
};

export type SurveyResultEvidenceReasonCode =
  | 'governance_contract_unavailable'
  | 'governance_contract_invalid'
  | 'closed_release_missing'
  | 'closure_manifest_invalid'
  | 'analytics_unavailable'
  | 'analytics_filtered'
  | 'analytics_not_backend'
  | 'response_provenance_invalid'
  | 'response_count_mismatch';

export interface SurveyResultEvidenceCounts {
  manifest: number | null;
  analytics: number | null;
  real: number | null;
  synthetic: number | null;
  unverified: number | null;
  classifiedClosureSet: number | null;
}

export interface SurveyResultEvidenceRelease {
  tenantId: number;
  tenantSlug: string;
  surveyId: number;
  releaseId: number;
  versionNumber: number;
  closedAt: string;
  manifestSha256: string;
  snapshotSha256: string;
  policySha256: string;
  responseSetSha256: string;
  humanReviewReferenceSha256: string;
  eligibilityPolicyVersion: string | null;
  consentPolicyVersion: string | null;
}

export interface SurveyResultEvidenceAssessment {
  status: 'reconciled' | 'not_reconciled';
  reasonCode: SurveyResultEvidenceReasonCode | null;
  reason: string;
  release: SurveyResultEvidenceRelease | null;
  counts: SurveyResultEvidenceCounts;
  canExportReconciledCountReceipt: boolean;
  assurance: {
    scope: 'count_reconciliation_only' | null;
    resultCertified: false;
    regulatedElectionCertified: false;
    externalAnchorVerified: false;
  };
}

export interface SurveyResultEvidenceInput {
  surveyId: number;
  tenantSlug: string;
  tenantId?: number | null;
  releaseList?: SurveyGovernanceReleaseList | null;
  analytics?: {
    totalResponses?: number | null;
    responseProvenance?: SurveyResponseProvenance | null;
    frontendProvenance?: SurveyAnalyticsProvenance | null;
    filtered?: boolean;
  } | null;
}

type ClassifiedAnalyticsCounts = {
  analytics: number;
  real: number;
  synthetic: number;
  unverified: number;
  classifiedClosureSet: number;
};

const emptyCounts = (analytics: number | null = null): SurveyResultEvidenceCounts => ({
  manifest: null,
  analytics,
  real: null,
  synthetic: null,
  unverified: null,
  classifiedClosureSet: null,
});

const notReconciled = (
  reasonCode: SurveyResultEvidenceReasonCode,
  reason: string,
  options: {
    release?: SurveyResultEvidenceRelease | null;
    counts?: SurveyResultEvidenceCounts;
  } = {},
): SurveyResultEvidenceAssessment => ({
  status: 'not_reconciled',
  reasonCode,
  reason,
  release: options.release ?? null,
  counts: options.counts ?? emptyCounts(),
  canExportReconciledCountReceipt: false,
  assurance: {
    scope: null,
    resultCertified: false,
    regulatedElectionCertified: false,
    externalAnchorVerified: false,
  },
});

const readProvenanceCounts = (
  provenance: SurveyResponseProvenance | null | undefined,
  analyticsTotal: number,
): ClassifiedAnalyticsCounts | null => {
  if (!isRecord(provenance)) return null;

  const unverifiedIncluded = provenance.unverified_responses_included;
  const unverifiedExcluded = provenance.unverified_responses_excluded;
  const realIncluded = provenance.real_responses_included;
  const syntheticIncluded = provenance.synthetic_responses_included;
  const syntheticExcluded = provenance.synthetic_responses_excluded;
  if (
    provenance.contract_version !== RESPONSE_PROVENANCE_CONTRACT ||
    provenance.mode !== 'real' ||
    provenance.server_trusted_classification !== true ||
    provenance.synthetic_marker_contract !== DEMO_SEEDING_CONTRACT ||
    !isNonNegativeSafeInteger(realIncluded) ||
    !isNonNegativeSafeInteger(syntheticIncluded) ||
    !isNonNegativeSafeInteger(syntheticExcluded) ||
    !isNonNegativeSafeInteger(unverifiedIncluded) ||
    !isNonNegativeSafeInteger(unverifiedExcluded) ||
    provenance.contains_synthetic !== (syntheticIncluded > 0) ||
    syntheticIncluded !== 0 ||
    unverifiedIncluded !== 0 ||
    realIncluded + syntheticIncluded + unverifiedIncluded !== analyticsTotal
  ) {
    return null;
  }

  return {
    analytics: analyticsTotal,
    real: realIncluded,
    synthetic: syntheticIncluded + syntheticExcluded,
    unverified: unverifiedIncluded + unverifiedExcluded,
    classifiedClosureSet:
      realIncluded +
      syntheticIncluded +
      syntheticExcluded +
      unverifiedIncluded +
      unverifiedExcluded,
  };
};

const releaseEvidenceFromManifest = (
  list: SurveyGovernanceReleaseList,
  release: SurveyGovernanceRelease,
): SurveyResultEvidenceRelease | null => {
  const closure = release.closure;
  const manifest = closure?.manifest;
  if (
    !closure ||
    !manifest ||
    !SHA256_PATTERN.test(closure.manifest_sha256) ||
    manifest.contract_version !== CLOSURE_MANIFEST_CONTRACT ||
    manifest.tenant_id !== list.tenant.id ||
    manifest.survey_id !== list.survey_id ||
    manifest.release_id !== release.release_id ||
    manifest.release_version !== release.version_number ||
    manifest.snapshot_sha256 !== release.snapshot_sha256 ||
    manifest.policy_sha256 !== release.policy_sha256 ||
    !isNonNegativeSafeInteger(manifest.response_count) ||
    !SHA256_PATTERN.test(manifest.response_set_sha256) ||
    !SHA256_PATTERN.test(manifest.human_review_reference_sha256) ||
    !isIsoTimestamp(manifest.closed_at) ||
    manifest.closed_at !== release.closed_at ||
    !isRecord(manifest.assurance) ||
    manifest.assurance.scope !== 'local_database_closure_integrity' ||
    manifest.assurance.regulated_election_certified !== false ||
    manifest.assurance.result_certified !== false ||
    manifest.assurance.external_anchor_verified !== false ||
    release.assurance?.regulated_election_certified !== false ||
    release.assurance?.result_certified !== false ||
    release.assurance?.external_verification !== 'not_performed' ||
    release.governance?.eligibility?.stores_roster_or_pii !== false ||
    release.governance?.decision_rules?.declarative_only !== true ||
    release.governance?.decision_rules?.computed_outcome !== null
  ) {
    return null;
  }

  return {
    tenantId: list.tenant.id,
    tenantSlug: list.tenant.slug,
    surveyId: list.survey_id,
    releaseId: release.release_id,
    versionNumber: release.version_number,
    closedAt: manifest.closed_at,
    manifestSha256: closure.manifest_sha256,
    snapshotSha256: manifest.snapshot_sha256,
    policySha256: manifest.policy_sha256,
    responseSetSha256: manifest.response_set_sha256,
    humanReviewReferenceSha256: manifest.human_review_reference_sha256,
    eligibilityPolicyVersion: release.governance?.eligibility?.policy_version ?? null,
    consentPolicyVersion: release.governance?.consent?.policy_version ?? null,
  };
};

const manifestFromRelease = (
  release: SurveyGovernanceRelease | undefined,
): SurveyGovernanceClosureManifest | null => release?.closure?.manifest ?? null;

export const buildSurveyResultEvidence = (
  input: SurveyResultEvidenceInput,
): SurveyResultEvidenceAssessment => {
  const analyticsTotal = isNonNegativeSafeInteger(input.analytics?.totalResponses)
    ? input.analytics.totalResponses
    : null;
  if (!input.releaseList) {
    return notReconciled(
      'governance_contract_unavailable',
      'No hay un manifiesto de releases disponible para comparar con analytics.',
      { counts: emptyCounts(analyticsTotal) },
    );
  }

  let list: SurveyGovernanceReleaseList;
  try {
    list = validateSurveyGovernanceReleaseList(input.releaseList, {
      surveyId: input.surveyId,
      tenantSlug: input.tenantSlug,
      ...(isPositiveSafeInteger(input.tenantId) ? { tenantId: input.tenantId } : {}),
    });
  } catch {
    return notReconciled(
      'governance_contract_invalid',
      'El contrato de releases no coincide con la encuesta y el tenant consultados.',
      { counts: emptyCounts(analyticsTotal) },
    );
  }

  const closedRelease = list.items.find((release) => release.status === 'closed');
  if (!closedRelease) {
    return notReconciled(
      'closed_release_missing',
      'Todavía no existe un release cerrado con manifiesto de resultados.',
      { counts: emptyCounts(analyticsTotal) },
    );
  }

  const manifest = manifestFromRelease(closedRelease);
  const release = releaseEvidenceFromManifest(list, closedRelease);
  const countsWithManifest: SurveyResultEvidenceCounts = {
    ...emptyCounts(analyticsTotal),
    manifest: isNonNegativeSafeInteger(manifest?.response_count)
      ? manifest.response_count
      : null,
  };
  if (!release || !manifest) {
    return notReconciled(
      'closure_manifest_invalid',
      'El cierre existe, pero su manifiesto, sus hashes o sus límites de assurance no son verificables.',
      { counts: countsWithManifest },
    );
  }

  if (input.analytics?.filtered) {
    return notReconciled(
      'analytics_filtered',
      'Quitá los filtros para conciliar el conjunto completo sin exponer cohortes pequeñas.',
      { release, counts: countsWithManifest },
    );
  }
  if (analyticsTotal === null) {
    return notReconciled(
      'analytics_unavailable',
      'Analytics no informó un conteo entero y no negativo para comparar.',
      { release, counts: countsWithManifest },
    );
  }

  const frontendProvenance = input.analytics?.frontendProvenance;
  if (
    !frontendProvenance ||
    frontendProvenance.source !== 'backend' ||
    frontendProvenance.synthetic !== false ||
    !Array.isArray(frontendProvenance.affected_modules) ||
    frontendProvenance.affected_modules.includes('summary')
  ) {
    return notReconciled(
      'analytics_not_backend',
      'La analítica visible usa datos de demo, fallback o una fuente mixta y no puede generar un recibo conciliado.',
      { release, counts: countsWithManifest },
    );
  }

  const classified = readProvenanceCounts(
    input.analytics?.responseProvenance,
    analyticsTotal,
  );
  if (!classified) {
    return notReconciled(
      'response_provenance_invalid',
      'Analytics no separó con un contrato confiable las respuestas reales, sintéticas y no verificadas.',
      { release, counts: countsWithManifest },
    );
  }

  const counts: SurveyResultEvidenceCounts = {
    manifest: manifest.response_count,
    analytics: classified.analytics,
    real: classified.real,
    synthetic: classified.synthetic,
    unverified: classified.unverified,
    classifiedClosureSet: classified.classifiedClosureSet,
  };
  if (classified.classifiedClosureSet !== manifest.response_count) {
    return notReconciled(
      'response_count_mismatch',
      'El total clasificado por analytics difiere del conteo sellado en el manifiesto.',
      { release, counts },
    );
  }

  return {
    status: 'reconciled',
    reasonCode: null,
    reason: 'El release, el manifiesto y el conteo clasificado de analytics coinciden por cantidad.',
    release,
    counts,
    canExportReconciledCountReceipt: true,
    assurance: {
      scope: 'count_reconciliation_only',
      resultCertified: false,
      regulatedElectionCertified: false,
      externalAnchorVerified: false,
    },
  };
};

export interface PrivacySafeEvidenceCount {
  value: number | null;
  bucket: 'unknown' | '0' | '<5' | 'exact';
}

export const privacySafeSurveyEvidenceCount = (
  value: number | null,
): PrivacySafeEvidenceCount => {
  if (value === null || !isNonNegativeSafeInteger(value)) return { value: null, bucket: 'unknown' };
  if (value === 0) return { value: 0, bucket: '0' };
  if (value < SURVEY_RESULT_EVIDENCE_MIN_COHORT_SIZE) return { value: null, bucket: '<5' };
  return { value, bucket: 'exact' };
};

export const buildSurveyResultEvidenceReceipt = (
  assessment: SurveyResultEvidenceAssessment,
) => {
  if (
    assessment.status !== 'reconciled' ||
    !assessment.canExportReconciledCountReceipt ||
    !assessment.release ||
    assessment.counts.manifest === null ||
    assessment.counts.analytics === null
  ) {
    throw new Error('survey_result_count_receipt_not_reconciled');
  }

  return {
    contract_version: 'surveys.closure_count_receipt.v1',
    status: 'closure_reconciled_by_count',
    tenant: {
      id: assessment.release.tenantId,
      slug: assessment.release.tenantSlug,
    },
    survey_id: assessment.release.surveyId,
    release: {
      id: assessment.release.releaseId,
      version: assessment.release.versionNumber,
      closed_at: assessment.release.closedAt,
    },
    declared_hash_references: {
      source: 'backend',
      client_verified: false,
      manifest_sha256: assessment.release.manifestSha256,
      snapshot_sha256: assessment.release.snapshotSha256,
      policy_sha256: assessment.release.policySha256,
      response_set_sha256: assessment.release.responseSetSha256,
      human_review_reference_sha256: assessment.release.humanReviewReferenceSha256,
      manifest_response_count: assessment.counts.manifest,
      analytics_response_count: assessment.counts.analytics,
    },
    reconciliation: {
      scope: 'count_only',
      validates_manifest_digest: false,
      validates_response_content: false,
      validates_result_distribution: false,
    },
    response_provenance: {
      minimum_cell_size: SURVEY_RESULT_EVIDENCE_MIN_COHORT_SIZE,
      real: privacySafeSurveyEvidenceCount(assessment.counts.real),
      synthetic: privacySafeSurveyEvidenceCount(assessment.counts.synthetic),
      unverified: privacySafeSurveyEvidenceCount(assessment.counts.unverified),
    },
    backend_declared_assurance: {
      client_verified: false,
      scope: 'local_database_closure_integrity',
      result_certified: false,
      regulated_election_certified: false,
      external_anchor_verified: false,
    },
    unsupported_metrics: [
      'eligible_population',
      'participation_rate',
      'abstentions',
      'quorum',
      'winner',
    ],
    privacy: {
      pii_included: false,
      small_provenance_cells_suppressed: true,
    },
  } as const;
};

export const serializeSurveyResultEvidenceReceipt = (
  assessment: SurveyResultEvidenceAssessment,
) => `${JSON.stringify(buildSurveyResultEvidenceReceipt(assessment), null, 2)}\n`;
