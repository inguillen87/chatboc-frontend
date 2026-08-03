import { render, screen } from '@testing-library/react';
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
  listError: null,
  publishSurvey: vi.fn(),
  closeSurvey: vi.fn(),
  deleteSurvey: vi.fn(),
  seedSurvey: vi.fn(),
  isPublishing: false,
  isClosing: false,
  isDeleting: false,
  isSeeding: false,
  refetchList: vi.fn(),
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
});
