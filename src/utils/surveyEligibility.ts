import type {
  SurveyEligibilityAckExpectation,
  SurveyEligibilityMode,
  SurveyPublic,
  SurveyPublicEligibilityContract,
} from '@/types/encuestas';
import { getSurveySubmissionReasonCode } from '@/utils/surveySubmissionErrors';

export const SURVEY_ELIGIBILITY_CREDENTIAL_HEADER = 'X-Survey-Eligibility-Credential' as const;
export const SURVEY_PUBLIC_ELIGIBILITY_CONTRACT = 'surveys.public_eligibility.v1' as const;

const RESTRICTED_MODES = new Set<SurveyEligibilityMode>([
  'institution_attested',
  'manual_review',
]);
const ATTESTATION_ONLY_MODES = new Set<SurveyEligibilityMode>([
  'open',
  'self_attested',
]);
const TERMINAL_REASON_CODES = new Set([
  'survey_eligibility_credential_invalid',
  'survey_eligibility_grant_expired',
  'survey_eligibility_grant_revoked',
  'survey_eligibility_credential_consumed',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const exactText = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 && value === value.trim() ? value : null;

const exactPositiveInteger = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;

const parseMode = (value: unknown): SurveyEligibilityMode | null => {
  if (
    value === 'open' ||
    value === 'self_attested' ||
    value === 'institution_attested' ||
    value === 'manual_review'
  ) {
    return value;
  }
  return null;
};

type ParsedEligibility = {
  contract: SurveyPublicEligibilityContract;
  signature: string;
};

const parseEligibilityContract = (value: unknown): ParsedEligibility | null => {
  if (!isRecord(value)) return null;
  const mode = parseMode(value.mode);
  const policyVersion = exactText(value.policy_version);
  const denominatorStatus = isRecord(value.denominator_status) ? value.denominator_status : null;
  if (
    value.contract_version !== SURVEY_PUBLIC_ELIGIBILITY_CONTRACT ||
    !mode ||
    !policyVersion ||
    typeof value.credential_required !== 'boolean' ||
    typeof value.intake_available !== 'boolean' ||
    value.persist_client_side !== false ||
    value.eligible_population !== null ||
    value.participation_rate !== null ||
    value.abstentions !== null ||
    denominatorStatus?.available !== false ||
    denominatorStatus.reason_code !== 'survey_eligible_population_not_sealed' ||
    value.subject_identifier_exposed !== false ||
    value.plaintext_credential_persisted !== false ||
    value.ballot_secrecy_certified !== false ||
    value.regulated_election_certified !== false ||
    value.result_certified !== false
  ) {
    return null;
  }

  const restricted = RESTRICTED_MODES.has(mode);
  const transport = value.transport;
  const transportValid = restricted
    ? isRecord(transport) &&
      transport.kind === 'http_header' &&
      transport.header_name === SURVEY_ELIGIBILITY_CREDENTIAL_HEADER &&
      transport.meta_flow_supported === false
    : transport === null;
  if (!transportValid) return null;

  const readyRestricted = restricted && value.gate_status === 'ready';
  const unavailableRestricted = restricted && value.gate_status === 'unavailable';
  const restrictedStateValid =
    value.credential_required === true &&
    ((readyRestricted && value.intake_available === true && value.decision === 'credential_pending' && value.blocked_reason_code === null) ||
      (unavailableRestricted &&
        value.intake_available === false &&
        value.decision === 'unavailable' &&
        value.blocked_reason_code === 'survey_eligibility_gate_unavailable')) &&
    value.privacy_assurance === 'pseudonymous_internal_linkability' &&
    value.assurance_level === 'human_reviewed_opaque_grant' &&
    value.authority_binding === 'operator_attested_v1';
  const attestationStateValid =
    ATTESTATION_ONLY_MODES.has(mode) &&
    value.credential_required === false &&
    value.gate_status === 'attestation_only' &&
    value.intake_available === true &&
    value.decision === 'not_evaluated' &&
    value.blocked_reason_code === null &&
    value.privacy_assurance === 'attestation_only' &&
    value.assurance_level === 'attestation_only' &&
    value.authority_binding === null;
  if (!(restricted ? restrictedStateValid : attestationStateValid)) return null;

  const contract = value as unknown as SurveyPublicEligibilityContract;
  const signature = JSON.stringify({
    contract_version: contract.contract_version,
    policy_version: contract.policy_version,
    mode: contract.mode,
    credential_required: contract.credential_required,
    gate_status: contract.gate_status,
    intake_available: contract.intake_available,
    decision: contract.decision,
    transport: contract.transport,
    blocked_reason_code: contract.blocked_reason_code,
    privacy_assurance: contract.privacy_assurance,
    assurance_level: contract.assurance_level,
    authority_binding: contract.authority_binding,
    subject_identifier_exposed: contract.subject_identifier_exposed,
    plaintext_credential_persisted: contract.plaintext_credential_persisted,
    persist_client_side: contract.persist_client_side,
    ballot_secrecy_certified: contract.ballot_secrecy_certified,
    regulated_election_certified: contract.regulated_election_certified,
    result_certified: contract.result_certified,
    eligible_population: contract.eligible_population,
    participation_rate: contract.participation_rate,
    abstentions: contract.abstentions,
    denominator_status: contract.denominator_status,
  });
  return { contract, signature };
};

export type ResolvedSurveyPublicEligibility = {
  required: boolean;
  restricted: boolean;
  valid: boolean;
  available: boolean;
  scopeKey: string;
  mode: SurveyEligibilityMode | null;
  policyVersion: string | null;
  releaseId: number | null;
  headerName: typeof SURVEY_ELIGIBILITY_CREDENTIAL_HEADER | null;
  invalidReason: string | null;
  blockedReasonCode: string | null;
  expectation: SurveyEligibilityAckExpectation | null;
};

const invalidEligibility = (
  mode: SurveyEligibilityMode | null,
  policyVersion: string | null,
  releaseId: number | null,
  scopeSuffix: string,
  reason: string,
): ResolvedSurveyPublicEligibility => ({
  required: true,
  restricted: true,
  valid: false,
  available: false,
  scopeKey: `eligibility:invalid:${releaseId ?? 'no-release'}:${policyVersion ?? 'no-policy'}:${scopeSuffix}`,
  mode,
  policyVersion,
  releaseId,
  headerName: null,
  invalidReason: reason,
  blockedReasonCode: 'survey_eligibility_contract_invalid',
  expectation: null,
});

export const resolveSurveyPublicEligibility = (survey: SurveyPublic): ResolvedSurveyPublicEligibility => {
  const governance = isRecord(survey.governance) ? survey.governance : null;
  const frontend = isRecord(survey.frontend_contract) ? survey.frontend_contract : null;
  const activeRelease = governance && isRecord(governance.active_release)
    ? governance.active_release
    : null;
  const governedReleaseExpected = Boolean(
    governance?.mode === 'governed_release' ||
    governance?.release_required === true ||
    activeRelease,
  );
  const releaseGovernance = activeRelease && isRecord(activeRelease.governance)
    ? activeRelease.governance
    : null;
  const releasePolicy = releaseGovernance && isRecord(releaseGovernance.eligibility)
    ? releaseGovernance.eligibility
    : null;
  const expectedMode = parseMode(releasePolicy?.mode);
  const expectedPolicyVersion = exactText(releasePolicy?.policy_version);
  const releaseId = exactPositiveInteger(activeRelease?.release_id);

  const governanceRaw = governance?.eligibility;
  const frontendRaw = frontend?.eligibility;
  const governanceParsed = governanceRaw === undefined || governanceRaw === null
    ? null
    : parseEligibilityContract(governanceRaw);
  const frontendParsed = frontendRaw === undefined || frontendRaw === null
    ? null
    : parseEligibilityContract(frontendRaw);
  if (governanceRaw !== undefined && governanceRaw !== null && !governanceParsed) {
    return invalidEligibility(
      expectedMode,
      expectedPolicyVersion,
      releaseId,
      'governance-malformed',
      'La política pública de elegibilidad llegó incompleta. La participación quedó bloqueada para proteger tu voto.',
    );
  }
  if (frontendRaw !== undefined && frontendRaw !== null && !frontendParsed) {
    return invalidEligibility(
      expectedMode,
      expectedPolicyVersion,
      releaseId,
      'frontend-malformed',
      'La pantalla no recibió un contrato de elegibilidad verificable. La participación quedó bloqueada.',
    );
  }
  if (governanceParsed && frontendParsed && governanceParsed.signature !== frontendParsed.signature) {
    return invalidEligibility(
      expectedMode,
      expectedPolicyVersion,
      releaseId,
      'aliases-mismatch',
      'Las políticas de elegibilidad publicadas no coinciden entre sí. No enviaremos tu respuesta hasta que el municipio las corrija.',
    );
  }

  if (releasePolicy && (!expectedMode || !expectedPolicyVersion)) {
    return invalidEligibility(
      expectedMode,
      expectedPolicyVersion,
      releaseId,
      'release-policy-malformed',
      'La versión activa no describe una política de elegibilidad válida. La participación quedó bloqueada.',
    );
  }

  const parsed = governanceParsed ?? frontendParsed;
  if (!parsed) {
    if (governedReleaseExpected) {
      return invalidEligibility(
        expectedMode,
        expectedPolicyVersion,
        releaseId,
        'governed-contract-missing',
        'La versión gobernada no publicó un contrato de elegibilidad verificable. La participación quedó bloqueada.',
      );
    }
    if (expectedMode && RESTRICTED_MODES.has(expectedMode)) {
      return invalidEligibility(
        expectedMode,
        expectedPolicyVersion,
        releaseId,
        'restricted-missing',
        'Esta participación requiere una credencial, pero el acceso seguro no está disponible en esta pantalla.',
      );
    }
    return {
      required: false,
      restricted: false,
      valid: true,
      available: true,
      scopeKey: `eligibility:attestation:${releaseId ?? 'legacy'}:${expectedPolicyVersion ?? 'legacy'}`,
      mode: expectedMode,
      policyVersion: expectedPolicyVersion,
      releaseId,
      headerName: null,
      invalidReason: null,
      blockedReasonCode: null,
      expectation: null,
    };
  }

  const { contract } = parsed;
  const restricted = RESTRICTED_MODES.has(contract.mode);
  if (
    expectedMode &&
    (contract.mode !== expectedMode || contract.policy_version !== expectedPolicyVersion)
  ) {
    return invalidEligibility(
      contract.mode,
      contract.policy_version,
      releaseId,
      'release-mismatch',
      'La credencial publicada no está vinculada a la versión activa de esta consulta. La participación quedó bloqueada.',
    );
  }
  if (restricted && (!releaseId || activeRelease?.status !== 'published' || !expectedPolicyVersion)) {
    return invalidEligibility(
      contract.mode,
      contract.policy_version,
      releaseId,
      'release-unbound',
      'No pudimos vincular la credencial a un release publicado. No enviaremos una respuesta sin esa garantía.',
    );
  }

  const available = !restricted || contract.gate_status === 'ready';
  const expectation: SurveyEligibilityAckExpectation | null = restricted && available && releaseId
    ? {
        contractVersion: SURVEY_PUBLIC_ELIGIBILITY_CONTRACT,
        releaseId,
        policyVersion: contract.policy_version,
        mode: contract.mode as 'institution_attested' | 'manual_review',
      }
    : null;
  return {
    required: restricted,
    restricted,
    valid: true,
    available,
    scopeKey: `eligibility:${releaseId ?? 'legacy'}:${contract.policy_version}:${contract.mode}:${contract.gate_status}`,
    mode: contract.mode,
    policyVersion: contract.policy_version,
    releaseId,
    headerName: restricted ? SURVEY_ELIGIBILITY_CREDENTIAL_HEADER : null,
    invalidReason: available
      ? null
      : 'La validación de credenciales está temporalmente fuera de servicio. Conservá tu credencial y volvé a intentar más tarde.',
    blockedReasonCode: contract.blocked_reason_code,
    expectation,
  };
};

export const isTerminalSurveyEligibilityError = (error: unknown): boolean => {
  const reasonCode = getSurveySubmissionReasonCode(error);
  return Boolean(reasonCode && TERMINAL_REASON_CODES.has(reasonCode));
};
