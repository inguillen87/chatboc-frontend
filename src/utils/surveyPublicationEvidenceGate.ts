import type { SurveyAdmin } from '@/types/encuestas';
import { resolveSurveyJurisdictionScope } from '@/utils/surveyJurisdictionScope';

export type SurveyPublicationEvidenceGate = {
  ready: boolean;
  required: boolean;
  reasonCode: string;
  nextAction: string | null;
};

const ACTION_COPY: Record<string, string> = {
  restore_survey_tenant_binding: 'Restaurá la vinculación del instrumento con su organización.',
  configure_verified_tenant_jurisdiction: 'Configurá y verificá la jurisdicción oficial de la organización.',
  bind_verified_tenant_jurisdiction_then_review: 'Vinculá el instrumento con la jurisdicción verificada y completá la revisión institucional.',
  duplicate_and_review_for_verified_jurisdiction: 'Duplicá el instrumento dentro de la jurisdicción correcta y volvé a revisarlo.',
  review_exact_survey_content: 'Revisá y aprobá el contenido exacto que se va a publicar.',
  resolve_content_review_findings: 'Resolvé las observaciones de la revisión institucional antes de publicar.',
  contact_support: 'Solicitá una revisión técnica de la cadena de evidencia antes de continuar.',
  fix_survey_jurisdiction_gate_configuration: 'Corregí la configuración del control jurisdiccional antes de publicar.',
};

const fallbackAction = (reasonCode: string) => {
  const reason = reasonCode.toLowerCase();
  if (reason.includes('conflict')) return 'Separá el instrumento y revisalo dentro de la jurisdicción institucional correcta.';
  if (reason.includes('review')) return 'Completá la revisión institucional y registrá su evidencia antes de publicar.';
  if (reason.includes('integrity')) return 'Solicitá una revisión técnica de la evidencia antes de continuar.';
  return 'Vinculá y verificá la jurisdicción de la organización y del instrumento antes de publicar.';
};

export const humanizeSurveyEvidenceNextAction = (value: unknown, reasonCode: string) => {
  if (typeof value !== 'string' || !value.trim()) return fallbackAction(reasonCode);
  const normalized = value.trim();
  if (ACTION_COPY[normalized]) return ACTION_COPY[normalized];
  if (/^[a-z0-9_:-]+$/i.test(normalized)) return fallbackAction(reasonCode);
  return normalized;
};

export const resolveSurveyPublicationEvidenceGate = (survey: SurveyAdmin): SurveyPublicationEvidenceGate => {
  const scope = resolveSurveyJurisdictionScope(survey);
  const lifecycle = survey.admin_lifecycle;
  const lifecycleJurisdiction = lifecycle?.jurisdiction;
  const gate = lifecycle?.government_survey_evidence_gate;
  const hasKnownContract = gate?.contract_version === 'surveys.government_evidence_gate.v1';
  const reasonCode = hasKnownContract
    ? String(gate.reason_code || 'survey_government_evidence_not_ready')
    : 'survey_government_evidence_gate_missing';
  const invalidReason = /(unbound|unverified|conflict|review_required|review_blocked|review_stale|integrity_failed|origin_invalid)/i.test(reasonCode);
  const compatibleLifecycle = scope.classification === 'compatible' && lifecycleJurisdiction?.status === 'compatible';
  const required = hasKnownContract ? gate.required === true : true;
  const ready = Boolean(
    hasKnownContract &&
    compatibleLifecycle &&
    (gate.required === false
      ? lifecycle?.capabilities.can_publish === true
      : gate.required === true && gate.ready === true) &&
    !invalidReason
  );

  return {
    ready,
    required,
    reasonCode,
    nextAction: ready
      ? null
      : humanizeSurveyEvidenceNextAction(hasKnownContract ? gate.next_action : null, reasonCode),
  };
};
