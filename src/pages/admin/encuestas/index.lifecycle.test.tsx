import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSurveyAdmin: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/hooks/useSurveyAdmin', () => ({ useSurveyAdmin: mocks.useSurveyAdmin }));
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));

import AdminSurveysIndex from '@/pages/admin/encuestas/index';
import { ApiError } from '@/utils/api';

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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/encuestas']}>
      <AdminSurveysIndex />
    </MemoryRouter>,
  );

describe('AdminSurveysIndex states', () => {
  beforeEach(() => {
    mocks.useSurveyAdmin.mockReset();
    mocks.toast.mockReset();
  });

  it('uses organization-neutral copy and renders the empty state', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState());

    renderPage();

    expect(screen.getByRole('heading', { name: 'Encuestas y votaciones' })).toBeTruthy();
    expect(screen.getByText(/participación de tu organización/i)).toBeTruthy();
    expect(screen.getByText(/Todavía no cargaste encuestas/i)).toBeTruthy();
  });

  it('renders an accessible loading state without showing a false empty state', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({ surveys: undefined, isLoadingList: true }));

    renderPage();

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText(/Todavía no cargaste encuestas/i)).toBeNull();
  });

  it('renders a retryable scoped error instead of an empty list', () => {
    mocks.useSurveyAdmin.mockReturnValue(adminState({
      surveys: undefined,
      listError: 'No se pudo validar el tenant seleccionado.',
    }));

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo validar el tenant seleccionado.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.queryByText(/Todavía no cargaste encuestas/i)).toBeNull();
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

    expect(screen.getByText('Mostrando 1 de 2 instrumentos')).toBeTruthy();
    expect(screen.getByText(/Métricas persistidas de los 1 instrumentos cargados de 2/i)).toBeTruthy();
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
      admin_lifecycle: {
        contract_version: 'surveys.admin_lifecycle.v1',
        instrument_kind: 'voting',
        phase: 'draft',
        persisted_state: 'borrador',
        accepts_responses: false,
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

  it('places contract-declared jurisdiction conflicts last and never offers their publish action', () => {
    const makeSurvey = (id: number, title: string, disabledReasonCode?: string) => ({
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
      admin_lifecycle: {
        contract_version: 'surveys.admin_lifecycle.v1',
        instrument_kind: 'voting',
        phase: 'draft',
        persisted_state: 'borrador',
        accepts_responses: false,
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
          publish: {
            method: 'POST',
            endpoint: `/api/admin/encuestas/${id}/publicar`,
            enabled: true,
            ...(disabledReasonCode ? { disabled_reason_code: disabledReasonCode } : {}),
          },
          close: { method: 'POST', endpoint: `/api/v2/surveys/${id}/close`, enabled: false },
        },
      },
    });

    const conflictingSurvey = makeSurvey(
      632,
      'Instrumento legado incompatible',
      'survey_jurisdiction_binding_conflict',
    );
    const validSurvey = makeSurvey(700, 'Instrumento válido de Junín');
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
    expect(screen.getByText('Legado incompatible con la jurisdicción actual')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Publicar' })).toHaveLength(1);
  });
});
