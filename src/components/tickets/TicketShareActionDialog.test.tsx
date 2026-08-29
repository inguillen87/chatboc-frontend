import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SaasAction } from '@/api/v2/saas';

import TicketShareActionDialog, { getTicketShareActionBlockReason } from './TicketShareActionDialog';

const idempotency = {
  contract_version: 'inbox.reply_idempotency.v1',
  preferred_header: 'Idempotency-Key',
  body_field: 'client_message_id',
  retry_rule: 'reuse_same_value',
};

const locationAction: SaasAction = {
  id: 'share_location',
  label: 'Registrar ubicación',
  endpoint: '/api/v2/inbox/omnichannel/actions',
  method: 'POST',
  delivery_mode: 'internal_event',
  external_dispatch: false,
  idempotency,
  input_schema: {
    type: 'object',
    required: ['location'],
    properties: {
      location: {
        type: 'object',
        additionalProperties: false,
        properties: {
          address: { type: 'string', maxLength: 300 },
          label: { type: 'string', maxLength: 100 },
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
        },
        anyOf: [{ required: ['address'] }, { required: ['lat', 'lng'] }],
      },
    },
  },
};

const replyContract = {
  form_selection: {
    options: [{
      id: 'form-1',
      form_slug: 'reclamo-alumbrado',
      label: 'Reclamo de alumbrado',
      href: '/e/reclamo-alumbrado',
      kind: 'survey',
    }],
  },
};

const formAction: SaasAction = {
  id: 'share_form',
  label: 'Registrar formulario',
  endpoint: '/api/v2/inbox/omnichannel/actions',
  method: 'POST',
  delivery_mode: 'internal_event',
  external_dispatch: false,
  idempotency,
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
};

describe('TicketShareActionDialog', () => {
  it('does not pre-block a location action because the operator still has to complete its required value', () => {
    expect(getTicketShareActionBlockReason('location', locationAction)).toBeNull();
  });

  it.each([
    ['external dispatch', { external_dispatch: true }],
    ['missing external dispatch flag', { external_dispatch: undefined }],
    ['provider dispatch mode', { delivery_mode: 'provider_dispatch' }],
  ])('blocks location when the contract permits %s', (_label, overrides) => {
    expect(getTicketShareActionBlockReason('location', {
      ...locationAction,
      ...overrides,
    })).toBe('El contrato de ubicación no garantiza una acción interna sin despacho externo.');
  });

  it('blocks location when the idempotency contract version is not exact', () => {
    expect(getTicketShareActionBlockReason('location', {
      ...locationAction,
      idempotency: {
        ...idempotency,
        contract_version: 'inbox.reply_idempotency.v0',
      },
    })).toBe('El contrato de ubicación no publicó una identidad idempotente compatible.');
  });

  it('collects a valid address and labels the operation as internal', () => {
    const onConfirm = vi.fn();
    render(
      <TicketShareActionDialog
        action={locationAction}
        kind="location"
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Esta acción se registra dentro del CRM. No envía un mensaje por WhatsApp.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Dirección'), {
      target: { value: 'Plaza departamental, Junín' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar acción interna' }));

    expect(onConfirm).toHaveBeenCalledWith({
      location: { address: 'Plaza departamental, Junín' },
    });
  });

  it('only submits a form slug published by the item reply contract', () => {
    const onConfirm = vi.fn();
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

    fireEvent.change(screen.getByLabelText('Formulario publicado'), {
      target: { value: 'reclamo-alumbrado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar acción interna' }));

    expect(onConfirm).toHaveBeenCalledWith({ form_slug: 'reclamo-alumbrado' });
  });

  it('blocks a form action when the tenant-scoped reply contract has no matching options', () => {
    expect(getTicketShareActionBlockReason('form', formAction, {
      form_selection: { options: [] },
    })).toBe('El contrato de formulario no publicó opciones válidas para este tenant.');
  });
});
