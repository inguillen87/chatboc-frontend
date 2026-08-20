import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useSurveyAdmin: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/hooks/useSurveyAdmin', () => ({ useSurveyAdmin: mocks.useSurveyAdmin }));
vi.mock('@/components/ui/use-toast', () => ({ toast: mocks.toast }));

import AdminSurveysIndex from '@/pages/admin/encuestas/index';

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
});
