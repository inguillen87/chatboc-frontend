import { Profiler, StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AiAssistPanel from './AiAssistPanel';
import { enterpriseService, type TicketAiEnrichmentResponse } from '@/services/enterpriseService';
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

const suggestedReply = 'Hola, recibimos tu reclamo y lo derivamos al area correspondiente.';
const ticketWithReply = (overrides: Partial<Ticket> = {}, reply = suggestedReply): Ticket => ({
  ...ticketFixture(),
  tenant_slug: 'municipio-junin',
  ...overrides,
  ai_enrichment: {
    contract_version: 'ticket.ai_enrichment.v1',
    operator_brief: { recommended_first_reply: reply },
  },
} as Ticket);

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const installClipboard = (writeText: (text: string) => Promise<void>) => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
};
const deferredClipboard = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('AiAssistPanel', () => {
  beforeEach(() => {
    mockedGetTicketAiEnrichment.mockReset();
  });

  afterEach(() => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
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
      expect(await screen.findByRole('button', { name: 'Borrador cargado' })).toBeInTheDocument();
    } finally {
      window.removeEventListener(TICKET_AI_DRAFT_EVENT_NAME, handler);
    }
  });

  it('keeps the loaded acknowledgement when the draft is used before passive effects finish', async () => {
    mockedGetTicketAiEnrichment.mockResolvedValue({
      contract_version: 'ticket.ai_enrichment.v1',
      operator_brief: { recommended_first_reply: suggestedReply },
    });
    let usedDuringCommit = false;
    render(
      <Profiler id="reply-commit" onRender={() => {
        const useDraft = screen.queryByRole('button', { name: 'Usar borrador' });
        if (useDraft && !usedDuringCommit) {
          usedDuringCommit = true;
          useDraft.click();
        }
      }}>
        <AiAssistPanel ticket={ticketFixture()} autoRefreshDelayMs={0} />
      </Profiler>,
    );

    expect(await screen.findByRole('button', { name: 'Borrador cargado' })).toBeInTheDocument();
    expect(usedDuringCommit).toBe(true);
  });

  it.each([
    ['ticket ID', { id: 45 }, suggestedReply],
    ['tenant', { tenant_slug: 'tierra-del-fuego' }, suggestedReply],
    ['scope', { tipo: 'pyme' }, suggestedReply],
    ['reply text', {}, 'Hola, revisamos el nuevo borrador de este caso.'],
  ] as const)('does not carry loaded or copied acknowledgements across a changed %s or a return to the old context', async (_field, overrides, reply) => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    const originalTicket = ticketWithReply();
    const { rerender } = render(<AiAssistPanel ticket={originalTicket} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar borrador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrador cargado' })).toBeInTheDocument();

    rerender(<AiAssistPanel ticket={ticketWithReply(overrides, reply)} autoRefreshDelayMs={-1} />);
    expect(screen.getByRole('button', { name: 'Usar borrador' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();

    rerender(<AiAssistPanel ticket={originalTicket} autoRefreshDelayMs={-1} />);
    expect(screen.getByRole('button', { name: 'Usar borrador' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
  });

  it('keeps acknowledgements when only unrelated ticket fields change', async () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    const { rerender } = render(<AiAssistPanel ticket={ticketWithReply()} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar borrador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();

    rerender(<AiAssistPanel ticket={ticketWithReply({ asunto: 'Otra descripción del mismo caso' })} autoRefreshDelayMs={-1} />);
    expect(screen.getByRole('button', { name: 'Borrador cargado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it.each(['resolve', 'reject'] as const)('ignores an old clipboard %s after another tenant becomes current', async (outcome) => {
    const oldCopy = deferredClipboard();
    const writeText = vi.fn().mockReturnValue(oldCopy.promise);
    installClipboard(writeText);
    const { rerender } = render(<AiAssistPanel ticket={ticketWithReply()} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    rerender(<AiAssistPanel ticket={ticketWithReply({ tenant_slug: 'tierra-del-fuego' })} autoRefreshDelayMs={-1} />);
    await act(async () => {
      if (outcome === 'resolve') oldCopy.resolve();
      else oldCopy.reject(new Error('Clipboard denied'));
      await oldCopy.promise.catch(() => undefined);
    });
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(suggestedReply);
  });

  it.each(['resolve', 'reject'] as const)('does not erase a newer clipboard acknowledgement when an old copy %s', async (outcome) => {
    const oldCopy = deferredClipboard();
    installClipboard(vi.fn().mockReturnValueOnce(oldCopy.promise).mockResolvedValue(undefined));
    const { rerender } = render(<AiAssistPanel ticket={ticketWithReply()} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    rerender(<AiAssistPanel ticket={ticketWithReply({ tenant_slug: 'tierra-del-fuego' })} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    await act(async () => {
      if (outcome === 'resolve') oldCopy.resolve();
      else oldCopy.reject(new Error('Old clipboard denied'));
      await oldCopy.promise.catch(() => undefined);
    });
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it.each([undefined, {}])('does not acknowledge a copy when clipboard writeText is unavailable (%s)', (clipboard) => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    render(<AiAssistPanel ticket={ticketWithReply()} autoRefreshDelayMs={-1} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiado' })).not.toBeInTheDocument();
  });

  it('keeps the latest successful copy when an earlier attempt in the same context fails', async () => {
    const oldCopy = deferredClipboard();
    installClipboard(vi.fn().mockReturnValueOnce(oldCopy.promise).mockResolvedValue(undefined));
    render(<AiAssistPanel ticket={ticketWithReply()} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();

    await act(async () => {
      oldCopy.reject(new Error('Earlier copy failed'));
      await oldCopy.promise.catch(() => undefined);
    });
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('keeps the latest failed copy when an earlier attempt in the same context succeeds', async () => {
    const oldCopy = deferredClipboard();
    installClipboard(vi.fn().mockReturnValueOnce(oldCopy.promise).mockRejectedValue(new Error('Latest copy failed')));
    render(<AiAssistPanel ticket={ticketWithReply()} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      oldCopy.resolve();
      await oldCopy.promise;
    });
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiado' })).not.toBeInTheDocument();
  });

  it('retires a pending clipboard acknowledgement when the panel unmounts', async () => {
    const oldCopy = deferredClipboard();
    installClipboard(vi.fn().mockReturnValue(oldCopy.promise));
    const { unmount } = render(<AiAssistPanel ticket={ticketWithReply()} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    unmount();
    render(<AiAssistPanel ticket={ticketWithReply()} autoRefreshDelayMs={-1} />);

    await act(async () => {
      oldCopy.resolve();
      await oldCopy.promise;
    });
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
  });

  it.each([
    ['ticket ID', { id: 45 }],
    ['tenant with the same ID', { tenant_slug: 'tierra-del-fuego' }],
    ['scope with the same ID', { tipo: 'pyme' }],
  ] as const)('hides persisted suggestions immediately when the %s changes to a case without enrichment', (_field, overrides) => {
    const original = ticketWithReply();
    const { rerender } = render(<AiAssistPanel ticket={original} autoRefreshDelayMs={-1} />);
    expect(screen.getByText(suggestedReply)).toBeInTheDocument();

    rerender(<AiAssistPanel ticket={{ ...ticketFixture(), tenant_slug: 'municipio-junin', ...overrides } as Ticket} autoRefreshDelayMs={-1} />);
    expect(screen.queryByText(suggestedReply)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar borrador' })).not.toBeInTheDocument();
    expect(mockedGetTicketAiEnrichment).not.toHaveBeenCalled();
  });

  it.each([
    ['ticket ID', { id: 45 }],
    ['tenant with the same ID', { tenant_slug: 'tierra-del-fuego' }],
    ['scope with the same ID', { tipo: 'pyme' }],
  ] as const)('ignores a pending enrichment after the %s changes before its next refresh', async (_field, overrides) => {
    let resolveOld!: (payload: TicketAiEnrichmentResponse) => void;
    const oldRequest = new Promise<TicketAiEnrichmentResponse>((resolve) => { resolveOld = resolve; });
    const currentReply = 'Borrador del caso actual confirmado por su respuesta IA.';
    mockedGetTicketAiEnrichment.mockReturnValueOnce(oldRequest).mockResolvedValueOnce({
      contract_version: 'ticket.ai_enrichment.v1',
      operator_brief: { recommended_first_reply: currentReply },
    });
    const original = { ...ticketFixture(), tenant_slug: 'municipio-junin' } as Ticket;
    const received: unknown[] = [];
    const handler = (event: Event) => received.push((event as CustomEvent).detail);
    window.addEventListener(TICKET_AI_DRAFT_EVENT_NAME, handler);
    try {
      const { rerender } = render(<AiAssistPanel ticket={original} autoRefreshDelayMs={-1} />);
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar asistencia IA' }));
      expect(screen.getByText('Analizando IA')).toBeInTheDocument();
      const current = { ...original, ...overrides } as Ticket;
      rerender(<AiAssistPanel ticket={current} autoRefreshDelayMs={-1} />);
      expect(screen.queryByText('Analizando IA')).not.toBeInTheDocument();

      await act(async () => {
        resolveOld({ operator_brief: { recommended_first_reply: suggestedReply } });
        await oldRequest;
      });
      expect(mockedGetTicketAiEnrichment).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(suggestedReply)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Usar borrador' })).not.toBeInTheDocument();
      expect(received).toEqual([]);

      fireEvent.click(screen.getByRole('button', { name: 'Actualizar asistencia IA' }));
      expect(await screen.findByText(currentReply)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Usar borrador' }));
      expect(received).toEqual([{ ticketId: String(current.id), draft: currentReply, source: 'operator_brief' }]);
    } finally {
      window.removeEventListener(TICKET_AI_DRAFT_EVENT_NAME, handler);
    }
  });

  it.each(['resolve', 'reject'] as const)('does not publish a retired request %s after A → B → A', async (outcome) => {
    let resolveOld!: (payload: TicketAiEnrichmentResponse) => void;
    let rejectOld!: (error: Error) => void;
    const oldRequest = new Promise<TicketAiEnrichmentResponse>((resolve, reject) => {
      resolveOld = resolve;
      rejectOld = reject;
    });
    mockedGetTicketAiEnrichment.mockReturnValueOnce(oldRequest);
    const original = { ...ticketFixture(), tenant_slug: 'municipio-junin' } as Ticket;
    const { rerender } = render(<AiAssistPanel ticket={original} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar asistencia IA' }));
    rerender(<AiAssistPanel ticket={{ ...original, tenant_slug: 'tierra-del-fuego' } as Ticket} autoRefreshDelayMs={-1} />);
    rerender(<AiAssistPanel ticket={original} autoRefreshDelayMs={-1} />);

    await act(async () => {
      if (outcome === 'resolve') resolveOld({ operator_brief: { recommended_first_reply: suggestedReply } });
      else rejectOld(new ApiError('Retired request failed', 502, {}));
      await oldRequest.catch(() => undefined);
    });
    expect(screen.queryByText(suggestedReply)).not.toBeInTheDocument();
    expect(screen.queryByText('Analizando IA')).not.toBeInTheDocument();
    expect(screen.queryByText('Asistencia IA temporalmente no disponible. El ticket, el chat y la gestion operativa siguen funcionando.')).not.toBeInTheDocument();
  });

  it('does not retain a previous tenant error in a new case', async () => {
    mockedGetTicketAiEnrichment.mockRejectedValueOnce(new ApiError('Unavailable', 502, {}));
    const original = { ...ticketFixture(), tenant_slug: 'municipio-junin' } as Ticket;
    const { rerender } = render(<AiAssistPanel ticket={original} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar asistencia IA' }));
    expect(await screen.findByText('Asistencia IA temporalmente no disponible. El ticket, el chat y la gestion operativa siguen funcionando.')).toBeInTheDocument();

    rerender(<AiAssistPanel ticket={{ ...original, tenant_slug: 'tierra-del-fuego' } as Ticket} autoRefreshDelayMs={-1} />);
    expect(screen.queryByText('Asistencia IA temporalmente no disponible. El ticket, el chat y la gestion operativa siguen funcionando.')).not.toBeInTheDocument();
  });

  it('retires a pending enrichment when the panel unmounts', async () => {
    let resolveOld!: (payload: TicketAiEnrichmentResponse) => void;
    const oldRequest = new Promise<TicketAiEnrichmentResponse>((resolve) => { resolveOld = resolve; });
    mockedGetTicketAiEnrichment.mockReturnValueOnce(oldRequest);
    const original = { ...ticketFixture(), tenant_slug: 'municipio-junin' } as Ticket;
    const { unmount } = render(<AiAssistPanel ticket={original} autoRefreshDelayMs={-1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar asistencia IA' }));
    unmount();
    render(<AiAssistPanel ticket={original} autoRefreshDelayMs={-1} />);

    await act(async () => {
      resolveOld({ operator_brief: { recommended_first_reply: suggestedReply } });
      await oldRequest;
    });
    expect(screen.queryByText(suggestedReply)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usar borrador' })).not.toBeInTheDocument();
    expect(mockedGetTicketAiEnrichment).toHaveBeenCalledTimes(1);
  });

  it('allows the current request and acknowledgements after StrictMode lifecycle replay', async () => {
    installClipboard(vi.fn().mockResolvedValue(undefined));
    mockedGetTicketAiEnrichment.mockResolvedValue({ operator_brief: { recommended_first_reply: suggestedReply } });
    render(<StrictMode><AiAssistPanel ticket={ticketFixture()} autoRefreshDelayMs={0} /></StrictMode>);

    fireEvent.click(await screen.findByRole('button', { name: 'Usar borrador' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Borrador cargado' })).toBeInTheDocument();
    expect(mockedGetTicketAiEnrichment).toHaveBeenCalledTimes(1);
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
