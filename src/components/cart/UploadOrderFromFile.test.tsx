import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UploadOrderFromFile from './UploadOrderFromFile';

const apiFetchMock = vi.fn();

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/utils/api', () => {
  class ApiError extends Error {
    status = 500;
    body: unknown = null;
  }

  return {
    ApiError,
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
    getErrorMessage: (_error: unknown, fallback: string) => fallback,
  };
});

describe('UploadOrderFromFile marketplace intake', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('creates an anonymous marketplace request and shows public follow-up actions', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 77,
      customer_message: 'Recibimos tu nota y la dejamos lista para revision comercial.',
      match_summary: { detected: 2, matched: 1, unmatched: 1 },
      source: { text_preview: '2 chapas galvanizadas' },
      crm_state: 'pending_operator_review',
      public_follow_up: {
        contract_version: 'marketplace.assisted_followup.v1',
        tracking: {
          code: 'pc-77',
          path: '/tracking/order/pc-77?tenant_slug=junin',
          label: 'Ver seguimiento',
        },
        channels: [
          {
            id: 'whatsapp_handoff',
            type: 'link',
            label: 'Continuar por WhatsApp',
            href: 'https://wa.me/?text=Pedido%20pc-77',
          },
        ],
      },
      next_actions: [
        {
          id: 'tracking',
          type: 'link',
          label: 'Ver seguimiento',
          href: '/tracking/order/pc-77?tenant_slug=junin',
          tracking_code: 'pc-77',
        },
      ],
      customer_next_steps: [
        { id: 'received', label: 'Solicitud recibida', status: 'done' },
        { id: 'reply', label: 'Respuesta del equipo', status: 'pending' },
      ],
    });

    render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);

    expect(screen.getByRole('button', { name: /Nota de pedido/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Marcelo' },
    });
    fireEvent.change(screen.getByLabelText('WhatsApp o telefono'), {
      target: { value: '+5492613168608' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'marcelo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Observaciones'), {
      target: { value: 'Entregar por la tarde' },
    });
    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud IA/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/pedidos/from-file?origen=marketplace',
        expect.objectContaining({
          method: 'POST',
          sendAnonId: true,
          tenantSlug: 'junin',
          suppressPanel401Redirect: true,
        }),
      );
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('pedido_text')).toBe('2 chapas galvanizadas');
    expect(body.get('document_type')).toBe('order_note');
    expect(body.get('tenant')).toBe('junin');
    expect(body.get('tenant_slug')).toBe('junin');
    expect(body.get('contact_name')).toBe('Marcelo');
    expect(body.get('contact_phone')).toBe('+5492613168608');
    expect(body.get('contact_email')).toBe('marcelo@example.com');
    expect(body.get('contact_notes')).toBe('Entregar por la tarde');

    expect(await screen.findByText('Seguimiento publico creado')).toBeInTheDocument();
    expect(screen.getByText('pc-77')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir seguimiento/i })).toHaveAttribute(
      'href',
      'http://localhost:3000/tracking/order/pc-77?tenant_slug=junin',
    );
    expect(screen.getByRole('link', { name: /Continuar por WhatsApp/i })).toHaveAttribute(
      'href',
      'https://wa.me/?text=Pedido%20pc-77',
    );

    fireEvent.click(screen.getByRole('button', { name: /Copiar seguimiento/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3000/tracking/order/pc-77?tenant_slug=junin',
      );
    });
  });

  it('uses backend quick examples to help anonymous users create a request without knowing the catalog', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 91,
      customer_message: 'Recibimos tu pedido de cotizacion.',
      public_follow_up: {
        tracking: {
          code: 'pc-91',
          path: '/tracking/order/pc-91?tenant_slug=junin',
        },
      },
    });

    render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        intakeEntry={{
          contract_version: 'marketplace.assisted_intake_entry.v1',
          document_types: [
            {
              id: 'quote_request',
              label: 'Cotizacion desde papel',
              helper: 'Lista escrita por mostrador para presupuestar.',
            },
          ],
          text_examples: [
            {
              id: 'hardware_order',
              label: 'Ferreteria',
              document_type: 'quote_request',
              text: '2 chapas galvanizadas\n1 caja de clavos punta paris',
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('button', { name: /Cotizacion desde papel/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ferreteria/i }));

    expect(screen.getByPlaceholderText(/2 chapas galvanizadas/i)).toHaveValue(
      '2 chapas galvanizadas\n1 caja de clavos punta paris',
    );

    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud IA/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('pedido_text')).toBe('2 chapas galvanizadas\n1 caja de clavos punta paris');
    expect(body.get('document_type')).toBe('quote_request');
  });

  it('submits municipal service requests as assisted marketplace intake', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 92,
      request_kind: 'service_request',
      customer_message: 'Recibimos tu reclamo o solicitud vecinal.',
      structured_extraction: {
        confidence: 'ready_for_operator',
        fields: {
          categoria_probable: 'Luminaria',
          direccion: 'Don Bosco 55 esquina Sarmiento',
          descripcion: 'Luminaria quemada',
          urgencia: 'normal',
        },
        missing_fields: [],
      },
      public_follow_up: {
        tracking: {
          kind: 'claim',
          code: 'M-378430',
          raw_code: '378430',
          pin: '900144',
          ticket_id: 378430,
          path: '/tracking/claim/378430?pin=900144',
        },
      },
    });

    render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        intakeEntry={{
          contract_version: 'marketplace.assisted_intake_entry.v1',
          text_examples: [
            {
              id: 'gov_service_request',
              label: 'Reclamo',
              document_type: 'service_request',
              text: 'Reclamo por luminaria quemada en Don Bosco 55 esquina Sarmiento.',
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Reclamo$/i }));
    expect(screen.getByRole('button', { name: /Reclamo vecinal/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud IA/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('pedido_text')).toBe('Reclamo por luminaria quemada en Don Bosco 55 esquina Sarmiento.');
    expect(body.get('document_type')).toBe('service_request');
    expect(await screen.findByText('Seguimiento de reclamo creado')).toBeInTheDocument();
    expect(screen.getByText('Reclamo trazable')).toBeInTheDocument();
    expect(screen.getByText('M-378430')).toBeInTheDocument();
    expect(screen.getByText('Lo que entendimos')).toBeInTheDocument();
    expect(screen.getByText('Don Bosco 55 esquina Sarmiento')).toBeInTheDocument();
    expect(screen.getByText('Luminaria')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir seguimiento/i })).toHaveAttribute(
      'href',
      'http://localhost:3000/tracking/claim/378430?pin=900144',
    );
  });
});
