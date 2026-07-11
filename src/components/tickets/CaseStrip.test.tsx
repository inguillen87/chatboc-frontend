import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaseStrip } from './CaseStrip';
import type { Ticket } from '@/types/tickets';

const baseTicket: Ticket = {
  id: 378430,
  tipo: 'municipio',
  nro_ticket: 'M-378430',
  asunto: 'Arreglo de calle',
  estado: 'en_proceso',
  fecha: '2026-06-05T21:03:00.000Z',
  categoria: 'Arreglo De Calle',
  direccion: 'Don Bosco 55',
  distrito: 'Junin',
  channel: 'whatsapp',
  priority: 'alta',
  sla_status: 'risk',
  assignedAgent: {
    id: 12,
    nombre_usuario: 'Obras Publicas',
    email: 'obras@junin.gob.ar',
  },
  informacion_personal_vecino: {
    nombre: 'Marcelo',
    telefono: '+5492613168608',
    dni: '32877851',
  },
} as Ticket;

describe('CaseStrip', () => {
  it('renders compact operational context without exposing citizen DNI', () => {
    render(<CaseStrip ticket={baseTicket} onOpenDetails={vi.fn()} />);

    expect(screen.getByTestId('ticket-case-strip')).toBeInTheDocument();
    expect(screen.getByText('M-378430')).toBeInTheDocument();
    expect(screen.getByText('Arreglo De Calle')).toBeInTheDocument();
    expect(screen.getByText('Marcelo')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Obras Publicas')).toBeInTheDocument();
    expect(screen.getByText('alta')).toBeInTheDocument();
    expect(screen.getByText(/Don Bosco 55/)).toBeInTheDocument();
    expect(screen.queryByText('32877851')).not.toBeInTheDocument();
  });

  it('hides itself when the full details panel is already visible', () => {
    render(<CaseStrip ticket={baseTicket} isDetailsVisible />);

    expect(screen.queryByTestId('ticket-case-strip')).not.toBeInTheDocument();
  });

  it('does not present a demo municipality label as the citizen identity', () => {
    render(
      <CaseStrip
        ticket={{
          ...baseTicket,
          display_name: 'Municipio Inteligente',
          informacion_personal_vecino: undefined,
        } as Ticket}
      />,
    );

    expect(screen.getByText('Contacto sin nombre')).toBeInTheDocument();
    expect(screen.queryByText('Municipio Inteligente')).not.toBeInTheDocument();
  });

  it('delegates to the details action when requested', () => {
    const onOpenDetails = vi.fn();

    render(<CaseStrip ticket={baseTicket} onOpenDetails={onOpenDetails} />);
    fireEvent.click(screen.getByRole('button', { name: /detalles/i }));

    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });
});
