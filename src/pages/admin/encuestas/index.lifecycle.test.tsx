import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSurveyAdmin: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/hooks/useSurveyAdmin', () => ({ useSurveyAdmin: mocks.useSurveyAdmin }));
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));

import AdminSurveysIndex, {
  buildOperationalSurveyOverview,
  resolveSurveyPublicationEvidenceGate,
} from '@/pages/admin/encuestas/index';
import type { SurveyAdmin, SurveyAdminInstrumentKind, SurveyAdminLifecyclePhase } from '@/types/encuestas';
import { ApiError } from '@/utils/api';

const adminScope = (status: 'compatible' | 'conflict' | 'unverified' = 'compatible') => ({
  contract_version: 'surveys.admin_scope.v1',
  jurisdiction: {
    contract_version: 'surveys.admin_jurisdiction_scope.v1',
    status,
    compatible: status === 'compatible' ? true : status === 'conflict' ? false : null,
    reason_code: status === 'compatible'
      ? 'survey_jurisdiction_compatible'
      : status === 'conflict'
      ? 'survey_jurisdiction_binding_conflict'
      : 'survey_jurisdiction_unbound',
    action_hint: status === 'compatible' ? null : 'review_scope',
    tenant_verified_ref: 'ar:ba:junin',
    survey_ref: status === 'conflict' ? 'ar:tf:ushuaia' : status === 'compatible' ? 'ar:ba:junin' : null,
    authoritative_source: 'server_owned_persisted_refs',
    content_review_included: false,
  },
  separation: {
    required: status === 'conflict',
    reason_code: status === 'conflict' ? 'survey_jurisdiction_binding_conflict' : null,
  },
});

const adminState = (overrides: Record<string, unknown> = {}) => ({
  surveys: { data: [] },
  isLoadingList: false,
  isLoadingMoreSurveys: false,
  hasMoreSurveys: false,
  listError: null,
  loadMoreError: null,
  surveyListProgress: { loaded: 0, total: 0 },
  publishSurvey: vi.fn(),
  closeSurvey: vi.fn(),
  deleteSurvey: vi.fn(),
  seedSurvey: vi.fn(),
  isPublishing: false,
  isClosing: false,
  isDeleting: false,
  isSeeding: false,
  refetchList: vi.fn(),
  loadMoreSurveys: vi.fn(),
  tenantSlug: 'org-demo',
  ...overrides,
});

const lifecycleFor = (
  phase: SurveyAdminLifecyclePhase,
  instrumentKind: SurveyAdminInstrumentKind = 'survey',
) => ({
  contract_version: 'surveys.admin_lifecycle.v1' as const,
  instrument_kind: instrumentKind,
  phase,
  persisted_state: phase === 'draft' ? 'borrador' : phase === 'closed' || phase === 'archived' ? 'cerrada' : 'publicada',
  accepts_responses: phase === 'collecting' || phase === 'live_voting',
  operational_block: null,
  jurisdiction: {
    status: 'compatible' as const,
    reason_code: 'survey_jurisdiction_compatible',
    content_review_included: false as const,
  },
  government_survey_evidence_gate: {
    contract_version: 'surveys.government_evidence_gate.v1' as const,
    required: true,
    ready: true,
    reason_code: 'survey_government_evidence_ready',
    next_action: null,
  },
  schedule: { opens_at: null, closes_at: null, evaluated_at: '2026-08-31T00:00:00Z' },
  participation: {
    responses: 0,
    unique_participants: 0,
    responses_last_24h: 0,
    last_response_at: null,
    eligible_population: null,
    participation_rate: null,
    abstentions: null,
    denominator_status: { available: false, reason_code: 'not_configured' },
  },
  capabilities: {
    can_publish: false,
    can_close: false,
    can_delete: false,
    can_share: false,
    can_view_results: true,
  },
  actions: {
    publish: { method: 'POST' as const, endpoint: '/api/v2/surveys/0/publish', enabled: false },
    close: { method: 'POST' as const, endpoint: '/api/v2/surveys/0/close', enabled: false },
  },
});

const workspaceInstrument = (
  id: number,
  title: string,
  phase: SurveyAdminLifecyclePhase,
  instrumentKind: SurveyAdminInstrumentKind = 'survey',
): SurveyAdmin => {
  const adminLifecycle = lifecycleFor(phase, instrumentKind);
  return {
    id,
    tenant_id: 22,
    slug: `instrumento-${id}`,
    titulo: title,
    tipo: instrumentKind === 'voting' ? 'votacion' : 'opinion',
    estado: adminLifecycle.persisted_state as SurveyAdmin['estado'],
    inicio_at: null,
    fin_at: null,
    politica_unicidad: 'libre',
    preguntas: [],
    admin_scope: adminScope(),
    admin_lifecycle: adminLifecycle,
  };
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/encuestas']}>
      <AdminSurveysIndex />
    </MemoryRouter>,
  );

describe('AdminSurveysIndex states', () => {
  it.each([
    ['survey_jurisdiction_unbound', 'Vinculá y verificá'],
    ['survey_tenant_jurisdiction_unverified', 'Vinculá y verificá'],
    ['survey_content_review_required', 'Completá la revisión institucional'],
    ['survey_content_review_blocked', 'Completá la revisión institucional'],
    ['survey_jurisdiction_binding_conflict', 'Separá el instrumento'],
  ])('fails publication closed for %s with an actionable recovery', (reasonCode, expectedAction) => {
    const survey = workspaceInstrument(900, 'Gate adversarial', 'draft');
    const classification = reasonCode.includes('conflict') ? 'conflict' : 'unverified';
    survey.admin_scope = adminScope(classification);
    if (survey.admin_lifecycle) {
      survey.admin_lifecycle.jurisdiction.status = classification;
      survey.admin_lifecycle.jurisdiction.reason_code = reasonCode;
      survey.admin_lifecycle.government_survey_evidence_gate = {
        contract_version: 'surveys.government_evidence_gate.v1',
        required: true,
        ready: false,
        reason_code: reasonCode,
        next_action: null,
      };
    }

    const gate = resolveSurveyPublicationEvidenceGate(survey);
    expect(gate.ready).toBe(false);
    expect(gate.nextAction).toContain(expectedAction);
  });

  it('uses the government evidence gate as the authoritative publication decision', () => {
    const survey = workspaceInstrument(901, 'Revisión pendiente', 'draft');
    if (!survey.admin_lifecycle) throw new Error('fixture lifecycle required');
    survey.admin_lifecycle.government_survey_evidence_gate = {
      contract_version: 'surveys.government_evidence_gate.v1',
      required: true,
      ready: false,
      reason_code: 'survey_content_review_required',
      next_action: 'review_exact_survey_content',
    };

    expect(resolveSurveyPublicationEvidenceGate(survey)).toEqual({
      ready: false,
      required: true,
      reasonCode: 'survey_content_review_required',
      nextAction: 'Revisá y aprobá el contenido exacto que se va a publicar.',
    });
  });

  it('explains a compatible government draft blocked by institutional review', () => {
    const survey = workspaceInstrument(904, 'Consulta con dictamen pendiente', 'draft');
    if (!survey.admin_lifecycle) throw new Error('fixture lifecycle required');
    survey.admin_lifecycle.capabilities.can_publish = false;
    survey.admin_lifecycle.government_survey_evidence_gate = {
      contract_version: 'surveys.government_evidence_gate.v1',
      required: true,
      ready: false,
      reason_code: 'survey_content_review_required',
      next_action: 'review_exact_survey_content',
    };
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: { data: [survey] },
      surveyListProgress: { loaded: 1, total: 1 },
    }));

    renderPage();

    expect(screen.getByRole('status', {
      name: 'Publicación bloqueada para Consulta con dictamen pendiente',
    })).toHaveTextContent('Revisá y aprobá el contenido exacto');
    expect(screen.getByRole('status', {
      name: 'Publicación bloqueada para Consulta con dictamen pendiente',
    })).not.toHaveTextContent('review_exact_survey_content');
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument();
  });

  it('fails closed when the government evidence gate is absent even if legacy scope says compatible', () => {
    const survey = workspaceInstrument(902, 'Contrato ausente', 'draft');
    if (!survey.admin_lifecycle) throw new Error('fixture lifecycle required');
    delete survey.admin_lifecycle.government_survey_evidence_gate;

    const gate = resolveSurveyPublicationEvidenceGate(survey);
    expect(gate.ready).toBe(false);
    expect(gate.reasonCode).toBe('survey_government_evidence_gate_missing');
    expect(gate.nextAction).toContain('Vinculá y verificá');
  });

  it('does not impose the government-only gate on a compatible non-government survey', () => {
    const survey = workspaceInstrument(903, 'Encuesta de servicio', 'draft');
    if (!survey.admin_lifecycle) throw new Error('fixture lifecycle required');
    survey.admin_lifecycle.capabilities.can_publish = true;
    survey.admin_lifecycle.government_survey_evidence_gate = {
      contract_version: 'surveys.government_evidence_gate.v1',
      required: false,
      ready: false,
      reason_code: 'survey_government_evidence_not_required',
      next_action: null,
    };

    expect(resolveSurveyPublicationEvidenceGate(survey)).toEqual({
      ready: true,
      required: false,
      reasonCode: 'survey_government_evidence_not_required',
      nextAction: null,
    });
  });

  it('opens governed drafts in the release workspace without attempting direct publication', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const publishSurvey = vi.fn();
    const survey = workspaceInstrument(905, 'Votación con gobernanza', 'draft', 'voting');
    survey.governance = { mode: 'governed_release', release_required: true };
    if (!survey.admin_lifecycle) throw new Error('fixture lifecycle required');
    survey.admin_lifecycle.actions.publish.disabled_reason_code = 'survey_governance_release_required';
    survey.admin_lifecycle.actions.publish.next_action = 'Revisá y aprobá un release antes de publicar.';
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: { data: [survey] },
      surveyListProgress: { loaded: 1, total: 1 },
      publishSurvey,
    }));

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Revisar y publicar release' }));
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Mocked navigate to: /admin/encuestas/905?section=governance#survey-governance',
    );
    expect(screen.getByRole('button', { name: 'Revisar y publicar release' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(publishSurvey).not.toHaveBeenCalled();
    consoleLogSpy.mockRestore();
  });
  beforeEach(() => {
    mocks.useSurveyAdmin.mockReset();
    mocks.toast.mockReset();
  });

  it('uses organization-neutral copy and renders the empty state', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState());

    renderPage();

    expect(screen.getByRole('heading', { name: 'Centro de participación ciudadana' })).toBeTruthy();
    expect(screen.getByText(/encuestas, sondeos y votaciones/i)).toBeTruthy();
    expect(screen.getByText(/No hay instrumentos operativos/i)).toBeTruthy();
  });

  it('renders an accessible loading state without showing a false empty state', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({ surveys: undefined, isLoadingList: true }));

    renderPage();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText(/No hay instrumentos operativos/i)).toBeNull();
  });

  it('renders a retryable scoped error instead of an empty list', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: undefined,
      listError: 'No se pudo validar el tenant seleccionado.',
    }));

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo validar el tenant seleccionado.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.queryByText(/No hay instrumentos operativos/i)).toBeNull();
  });

  it('does not offer retry when the tenant scope is missing', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: undefined,
      tenantSlug: null,
      listError: 'Seleccioná una organización antes de administrar encuestas y votaciones.',
    }));

    renderPage();

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('shows honest loaded totals and exposes an accessible incremental action', () => {
    const loadMoreSurveys = vi.fn().mockResolvedValue(undefined);
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: {
        data: [{
          id: 41,
          slug: 'consulta-organizacion',
          titulo: 'Consulta de servicios',
          tipo: 'opinion',
          estado: 'cerrada',
          inicio_at: '2026-08-01T12:00:00Z',
          fin_at: '2026-08-20T12:00:00Z',
          politica_unicidad: 'libre',
          preguntas: [],
          admin_scope: adminScope(),
        }],
        overview: {
          total: 1,
          por_estado: { cerrada: 1 },
          activas: 0,
          con_respuestas: 1,
          total_respuestas: 9,
          respuestas_con_coordenadas: 2,
          respuestas_ultimas_24h: 1,
          accepting_responses: 0,
          por_tipo_instrumento: { survey: 1, voting: 0 },
          participation_denominator: {
            available: false,
            reason_code: 'survey_eligible_population_not_configured',
          },
        },
      },
      surveyListProgress: { loaded: 1, total: 2 },
      hasMoreSurveys: true,
      loadMoreSurveys,
    }));

    renderPage();

    expect(screen.getByText('Mostrando 1 de 2 registros · 1 operativo (1 compatible · 0 por verificar) · 0 conflictos separados')).toBeTruthy();
    expect(screen.getByText('Instrumentos cargados')).toBeTruthy();
    expect(screen.getByText(/Indicadores de alcance operativo para 1 instrumentos cargados, dentro de 2/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más encuestas' }));
    expect(loadMoreSurveys).toHaveBeenCalledTimes(1);
  });

  it('keeps loaded instruments visible when the following page fails', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: {
        data: [{
          id: 41,
          slug: 'consulta-organizacion',
          titulo: 'Consulta de servicios',
          tipo: 'opinion',
          estado: 'cerrada',
          inicio_at: '2026-08-01T12:00:00Z',
          fin_at: '2026-08-20T12:00:00Z',
          politica_unicidad: 'libre',
          preguntas: [],
          admin_scope: adminScope(),
        }],
      },
      surveyListProgress: { loaded: 1, total: 2 },
      hasMoreSurveys: true,
      loadMoreError: 'network unavailable',
    }));

    renderPage();

    expect(screen.getByText('Consulta de servicios')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent(/Conservamos los instrumentos ya cargados/i);
  });

  it('offers a compact searchable workspace without hiding separated jurisdiction conflicts', () => {
    const instrument = (
      id: number,
      title: string,
      kind: 'opinion' | 'votacion',
      state: 'borrador' | 'publicada',
      scope: 'compatible' | 'conflict' | 'unverified' = 'compatible',
    ) => ({
      id,
      tenant_id: 22,
      slug: `instrumento-${id}`,
      titulo: title,
      tipo: kind,
      estado: state,
      inicio_at: null,
      fin_at: null,
      politica_unicidad: 'libre',
      preguntas: [],
      admin_scope: adminScope(scope),
    });

    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: {
        data: [
          instrument(701, 'Consulta de alumbrado', 'opinion', 'publicada'),
          instrument(702, 'Votación de obras', 'votacion', 'borrador', 'unverified'),
          instrument(703, 'Auditoría de otra jurisdicción', 'votacion', 'borrador', 'conflict'),
        ],
      },
      surveyListProgress: { loaded: 3, total: 3 },
    }));

    renderPage();

    expect(screen.getByRole('heading', { name: 'Instrumentos operativos' })).toBeTruthy();
    expect(screen.getByText(/2 visibles de 2 instrumentos operativos · 1 conflicto separado/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Buscar instrumentos'), {
      target: { value: '701' },
    });
    expect(screen.getByText('Consulta de alumbrado')).toBeTruthy();
    expect(screen.queryByText('Votación de obras')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

    fireEvent.click(screen.getByRole('button', { name: 'Votaciones: 1' }));
    expect(screen.queryByText('Consulta de alumbrado')).toBeNull();
    expect(screen.getByText('Votación de obras')).toBeTruthy();
    expect(screen.getByText('Conflicto de alcance · 1 instrumento')).toBeTruthy();
    expect(screen.getByText('Auditoría de otra jurisdicción')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Buscar instrumentos'), {
      target: { value: 'sin coincidencia' },
    });
    expect(screen.getByText('No hay instrumentos que coincidan con esta vista.')).toBeTruthy();
    expect(screen.getByText(/los registros no fueron eliminados/i)).toBeTruthy();
    expect(screen.getByText('Conflicto de alcance · 1 instrumento')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Consulta de alumbrado')).toBeTruthy();
    expect(screen.getByText('Votación de obras')).toBeTruthy();
  });

  it('filters operational states from the lifecycle phase without inferring them from persisted state', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: {
        data: [
          workspaceInstrument(710, 'Consulta programada', 'scheduled'),
          workspaceInstrument(711, 'Votación recibiendo', 'live_voting', 'voting'),
          workspaceInstrument(712, 'Consulta con ventana finalizada', 'window_ended'),
          workspaceInstrument(713, 'Consulta sin fase verificable', 'unknown'),
        ],
      },
      surveyListProgress: { loaded: 4, total: 4 },
    }));

    renderPage();

    expect(screen.getByRole('button', { name: 'Programadas 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recibiendo 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finalizados 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sin verificar 1' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Programadas 1' }));
    expect(screen.getByText('Consulta programada')).toBeTruthy();
    expect(screen.queryByText('Votación recibiendo')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Finalizados 1' }));
    expect(screen.getByText('Consulta con ventana finalizada')).toBeTruthy();
    expect(screen.queryByText('Consulta programada')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sin verificar 1' }));
    expect(screen.getByText('Consulta sin fase verificable')).toBeTruthy();
    expect(screen.queryByText('Consulta con ventana finalizada')).toBeNull();
  });

  it('labels search as partial and loads more before claiming no global matches', () => {
    const loadMoreSurveys = vi.fn().mockResolvedValue(undefined);
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: { data: [workspaceInstrument(720, 'Consulta programada', 'scheduled')] },
      surveyListProgress: { loaded: 1, total: 4 },
      hasMoreSurveys: true,
      loadMoreSurveys,
    }));

    renderPage();
    fireEvent.change(screen.getByLabelText('Buscar instrumentos'), {
      target: { value: 'movilidad' },
    });

    expect(screen.getByText(/0 visibles entre 1 instrumento operativo cargado/i)).toBeTruthy();
    expect(screen.getByText('No hay coincidencias entre 1 instrumento operativo cargado.')).toBeTruthy();
    expect(screen.getByText(/todavía puede haber coincidencias en las páginas pendientes/i)).toBeTruthy();
    expect(screen.queryByText('No hay instrumentos que coincidan con esta vista.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cargar más resultados' }));
    expect(loadMoreSurveys).toHaveBeenCalledTimes(1);
  });

  it('keeps a publish conflict visible and refreshes the lifecycle from the backend', async () => {
    const publishSurvey = vi.fn().mockRejectedValue(new ApiError(
      'La publicación está bloqueada por el control institucional de jurisdicción',
      409,
      { reason_code: 'survey_jurisdiction_binding_conflict' },
    ));
    const refetchList = vi.fn().mockResolvedValue(undefined);
    const survey = {
      id: 632,
      tenant_id: 22,
      slug: 'borrador-otra-jurisdiccion',
      titulo: 'Votación institucional',
      tipo: 'votacion',
      estado: 'borrador',
      inicio_at: '2026-08-01T12:00:00Z',
      fin_at: null,
      politica_unicidad: 'libre',
      preguntas: [{ id: 1, orden: 1, tipo: 'opcion_unica', texto: 'Prioridad', opciones: [] }],
      admin_scope: adminScope(),
      admin_lifecycle: {
        contract_version: 'surveys.admin_lifecycle.v1',
        instrument_kind: 'voting',
        phase: 'draft',
        persisted_state: 'borrador',
        accepts_responses: false,
        operational_block: null,
        jurisdiction: {
          status: 'compatible',
          reason_code: 'survey_jurisdiction_compatible',
          content_review_included: false,
        },
        government_survey_evidence_gate: {
          contract_version: 'surveys.government_evidence_gate.v1',
          required: true,
          ready: true,
          reason_code: 'survey_government_evidence_ready',
          next_action: null,
        },
        schedule: { opens_at: null, closes_at: null, evaluated_at: '2026-08-26T00:00:00Z' },
        participation: {
          responses: 0,
          unique_participants: 0,
          responses_last_24h: 0,
          last_response_at: null,
          eligible_population: null,
          participation_rate: null,
          abstentions: null,
          denominator_status: { available: false, reason_code: 'not_configured' },
        },
        capabilities: {
          can_publish: true,
          can_close: false,
          can_delete: true,
          can_share: false,
          can_view_results: true,
        },
        actions: {
          publish: { method: 'POST', endpoint: '/api/admin/encuestas/632/publicar', enabled: true },
          close: { method: 'POST', endpoint: '/api/v2/surveys/632/close', enabled: false },
        },
      },
    };
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: { data: [survey] },
      surveyListProgress: { loaded: 1, total: 1 },
      publishSurvey,
      refetchList,
    }));

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    expect(await screen.findByTestId('survey-publish-failure-632')).toHaveTextContent(
      'La jurisdicción no coincide con la organización',
    );
    expect(screen.getByTestId('survey-publish-failure-632')).toHaveTextContent(
      'evitar presentar esa encuesta como propia',
    );
    await waitFor(() => expect(refetchList).toHaveBeenCalledTimes(1));
  });

  it('keeps unverified instruments visible but blocks publication even when a legacy contract enables it', async () => {
    const publishSurvey = vi.fn().mockResolvedValue(undefined);
    const deleteSurvey = vi.fn().mockResolvedValue(undefined);
    const survey = {
      id: 640,
      tenant_id: 22,
      slug: 'consulta-pendiente-verificacion',
      titulo: 'Consulta pendiente de verificación',
      tipo: 'opinion',
      estado: 'borrador',
      inicio_at: null,
      fin_at: null,
      politica_unicidad: 'libre',
      preguntas: [{ id: 6401, orden: 1, tipo: 'opcion_unica', texto: 'Prioridad', opciones: [] }],
      admin_scope: adminScope('unverified'),
      admin_lifecycle: {
        contract_version: 'surveys.admin_lifecycle.v1',
        instrument_kind: 'survey',
        phase: 'draft',
        persisted_state: 'borrador',
        accepts_responses: false,
        operational_block: null,
        jurisdiction: {
          status: 'unverified',
          reason_code: 'survey_jurisdiction_unbound',
          content_review_included: false,
        },
        government_survey_evidence_gate: {
          contract_version: 'surveys.government_evidence_gate.v1',
          required: true,
          ready: false,
          reason_code: 'survey_jurisdiction_unbound',
          next_action: 'Vincular y verificar la jurisdicción.',
        },
        schedule: { opens_at: null, closes_at: null, evaluated_at: '2026-08-26T00:00:00Z' },
        participation: {
          responses: 0,
          unique_participants: 0,
          responses_last_24h: 0,
          last_response_at: null,
          eligible_population: null,
          participation_rate: null,
          abstentions: null,
          denominator_status: { available: false, reason_code: 'not_configured' },
        },
        capabilities: {
          can_publish: true,
          can_close: false,
          can_delete: true,
          can_share: false,
          can_view_results: true,
        },
        actions: {
          publish: { method: 'POST', endpoint: '/api/v2/surveys/640/publish', enabled: true },
          close: { method: 'POST', endpoint: '/api/v2/surveys/640/close', enabled: false },
        },
      },
    };
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: { data: [survey] },
      surveyListProgress: { loaded: 1, total: 1 },
      publishSurvey,
      deleteSurvey,
    }));

    renderPage();

    expect(screen.getByRole('status', {
      name: 'Publicación bloqueada para Consulta pendiente de verificación',
    })).toHaveTextContent(/Publicación institucional pendiente/i);
    expect(screen.getByRole('status', {
      name: 'Publicación bloqueada para Consulta pendiente de verificación',
    })).toHaveTextContent(/Vincular y verificar la jurisdicción/i);
    expect(screen.queryByText(/Conflictos de alcance/)).toBeNull();

    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(publishSurvey).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Borrar borrador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(deleteSurvey).toHaveBeenCalledWith(640));
  });

  it('places contract-declared jurisdiction conflicts last and never offers their publish action', () => {
    const makeSurvey = (id: number, title: string, scope: 'compatible' | 'conflict') => ({
      id,
      tenant_id: 22,
      slug: `instrumento-${id}`,
      titulo: title,
      tipo: 'votacion',
      estado: 'borrador',
      inicio_at: '2026-08-01T12:00:00Z',
      fin_at: null,
      politica_unicidad: 'libre',
      preguntas: [{ id: id * 10, orden: 1, tipo: 'opcion_unica', texto: 'Prioridad', opciones: [] }],
      admin_scope: adminScope(scope),
      admin_lifecycle: {
        contract_version: 'surveys.admin_lifecycle.v1',
        instrument_kind: 'voting',
        phase: 'draft',
        persisted_state: 'borrador',
        accepts_responses: false,
        operational_block: scope === 'conflict'
          ? {
              reason_code: 'survey_jurisdiction_binding_conflict',
              action_hint: 'separate_and_review_foreign_jurisdiction_instrument',
            }
          : null,
        jurisdiction: {
          status: scope,
          reason_code: scope === 'conflict'
            ? 'survey_jurisdiction_binding_conflict'
            : 'survey_jurisdiction_compatible',
          content_review_included: false,
        },
        government_survey_evidence_gate: {
          contract_version: 'surveys.government_evidence_gate.v1',
          required: true,
          ready: scope === 'compatible',
          reason_code: scope === 'compatible'
            ? 'survey_government_evidence_ready'
            : 'survey_jurisdiction_binding_conflict',
          next_action: scope === 'compatible' ? null : 'Separar y revisar el instrumento.',
        },
        schedule: { opens_at: null, closes_at: null, evaluated_at: '2026-08-26T00:00:00Z' },
        participation: {
          responses: 0,
          unique_participants: 0,
          responses_last_24h: 0,
          last_response_at: null,
          eligible_population: null,
          participation_rate: null,
          abstentions: null,
          denominator_status: { available: false, reason_code: 'not_configured' },
        },
        capabilities: {
          can_publish: scope === 'compatible',
          can_close: false,
          can_delete: true,
          can_share: false,
          can_view_results: true,
        },
        actions: {
          publish: {
            method: 'POST',
            endpoint: `/api/admin/encuestas/${id}/publicar`,
            enabled: scope === 'compatible',
            ...(scope === 'conflict' ? { disabled_reason_code: 'survey_jurisdiction_binding_conflict' } : {}),
          },
          close: { method: 'POST', endpoint: `/api/v2/surveys/${id}/close`, enabled: false },
        },
      },
    });

    const conflictingSurvey = makeSurvey(
      632,
      'Instrumento legado incompatible',
      'conflict',
    );
    const validSurvey = makeSurvey(700, 'Instrumento válido de Junín', 'compatible');
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      // The conflict intentionally arrives first: the UI must use the lifecycle
      // contract, rather than names or slugs, to move it behind valid records.
      surveys: { data: [conflictingSurvey, validSurvey] },
      surveyListProgress: { loaded: 2, total: 2 },
    }));

    renderPage();

    const validTitle = screen.getByText('Instrumento válido de Junín');
    const conflictTitle = screen.getByText('Instrumento legado incompatible');
    expect(validTitle.compareDocumentPosition(conflictTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const legacySection = screen.getByText('Conflicto de alcance · 1 instrumento').closest('details');
    expect(legacySection).not.toHaveAttribute('open');
    expect(screen.getAllByRole('button', { name: 'Publicar' })).toHaveLength(1);
  });

  it('derives the executive scope from compatible records and keeps incompatible legacy collapsed', () => {
    const makeSurvey = (id: number, title: string, conflict = false) => ({
      id,
      tenant_id: 22,
      slug: `instrumento-${id}`,
      titulo: title,
      tipo: conflict ? 'votacion' : 'opinion',
      estado: conflict ? 'borrador' : 'publicada',
      inicio_at: '2026-08-01T12:00:00Z',
      fin_at: null,
      politica_unicidad: 'libre',
      preguntas: [],
      admin_scope: adminScope(conflict ? 'conflict' : 'compatible'),
      metricas: {
        total_respuestas: conflict ? 90 : 10,
        participantes_unicos: conflict ? 90 : 8,
        respuestas_ultimas_24h: conflict ? 20 : 2,
        respuestas_con_coordenadas: conflict ? 80 : 5,
        ultima_respuesta_at: null,
      },
      admin_lifecycle: {
        contract_version: 'surveys.admin_lifecycle.v1',
        instrument_kind: conflict ? 'voting' : 'survey',
        phase: conflict ? 'draft' : 'collecting',
        persisted_state: conflict ? 'borrador' : 'publicada',
        accepts_responses: !conflict,
        schedule: { opens_at: null, closes_at: null, evaluated_at: '2026-08-26T00:00:00Z' },
        participation: {
          responses: conflict ? 90 : 10,
          unique_participants: conflict ? 90 : 8,
          responses_last_24h: conflict ? 20 : 2,
          last_response_at: null,
          eligible_population: null,
          participation_rate: null,
          abstentions: null,
          denominator_status: { available: false, reason_code: 'not_configured' },
        },
        capabilities: {
          can_publish: conflict,
          can_close: !conflict,
          can_delete: conflict,
          can_share: !conflict,
          can_view_results: true,
        },
        actions: {
          publish: {
            method: 'POST',
            endpoint: `/api/admin/encuestas/${id}/publicar`,
            enabled: conflict,
            ...(conflict ? { disabled_reason_code: 'survey_jurisdiction_binding_conflict' } : {}),
          },
          close: { method: 'POST', endpoint: `/api/v2/surveys/${id}/close`, enabled: !conflict },
        },
      },
    });
    const validSurvey = makeSurvey(700, 'Consulta operativa de Junín');
    const legacySurvey = makeSurvey(632, 'Votación legado TDF', true);
    const scopedOverview = buildOperationalSurveyOverview([validSurvey] as never[]);

    expect(scopedOverview.total).toBe(1);
    expect(scopedOverview.total_respuestas).toBe(10);
    expect(scopedOverview.respuestas_con_coordenadas).toBe(5);

    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: {
        data: [legacySurvey, validSurvey],
        overview: {
          total: 2,
          por_estado: { publicada: 1, borrador: 1 },
          activas: 1,
          con_respuestas: 2,
          total_respuestas: 100,
          respuestas_con_coordenadas: 85,
          respuestas_ultimas_24h: 22,
          accepting_responses: 1,
          por_tipo_instrumento: { survey: 1, voting: 1 },
          participation_denominator: { available: false, reason_code: 'not_configured' },
        },
        freshness: {
          generated_at: '2026-08-26T12:00:00Z',
          source: 'enc_encuesta_and_enc_respuesta',
          synthetic: false,
        },
      },
      surveyListProgress: { loaded: 2, total: 2 },
    }));

    renderPage();

    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
    expect(screen.queryByText('100')).toBeNull();
    const legacy = screen.getByText('Conflicto de alcance · 1 instrumento').closest('details');
    expect(legacy).not.toHaveAttribute('open');
    expect(screen.getByText(/Se excluyen 1 conflictos confirmados\. 0 instrumentos sin verificar/i)).toBeTruthy();
  });

  it('fails closed when a Junín-looking title has no authoritative scope', () => {
    const survey = {
      id: 801,
      slug: 'junin-prioridades',
      titulo: 'Consulta oficial Municipalidad de Junín',
      tipo: 'opinion',
      estado: 'borrador',
      inicio_at: '2026-08-01T12:00:00Z',
      fin_at: null,
      politica_unicidad: 'libre',
      preguntas: [],
    };
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: { data: [survey] },
      surveyListProgress: { loaded: 1, total: 1 },
    }));

    renderPage();

    expect(screen.queryByText(/Conflictos de alcance/)).toBeNull();
    expect(screen.getByRole('status', {
      name: 'Publicación bloqueada para Consulta oficial Municipalidad de Junín',
    })).toHaveTextContent(/Publicación institucional pendiente/i);
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });
});

describe('survey list refresh controls',()=>{
  it('provides a manual read without navigating away',()=>{
    const refresh=vi.fn().mockResolvedValue(undefined);mocks.useSurveyAdmin.mockReturnValue(adminState({refetchList:refresh}));
    renderPage();fireEvent.click(screen.getByRole('button',{name:'Actualizar listado'}));expect(refresh).toHaveBeenCalledOnce();
  });
  it.each(['isLoadingList','isLoadingMoreSurveys','isPublishing','isClosing','isDeleting','isSeeding'])('does not start a competing refresh during %s',flag=>{
    const refresh=vi.fn();mocks.useSurveyAdmin.mockReturnValue(adminState({[flag]:true,refetchList:refresh}));renderPage();
    expect(screen.getByRole('button',{name:'Actualizar listado'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Actualizar listado'}));expect(refresh).not.toHaveBeenCalled();
  });
  it('shows a visible refreshing state rather than an empty successful list',()=>{
    mocks.useSurveyAdmin.mockReturnValue(adminState({surveys:undefined,isLoadingList:true,listReadState:{phase:'refreshing',pages:0,receivedAt:null}}));renderPage();
    expect(screen.getByText('Actualizando encuestas y votaciones')).toBeVisible();expect(screen.queryByText('Instrumentos operativos')).not.toBeInTheDocument();
  });
  it('labels recovery of a failed next page explicitly',()=>{
    mocks.useSurveyAdmin.mockReturnValue(adminState({surveys:{data:[workspaceInstrument(90,'Consulta recibida','collecting')]},hasMoreSurveys:true,loadMoreError:'Página no disponible',surveyListProgress:{loaded:1,total:2}}));renderPage();
    expect(screen.getByRole('button',{name:'Reintentar página'})).toBeVisible();expect(screen.getByText('Consulta recibida')).toBeVisible();
  });
});
