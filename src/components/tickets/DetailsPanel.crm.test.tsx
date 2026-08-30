import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DetailsPanel, { collectAttachmentsFromTicket, resolveTicketCaseSummary } from './DetailsPanel';
import type { Ticket } from '@/types/tickets';

const detailsMocks = vi.hoisted(() => ({
  selectedTicket: null as Ticket | null,
  updateTicket: vi.fn(),
}));

vi.mock('@/context/TicketContext', () => ({
  useTickets: () => ({
    selectedTicket: detailsMocks.selectedTicket,
    updateTicket: detailsMocks.updateTicket,
  }),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('./AiAssistPanel', () => ({
  default: () => <section data-testid="ai-assist-panel">IA operativa</section>,
}));

vi.mock('./TicketLogisticsSummary', () => ({
  default: () => <section data-testid="ticket-logistics-summary">Logistica</section>,
}));

vi.mock('./TicketAssignment', () => ({
  default: ({ variant }: { variant?: string }) => (
    <div data-testid="ticket-assignment" data-variant={variant || 'default'} />
  ),
}));

vi.mock('./TicketTimeline', () => ({
  default: () => <div data-testid="ticket-timeline" />,
}));

vi.mock('./TicketAttachments', () => ({
  default: () => <div data-testid="ticket-attachments" />,
}));

vi.mock('@/utils/contacts', () => ({
  getSpecializedContact: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/ticketService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/ticketService');
  return {
    ...actual,
    getTicketById: vi.fn(),
    getTicketMessages: vi.fn(),
    sendTicketHistory: vi.fn().mockResolvedValue({ status: 'sent' }),
  };
});

vi.mock('@/services/exportService', () => ({
  exportToPdf: vi.fn(),
  exportToXlsx: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const baseTicket: Ticket = {
  id: 378430,
  tipo: 'municipio',
  nro_ticket: 'M-378430',
  asunto: 'Arreglo de calle',
  estado: 'nuevo',
  fecha: '2026-06-06T00:03:00Z',
  categoria: 'Arreglo de calle',
  direccion: 'Don Bosco 55, Junin',
  channel: 'whatsapp',
  history: [],
  messages: [],
  informacion_personal_vecino: {
    nombre: 'Marcelo',
    telefono: '+54 9 261 316 8608',
    email: 'marcelo@example.com',
    direccion: 'Don Bosco 55, Junin',
    dni: '32877851',
  },
} as Ticket;

describe('DetailsPanel resolution guide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detailsMocks.selectedTicket = baseTicket;
  });

  it('returns to the empty inspector when filtering clears the selected ticket', () => {
    detailsMocks.selectedTicket = {
      id: 901,
      tipo: 'municipio',
      nro_ticket: 'QA-901',
      asunto: 'Caso QA sin datos personales reales',
      estado: 'nuevo',
      fecha: '2026-08-29T12:00:00Z',
      categoria: 'Alumbrado de prueba',
      direccion: 'Calle de Prueba 100',
      channel: 'web',
      history: [],
      messages: [],
      informacion_personal_vecino: {
        nombre: 'Persona QA',
        telefono: '+54 11 5555 0101',
        email: 'persona.qa@example.test',
        direccion: 'Calle de Prueba 100',
        dni: '',
      },
    } as Ticket;
    const { rerender } = render(<DetailsPanel />);

    expect(screen.getByRole('heading', { name: 'Caso QA sin datos personales reales' })).toBeInTheDocument();

    detailsMocks.selectedTicket = null;
    rerender(<DetailsPanel />);

    expect(screen.getByRole('heading', { name: 'Detalles del Ticket' })).toBeInTheDocument();
    expect(screen.getByText(/Seleccioná un ticket para ver los detalles/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Caso QA sin datos personales reales' })).not.toBeInTheDocument();
  });

  it('shows the resolution guide first and keeps personal and technical data collapsed', () => {
    render(<DetailsPanel />);

    const guide = screen.getByTestId('ticket-resolution-guide');
    expect(guide).toHaveTextContent('Resumen del caso');
    expect(guide).toHaveTextContent('Próximo paso');
    expect(guide).toHaveTextContent('Reclamo por Arreglo de calle en Don Bosco 55, Junin');
    expect(within(guide).getByTestId('ticket-assignment')).toHaveAttribute('data-variant', 'compact');
    expect(screen.getAllByTestId('ticket-assignment')).toHaveLength(1);
    expect(screen.queryByTestId('ticket-operator-contact-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ticket-technical-details')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-assist-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ticket-logistics-summary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /datos del vecino/i }));

    const contactCard = screen.getByTestId('ticket-operator-contact-card');
    expect(contactCard).toHaveTextContent('Marcelo');
    expect(contactCard).toHaveTextContent('+54 9 261 316 8608');
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      'https://wa.me/5492613168608',
    );
    expect(screen.getByRole('link', { name: /email/i })).toHaveAttribute(
      'href',
      'mailto:marcelo@example.com',
    );

    fireEvent.click(screen.getByRole('button', { name: /ubicación del reclamo/i }));
    expect(screen.getByTestId('ticket-logistics-summary')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /herramientas internas/i }));
    expect(screen.getByTestId('ai-assist-panel')).toBeInTheDocument();
    expect(screen.getByTestId('ticket-technical-details')).toHaveTextContent('M-378430');

    fireEvent.click(screen.getByRole('button', { name: /historial del caso/i }));
    expect(screen.getByTestId('ticket-timeline')).toBeInTheDocument();
    expect(screen.getAllByTestId('ticket-assignment')).toHaveLength(1);
  });

  it('keeps long municipal content readable inside the responsive inspector', () => {
    const longSubject = 'Reclamo integral por interrupción prolongada del servicio de alumbrado público en corredor escolar y accesos barriales';
    const longCategory = 'Infraestructura urbana, alumbrado público, seguridad peatonal y coordinación interáreas';
    const longSummary = 'La persona solicita una respuesta coordinada entre servicios públicos, movilidad y atención ciudadana porque el incidente afecta varios accesos y requiere seguimiento documentado sin perder información operativa.';
    const longAction = 'Coordinar inspección conjunta y confirmar ventana estimada de resolución al ciudadano';
    const onClose = vi.fn();
    detailsMocks.selectedTicket = {
      ...baseTicket,
      asunto: longSubject,
      categoria: longCategory,
      description: longSummary,
      allowed_actions: [
        { id: 'coordinate', label: longAction, href: '/admin/tickets/378430/coordinate', enabled: true },
      ],
    } as Ticket;

    render(<DetailsPanel operationalWorkspace onClose={onClose} />);

    const inspector = screen.getByTestId('ticket-details-panel');
    expect(inspector).toHaveClass('ticket-inspector', 'min-w-0', 'max-w-full', 'overflow-hidden');
    expect(inspector).toHaveAttribute('data-operational-workspace', 'true');
    expect(screen.getByRole('heading', { name: longSubject })).toHaveClass('ticket-inspector__header-title');
    expect(screen.getByText(longSummary)).not.toHaveClass('line-clamp-3');
    expect(screen.getByText(longCategory)).toHaveClass('ticket-inspector__badge');
    expect(screen.getByRole('button', { name: longAction })).toHaveClass('ticket-inspector__action-button');
    expect(screen.getByRole('button', { name: /cerrar detalles del ticket/i })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /cerrar detalles del ticket/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('replaces technical runtime JSON with the human case question', () => {
    const runtimeDetails = JSON.stringify({
      demo_runtime: true,
      source: 'demo_municipio_runtime',
      chat_session_id: 'internal-session-id',
      demo_session_payload: { tenant_slug: 'junin' },
      events: [{ type: 'ticket_created', question: 'Luminaria apagada frente a la plaza.' }],
    });
    detailsMocks.selectedTicket = {
      ...baseTicket,
      asunto: 'Demo reclamo - Alumbrado publico',
      description: runtimeDetails,
      detalles: runtimeDetails,
      pregunta: 'Luminaria apagada frente a la plaza.',
    } as Ticket;

    render(<DetailsPanel />);

    const guide = screen.getByTestId('ticket-resolution-guide');
    expect(guide).toHaveTextContent('Luminaria apagada frente a la plaza.');
    expect(guide).not.toHaveTextContent('demo_runtime');
    expect(guide).not.toHaveTextContent('chat_session_id');
    expect(resolveTicketCaseSummary(detailsMocks.selectedTicket)).toBe(
      'Luminaria apagada frente a la plaza.',
    );
  });

  it('falls back safely when a JSON-looking description is malformed', () => {
    detailsMocks.selectedTicket = {
      ...baseTicket,
      description: '{"demo_runtime":true',
      detalles: '{"chat_session_id":"broken"',
      pregunta: 'Árbol caído sobre la vereda.',
    } as Ticket;

    render(<DetailsPanel />);

    const guide = screen.getByTestId('ticket-resolution-guide');
    expect(guide).toHaveTextContent('Árbol caído sobre la vereda.');
    expect(guide).not.toHaveTextContent('demo_runtime');
    expect(guide).not.toHaveTextContent('chat_session_id');
  });

  it('surfaces assisted request context and public follow-up actions', () => {
    detailsMocks.selectedTicket = {
      ...baseTicket,
      recommended_next_action: 'Resolver faltantes y responder',
      assisted_request: {
        contract_version: 'ticket.assisted_marketplace_request.v1',
        request_kind_label: 'reclamo o solicitud vecinal',
        target_module: 'municipal_claims',
        operator_intake_summary: {
          summary: 'Vecino informa luminaria quemada con direccion suficiente.',
        },
      },
      public_follow_up: {
        contract_version: 'marketplace.assisted_followup.v1',
        tracking: {
          code: 'M-123456',
          path: '/tracking/claim/M-123456?pin=900144',
          label: 'Ver reclamo',
        },
        channels: [
          {
            id: 'tracking_page',
            label: 'Ver reclamo',
            href: '/tracking/claim/M-123456?pin=900144',
          },
        ],
      },
      ai_operator_brief: {
        recommended_next_action: 'Resolver faltantes y responder',
        summary: 'Vecino informa luminaria quemada con direccion suficiente.',
      },
    };

    render(<DetailsPanel />);

    const guide = screen.getByTestId('ticket-resolution-guide');
    const assistedContext = screen.getByTestId('ticket-assisted-context-card');
    expect(assistedContext).toHaveTextContent('Reclamos municipales');
    expect(assistedContext).toHaveTextContent('reclamo o solicitud vecinal');
    expect(guide).toHaveTextContent('Vecino informa luminaria quemada con direccion suficiente.');
    expect(guide).toHaveTextContent('Resolver faltantes y responder');
    expect(screen.getByRole('button', { name: /ver reclamo/i })).toBeEnabled();
    expect(screen.queryByText('M-123456')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /herramientas internas/i }));
    expect(screen.getByTestId('ticket-technical-details')).toHaveTextContent('M-123456');
  });

  it('shows backend blocker reasons for disabled operational actions', () => {
    detailsMocks.selectedTicket = {
      ...baseTicket,
      allowed_actions: [
        {
          id: 'open_live_chat',
          label: 'Abrir chat en vivo',
          enabled: false,
          disabled_reason: 'Fuera de horario de atencion',
        },
      ],
    } as Ticket;

    render(<DetailsPanel />);

    expect(screen.getByRole('button', { name: /abrir chat en vivo/i })).toBeDisabled();
    expect(screen.getByText('Fuera de horario de atencion')).toBeInTheDocument();
  });

  it('explains which contact actions are blocked when profile data is missing', () => {
    detailsMocks.selectedTicket = {
      ...baseTicket,
      display_name: '',
      direccion: '',
      informacion_personal_vecino: {
        nombre: '',
        telefono: '',
        email: '',
        direccion: '',
        dni: '',
      },
    } as Ticket;

    render(<DetailsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /datos del vecino/i }));

    const blockers = screen.getByTestId('crm-contact-action-blockers');
    expect(blockers).toHaveTextContent('Falta telefono para abrir WhatsApp.');
    expect(blockers).toHaveTextContent('Falta email para enviar correo.');
    expect(blockers).toHaveTextContent('Falta direccion o coordenadas para abrir mapa.');
    expect(blockers).toHaveTextContent('Faltan datos del contacto para copiar.');
  });

  it('surfaces at most three operational actions and keeps the remainder available internally', () => {
    detailsMocks.selectedTicket = {
      ...baseTicket,
      allowed_actions: [
        { id: 'one', label: 'Acción uno', href: '/one', enabled: true },
        { id: 'two', label: 'Acción dos', href: '/two', enabled: true },
        { id: 'three', label: 'Acción tres', href: '/three', enabled: true },
        { id: 'four', label: 'Acción cuatro', href: '/four', enabled: true },
      ],
    } as Ticket;

    render(<DetailsPanel />);

    const guide = screen.getByTestId('ticket-resolution-guide');
    expect(within(guide).getAllByRole('button', { name: /acción/i })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Acción cuatro' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /herramientas internas/i }));
    expect(screen.getByRole('button', { name: 'Acción cuatro' })).toBeEnabled();
  });

  it('keeps signed delivery, origin and status when merging ticket evidence', () => {
    const attachments = collectAttachmentsFromTicket({
      ...baseTicket,
      attachments: [
        {
          id: 55,
          filename: 'evidencia.pdf',
          url: 'tenant/junin/private/evidencia.pdf',
          download_url: 'https://signed.example/evidencia.pdf?token=safe',
          mime_type: 'application/pdf',
          storage_access: 'signed',
          source: 'whatsapp_flow',
          origin: 'whatsapp_flow',
          status: 'ready',
          flow_id: 'claim_evidence',
        },
      ],
    } as Ticket);

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toEqual(
      expect.objectContaining({
        id: 55,
        url: 'https://signed.example/evidencia.pdf?token=safe',
        download_url: 'https://signed.example/evidencia.pdf?token=safe',
        storage_access: 'signed',
        source: 'whatsapp_flow',
        origin: 'whatsapp_flow',
        status: 'ready',
        flow_id: 'claim_evidence',
      }),
    );
  });
});
