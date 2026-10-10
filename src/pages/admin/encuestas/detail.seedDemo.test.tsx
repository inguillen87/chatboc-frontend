import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/utils/api';
import {
  SURVEY_RESPONSE_DUPLICATE_ADMIN_MESSAGE,
  SURVEY_RESPONSE_DUPLICATE_ADMIN_TITLE,
} from '@/utils/surveySubmissionErrors';

const mocks = vi.hoisted(() => ({
  useSurveyAdmin: vi.fn(),
  toast: vi.fn(),
  seedQaEnabled: true,
}));

vi.mock('@/hooks/useSurveyAdmin', () => ({ useSurveyAdmin: mocks.useSurveyAdmin }));
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));
vi.mock('@/utils/surveySyntheticSeedGate', () => ({
  isSurveySyntheticSeedQaEnabled: () => mocks.seedQaEnabled,
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: '42' }),
  };
});
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'org-demo' }),
}));
vi.mock('@/components/surveys/SurveyEditor', () => ({
  SurveyEditor: ({ tenantSlug, onPublish }: { tenantSlug?: string | null; onPublish?: () => void }) => (
    <div data-testid="survey-editor" data-tenant-slug={tenantSlug ?? ''}>
      {onPublish ? <button type="button" onClick={onPublish}>Publicar desde editor</button> : null}
    </div>
  ),
}));
vi.mock('@/components/surveys/SurveyGovernancePanel', () => ({
  SurveyGovernancePanel: () => <div data-testid="survey-governance" />,
}));
vi.mock('@/components/surveys/SurveyEligibilityAdminPanel', () => ({
  SurveyEligibilityAdminPanel: () => <div data-testid="survey-eligibility" />,
}));

import SurveyDetailPage from '@/pages/admin/encuestas/[id]';

const adminState = (overrides: Record<string, unknown> = {}) => ({
  survey: {
    id: 42,
    estado: 'borrador',
  },
  isLoadingSurvey: false,
  surveyError: null,
  saveSurvey: vi.fn(),
  duplicateSurvey: vi.fn(),
  publishSurvey: vi.fn(),
  seedSurvey: vi.fn(),
  isSaving: false,
  isPublishing: false,
  isDuplicating: false,
  isSeeding: false,
  refetchSurvey: vi.fn(),
  tenantSlug: 'org-demo',
  ...overrides,
});

const governedDraft = (gate: Record<string, unknown> | undefined) => ({
  id: 42,
  tenant_id: 22,
  titulo: 'Consulta institucional',
  estado: 'borrador',
  admin_scope: {
    contract_version: 'surveys.admin_scope.v1',
    jurisdiction: {
      contract_version: 'surveys.admin_jurisdiction_scope.v1',
      status: 'compatible',
      compatible: true,
      reason_code: 'survey_jurisdiction_compatible',
      action_hint: null,
      tenant_verified_ref: 'ar:ba:junin',
      survey_ref: 'ar:ba:junin',
      authoritative_source: 'server_owned_persisted_refs',
      content_review_included: false,
    },
    separation: { required: false, reason_code: null },
  },
  admin_lifecycle: {
    phase: 'draft',
    jurisdiction: {
      status: 'compatible',
      reason_code: 'survey_jurisdiction_compatible',
      content_review_included: false,
    },
    government_survey_evidence_gate: gate,
    capabilities: { can_publish: true },
    actions: { publish: { disabled_reason_code: null } },
  },
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/encuestas/42']}>
      <Routes>
        <Route path="/admin/encuestas/:id" element={<SurveyDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('SurveyDetailPage synthetic demo data', () => {
  beforeEach(() => {
    mocks.useSurveyAdmin.mockReset();
    mocks.toast.mockReset();
    mocks.seedQaEnabled = true;
  });

  it('keeps synthetic seeding hidden when the explicit QA gate is closed', () => {
    mocks.seedQaEnabled = false;
    mocks.useSurveyAdmin.mockReturnValue(adminState());

    renderPage();

    expect(screen.queryByRole('button', { name: /respuestas sintéticas/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('survey-editor')).toHaveAttribute('data-tenant-slug', 'org-demo');
  });

  it('does not reset responses when the operator cancels the explicit confirmation', async () => {
    const seedSurvey = vi.fn();
    mocks.useSurveyAdmin.mockReturnValue(adminState({ seedSurvey }));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar por 100 respuestas sintéticas' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      '¿Reemplazar las respuestas por datos sintéticos?',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(seedSurvey).not.toHaveBeenCalled();
  });

  it('labels and generates only synthetic data after confirmation', async () => {
    const seedSurvey = vi.fn().mockResolvedValue({
      creadas: 100,
      reset: { respuestas: 8, comentarios: 2 },
    });
    mocks.useSurveyAdmin.mockReturnValue(adminState({ seedSurvey }));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar por 100 respuestas sintéticas' }));
    expect(await screen.findByText(/elimina las respuestas y comentarios actuales/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reemplazar con datos sintéticos' }));

    await waitFor(() => {
      expect(seedSurvey).toHaveBeenCalledWith(42, { cantidad: 100, reset: true });
    });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Datos sintéticos actualizados',
      description: expect.stringContaining('100 respuestas sintéticas'),
    }));
  });

  it('presents an admin duplicate as a human terminal outcome', async () => {
    const technicalMessage = 'duplicate key value violates unique constraint survey_response_identity';
    const seedSurvey = vi.fn().mockRejectedValue(new ApiError(technicalMessage, 409, {
      reason_code: 'survey_response_duplicate',
    }));
    mocks.useSurveyAdmin.mockReturnValue(adminState({ seedSurvey }));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar por 100 respuestas sintéticas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, reemplazar con datos sintéticos' }));

    await waitFor(() => expect(seedSurvey).toHaveBeenCalledTimes(1));
    expect(mocks.toast).toHaveBeenCalledWith({
      title: SURVEY_RESPONSE_DUPLICATE_ADMIN_TITLE,
      description: SURVEY_RESPONSE_DUPLICATE_ADMIN_MESSAGE,
    });
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain(technicalMessage);
  });

  it('blocks an individual draft with a missing gate and explains the next step', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({ survey: governedDraft(undefined) }));

    renderPage();

    expect(screen.getByRole('status', {
      name: 'Publicación bloqueada para Consulta institucional',
    })).toHaveTextContent(/Vinculá y verificá la jurisdicción/i);
    expect(screen.queryByRole('button', { name: 'Publicar desde editor' })).not.toBeInTheDocument();
  });

  it('translates backend action codes on the individual government draft', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      survey: governedDraft({
        contract_version: 'surveys.government_evidence_gate.v1',
        required: true,
        ready: false,
        reason_code: 'survey_content_review_required',
        next_action: 'review_exact_survey_content',
      }),
    }));

    renderPage();

    const state = screen.getByRole('status', {
      name: 'Publicación bloqueada para Consulta institucional',
    });
    expect(state).toHaveTextContent('Revisá y aprobá el contenido exacto');
    expect(state).not.toHaveTextContent('review_exact_survey_content');
  });

  it('keeps an explicit non-government draft publishable from the individual editor', () => {
    const survey = governedDraft({
      contract_version: 'surveys.government_evidence_gate.v1',
      required: false,
      ready: false,
      reason_code: 'survey_government_evidence_not_required',
      next_action: null,
    });
    mocks.useSurveyAdmin.mockReturnValue(adminState({ survey }));

    renderPage();

    expect(screen.getByRole('button', { name: 'Publicar desde editor' })).toBeInTheDocument();
    expect(screen.queryByRole('status', {
      name: 'Publicación bloqueada para Consulta institucional',
    })).not.toBeInTheDocument();
  });

  it('does not show a jurisdiction warning when a non-government draft is blocked for another reason', () => {
    const survey = governedDraft({
      contract_version: 'surveys.government_evidence_gate.v1',
      required: false,
      ready: false,
      reason_code: 'survey_government_evidence_not_required',
      next_action: null,
    });
    survey.admin_lifecycle.capabilities.can_publish = false;
    mocks.useSurveyAdmin.mockReturnValue(adminState({ survey }));

    renderPage();

    expect(screen.queryByRole('status', {
      name: 'Publicación bloqueada para Consulta institucional',
    })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar desde editor' })).not.toBeInTheDocument();
  });
});
