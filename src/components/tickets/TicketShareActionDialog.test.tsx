import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SaasAction } from '@/api/v2/saas';
import TicketShareActionDialog, { getTicketShareActionBlockReason } from './TicketShareActionDialog';

const action = (id: string, requires: string[], extra: Partial<SaasAction> = {}): SaasAction => ({
  id, label: id, enabled: true, disabled: false, method: 'POST', endpoint: '/api/v2/inbox/omnichannel/actions',
  delivery_mode: 'crm_only', external_dispatch: false, delivery_contract_version: 'inbox.action_delivery.v2', requires, ...extra,
});

describe('TicketShareActionDialog crm-only v2', () => {
  it('accepts only the exact enabled location contract', () => {
    expect(getTicketShareActionBlockReason('location', action('share_location', ['lat', 'lng', 'Idempotency-Key']))).toBeNull();
    expect(getTicketShareActionBlockReason('location', action('share_location', ['lat', 'lng']))).toMatch(/idempotente/i);
    expect(getTicketShareActionBlockReason('location', action('share_location', ['lat', 'lng', 'Idempotency-Key'], { external_dispatch: true }))).toMatch(/CRM-only/i);
  });

  it('fails closed when a CRM-only action advertises an external queue or mode', () => {
    expect(getTicketShareActionBlockReason('location', action('share_location', ['lat', 'lng', 'Idempotency-Key'], {
      may_queue_external_delivery: true,
      delivery_modes: ['durable_queue'],
    }))).toMatch(/CRM-only/i);
  });

  it('submits root WGS84 fields and states that no external message is sent', () => {
    const onConfirm = vi.fn();
    render(<TicketShareActionDialog action={action('share_location', ['lat', 'lng', 'Idempotency-Key'])} kind="location" open onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText(/guardará en CRM, no se enviará externamente/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Latitud WGS84'), { target: { value: '-34.593' } });
    fireEvent.change(screen.getByLabelText('Longitud WGS84'), { target: { value: '-60.946' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en CRM' }));
    expect(onConfirm).toHaveBeenCalledWith({ lat: -34.593, lng: -60.946 });
    expect(screen.getByText(/GPS corresponde al dispositivo del operador.*No modifica ni prueba/i)).toBeInTheDocument();
  });

  it('publishes browser provenance only when the backend explicitly requires it', () => {
    const onConfirm = vi.fn();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: -34.59, longitude: -60.94 } } as GeolocationPosition) } });
    render(<TicketShareActionDialog action={action('share_location', ['lat', 'lng', 'Idempotency-Key'], { raw: { accepted_fields: ['lat', 'lng', 'capture_source'] } })} kind="location" open onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en CRM' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ capture_source: 'operator_browser_geolocation' }));
  });

  it('never requests browser location before explicit opt-in', () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    render(<TicketShareActionDialog action={action('share_location', ['lat', 'lng', 'Idempotency-Key'])} kind="location" open onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('enables attachment only for an existing numeric ticket attachment id', () => {
    const attachmentAction = action('attach_file', ['attachment_id', 'Idempotency-Key']);
    expect(getTicketShareActionBlockReason('attachment', attachmentAction, undefined, [])).toMatch(/No hay adjuntos existentes/i);
    expect(getTicketShareActionBlockReason('attachment', attachmentAction, undefined, [{ id: 17, filename: 'acta.pdf' }])).toBeNull();
    expect(getTicketShareActionBlockReason('attachment', attachmentAction, undefined, [{ url: 'https://example.test/file' }])).toMatch(/ID verificable/i);
  });

  it('keeps forms blocked without a real approved tenant option', () => {
    const formAction = action('send_form', ['form_id', 'Idempotency-Key']);
    expect(getTicketShareActionBlockReason('form', formAction)).toMatch(/no publicó formularios reales/i);
  });

  it('submits only a verified, tenant-owned approved numeric form id published by the action', () => {
    const onConfirm = vi.fn();
    const formAction = action('send_form', ['form_id', 'Idempotency-Key'], { raw: { options: [{ id: 9, label: 'CUD', approved: true, tenant_owned: true, tenant_verified: true, evidence: { approved: true, tenant_owned: true, flow_contract_verified: true } }] } });
    expect(getTicketShareActionBlockReason('form', formAction)).toBeNull();
    render(<TicketShareActionDialog action={formAction} kind="form" open onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('Formulario publicado'), { target: { value: 'number:9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en CRM' }));
    expect(onConfirm).toHaveBeenCalledWith({ form_id: 9 });
  });

  it('rejects unverified or non-tenant form options even when they look approved', () => {
    const formAction = action('send_form', ['form_id', 'Idempotency-Key'], { raw: { options: [
      { id: 9, label: 'Foreign', approved: true, tenant_owned: false, tenant_verified: true, evidence: { approved: true, tenant_owned: false, flow_contract_verified: true } },
      { id: 10, label: 'Unverified', approved: true, tenant_owned: true, tenant_verified: false, evidence: { approved: true, tenant_owned: true, flow_contract_verified: false } },
    ] } });
    expect(getTicketShareActionBlockReason('form', formAction)).toMatch(/no publicó formularios reales/i);
  });

  it('uses the published form_slug schema and reply-contract options for runtime preflight', () => {
    const onConfirm = vi.fn();
    const formAction = action('share_form', ['form_slug'], {
      delivery_mode: 'runtime_preflight',
      delivery_modes: ['durable_queue', 'internal_event'],
      external_dispatch: false,
      direct_external_dispatch: false,
      may_queue_external_delivery: true,
      action_response_delivery_authoritative: true,
      final_delivery_authority: 'provider_status_callback',
      idempotency: {
        preferred_header: 'Idempotency-Key',
        body_field: 'client_message_id',
        retry_rule: 'reuse_same_value',
      },
      input_schema: {
        type: 'object',
        required: ['form_slug'],
        properties: {
          form_slug: {
            type: 'string',
            enum: ['reclamo-alumbrado'],
            'x-options-source': 'reply_contract.form_selection.options',
          },
        },
      },
    });
    const replyContract = {
      form_selection: {
        options: [{
          id: 'survey-12',
          form_slug: 'reclamo-alumbrado',
          label: 'Reclamo de alumbrado',
        }],
      },
    };

    expect(getTicketShareActionBlockReason('form', formAction, replyContract)).toBeNull();
    render(
      <TicketShareActionDialog
        action={formAction}
        kind="form"
        open
        replyContract={replyContract}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(/puede quedar en cola/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Formulario publicado'), {
      target: { value: 'string:reclamo-alumbrado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Compartir formulario' }));
    expect(onConfirm).toHaveBeenCalledWith({ form_slug: 'reclamo-alumbrado' });
  });

  it('fails closed when form requires and input schema disagree', () => {
    const formAction = action('share_form', ['form_id', 'Idempotency-Key'], {
      input_schema: {
        type: 'object',
        required: ['form_slug'],
        properties: {
          form_slug: { type: 'string', enum: ['reclamo-alumbrado'] },
        },
      },
    });

    expect(getTicketShareActionBlockReason('form', formAction)).toMatch(/contradicen/i);
  });

  it('does not replace an explicitly empty form enum with reply-contract options', () => {
    const formAction = action('share_form', ['form_slug'], {
      delivery_mode: 'runtime_preflight',
      delivery_modes: ['durable_queue', 'internal_event'],
      direct_external_dispatch: false,
      may_queue_external_delivery: true,
      action_response_delivery_authoritative: true,
      final_delivery_authority: 'provider_status_callback',
      idempotency: {
        preferred_header: 'Idempotency-Key',
        body_field: 'client_message_id',
        retry_rule: 'reuse_same_value',
      },
      input_schema: {
        type: 'object',
        required: ['form_slug'],
        properties: {
          form_slug: {
            type: 'string',
            enum: [],
            'x-options-source': 'reply_contract.form_selection.options',
          },
        },
      },
    });
    const replyContract = {
      form_selection: {
        options: [{ form_slug: 'no-permitido', label: 'No permitido' }],
      },
    };

    expect(getTicketShareActionBlockReason('form', formAction, replyContract)).toMatch(/lista cerrada/i);
  });

  it('submits the exact nested location shape published by input_schema', () => {
    const onConfirm = vi.fn();
    const locationAction = action('share_location', ['location', 'Idempotency-Key'], {
      input_schema: {
        type: 'object',
        required: ['location'],
        properties: {
          location: {
            type: 'object',
            additionalProperties: false,
            properties: {
              address: { type: 'string', maxLength: 300 },
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lng: { type: 'number', minimum: -180, maximum: 180 },
            },
            anyOf: [{ required: ['address'] }, { required: ['lat', 'lng'] }],
          },
        },
      },
    });

    expect(getTicketShareActionBlockReason('location', locationAction)).toBeNull();
    render(<TicketShareActionDialog action={locationAction} kind="location" open onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('Dirección o referencia'), {
      target: { value: 'Av. San Martín 123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en CRM' }));
    expect(onConfirm).toHaveBeenCalledWith({ location: { address: 'Av. San Martín 123' } });
  });

  it('fails closed when a nested location schema contradicts root required fields', () => {
    const locationAction = action('share_location', ['lat', 'lng', 'Idempotency-Key'], {
      input_schema: {
        type: 'object',
        required: ['location'],
        properties: {
          location: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
            },
            anyOf: [{ required: ['address'] }, { required: ['lat', 'lng'] }],
          },
        },
      },
    });

    expect(getTicketShareActionBlockReason('location', locationAction)).toMatch(/contradice/i);
  });

  it('preserves base required fields when location also publishes anyOf alternatives', () => {
    const onConfirm = vi.fn();
    const locationAction = action('share_location', ['location', 'Idempotency-Key'], {
      input_schema: {
        type: 'object',
        required: ['location'],
        properties: {
          location: {
            type: 'object',
            required: ['address'],
            properties: {
              address: { type: 'string' },
              lat: { type: 'number' },
              lng: { type: 'number' },
            },
            anyOf: [{ required: ['address'] }, { required: ['lat', 'lng'] }],
          },
        },
      },
    });

    expect(getTicketShareActionBlockReason('location', locationAction)).toBeNull();
    render(<TicketShareActionDialog action={locationAction} kind="location" open onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText('Latitud WGS84'), { target: { value: '-34.593' } });
    fireEvent.change(screen.getByLabelText('Longitud WGS84'), { target: { value: '-60.946' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar en CRM' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/dirección o referencia requerida/i);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('labels a runtime-preflight attachment confirmation as an attachment action', () => {
    const attachmentAction = action('attach_file', ['attachment_id'], {
      delivery_mode: 'runtime_preflight',
      delivery_modes: ['durable_queue', 'internal_event'],
      direct_external_dispatch: false,
      may_queue_external_delivery: true,
      action_response_delivery_authoritative: true,
      final_delivery_authority: 'provider_status_callback',
      idempotency: {
        preferred_header: 'Idempotency-Key',
        body_field: 'client_message_id',
        retry_rule: 'reuse_same_value',
      },
    });

    render(
      <TicketShareActionDialog
        action={attachmentAction}
        attachments={[{ id: 17, filename: 'acta.pdf' }]}
        kind="attachment"
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirmar adjunto' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar ubicación' })).not.toBeInTheDocument();
  });
});
