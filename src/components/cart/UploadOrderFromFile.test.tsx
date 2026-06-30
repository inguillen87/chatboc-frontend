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
    fireEvent.change(screen.getByLabelText('WhatsApp para respuesta'), {
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
          submit: {
            endpoint: '/api/pedidos/from-file?origen=marketplace',
            method: 'POST',
          },
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

  it('honors marketplace submit headers without leaking header fields into the form payload', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 104,
      customer_message: 'Solicitud marketplace recibida.',
    });

    render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        intakeEntry={{
          contract_version: 'marketplace.assisted_intake_entry.v1',
          submit: {
            endpoint: '/api/pedidos/from-file?origen=marketplace',
            method: 'POST',
            tenant_fields: ['X-Tenant'],
            headers: ['X-Tenant', 'X-Checkout-Origin'],
          },
        }}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud IA/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/pedidos/from-file?origen=marketplace',
        expect.objectContaining({
          method: 'POST',
          tenantSlug: 'junin',
          headers: {
            'X-Tenant': 'junin',
            'X-Checkout-Origin': 'marketplace',
          },
        }),
      );
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('pedido_text')).toBe('2 chapas galvanizadas');
    expect(body.get('X-Tenant')).toBeNull();
    expect(body.get('tenant')).toBeNull();
    expect(body.get('tenant_slug')).toBeNull();
  });

  it('explains AI processing state while the marketplace request is in flight', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    apiFetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);

    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud IA/i }));

    expect(await screen.findByText('Procesando solicitud con IA')).toBeInTheDocument();
    expect(screen.getByText(/Analizando nota de pedido con IA/i)).toBeInTheDocument();
    expect(screen.getByText('Recibimos la entrada')).toBeInTheDocument();
    expect(screen.getByText('Identificamos datos')).toBeInTheDocument();
    expect(screen.getByText('El equipo lo recibe')).toBeInTheDocument();

    resolveRequest({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 93,
      customer_message: 'Solicitud recibida para revision.',
    });

    expect(await screen.findByText(/Solicitud procesada: quedo lista/i)).toBeInTheDocument();
  });

  it('submits a handwritten photo as an assisted marketplace file', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      lead_id: 'lead-44',
      customer_message: 'Foto recibida para desmenuzar articulos.',
    });

    const { container } = render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['foto'], 'nota-manuscrita.jpg', { type: 'image/jpeg' });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect((body.get('archivo') as File).name).toBe('nota-manuscrita.jpg');
    expect(body.get('document_type')).toBe('order_note');
    expect(body.get('tenant')).toBe('junin');
    expect(await screen.findByText('Foto recibida para desmenuzar articulos.')).toBeInTheDocument();
  });

  it('blocks marketplace upload when a backend contract exists without submit endpoint', async () => {
    render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        intakeEntry={{
          contract_version: 'marketplace.assisted_intake_entry.v1',
          title: 'Carga asistida controlada por backend',
          summary: 'El endpoint se habilita desde el contrato.',
          submit: {
            method: 'POST',
          },
        }}
      />,
    );

    expect(screen.getByText('Carga asistida pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear solicitud IA/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud IA/i }));

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('uses custom backend submit endpoint and field names from the intake contract', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 101,
      customer_message: 'Solicitud recibida.',
    });

    render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        intakeEntry={{
          contract_version: 'marketplace.assisted_intake_entry.v1',
          submit: {
            endpoint: '/api/custom/intake',
            method: 'POST',
            file_field: 'document',
            text_field: 'notes',
            document_type_field: 'kind',
            tenant_fields: ['tenant_slug'],
            contact_fields: ['contact_name', 'contact_phone'],
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Marcelo' },
    });
    fireEvent.change(screen.getByLabelText('WhatsApp para respuesta'), {
      target: { value: '+5492613168608' },
    });
    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud IA/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/custom/intake',
        expect.objectContaining({ method: 'POST', tenantSlug: 'junin' }),
      );
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('notes')).toBe('2 chapas galvanizadas');
    expect(body.get('kind')).toBe('order_note');
    expect(body.get('tenant_slug')).toBe('junin');
    expect(body.get('tenant')).toBeNull();
    expect(body.get('contact_name')).toBe('Marcelo');
    expect(body.get('contact_phone')).toBe('+5492613168608');
    expect(body.get('contact_email')).toBeNull();
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
          submit: {
            endpoint: '/api/pedidos/from-file?origen=marketplace',
            method: 'POST',
          },
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
