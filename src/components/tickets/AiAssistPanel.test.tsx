import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AiAssistPanel from './AiAssistPanel';
import { enterpriseService } from '@/services/enterpriseService';
import type { Ticket } from '@/types/tickets';
import { ApiError } from '@/utils/api';
import { TICKET_AI_DRAFT_EVENT_NAME } from './aiDraftEvents';

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

  it('uses persisted CRM enrichment immediately and keeps it if refresh is unavailable', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedGetTicketAiEnrichment.mockRejectedValue(new TypeError('Failed to fetch'));

    render(
      <AiAssistPanel
        autoRefreshDelayMs={0}
        ticket={{
          ...ticketFixture(),
          ai_enrichment: {
            contract_version: 'ticket.ai_enrichment.v1',
            advisory_policy: { advisory_only: true, mutates_operational_state: false },
            source: { text_chars: 96, comments_count: 0 },
            huggingface: {
              provider_family: 'huggingface',
              priority: {
                prioridad: 'urgente',
                score: 0.91,
                provider: 'deterministic_local_fallback',
              },
            },
            crm_hints: {
              risk_level: 'alto',
              requires_human_attention: true,
              requires_photo: true,
              advisory_only: true,
              mutates_operational_state: false,
            },
            operator_brief: {
              summary: 'Reclamo con evidencia operativa suficiente para mesa de entrada.',
              routing_hint: 'servicios_publicos_luminaria',
              recommended_first_reply: 'Hola, ya tenemos registrado el reclamo y lo revisa el area.',
            },
            state_mutation: { applied: false },
            persisted: true,
            secret_values_exposed: false,
          },
        } as Ticket}
      />,
    );

    expect(screen.getByText('Riesgo alto')).toBeInTheDocument();
    expect(screen.getByText('guardado en CRM')).toBeInTheDocument();
    expect(screen.getByText('Reclamo con evidencia operativa suficiente para mesa de entrada.')).toBeInTheDocument();

    await waitFor(() => expect(mockedGetTicketAiEnrichment).toHaveBeenCalled());
    expect(
      await screen.findByText(
        'Asistencia IA temporalmente no disponible. El ticket, el chat y la gestion operativa siguen funcionando.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Riesgo alto')).toBeInTheDocument();
    expect(consoleWarn).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
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
      operator_brief: {
        summary: 'Caso de luminaria con prioridad urgente.',
        response_tone: 'prioritario_empatico',
        routing_hint: 'servicios_publicos_luminaria',
        recommended_first_reply: 'Hola, recibimos tu reclamo y lo revisamos con el area correspondiente.',
        checklist: [
          { id: 'send_acknowledgement', label: 'Responder acuse claro al vecino', priority: 'high' },
          { id: 'validate_location', label: 'Validar direccion exacta', priority: 'high' },
        ],
        confidence_notes: ['Guia advisory-only: no cambia estado ni asigna responsables automaticamente.'],
      },
      state_mutation: { applied: false },
      persisted: false,
      secret_values_exposed: false,
    });

    render(<AiAssistPanel ticket={ticketFixture()} autoRefreshDelayMs={0} />);

    expect(await screen.findAllByText('IA local deterministica')).not.toHaveLength(0);
    expect(screen.getByText('fallback seguro')).toBeInTheDocument();
    expect(screen.getByText('advisory-only')).toBeInTheDocument();
    expect(screen.getByText('Riesgo alto')).toBeInTheDocument();
    expect(screen.getByText('validar ubicacion')).toBeInTheDocument();
    expect(screen.getByText('revisar evidencia')).toBeInTheDocument();
    expect(screen.getByText('Guia para responder')).toBeInTheDocument();
    expect(screen.getByText('Caso de luminaria con prioridad urgente.')).toBeInTheDocument();
    expect(screen.getByText('Ruta: servicios publicos luminaria')).toBeInTheDocument();
    expect(screen.getByText('Borrador sugerido')).toBeInTheDocument();
    expect(screen.getByText('Responder acuse claro al vecino')).toBeInTheDocument();
    expect(screen.getByText('Validar direccion exacta')).toBeInTheDocument();
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

  it('emits a ticket-scoped AI draft event when the operator uses the suggested reply', async () => {
    mockedGetTicketAiEnrichment.mockResolvedValue({
      contract_version: 'ticket.ai_enrichment.v1',
      advisory_policy: { advisory_only: true, mutates_operational_state: false },
      source: { text_chars: 64, comments_count: 0 },
      huggingface: { provider_family: 'huggingface' },
      crm_hints: { risk_level: 'medio', advisory_only: true, mutates_operational_state: false },
      operator_brief: {
        summary: 'Caso de luminaria con prioridad media.',
        recommended_first_reply: 'Hola, recibimos tu reclamo y lo derivamos al area correspondiente.',
      },
      state_mutation: { applied: false },
      persisted: false,
      secret_values_exposed: false,
    });
    const received: unknown[] = [];
    const handler = (event: Event) => received.push((event as CustomEvent).detail);
    window.addEventListener(TICKET_AI_DRAFT_EVENT_NAME, handler);

    try {
      render(<AiAssistPanel ticket={ticketFixture()} autoRefreshDelayMs={0} />);

      fireEvent.click(await screen.findByRole('button', { name: /usar borrador/i }));

      expect(received).toEqual([
        {
          ticketId: '44',
          draft: 'Hola, recibimos tu reclamo y lo derivamos al area correspondiente.',
          source: 'operator_brief',
        },
      ]);
      expect(screen.getByText('Borrador cargado')).toBeInTheDocument();
    } finally {
      window.removeEventListener(TICKET_AI_DRAFT_EVENT_NAME, handler);
    }
  });

  it('degrades safely when the AI enrichment endpoint is temporarily unavailable', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedGetTicketAiEnrichment.mockRejectedValue(
      new ApiError('Bad Gateway', 502, '<html><title>502</title><body>Bad Gateway</body></html>'),
    );

    render(<AiAssistPanel ticket={ticketFixture()} autoRefreshDelayMs={0} />);

    expect(
      await screen.findByText(
        'Asistencia IA temporalmente no disponible. El ticket, el chat y la gestion operativa siguen funcionando.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Asistencia IA del caso')).toBeInTheDocument();
    expect(screen.getByText('IA temporalmente offline')).toBeInTheDocument();
    expect(screen.getByText('CRM operativo')).toBeInTheDocument();
    expect(screen.queryByText('IA operativa')).not.toBeInTheDocument();
    expect(screen.queryByText('requiere revision')).not.toBeInTheDocument();
    expect(consoleWarn).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it('keeps the CRM quiet for advisory AI 5xx responses without legacy HTML bodies', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedGetTicketAiEnrichment.mockRejectedValue(
      new ApiError('El servidor no pudo responder correctamente.', 502, { error: 'Bad Gateway' }),
    );

    render(<AiAssistPanel ticket={ticketFixture()} autoRefreshDelayMs={0} />);

    expect(
      await screen.findByText(
        'Asistencia IA temporalmente no disponible. El ticket, el chat y la gestion operativa siguen funcionando.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('IA temporalmente offline')).toBeInTheDocument();
    expect(screen.getByText('CRM operativo')).toBeInTheDocument();
    expect(screen.queryByText('IA operativa')).not.toBeInTheDocument();
    expect(screen.queryByText('requiere revision')).not.toBeInTheDocument();
    expect(consoleWarn).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it('keeps the CRM quiet for advisory AI network failures', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockedGetTicketAiEnrichment.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<AiAssistPanel ticket={ticketFixture()} autoRefreshDelayMs={0} />);

    expect(
      await screen.findByText(
        'Asistencia IA temporalmente no disponible. El ticket, el chat y la gestion operativa siguen funcionando.',
      ),
    ).toBeInTheDocument();
    expect(consoleWarn).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });
});
