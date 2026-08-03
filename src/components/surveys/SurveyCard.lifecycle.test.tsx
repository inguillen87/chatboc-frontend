import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SurveyCard } from '@/components/surveys/SurveyCard';
import type { SurveyAdmin, SurveyAdminLifecycle } from '@/types/encuestas';

const lifecycle = (
  phase: SurveyAdminLifecycle['phase'],
  capabilities: Partial<SurveyAdminLifecycle['capabilities']>,
  instrumentKind: SurveyAdminLifecycle['instrument_kind'] = 'survey',
): SurveyAdminLifecycle => {
  const canPublish = capabilities.can_publish ?? false;
  const canClose = capabilities.can_close ?? false;
  return {
    contract_version: 'surveys.admin_lifecycle.v1',
    instrument_kind: instrumentKind,
    phase,
    persisted_state: phase === 'draft' ? 'borrador' : phase === 'closed' ? 'cerrada' : 'publicada',
    accepts_responses: phase === 'collecting' || phase === 'live_voting',
    schedule: {
      opens_at: '2026-08-01T10:00:00Z',
      closes_at: '2026-08-20T10:00:00Z',
      evaluated_at: '2026-08-02T10:00:00Z',
    },
    participation: {
      responses: 12,
      unique_participants: 10,
      responses_last_24h: 3,
      last_response_at: '2026-08-02T09:30:00Z',
      eligible_population: null,
      participation_rate: null,
      abstentions: null,
      denominator_status: {
        available: false,
        reason_code: 'survey_eligible_population_not_configured',
      },
    },
    capabilities: {
      can_publish: canPublish,
      can_close: canClose,
      can_delete: capabilities.can_delete ?? false,
      can_share: capabilities.can_share ?? false,
      can_view_results: capabilities.can_view_results ?? true,
    },
    actions: {
      publish: {
        method: 'POST',
        endpoint: '/api/v2/surveys/41/publish',
        enabled: canPublish,
        disabled_reason_code: canPublish ? null : 'survey_not_draft',
      },
      close: {
        method: 'POST',
        endpoint: '/api/v2/surveys/41/close',
        enabled: canClose,
        confirmation_required: true,
        irreversible: true,
        disabled_reason_code: canClose ? null : 'survey_not_published',
      },
    },
  };
};

const survey = (adminLifecycle: SurveyAdminLifecycle): SurveyAdmin => ({
  id: 41,
  slug: 'consulta-demo',
  slug_publico: 'consulta-demo',
  url_publica: 'https://chatboc.test/e/consulta-demo',
  titulo: 'Consulta de la organización',
  descripcion: 'Descripción',
  tipo: adminLifecycle.instrument_kind === 'voting' ? 'votacion' : 'opinion',
  estado: adminLifecycle.persisted_state as SurveyAdmin['estado'],
  inicio_at: '2026-08-01T10:00:00Z',
  fin_at: '2026-08-20T10:00:00Z',
  politica_unicidad: 'libre',
  preguntas: [],
  admin_lifecycle: adminLifecycle,
});

const baseProps = {
  onEdit: vi.fn(),
  onAnalytics: vi.fn(),
};

describe('SurveyCard lifecycle actions', () => {
  it('shows publish only for a publishable draft', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('draft', { can_publish: true, can_delete: true }))}
        onPublish={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Publicar' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cerrar participación' })).toBeNull();
  });

  it.each([
    ['closed', lifecycle('closed', { can_publish: false, can_close: false })],
    ['governed draft', lifecycle('draft', { can_publish: false, can_close: false })],
  ])('does not expose invalid mutations for %s', (_label, adminLifecycle) => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(adminLifecycle)}
        onPublish={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cerrar participación' })).toBeNull();
  });

  it('requires an irreversible close confirmation and invokes it once', async () => {
    const onClose = vi.fn().mockResolvedValue(undefined);
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('live_voting', { can_close: true, can_share: true }, 'voting'))}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar participación' }));
    expect(screen.getByText(/respuestas nuevas serán rechazadas/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar definitivamente' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('disables other record actions while close is pending', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('collecting', { can_close: true, can_share: true }))}
        onClose={vi.fn()}
        onCopyLink={vi.fn()}
        closing
      />,
    );

    expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Resultados' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrando…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Ver participación' })).toBeNull();
  });

  it('labels unavailable abstention instead of deriving it', () => {
    render(
      <SurveyCard
        {...baseProps}
        survey={survey(lifecycle('collecting', { can_close: true }))}
      />,
    );

    expect(screen.getByText('Abstención')).toBeTruthy();
    expect(screen.getByText('No disponible')).toBeTruthy();
  });
});
