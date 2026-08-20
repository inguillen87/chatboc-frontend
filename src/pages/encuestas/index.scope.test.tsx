import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SurveyPublic } from '@/types/encuestas';

const mocks = vi.hoisted(() => ({
  listPublicSurveys: vi.fn(),
  tenantContext: {
    currentSlug: null as string | null,
    tenant: { slug: 'default' } as { slug: string } | null,
    isLoadingTenant: false,
    tenantError: null as string | null,
  },
}));

vi.mock('@/api/encuestas', () => ({
  listPublicSurveys: mocks.listPublicSurveys,
}));

vi.mock('@/hooks/usePageMetadata', () => ({
  usePageMetadata: vi.fn(),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => mocks.tenantContext,
}));

vi.mock('@/components/surveys/SurveyQrPreview', () => ({
  SurveyQrPreview: ({ slug, tenantSlug }: { slug: string; tenantSlug?: string | null }) => (
    <div data-testid="survey-qr" data-slug={slug} data-tenant-slug={tenantSlug ?? ''} />
  ),
}));

import SurveysPublicIndex from './index';

const survey: SurveyPublic = {
  id: 7,
  slug: 'encuesta-interna',
  slug_publico: 'encuesta-publica',
  titulo: 'Prioridades de la ciudad',
  descripcion: 'Elegí las prioridades para este año.',
  tipo: 'opinion',
  inicio_at: '2026-01-01T00:00:00.000Z',
  fin_at: '2030-01-01T00:00:00.000Z',
  politica_unicidad: 'libre',
  preguntas: [],
};

const renderPage = (entry: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/encuestas" element={<SurveysPublicIndex />} />
          <Route path="/t/:tenant/encuestas" element={<div>Listado canónico del espacio</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('public survey index tenant scope', () => {
  beforeEach(() => {
    mocks.listPublicSurveys.mockReset();
    mocks.listPublicSurveys.mockResolvedValue([survey]);
    Object.assign(mocks.tenantContext, {
      currentSlug: null,
      tenant: { slug: 'default' },
      isLoadingTenant: false,
      tenantError: null,
    });
  });

  it('does not issue a public survey request without an authoritative tenant', async () => {
    renderPage('/encuestas');

    expect(await screen.findByRole('heading', { name: 'Elegí una organización para ver sus encuestas' })).toBeVisible();
    expect(screen.getByText(/no mostramos ni combinamos encuestas/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    expect(mocks.listPublicSurveys).not.toHaveBeenCalled();
  });

  it('treats the internal default sentinel as missing scope', async () => {
    renderPage('/encuestas?tenant_slug=default');

    expect(await screen.findByRole('heading', { name: 'Elegí una organización para ver sus encuestas' })).toBeVisible();
    expect(mocks.listPublicSurveys).not.toHaveBeenCalled();
  });

  it('waits for backend tenant resolution without issuing an unscoped request', async () => {
    Object.assign(mocks.tenantContext, {
      currentSlug: 'rio-grande',
      tenant: null,
      isLoadingTenant: true,
    });

    renderPage('/encuestas');

    expect(await screen.findByRole('status')).toHaveTextContent('Identificando tu organización');
    expect(mocks.listPublicSurveys).not.toHaveBeenCalled();
  });

  it('redirects a backend-resolved ambient tenant to its canonical survey route', async () => {
    Object.assign(mocks.tenantContext, {
      currentSlug: 'rio-grande',
      tenant: { slug: 'rio-grande' },
      isLoadingTenant: false,
    });

    renderPage('/encuestas');

    expect(await screen.findByText('Listado canónico del espacio')).toBeVisible();
    expect(mocks.listPublicSurveys).not.toHaveBeenCalled();
  });

  it('does not trust a tenant payload that differs from the active context scope', async () => {
    Object.assign(mocks.tenantContext, {
      currentSlug: 'rio-grande',
      tenant: { slug: 'otra-organizacion' },
      isLoadingTenant: false,
    });

    renderPage('/encuestas');

    expect(await screen.findByRole('heading', { name: 'Elegí una organización para ver sus encuestas' })).toBeVisible();
    expect(mocks.listPublicSurveys).not.toHaveBeenCalled();
  });

  it('does not trust a failed tenant resolution for canonical navigation', async () => {
    Object.assign(mocks.tenantContext, {
      currentSlug: 'rio-grande',
      tenant: { slug: 'rio-grande' },
      isLoadingTenant: false,
      tenantError: 'No existe',
    });

    renderPage('/encuestas');

    expect(await screen.findByRole('heading', { name: 'Elegí una organización para ver sus encuestas' })).toBeVisible();
    expect(mocks.listPublicSurveys).not.toHaveBeenCalled();
  });

  it('uses an explicit tenant_slug authoritatively for links and QR assets', async () => {
    renderPage('/encuestas?tenant_slug=rio-grande');

    await waitFor(() => expect(mocks.listPublicSurveys).toHaveBeenCalledWith('rio-grande'));
    expect(await screen.findByRole('link', { name: /^Participar/ })).toHaveAttribute(
      'href',
      '/e/encuesta-publica?tenant_slug=rio-grande',
    );
    expect(screen.queryByTestId('public-survey-scope-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('survey-qr')).toHaveAttribute('data-slug', 'encuesta-publica');
    expect(screen.getByTestId('survey-qr')).toHaveAttribute('data-tenant-slug', 'rio-grande');
  });
});
