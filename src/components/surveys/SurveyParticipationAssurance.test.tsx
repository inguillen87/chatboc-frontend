import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SurveyParticipationAssurance } from './SurveyParticipationAssurance';
import type { SurveyPublic } from '@/types/encuestas';
afterEach(cleanup);
const contract = () => ({ contract_version: 'surveys.participation_assurance.v1', strict_mode: false, configuration_ready: true,
  blocked_reason_code: null, uniqueness_policy: 'por_usuario', required_proof: 'verified_existing_account', uniqueness_scope: 'account_per_survey',
  credential_validation: null, phone_ownership_verified: false, cookie_is_person_identity: false, ip_is_person_identity: false,
  unique_person_certified: false, result_certified: false, historical_rows_reassessed: false, recommended_strict_policy: 'por_usuario_or_reviewed_opaque_grant',
  warnings: ['account_is_not_unique_person'], ui: { title: 'Control de participación', label: 'Una cuenta por encuesta', description: 'Se comprueba una sesión.', limitation: 'Una cuenta no certifica una persona única.' } });
const survey = (value?: unknown) => ({ slug: 'synthetic-survey', participation_assurance: value }) as SurveyPublic;
describe('backend participation assurance presentation', () => {
  it('renders the backend copy and its limitation without converting a account into a unique person', () => {
    render(<SurveyParticipationAssurance survey={survey(contract())} />); expect(screen.getByText(contract().ui.limitation)).toBeVisible(); expect(screen.getByText(contract().ui.description)).toBeVisible();
  });
  it('makes no strong claim when the legacy contract is absent', () => { const view = render(<SurveyParticipationAssurance survey={survey()} />); expect(view.container).toBeEmptyDOMElement(); });
  it.each(['phone_ownership_verified', 'cookie_is_person_identity', 'ip_is_person_identity', 'unique_person_certified', 'result_certified', 'historical_rows_reassessed'])('rejects an unsupported %s claim', flag => {
    render(<SurveyParticipationAssurance survey={survey({ ...contract(), [flag]: true })} />); expect(screen.getByRole('status')).toHaveTextContent('no disponible'); expect(screen.queryByText(contract().ui.description)).not.toBeInTheDocument();
  });
  it('fails closed when the nested and top-level contracts disagree', () => {
    const record = survey(contract()); record.frontend_contract = { participation_assurance: { ...contract(), required_proof: 'legacy_client_identifier' } };
    render(<SurveyParticipationAssurance survey={record} />); expect(screen.getByRole('status')).toHaveTextContent('no disponible');
  });
  it('renders the backend blocked copy without claiming configuration is ready', () => {
    const raw = { ...contract(), strict_mode: true, configuration_ready: false, blocked_reason_code: 'survey_authoritative_participation_required', ui: { ...contract().ui, label: 'Participación bloqueada' } };
    render(<SurveyParticipationAssurance survey={survey(raw)} />); expect(screen.getByText(/Participación bloqueada/)).toBeVisible();
  });
});
