import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UploadOrderFromFile from './UploadOrderFromFile';

const envMock = vi.hoisted(() => ({ turnstileSiteKey: '' }));
const apiMock = vi.hoisted(() => {
  class ApiError extends Error {
    status = 500;
    body: unknown = null;

    constructor(message = 'api_error', status = 500, body: unknown = null) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  }

  return {
    ApiError,
    apiFetchMock: vi.fn(),
  };
});
const apiFetchMock = apiMock.apiFetchMock;
const ApiError = apiMock.ApiError;

vi.mock('@/env', () => ({
  get CLOUDFLARE_TURNSTILE_SITE_KEY() {
    return envMock.turnstileSiteKey;
  },
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/utils/api', () => {
  return {
    ApiError: apiMock.ApiError,
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
    getErrorMessage: (_error: unknown, fallback: string) => fallback,
  };
});

describe('UploadOrderFromFile marketplace intake', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    envMock.turnstileSiteKey = '';
    delete (window as any).turnstile;
    document.getElementById('chatboc-cloudflare-turnstile')?.remove();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('shows the assisted marketplace pipeline in the visible public intake header', () => {
    render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);

    expect(screen.getByTestId('marketplace-assisted-visible-pipeline')).toBeInTheDocument();
    expect(screen.getByText('Foto o texto')).toBeInTheDocument();
    expect(screen.getByText('Lectura ordenada')).toBeInTheDocument();
    expect(screen.getByText('Solicitud en panel')).toBeInTheDocument();
    expect(screen.getByText('Respuesta y seguimiento')).toBeInTheDocument();
  });

  it('submits Cloudflare Turnstile token when marketplace protection is configured', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    const renderTurnstile = vi.fn((container: HTMLElement, options: { callback?: (token: string) => void }) => {
      container.setAttribute('data-rendered-turnstile', 'true');
      options.callback?.('turnstile-token-123');
      return 'widget-1';
    });
    (window as any).turnstile = {
      render: renderTurnstile,
      remove: vi.fn(),
    };
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 112,
      customer_message: 'Solicitud protegida recibida.',
    });

    render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);

    expect(await screen.findByTestId('marketplace-turnstile-challenge')).toBeInTheDocument();
    await waitFor(() => {
      expect(renderTurnstile).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ sitekey: 'site-key-public' }),
      );
    });

    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('turnstile_token')).toBe('turnstile-token-123');
  });

  it('blocks anonymous marketplace intake when backend requires Turnstile but the public site key is missing', () => {
    render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        securityContract={{
          contract_version: 'marketplace.public_security.v1',
          protected_surfaces: ['marketplace_assisted_upload'],
          turnstile: {
            contract_version: 'cloudflare.turnstile.public_intake.v1',
            provider: 'cloudflare_turnstile',
            surface: 'marketplace_assisted_upload',
            status: 'required',
            configured: true,
            enforced: true,
            required: true,
          },
        }}
      />,
    );

    expect(screen.queryByTestId('marketplace-turnstile-challenge')).not.toBeInTheDocument();
    expect(screen.getByText(/Proteccion pendiente de configurar/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    expect(screen.getByRole('button', { name: /Crear solicitud/i })).toBeDisabled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('does not force Turnstile when the backend contract marks marketplace intake as not required', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 114,
      customer_message: 'Solicitud recibida sin desafio requerido.',
    });

    render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        securityContract={{
          contract_version: 'marketplace.public_security.v1',
          protected_surfaces: ['marketplace_assisted_upload'],
          turnstile: {
            contract_version: 'cloudflare.turnstile.public_intake.v1',
            provider: 'cloudflare_turnstile',
            surface: 'marketplace_assisted_upload',
            status: 'not_required',
            configured: true,
            enforced: false,
            required: false,
          },
        }}
      />,
    );

    expect(screen.queryByTestId('marketplace-turnstile-challenge')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });
    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('turnstile_token')).toBeNull();
  });

  it('resets Cloudflare Turnstile when backend rejects the marketplace security token', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    const resetTurnstile = vi.fn();
    const renderTurnstile = vi.fn((container: HTMLElement, options: { callback?: (token: string) => void }) => {
      container.setAttribute('data-rendered-turnstile', 'true');
      options.callback?.('expired-token-123');
      return 'widget-1';
    });
    (window as any).turnstile = {
      render: renderTurnstile,
      remove: vi.fn(),
      reset: resetTurnstile,
    };
    apiFetchMock.mockRejectedValueOnce(
      new ApiError('turnstile rejected', 400, {
        codigo: 'turnstile_verificacion_fallida',
        mensaje: 'No pudimos validar la verificacion de seguridad. Intenta nuevamente.',
        security: {
          contract_version: 'cloudflare.turnstile.public_intake.v1',
          provider: 'cloudflare_turnstile',
          status: 'verification_failed',
          reset_required: true,
        },
        frontend_contract: {
          render_as: 'public_intake_security_error',
          reset_turnstile: true,
        },
      }),
    );

    render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);

    expect(await screen.findByTestId('marketplace-turnstile-challenge')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    expect(await screen.findByText(/No pudimos validar la verificacion de seguridad/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(resetTurnstile).toHaveBeenCalledWith('widget-1');
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('turnstile_token')).toBe('expired-token-123');
  });

  it('creates an anonymous marketplace request and shows public follow-up actions', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 77,
      customer_message: 'Recibimos tu nota y la dejamos lista para revision comercial.',
      match_summary: { detected: 2, matched: 1, unmatched: 1 },
      source: { text_preview: '2 chapas galvanizadas' },
      crm_state: 'pending_operator_review',
      operational_result: {
        contract_version: 'marketplace.assisted_operational_result.v1',
        type: 'assisted_order_request',
        created_record: 'tenant_ticket',
        created_record_id: 501,
        pedido_id: 77,
        status: 'pending_operator_review',
        status_label: 'Solicitud recibida',
        requires_operator_confirmation: true,
        admin_surface: 'orders',
        record_reference: 'pc-77',
        tracking_path: '/tracking/order/pc-77?tenant_slug=junin&token=signed-token-77',
        tracking_code: 'pc-77',
        tracking_kind: 'order',
        customer_headline: 'Tu pedido quedo armado para revision',
        customer_description: 'El equipo recibe articulos, cantidades, candidatos de catalogo y faltantes antes de confirmar precio, stock o entrega.',
        operator_next_step: 'Resolver faltantes y responder',
      },
      crm_order_draft: {
        contract_version: 'marketplace.crm_order_draft.v1',
        reference: 'pedido:77',
        contact_state: 'available',
        recommended_next_step: 'resolver_items_y_cotizar',
        summary: { detected: 2, matched: 1, unmatched: 1 },
        lines: [
          {
            source_name: 'Chapas galvanizadas',
            quantity: 2,
            unit: 'unidades',
            status: 'matched',
            customer_visible_status: 'Producto encontrado en catalogo',
            confidence: 'high',
            catalog_item_id: 11,
          },
          {
            source_name: 'Clavos punta paris',
            quantity: 1,
            unit: 'caja',
            status: 'needs_review',
            customer_visible_status: 'Pendiente de asociar al catalogo',
            confidence: 'medium',
            candidate_count: 2,
          },
        ],
        customer_confirmation: {
          contract_version: 'marketplace.customer_confirmation.v1',
          status: 'operator_review_required',
          status_label: 'Revision del equipo necesaria',
          headline: 'Solicitud lista para revision',
          description: 'Ya quedo cargada con lo que pudimos interpretar. El equipo completa faltantes y responde.',
          confidence_level: 'medium',
          primary_action_label: 'Continuar por WhatsApp o chat',
          blocking_reasons: [
            {
              id: 'items_need_review',
              label: 'Hay articulos para revisar',
              description: 'Algunos renglones no se pudieron asociar al catalogo con seguridad.',
            },
          ],
        },
      },
      operator_pack: {
        priority: 'normal',
        operator_queue_label: 'Pedidos asistidos',
        priority_reason_label: 'Contacto disponible',
        contact_links: [{ type: 'whatsapp', label: 'Responder por WhatsApp' }],
        suggested_tasks: [
          {
            id: 'confirm_stock_price',
            label: 'Confirmar stock y precio',
            description: 'Validar disponibilidad, promocion vigente y condiciones antes de responder.',
          },
        ],
        suggested_reply: 'Hola Marcelo, recibimos tu lista y la estamos cotizando.',
      },
      operator_intake_summary: {
        objective: 'Confirmar stock, precio, alternativas y convertir la nota en pedido o cotizacion.',
        priority: 'normal',
        operator_queue_label: 'Pedidos asistidos',
        recommended_next_step: 'confirmar_stock_precio_y_responder',
        sla_hint: { label: '2 h', minutes: 120 },
      },
      public_follow_up: {
        contract_version: 'marketplace.assisted_followup.v1',
        tracking: {
          code: 'pc-77',
          path: '/tracking/order/pc-77?tenant_slug=junin&token=signed-token-77',
          token: 'signed-token-77',
          token_required: true,
          access: 'signed_link',
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
          href: '/tracking/order/pc-77?tenant_slug=junin&token=signed-token-77',
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
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/pedidos/from-file?origen=marketplace',
        expect.objectContaining({
          method: 'POST',
          skipAuth: true,
          omitCredentials: true,
          sendAnonId: true,
          tenantSlug: 'junin',
          suppressPanel401Redirect: true,
        }),
      );
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    const options = apiFetchMock.mock.calls[0][1];
    expect(options.headers).toEqual(
      expect.objectContaining({
        'Idempotency-Key': expect.stringMatching(/^assisted_intake:junin:order_note:text:/),
      }),
    );
    expect(body.get('idempotency_key')).toEqual(expect.stringMatching(/^assisted_intake:junin:order_note:text:/));
    expect(body.get('pedido_text')).toBe('2 chapas galvanizadas');
    expect(body.get('texto_pedido')).toBe('2 chapas galvanizadas');
    expect(body.get('order_text')).toBe('2 chapas galvanizadas');
    expect(body.get('document_type')).toBe('order_note');
    expect(body.get('tenant')).toBe('junin');
    expect(body.get('tenant_slug')).toBe('junin');
    expect(body.get('contact_name')).toBe('Marcelo');
    expect(body.get('contact_phone')).toBe('+5492613168608');
    expect(body.get('contact_email')).toBe('marcelo@example.com');
    expect(body.get('contact_notes')).toBe('Entregar por la tarde');

    expect(await screen.findByText('Tu pedido quedo armado para revision')).toBeInTheDocument();
    expect(screen.getByTestId('assisted-operational-result')).toBeInTheDocument();
    expect(screen.getAllByText('Solicitud recibida').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pedidos asistidos').length).toBeGreaterThan(0);
    expect(screen.getByText('Ticket del equipo')).toBeInTheDocument();
    expect(screen.getByText('Resolver faltantes y responder')).toBeInTheDocument();
    expect(screen.getByText('pc-77')).toBeInTheDocument();
    expect(screen.getByText('Que hace el equipo ahora')).toBeInTheDocument();
    expect(screen.getByText('Prioridad Normal')).toBeInTheDocument();
    expect(screen.getAllByText('Pedidos asistidos').length).toBeGreaterThan(0);
    expect(screen.getByText('SLA 2 h')).toBeInTheDocument();
    expect(screen.getByText('Confirmar stock, precio y responder')).toBeInTheDocument();
    expect(screen.getAllByText('Contacto disponible').length).toBeGreaterThan(0);
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Confirmar stock y precio')).toBeInTheDocument();
    expect(screen.getByText('Borrador que recibe el equipo')).toBeInTheDocument();
    expect(screen.getByText('Resolver items y cotizar')).toBeInTheDocument();
    expect(screen.getByTestId('assisted-draft-confirmation')).toBeInTheDocument();
    expect(screen.getByText('Revision del equipo necesaria')).toBeInTheDocument();
    expect(screen.getByText('Solicitud lista para revision')).toBeInTheDocument();
    expect(screen.getByText('Hay articulos para revisar')).toBeInTheDocument();
    expect(screen.getByText('Continuar por WhatsApp o chat')).toBeInTheDocument();
    expect(screen.getByText('Producto encontrado en catalogo')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de asociar al catalogo')).toBeInTheDocument();
    expect(screen.getByText('Confianza high')).toBeInTheDocument();
    expect(screen.getAllByText('Confianza medium').length).toBeGreaterThan(0);
    expect(screen.getByText('Chapas galvanizadas')).toBeInTheDocument();
    expect(screen.getByText('Clavos punta paris')).toBeInTheDocument();
    expect(screen.getByText(/Hola Marcelo, recibimos tu lista/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir seguimiento/i })).toHaveAttribute(
      'href',
      'http://localhost:3000/tracking/order/pc-77?tenant_slug=junin&token=signed-token-77',
    );
    expect(screen.getByRole('link', { name: /Continuar por WhatsApp/i })).toHaveAttribute(
      'href',
      'https://wa.me/?text=Pedido%20pc-77',
    );

    fireEvent.click(screen.getByRole('button', { name: /Copiar seguimiento/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3000/tracking/order/pc-77?tenant_slug=junin&token=signed-token-77',
      );
    });
  });

  it('submits crm operator uploads with authenticated credentials instead of anonymous marketplace mode', async () => {
    const onProcessed = vi.fn();
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 88,
      customer_message: 'Solicitud creada en CRM.',
      match_summary: { detected: 1, matched: 0, unmatched: 1 },
      crm_state: 'pending_operator_review',
      source: { text_preview: '2 bolsas de cemento' },
    });

    render(<UploadOrderFromFile tenantSlug="junin" variant="crm" onProcessed={onProcessed} />);

    expect(screen.getByText('Operador autenticado')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre'), {
      target: { value: 'Mostrador' },
    });
    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 bolsas de cemento' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/pedidos/from-file?origen=crm_admin',
        expect.objectContaining({
          method: 'POST',
          skipAuth: false,
          omitCredentials: false,
          sendAnonId: false,
          tenantSlug: 'junin',
          suppressPanel401Redirect: false,
        }),
      );
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('pedido_text')).toBe('2 bolsas de cemento');
    expect(body.get('document_type')).toBe('order_note');
    expect(body.get('tenant')).toBe('junin');
    expect(body.get('tenant_slug')).toBe('junin');
    expect(body.get('contact_name')).toBe('Mostrador');
    expect(onProcessed).toHaveBeenCalledWith(expect.objectContaining({ pedido_id: 88 }));
  });

  it('renders received relational upload evidence with image preview and file link', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 88,
      customer_message: 'Recibimos tu foto para revision.',
      source_attachment: {
        id: 'att-88',
        url: 'https://cdn.example.com/uploads/pedido-88.jpg',
        name: 'pedido-88.jpg',
        mime_type: 'image/jpeg',
        thumbnail_url: 'https://cdn.example.com/uploads/pedido-88-thumb.jpg',
      },
    });

    render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);

    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: 'foto con pedido manuscrito' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    expect(await screen.findByText('Evidencia adjunta recibida')).toBeInTheDocument();
    expect(screen.getByText('pedido-88.jpg')).toBeInTheDocument();
    expect(screen.getByText('ID att-88')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /pedido-88.jpg/i })).toHaveAttribute(
      'src',
      'https://cdn.example.com/uploads/pedido-88-thumb.jpg',
    );
    expect(screen.getByRole('link', { name: /Abrir archivo/i })).toHaveAttribute(
      'href',
      'https://cdn.example.com/uploads/pedido-88.jpg',
    );
  });

  it('uses backend quick examples to help anonymous users create a request without knowing the catalog', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 91,
      customer_message: 'Recibimos tu pedido de cotizacion.',
      public_follow_up: {
        tracking: {
          code: 'pc-91',
          path: '/tracking/order/pc-91?tenant_slug=junin&token=signed-token-91',
          token: 'signed-token-91',
          token_required: true,
          access: 'signed_link',
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

    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('pedido_text')).toBe('2 chapas galvanizadas\n1 caja de clavos punta paris');
    expect(body.get('document_type')).toBe('quote_request');
  });

  it('submits an explicit assisted search draft as marketplace text', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 94,
      customer_message: 'Recibimos tu busqueda para revision.',
    });

    render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        suggestedTextDraft={'Busco: clavos punta paris\nNo lo encontre en el catalogo.'}
        suggestedTextDraftKey={1}
        suggestedDocumentType="quote_request"
      />,
    );

    const textarea = screen.getByPlaceholderText(/2 chapas galvanizadas/i);
    expect(textarea).toHaveValue('Busco: clavos punta paris\nNo lo encontre en el catalogo.');
    expect(screen.getByRole('button', { name: /Cotizacion/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('pedido_text')).toBe('Busco: clavos punta paris\nNo lo encontre en el catalogo.');
    expect(body.get('document_type')).toBe('quote_request');
  });

  it('does not overwrite manual text when a newer search draft arrives', () => {
    const { rerender } = render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        suggestedTextDraft="Busco: chapas"
        suggestedTextDraftKey={1}
      />,
    );

    const textarea = screen.getByPlaceholderText(/2 chapas galvanizadas/i);
    expect(textarea).toHaveValue('Busco: chapas');

    fireEvent.change(textarea, { target: { value: 'Texto manual del cliente' } });

    rerender(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        suggestedTextDraft="Busco: clavos"
        suggestedTextDraftKey={2}
      />,
    );

    expect(textarea).toHaveValue('Texto manual del cliente');
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
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/pedidos/from-file?origen=marketplace',
        expect.objectContaining({
          method: 'POST',
          tenantSlug: 'junin',
          headers: {
            'X-Tenant': 'junin',
            'X-Checkout-Origin': 'marketplace',
            'Idempotency-Key': expect.stringMatching(/^assisted_intake:junin:order_note:text:/),
          },
        }),
      );
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('pedido_text')).toBe('2 chapas galvanizadas');
    expect(body.get('idempotency_key')).toEqual(expect.stringMatching(/^assisted_intake:junin:order_note:text:/));
    expect(body.get('X-Tenant')).toBeNull();
    expect(body.get('tenant')).toBeNull();
    expect(body.get('tenant_slug')).toBeNull();
  });

  it('keeps the same idempotency key when the same marketplace request is retried after a network error', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new TypeError('network failed'))
      .mockResolvedValueOnce({
        contract_version: 'marketplace.assisted_request.v1',
        pedido_id: 107,
        customer_message: 'Solicitud marketplace recibida despues del reintento.',
      });

    render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);

    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    expect(await screen.findByText(/No pudimos procesar el archivo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });

    const firstHeaders = apiFetchMock.mock.calls[0][1].headers as Record<string, string>;
    const secondHeaders = apiFetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(firstHeaders['Idempotency-Key']).toEqual(expect.stringMatching(/^assisted_intake:junin:order_note:text:/));
    expect(secondHeaders['Idempotency-Key']).toBe(firstHeaders['Idempotency-Key']);
    expect((apiFetchMock.mock.calls[1][1].body as FormData).get('idempotency_key')).toBe(firstHeaders['Idempotency-Key']);
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
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    expect(await screen.findByText('Procesando solicitud')).toBeInTheDocument();
    expect(screen.getByText(/Analizando nota de pedido para separar articulos/i)).toBeInTheDocument();
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

  it('labels partial 200 responses as manual review instead of automatic processing', async () => {
    apiFetchMock.mockResolvedValue({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 106,
      crm_state: 'manual_review',
      provider_status: 'failed',
      row_errors: ['No se pudo leer la nota de pedido'],
      customer_message: 'Recibimos tu nota, pero necesita revision del equipo.',
      crm_order_draft: {
        reference: 'pedido:106',
        provider_status: 'failed',
        row_errors: ['No hay lineas confiables'],
        summary: { detected: 0, matched: 0, unmatched: 0 },
        lines: [],
      },
    });

    render(<UploadOrderFromFile tenantSlug="junin" variant="marketplace" />);

    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: 'foto borrosa con pedido de clavos' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    expect(await screen.findByText('Solicitud recibida para revision')).toBeInTheDocument();
    expect(screen.getByText(/requiere revision manual antes de responder/i)).toBeInTheDocument();
    expect(screen.getByText(/No se genero un borrador editable automatico/i)).toBeInTheDocument();
    expect(screen.getByText('Revision manual que recibe el equipo')).toBeInTheDocument();
    expect(screen.queryByText(/Solicitud procesada: quedo lista/i)).not.toBeInTheDocument();
  });

  it('rejects unsupported marketplace file formats before uploading to the backend', async () => {
    const { container } = render(
      <UploadOrderFromFile
        tenantSlug="junin"
        variant="marketplace"
        intakeEntry={{
          contract_version: 'marketplace.assisted_intake_entry.v1',
          submit: {
            endpoint: '/api/pedidos/from-file?origen=marketplace',
            method: 'POST',
            accepted_extensions: ['.jpg', '.pdf'],
            accepted_mime_types: ['image/jpeg', 'application/pdf'],
          },
        }}
      />,
    );
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['contenido'], 'pedido.exe', { type: 'application/x-msdownload' });

    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(await screen.findByText(/Formato no aceptado/i)).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole('button', { name: /Nota manuscrita/i }));
    fireEvent.change(fileInput, {
      target: { files: [file] },
    });

    expect(await screen.findByTestId('assisted-pending-file')).toBeInTheDocument();
    expect(screen.getByText(/nota-manuscrita.jpg/i)).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud con archivo/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalled();
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    const headers = apiFetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toEqual(expect.stringMatching(/^assisted_intake:junin:handwritten_order:file:/));
    expect(body.get('idempotency_key')).toEqual(expect.stringMatching(/^assisted_intake:junin:handwritten_order:file:/));
    expect((body.get('archivo') as File).name).toBe('nota-manuscrita.jpg');
    expect(body.get('document_type')).toBe('handwritten_order');
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
    expect(screen.getByRole('button', { name: /Crear solicitud/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/2 chapas galvanizadas/i), {
      target: { value: '2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

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
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/custom/intake',
        expect.objectContaining({ method: 'POST', tenantSlug: 'junin' }),
      );
    });

    const body = apiFetchMock.mock.calls[0][1].body as FormData;
    expect(body.get('notes')).toBe('2 chapas galvanizadas');
    expect(body.get('pedido_text')).toBeNull();
    expect(body.get('texto_pedido')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: /Crear solicitud/i }));

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
