import type { SurveyPublic } from '@/types/encuestas';

const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const unverifiedFlags = ['phone_ownership_verified', 'cookie_is_person_identity', 'ip_is_person_identity', 'unique_person_certified', 'result_certified', 'historical_rows_reassessed'] as const;
export const readParticipationAssurance = (value: unknown) => {
  const raw = record(value), ui = record(raw?.ui);
  if (!raw || !ui || raw.contract_version !== 'surveys.participation_assurance.v1' || typeof raw.strict_mode !== 'boolean' || typeof raw.configuration_ready !== 'boolean' ||
      ![null, 'survey_authoritative_participation_required', 'survey_participation_assurance_misconfigured'].includes(raw.blocked_reason_code as string | null) ||
      raw.configuration_ready !== (raw.blocked_reason_code === null) || typeof raw.uniqueness_policy !== 'string' ||
      !['verified_existing_account', 'reviewed_opaque_grant', 'legacy_client_identifier'].includes(String(raw.required_proof)) ||
      !['account_per_survey', 'reviewed_subject_per_release', 'legacy_policy'].includes(String(raw.uniqueness_scope)) ||
      ![null, 'submission_time'].includes(raw.credential_validation as string | null) ||
      raw.recommended_strict_policy !== 'por_usuario_or_reviewed_opaque_grant' || !unverifiedFlags.every(name => raw[name] === false) ||
      !Array.isArray(raw.warnings) || !raw.warnings.every(value => typeof value === 'string') ||
      !['title', 'label', 'description', 'limitation'].every(name => typeof ui[name] === 'string' && ui[name].trim().length > 0)) return null;
  return { strict_mode: raw.strict_mode, configuration_ready: raw.configuration_ready, blocked_reason_code: raw.blocked_reason_code,
    uniqueness_policy: raw.uniqueness_policy, required_proof: raw.required_proof, uniqueness_scope: raw.uniqueness_scope,
    credential_validation: raw.credential_validation, warnings: raw.warnings,
    ui: { title: ui.title as string, label: ui.label as string, description: ui.description as string, limitation: ui.limitation as string } };
};
export function SurveyParticipationAssurance({ survey }: { survey: SurveyPublic }) {
  const top = survey.participation_assurance, nested = record(survey.frontend_contract)?.participation_assurance;
  if (top === undefined && nested === undefined) return null;
  const assurance = readParticipationAssurance(top === undefined ? nested : top);
  if (!assurance || (top !== undefined && nested !== undefined && JSON.stringify(assurance) !== JSON.stringify(readParticipationAssurance(nested))))
    return <p role="status" className="text-sm text-muted-foreground">Control de participación no disponible. No se pudo verificar la garantía declarada.</p>;
  return <aside className="space-y-1 rounded-lg border bg-muted/20 p-3 text-sm" aria-label={assurance.ui.title}>
    <h3 className="font-medium">{assurance.ui.title}: {assurance.ui.label}</h3><p>{assurance.ui.description}</p><p className="text-muted-foreground">{assurance.ui.limitation}</p>
  </aside>;
}
