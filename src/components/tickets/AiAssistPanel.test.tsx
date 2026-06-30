import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AiAssistPanel from './AiAssistPanel';
import { enterpriseService } from '@/services/enterpriseService';
import type { Ticket } from '@/types/tickets';

vi.mock('@/services/enterpriseService', () => ({
  enterpriseService: {
    getTicketAiEnrichment: vi.fn(),
  },
}));

const mockedGetTicketAiEnrichment = vi.mocked(enterpriseService.getTicketAiEnrichment);

const ticketFixture = (): Ticket => ({
  id: 44,
  tipo: 'municipio',
  nro_ticket: 'M-44',
  asunto: 'Luminaria',
  estado: 'nuevo',
  fecha: '2026-06-30T12:00:00Z',
  categoria: 'Luminaria',
} as Ticket);

describe('AiAssistPanel', () => {
  beforeEach(() => {
    mockedGetTicketAiEnrichment.mockReset();
  });

  it('surfaces the local fallback engine and advisory municipal signals', async () => {
    mockedGetTicketAiEnrichment.mockResolvedValue({
      contract_version: 'ticket.ai_enrichment.v1',
      advisory_policy: { advisory_only: true, mutates_operational_state: false },
      source: { text_chars: 128, comments_count: 1 },
      huggingface: {
        provider_family: 'huggingface',
        category: {
          categoria: 'luminaria',
          score: 0.82,
          provider: 'deterministic_local_fallback',
          fallback_reason: 'huggingface_unavailable',
        },
        priority: {
          prioridad: 'urgente',
          score: 0.89,
          provider: 'deterministic_local_fallback',
        },
        operational_signals: {
          provider: 'deterministic_local_fallback',
          fallback_reason: 'huggingface_unavailable',
        },
        sentiment: {
          label: 'preocupado',
          score: 0.75,
          provider: 'deterministic_local_fallback',
        },
      },
      crm_hints: {
        risk_level: 'alto',
        requires_human_attention: true,
        requires_photo: true,
        requires_exact_location: true,
        tags: ['signal:riesgo_personas', 'sentiment:preocupacion'],
        recommended_actions: [{ id: 'review', label: 'Revisar reclamo con operador', priority: 'high' }],
        advisory_only: true,
        mutates_operational_state: false,
      },
      state_mutation: { applied: false },
      persisted: false,
      secret_values_exposed: false,
    });

    render(<AiAssistPanel ticket={ticketFixture()} />);

    expect(await screen.findAllByText('IA local deterministica')).not.toHaveLength(0);
    expect(screen.getByText('fallback seguro')).toBeInTheDocument();
    expect(screen.getByText('advisory-only')).toBeInTheDocument();
    expect(screen.getByText('Riesgo alto')).toBeInTheDocument();
    expect(screen.getByText('validar ubicacion')).toBeInTheDocument();
    expect(screen.getByText('revisar evidencia')).toBeInTheDocument();
    expect(screen.getByText('Revisar reclamo con operador')).toBeInTheDocument();
    expect(screen.getByText('Estado sin cambios: confirmado')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedGetTicketAiEnrichment).toHaveBeenCalledWith(
        '44',
        expect.objectContaining({ scope: 'municipio', ticket_type: 'municipio' }),
        undefined,
      );
    });
  });
});
