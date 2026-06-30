import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

describe('AssistedRequestPanel', () => {
  it('renders catalog candidates with operator actions', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <AssistedRequestPanel
        order={{
          ...baseOrder,
          assisted_request: {
            contract_version: 'marketplace.assisted_request.v1',
            mode: 'order_note_upload',
            crm_state: 'pending_operator_review',
            document_profile: {
              primary_intent: 'create_order_or_quote',
              catalog_matching: true,
              input_mode: 'file',
            },
            structured_extraction: {
              contract_version: 'marketplace.structured_extraction.v1',
              primary_intent: 'create_order_or_quote',
              confidence: 'ready_for_operator',
              fields: {
                resumen: '2 chapas y 1 caja de clavos para cotizar',
                contacto: { name: 'Marcelo', phone: '+5492613168608' },
              },
              missing_fields: ['direccion'],
              source: 'llm_or_text_rows',
            },
            crm_handoff: {
              contract_version: 'marketplace.crm_handoff.v1',
              target_module: 'orders',
              recommended_record: 'assisted_order',
              operator_goal: 'convertir_a_pedido_o_cotizacion',
              draft_order: {
                estado: 'nuevo',
                prioridad: 'normal',
                canal_ingreso: 'marketplace',
              },
            },
            crm_order_draft: {
              contract_version: 'marketplace.crm_order_draft.v1',
              request_kind: 'quote_request',
              request_kind_label: 'pedido de cotizacion',
              target_module: 'orders',
              recommended_record: 'assisted_order',
              recommended_next_step: 'resolver_items_y_cotizar',
              needs_operator_review: true,
              pedido_id: 42,
              lead_id: 42,
              reference: 'pedido:42',
              contact_state: 'available',
              source: {
                channel: 'marketplace',
                input_type: 'txt',
              },
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
                  source_name: '2 Chapas',
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
                  candidate_count: 0,
                  needs_operator_review: false,
                },
                {
                  line_id: 'line-2',
                  status: 'needs_catalog_resolution',
                  source_name: '1 Clavos 2 pulgadas',
                  quantity: 1,
                  unit: 'caja',
                  candidate_count: 1,
                  needs_operator_review: true,
                },
              ],
            },
            source: {
              channel: 'marketplace',
              original_filename: 'pedido-ferreteria.png',
              mime_type: 'image/png',
              file_size_bytes: 2400,
            },
            match_summary: { detected: 2, matched: 1, unmatched: 1 },
            operator_pack: {
              priority: 'high',
              priority_reason: 'datos_no_interpretados',
              priority_reason_label: 'Hay datos para resolver',
              sla_hint: { label: '3 h', minutes: 180, basis: 'datos_no_interpretados' },
              operator_queue: 'commerce_assisted_orders',
              operator_queue_label: 'Pedidos asistidos y catalogo',
              primary_missing_field: 'catalog_resolution',
              missing_fields: ['catalog_resolution'],
            },
            operator_intake_summary: {
              contract_version: 'marketplace.operator_intake_summary.v1',
              objective: 'Confirmar stock, precio, alternativas y convertir la nota en pedido o cotizacion.',
              recommended_next_step: 'resolver_faltantes_y_responder',
              target_module: 'orders',
              operator_queue: 'commerce_assisted_orders',
              operator_queue_label: 'Pedidos asistidos y catalogo',
              priority_reason: 'datos_no_interpretados',
              priority_reason_label: 'Hay datos para resolver',
              sla_hint: { label: '3 h', minutes: 180 },
              primary_missing_field: 'catalog_resolution',
              contact_state: 'available',
            },
            public_follow_up: {
              contract_version: 'marketplace.assisted_followup.v1',
              tracking: {
                code: 'pc-42',
                path: '/tracking/order/pc-42?tenant_slug=demo',
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
            review_context: {
              review_reasons: ['items_sin_match_exacto', 'contacto_incompleto'],
              operator_queue_label: 'Pedidos asistidos y catalogo',
              priority_reason_label: 'Hay datos para resolver',
              sla_hint: { label: '3 h', minutes: 180 },
              primary_missing_field: 'catalog_resolution',
            },
            intake_experience: {
              contract_version: 'marketplace.assisted_intake_experience.v1',
              title: 'Pedido asistido por foto, papel o texto',
              summary: 'Chatboc recibio la nota y la dejo lista para el CRM.',
              anonymous_intake: true,
              catalog_matching: true,
              needs_operator_review: true,
              pipeline: [
                { id: 'capture', label: 'Archivo o texto recibido', description: 'Entrada anonima.', status: 'done' },
                { id: 'catalog_match', label: 'Cruce con catalogo', description: 'Alternativas para operador.', status: 'pending_review' },
              ],
              capabilities: [{ id: 'handwritten_note_ocr', label: 'Notas manuscritas', status: 'enabled' }],
            },
            customer_next_steps: [
              { id: 'received', label: 'Solicitud recibida', status: 'done', description: 'El pedido quedo registrado.' },
              { id: 'reply', label: 'Respuesta por canal', status: 'pending', description: 'El equipo responde por WhatsApp.' },
            ],
            unmatched_items: ['1 Clavos 2 pulgadas'],
            catalog_candidates: [
              {
                item: '1 Clavos 2 pulgadas',
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
        }}
      />,
    );

    expect(screen.getByText('Alternativas de catalogo')).toBeTruthy();
    expect(screen.getByText('Pedido o cotizacion')).toBeTruthy();
    expect(screen.getAllByText('Cruce con catalogo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Proximo paso').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Completar Direccion')).toBeTruthy();
    expect(screen.getAllByText('Objetivo operativo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Confirmar stock, precio, alternativas y convertir la nota en pedido o cotizacion.')).toBeTruthy();
    expect(screen.getByText('Accion sugerida: resolver faltantes y responder')).toBeTruthy();
    expect(screen.getAllByText('Pedidos asistidos y catalogo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SLA')).toBeTruthy();
    expect(screen.getAllByText('3 h').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Hay datos para resolver')).toBeTruthy();
    expect(screen.getByText('Resolucion de catalogo')).toBeTruthy();
    expect(screen.getByText('Lectura IA')).toBeTruthy();
    expect(screen.getByText(/2 detectados/)).toBeTruthy();
    expect(screen.getByText('Motivo operativo')).toBeTruthy();
    expect(screen.getByText('Items sin match exacto')).toBeTruthy();
    expect(screen.getByText('Contacto incompleto')).toBeTruthy();
    expect(screen.getByText('Datos entendidos por IA')).toBeTruthy();
    expect(screen.getByText('2 chapas y 1 caja de clavos para cotizar')).toBeTruthy();
    expect(screen.getAllByText(/Marcelo/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Faltantes para completar')).toBeTruthy();
    expect(screen.getByText('Direccion')).toBeTruthy();
    expect(screen.getByText('Derivacion operativa')).toBeTruthy();
    expect(screen.getByText('Pedidos y cotizaciones')).toBeTruthy();
    expect(screen.getByText('Pedido asistido')).toBeTruthy();
    expect(screen.getByText('convertir a pedido o cotizacion')).toBeTruthy();
    expect(screen.getByText('Borrador de pedido armado')).toBeTruthy();
    expect(screen.getByText('pedido:42')).toBeTruthy();
    expect(screen.getByText('resolver items y cotizar')).toBeTruthy();
    expect(screen.getByText('Catalogo confirmado')).toBeTruthy();
    expect(screen.getByText('Resolver catalogo')).toBeTruthy();
    expect(screen.getByText('2 Chapas')).toBeTruthy();
    expect(screen.getByText('Chapa galvanizada acanalada')).toBeTruthy();
    expect(screen.getByText('Sin producto confirmado. Resolver alternativa antes de confirmar.')).toBeTruthy();
    expect(screen.getAllByText('1 candidato').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Plan para el cliente')).toBeTruthy();
    expect(screen.getByText('Seguimiento publico')).toBeTruthy();
    expect(screen.getAllByText('pc-42').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe(
      'http://localhost:3000/tracking/order/pc-42?tenant_slug=demo',
    );
    expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/?text=Pedido%20pc-42');
    expect(screen.getByText('Pedido asistido por foto, papel o texto')).toBeTruthy();
    expect(screen.getByText('Chatboc recibio la nota y la dejo lista para el CRM.')).toBeTruthy();
    expect(screen.getByText('Archivo o texto recibido')).toBeTruthy();
    expect(screen.getAllByText('Cruce con catalogo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Notas manuscritas')).toBeTruthy();
    expect(screen.getByText('Respuesta por canal')).toBeTruthy();
    expect(screen.getByText(/Item no encontrado:/)).toBeTruthy();
    expect(screen.getAllByText('1 Clavos 2 pulgadas').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Clavos punta paris')).toBeTruthy();
    expect(screen.getByText('Score 88%')).toBeTruthy();
    expect(screen.getByText('Confianza Alta')).toBeTruthy();
    expect(screen.getByText('SKU CL-01')).toBeTruthy();
    expect(screen.getByText('Precio $3.000')).toBeTruthy();
    expect(screen.getByText('Motivo: Nombre similar al texto detectado')).toBeTruthy();
    expect(screen.getByLabelText('Abrir referencia Clavos punta paris').getAttribute('href')).toBe('/t/demo/catalogo?item=7');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar resumen operativo' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Resumen operativo Chatboc'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Pedido/Solicitud: conversational:42'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Seguimiento: pc-42'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Pedido armado:'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('2 un 2 Chapas -> Chapa galvanizada acanalada'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('1 Clavos 2 pulgadas'));

    fireEvent.click(screen.getByRole('button', { name: 'Copiar pedido' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Pedido armado por Chatboc'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Referencia: pedido:42'));

    fireEvent.click(screen.getByLabelText('Copiar candidato Clavos punta paris'));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Candidato: Clavos punta paris'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('SKU: CL-01'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Motivo: Nombre similar al texto detectado'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Copiar' })[0]);
    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/tracking/order/pc-42?tenant_slug=demo');
  });

  it('keeps rendering older assisted requests without candidates', () => {
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

    expect(screen.getByText('Solicitud asistida por IA')).toBeTruthy();
    expect(screen.getByText('Chapas para cotizar')).toBeTruthy();
    expect(screen.queryByText('Alternativas de catalogo')).toBeNull();
  });
});
