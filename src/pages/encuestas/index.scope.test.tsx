import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SurveyPublic } from '@/types/encuestas';

const mocks = vi.hoisted(() => ({
  listPublicSurveys: vi.fn(),
}));

vi.mock('@/api/encuestas', () => ({
  listPublicSurveys: mocks.listPublicSurveys,
}));

vi.mock('@/hooks/usePageMetadata', () => ({
  usePageMetadata: vi.fn(),
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
        <SurveysPublicIndex />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('public survey index tenant scope', () => {
  beforeEach(() => {
    mocks.listPublicSurveys.mockReset();
    mocks.listPublicSurveys.mockResolvedValue([survey]);
  });

  it('does not generate participation, QR or share targets without an authoritative tenant', async () => {
    renderPage('/encuestas');

    expect(await screen.findByTestId('public-survey-scope-warning')).toHaveTextContent(
      'Organización no identificada',
    );
    expect(mocks.listPublicSurveys).toHaveBeenCalledWith(undefined);
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviar por WhatsApp' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Participación no disponible' })).toBeDisabled();
    expect(screen.queryByTestId('survey-qr')).not.toBeInTheDocument();
    expect(screen.queryByText('Compartir las últimas encuestas')).not.toBeInTheDocument();
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
