import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AssistedRequestPanel } from './AssistedRequestPanel';
import type { Order } from '@/types/unified';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseOrder: Order = {
  id: 'conversational:42',
  total: 0,
  status: 'nuevo',
  items: [],
  created_at: '2026-06-28T12:00:00.000Z',
};

const richOrder: Order = {
  ...baseOrder,
  crm_review_card: {
    contract_version: 'marketplace.crm_review_card.v1',
    reference: 'pedido:42',
    request_kind: 'quote_request',
    request_kind_label: 'Pedido de cotizacion',
    status: 'needs_review',
    priority: 'high',
    primary_intent: 'create_order_or_quote',
    recommended_next_step: 'resolver_faltantes_y_responder',
    summary: { detected: 2, matched: 1, unmatched: 1 },
    sourceAttachment: {
      id: 'upload-rel-42',
      url: 'https://files.example.com/relational/pedido-ferreteria.png',
      name: 'pedido-ferreteria.png',
      mimeType: 'image/png',
    },
    source: {
      channel: 'marketplace',
      input_type: 'image/png',
      archivo_url: 'https://files.example.com/legacy/pedido-viejo.png',
      archivo_nombre: 'pedido-viejo.png',
      text_preview: '2 chapas galvanizadas y 1 caja de clavos de 2 pulgadas.',
    },
    contact: {
      name: 'Marcelo Perez',
      phone: '+5492613168608',
      email: 'marcelo@example.com',
    },
    suggested_reply: 'Marcelo, estamos validando stock y precio para enviarte la cotizacion.',
    contact_links: [
      {
        type: 'whatsapp',
        label: 'Responder por WhatsApp',
        href: 'https://wa.me/5492613168608',
      },
    ],
    lines: [],
  },
  assisted_request: {
    contract_version: 'marketplace.assisted_request.v1',
    mode: 'order_note_upload',
    crm_state: 'pending_operator_review',
    request_kind_label: 'Pedido de cotizacion',
    document_profile: {
      primary_intent: 'create_order_or_quote',
      catalog_matching: true,
      input_mode: 'file',
    },
    structured_extraction: {
      contract_version: 'marketplace.structured_extraction.v1',
      primary_intent: 'create_order_or_quote',
      catalog_matching: true,
      confidence: 'medium',
      fields: {
        resumen: 'El cliente solicita cotizacion por dos chapas y una caja de clavos.',
        contacto: { name: 'Marcelo Perez', phone: '+5492613168608' },
        observaciones: 'Confirmar stock antes de responder.',
      },
      missing_fields: ['direccion'],
      source: 'llm_or_text_rows',
    },
    crm_handoff: {
      contract_version: 'marketplace.crm_handoff.v1',
      target_module: 'orders',
      recommended_record: 'assisted_order',
      operator_goal: 'convertir_a_pedido_o_cotizacion',
    },
    crm_order_draft: {
      contract_version: 'marketplace.crm_order_draft.v1',
      request_kind: 'quote_request',
      request_kind_label: 'Pedido de cotizacion',
      target_module: 'orders',
      recommended_record: 'assisted_order',
      recommended_next_step: 'resolver_items_y_cotizar',
      needs_operator_review: true,
      reference: 'pedido:42',
      summary: {
        detected: 2,
        matched: 1,
        unmatched: 1,
        has_contact: true,
        needs_operator_review: true,
      },
      lines: [
        {
          line_id: 'line-1',
          status: 'catalog_matched',
          source_name: 'Chapas galvanizadas',
          quantity: 2,
          unit: 'un',
          sku: 'CH-01',
          catalog_item_id: 11,
          catalog_match: {
            catalogo_item_id: 11,
            name: 'Chapa galvanizada acanalada',
            sku: 'CH-01',
            price: 12000,
            currency: 'ARS',
          },
        },
        {
          line_id: 'line-2',
          status: 'needs_catalog_resolution',
          source_name: 'Clavos 2 pulgadas',
          quantity: 1,
          unit: 'caja',
          candidate_count: 1,
          needs_operator_review: true,
        },
      ],
    },
    source: {
      channel: 'marketplace',
      original_filename: 'pedido-viejo.png',
      archivo_url: 'https://files.example.com/legacy/pedido-viejo.png',
      mime_type: 'image/png',
      file_size_bytes: 2400,
      text_preview: 'Texto legacy que no debe ganar al review card.',
    },
    match_summary: { detected: 2, matched: 1, unmatched: 1 },
    operator_pack: {
      priority: 'high',
      operator_queue_label: 'Pedidos asistidos y catalogo',
      primary_missing_field: 'catalog_resolution',
      missing_fields: ['catalog_resolution'],
      sla_hint: { label: '3 h', minutes: 180 },
      suggested_reply: 'Marcelo, estamos validando stock y precio para enviarte la cotizacion.',
      contact_links: [
        {
          type: 'whatsapp',
          label: 'Responder por WhatsApp',
          href: 'https://wa.me/5492613168608',
        },
      ],
    },
    operator_intake_summary: {
      contract_version: 'marketplace.operator_intake_summary.v1',
      objective: 'Confirmar stock, precio y alternativa antes de cotizar.',
      recommended_next_step: 'resolver_faltantes_y_responder',
      target_module: 'orders',
      operator_queue_label: 'Pedidos asistidos y catalogo',
      sla_hint: { label: '3 h', minutes: 180 },
    },
    review_context: {
      review_reasons: ['items_sin_match_exacto', 'contacto_incompleto'],
      missing_fields: ['catalog_resolution'],
    },
    public_follow_up: {
      contract_version: 'marketplace.assisted_followup.v1',
      tracking: {
        code: 'pc-42',
        path: '/tracking/order/pc-42?tenant_slug=demo&token=signed-token-42',
        label: 'Seguimiento de solicitud',
      },
      channels: [
        {
          id: 'whatsapp_handoff',
          type: 'link',
          label: 'Continuar por WhatsApp',
          href: 'https://wa.me/?text=Pedido%20pc-42',
        },
      ],
    },
    unmatched_items: ['Clavos 2 pulgadas'],
    catalog_candidates: [
      {
        item: 'Clavos 2 pulgadas',
        candidates: [
          {
            catalogo_item_id: 7,
            name: 'Clavos punta paris',
            sku: 'CL-01',
            price: 3000,
            score: 0.88,
            confidence: 'high',
            reason: 'Nombre similar al texto detectado',
            reference_url: '/t/demo/catalogo?item=7',
          },
        ],
      },
    ],
  },
};

describe('AssistedRequestPanel', () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  it('renders the received contract as a dense operational review and keeps real actions wired', async () => {
    const onResolveCatalogCandidate = vi.fn();

    render(<AssistedRequestPanel order={richOrder} onResolveCatalogCandidate={onResolveCatalogCandidate} />);

    const panel = screen.getByRole('region', { name: 'Solicitud asistida por IA' });
    expect(panel.getAttribute('aria-busy')).toBe('false');
    expect(within(panel).getByRole('heading', { name: 'PROXIMA ACCION' })).toBeTruthy();
    expect(within(panel).getByText('Resolver faltantes y responder')).toBeTruthy();
    expect(within(panel).getByText('Confirmar stock, precio y alternativa antes de cotizar.', { exact: false })).toBeTruthy();

    expect(within(panel).getByLabelText('2 lineas detectadas')).toBeTruthy();
    expect(within(panel).getByLabelText('1 coincidencia de catalogo')).toBeTruthy();
    expect(within(panel).getByLabelText('1 linea sin coincidencia')).toBeTruthy();
    expect(within(panel).getByLabelText('2 datos faltantes')).toBeTruthy();

    expect(within(panel).getByRole('heading', { name: 'Documento original' })).toBeTruthy();
    expect(within(panel).getByText('pedido-ferreteria.png')).toBeTruthy();
    expect(within(panel).getByText('upload-rel-42')).toBeTruthy();
    expect(within(panel).queryByText('pedido-viejo.png')).toBeNull();
    expect(within(panel).getByText('2 chapas galvanizadas y 1 caja de clavos de 2 pulgadas.')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Abrir documento original' }).getAttribute('href')).toBe(
      'https://files.example.com/relational/pedido-ferreteria.png',
    );

    expect(within(panel).getByRole('heading', { name: 'Resumen IA' })).toBeTruthy();
    expect(within(panel).getByText('El cliente solicita cotizacion por dos chapas y una caja de clavos.')).toBeTruthy();
    expect(within(panel).getByText('Confirmar stock antes de responder.')).toBeTruthy();
    expect(within(panel).getByText('Confianza Media')).toBeTruthy();

    const linesTable = within(panel).getByRole('table', { name: 'Lineas detectadas y coincidencias de catalogo' });
    expect(within(linesTable).getByRole('columnheader', { name: 'Texto detectado' })).toBeTruthy();
    expect(within(linesTable).getByRole('rowheader', { name: 'Chapas galvanizadas' })).toBeTruthy();
    expect(within(linesTable).getByRole('rowheader', { name: 'Clavos 2 pulgadas' })).toBeTruthy();
    expect(within(linesTable).getByText('Chapa galvanizada acanalada')).toBeTruthy();
    expect(within(linesTable).getByText('Coincidencia confirmada')).toBeTruthy();
    expect(within(linesTable).getByText('Sin coincidencia')).toBeTruthy();

    expect(within(panel).getByRole('heading', { name: 'Datos faltantes y bloqueos' })).toBeTruthy();
    expect(within(panel).getByText('Direccion')).toBeTruthy();
    expect(within(panel).getByText('Resolucion de catalogo')).toBeTruthy();

    expect(within(panel).getByRole('heading', { name: 'Alternativas de catalogo' })).toBeTruthy();
    expect(within(panel).getByText('Clavos punta paris')).toBeTruthy();
    expect(within(panel).getByText('Score 88%')).toBeTruthy();
    expect(within(panel).getByText('Confianza Alta')).toBeTruthy();
    expect(within(panel).getByText('SKU CL-01 / Precio $3.000')).toBeTruthy();
    expect(within(panel).getByText('Motivo: Nombre similar al texto detectado')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Abrir referencia Clavos punta paris' }).getAttribute('href')).toBe(
      '/t/demo/catalogo?item=7',
    );

    fireEvent.click(within(panel).getByRole('button', { name: 'Vincular Clavos 2 pulgadas con Clavos punta paris' }));
    expect(onResolveCatalogCandidate).toHaveBeenCalledWith({
      lineId: 'line-2',
      sourceName: 'Clavos 2 pulgadas',
      catalogItemId: '7',
      candidateName: 'Clavos punta paris',
    });

    fireEvent.click(within(panel).getByRole('button', { name: 'Copiar resumen' }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Documento original: pedido-ferreteria.png'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Resumen IA: El cliente solicita cotizacion'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Chapas galvanizadas | Chapa galvanizada acanalada'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Datos faltantes: Direccion, Resolucion de catalogo'));

    fireEvent.click(within(panel).getByRole('button', { name: 'Copiar pedido' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Pedido armado por Chatboc')));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Referencia: pedido:42'));

    expect(within(panel).getByRole('link', { name: 'Responder por WhatsApp' }).getAttribute('href')).toBe(
      'https://wa.me/5492613168608',
    );
    expect(within(panel).getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe(
      'http://localhost:3000/tracking/order/pc-42?tenant_slug=demo&token=signed-token-42',
    );
  });

  it('announces and locks catalog resolution while the existing callback is in flight', () => {
    render(
      <AssistedRequestPanel
        order={richOrder}
        onResolveCatalogCandidate={vi.fn()}
        resolvingCatalogCandidateKey="line-2:7"
      />,
    );

    const panel = screen.getByRole('region', { name: 'Solicitud asistida por IA' });
    const button = within(panel).getByRole('button', { name: 'Vincular Clavos 2 pulgadas con Clavos punta paris' });
    expect(panel.getAttribute('aria-busy')).toBe('true');
    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(within(button).getByText('Vinculando')).toBeTruthy();
  });

  it('shows explicit empty states for a legacy request without structured lines or candidates', () => {
    render(
      <AssistedRequestPanel
        order={{
          ...baseOrder,
          assisted_request: {
            contract_version: 'marketplace.assisted_request.v1',
            mode: 'order_note_upload',
            source: { channel: 'marketplace' },
            match_summary: { detected: 1, matched: 0, unmatched: 1 },
            unmatched_items: ['Chapas para cotizar'],
          },
        }}
      />,
    );

    expect(screen.getByText('No hay lineas detectadas')).toBeTruthy();
    expect(screen.getByText('Sin resumen IA disponible.')).toBeTruthy();
    expect(screen.getByText('Sin adjunto ni texto original disponible en el contrato.')).toBeTruthy();
    expect(screen.getByText('Sin alternativas de catalogo')).toBeTruthy();
    expect(screen.getByText('Chapas para cotizar')).toBeTruthy();
  });

  it('exposes a loading state from the received processing status', () => {
    render(
      <AssistedRequestPanel
        order={{
          ...baseOrder,
          assisted_request: {
            contract_version: 'marketplace.assisted_request.v1',
            crm_state: 'processing',
            source: {
              channel: 'marketplace',
              original_filename: 'pedido-en-proceso.pdf',
              mime_type: 'application/pdf',
            },
            match_summary: { detected: 0, matched: 0, unmatched: 0 },
          },
        }}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Solicitud asistida por IA' });
    expect(panel.getAttribute('aria-busy')).toBe('true');
    expect(within(panel).getByRole('status', { name: 'Analizando documento' })).toBeTruthy();
    expect(within(panel).getByText('Analizando documento')).toBeTruthy();
    expect(within(panel).getByText('El resumen IA todavia se esta generando.')).toBeTruthy();
    expect(within(panel).getByText('La lectura sigue en curso.')).toBeTruthy();
  });

  it('renders a manual-review alert with the backend errors and no optimistic AI claim', () => {
    render(
      <AssistedRequestPanel
        order={{
          ...baseOrder,
          crm_review_card: {
            contract_version: 'marketplace.crm_review_card.v1',
            request_kind_label: 'Nota manuscrita',
            status: 'ai_unavailable',
            recommended_next_step: 'revisar_manualmente_el_archivo',
            summary: { detected: 0, matched: 0, unmatched: 0 },
            source: {
              channel: 'marketplace',
              input_type: 'jpg',
              text_preview: 'Imagen manuscrita con baja legibilidad.',
              extraction_error: 'provider_unavailable',
              provider_status: 'failed',
            },
            row_errors: ['No se pudo leer la nota'],
            lines: [],
          },
        }}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Lectura manual / IA no disponible' });
    const alert = within(panel).getByRole('alert');
    expect(within(alert).getByText('No se pudo completar una lectura automatica confiable')).toBeTruthy();
    expect(within(alert).getByText('El proveedor de IA no estuvo disponible.')).toBeTruthy();
    expect(within(alert).getByText('No se pudo leer la nota')).toBeTruthy();
    expect(within(panel).getByText('Sin resumen IA confiable.')).toBeTruthy();
    expect(within(panel).getByText('Imagen manuscrita con baja legibilidad.')).toBeTruthy();
    expect(within(panel).getByText('Revisar manualmente el archivo')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Solicitud asistida por IA' })).toBeNull();
  });
});
