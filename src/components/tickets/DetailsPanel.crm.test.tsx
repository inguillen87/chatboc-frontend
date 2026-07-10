import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DetailsPanel from './DetailsPanel';
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
  default: () => <div data-testid="ticket-assignment" />,
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

describe('DetailsPanel CRM contact priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detailsMocks.selectedTicket = baseTicket;
  });

  it('puts the operator contact card before AI and logistics blocks', () => {
    render(<DetailsPanel />);

    const contactCard = screen.getByTestId('ticket-operator-contact-card');
    expect(contactCard).toHaveTextContent('Marcelo');
    expect(contactCard).toHaveTextContent('+54 9 261 316 8608');
    expect(contactCard).toHaveTextContent('Don Bosco 55, Junin');
    const profileSummary = screen.getByTestId('crm-contact-profile-summary');
    expect(profileSummary).toHaveTextContent('Perfil CRM');
    expect(profileSummary).toHaveTextContent('86% completo');
    expect(profileSummary).toHaveTextContent('Avatar seguro por identidad');
    expect(profileSummary).toHaveTextContent('WhatsApp');
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      'https://wa.me/5492613168608',
    );
    expect(screen.getByRole('link', { name: /email/i })).toHaveAttribute(
      'href',
      'mailto:marcelo@example.com',
    );

    const pageText = document.body.textContent ?? '';
    expect(pageText.indexOf('Marcelo')).toBeLessThan(pageText.indexOf('IA operativa'));
    expect(pageText.indexOf('Marcelo')).toBeLessThan(pageText.indexOf('Logistica'));
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

    const assistedCard = screen.getByTestId('ticket-assisted-context-card');
    expect(assistedCard).toHaveTextContent('Solicitud asistida');
    expect(assistedCard).toHaveTextContent('Reclamos municipales');
    expect(assistedCard).toHaveTextContent('reclamo o solicitud vecinal');
    expect(assistedCard).toHaveTextContent('M-123456');
    expect(assistedCard).toHaveTextContent('Vecino informa luminaria quemada con direccion suficiente.');
    expect(assistedCard).toHaveTextContent('Resolver faltantes y responder');
    expect(screen.getByRole('button', { name: /ver reclamo/i })).toBeEnabled();
  });
});
