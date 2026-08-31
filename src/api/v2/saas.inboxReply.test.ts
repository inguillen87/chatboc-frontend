import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';

const panelGetMock = vi.fn();
const panelPostMock = vi.fn();
const panelPatchMock = vi.fn();

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    get: (...args: unknown[]) => panelGetMock(...args),
    post: (...args: unknown[]) => panelPostMock(...args),
    patch: (...args: unknown[]) => panelPatchMock(...args),
  },
}));

import {
  normalizeOmnichannelInboxDetailV2,
  normalizeOmnichannelInboxActionV2,
  normalizeSaasActions,
  postOmnichannelInboxActionV2,
} from './saas';

const responseWithDelivery = (delivery: Record<string, unknown> = {}) => ({
  contract_version: 'inbox.omnichannel.action.v1',
  request_id: 'request-42',
  action: 'reply',
  delivery: {
    contract_version: 'inbox.action_delivery.v2',
    mode: 'durable_queue',
    status: 'durably_staged',
    ...delivery,
  },
  ticket: {
    id: 'municipio:42',
    ticket_id: 42,
    source_model: 'MunicipioTicket',
    title: 'Luminaria apagada',
    status: 'en_proceso',
  },
});

describe('omnichannel inbox reply v2 transport', () => {
  beforeEach(() => {
    panelGetMock.mockReset();
    panelPostMock.mockReset();
    panelPatchMock.mockReset();
    panelPostMock.mockResolvedValue(responseWithDelivery());
  });

  it('sends one stable client identity unchanged in the body and Idempotency-Key header', async () => {
    const clientMessageId = 'crm-reply:11111111-2222-4333-8444-555555555555';

    await postOmnichannelInboxActionV2(
      'municipio:42',
      {
        action: 'reply',
        payload: {
          endpoint: '/api/v2/inbox/omnichannel/actions',
          source_model: 'MunicipioTicket',
          legacy_id: 42,
          message: 'La cuadrilla ya recibio el aviso.',
          client_message_id: clientMessageId,
        },
      },
      'junin',
    );

    expect(panelPostMock).toHaveBeenCalledTimes(1);
    expect(panelPostMock).toHaveBeenCalledWith(
      '/api/v2/inbox/omnichannel/actions',
      expect.objectContaining({
        action: 'reply',
        source_model: 'MunicipioTicket',
        legacy_id: 42,
        ticket_id: 42,
        body: 'La cuadrilla ya recibio el aviso.',
        message: 'La cuadrilla ya recibio el aviso.',
        client_message_id: clientMessageId,
        visibility: 'public',
      }),
      {
        tenantSlug: 'junin',
        headers: { 'Idempotency-Key': clientMessageId },
      },
    );
    expect(panelPostMock.mock.calls[0][1]).not.toHaveProperty('idempotency_key');
    expect(panelPostMock.mock.calls[0][1]).not.toHaveProperty('payload');
  });

  it('preserves the same identity across the compatibility endpoint fallback', async () => {
    const clientMessageId = 'crm-reply:fallback-identity-0001';
    panelPostMock
      .mockRejectedValueOnce(new ApiError('not found', 404))
      .mockResolvedValueOnce(responseWithDelivery());

    await postOmnichannelInboxActionV2(
      'municipio:42',
      {
        action: 'reply',
        message: 'Seguimos el caso.',
        client_message_id: clientMessageId,
      },
      'junin',
    );

    expect(panelPostMock).toHaveBeenCalledTimes(2);
    expect(panelPostMock.mock.calls[0][1].client_message_id).toBe(clientMessageId);
    expect(panelPostMock.mock.calls[1][1].client_message_id).toBe(clientMessageId);
    expect(panelPostMock.mock.calls[0][2]).toEqual(panelPostMock.mock.calls[1][2]);
  });

  it('posts a location action with one stable identity and no reply or external-channel fields', async () => {
    const clientMessageId = 'crm-share_location:m419-location-0001';
    panelPostMock.mockResolvedValue({
      ...responseWithDelivery({
        mode: 'internal_event',
        delivery_mode: 'internal_event',
        status: 'recorded_in_crm',
        external_dispatch: false,
        final_delivery: {
          status: 'not_dispatched',
          authoritative_source: 'not_applicable',
        },
      }),
      action: 'share_location',
      ticket: {
        id: 'municipio:419', ticket_id: 419, source_model: 'MunicipioTicket',
        title: 'Luminaria apagada', status: 'en_proceso',
      },
    });

    await postOmnichannelInboxActionV2(
      'municipio:419',
      {
        action: 'share_location',
        endpoint: '/api/v2/inbox/omnichannel/actions',
        payload: {
          source_model: 'MunicipioTicket',
          legacy_id: 419,
          ticket_id: 419,
          lat: -34.593,
          lng: -60.946,
          client_message_id: clientMessageId,
        },
      },
      'junin',
    );

    expect(panelPostMock).toHaveBeenCalledTimes(1);
    expect(panelPostMock).toHaveBeenCalledWith(
      '/api/v2/inbox/omnichannel/actions',
      expect.objectContaining({
        action: 'share_location',
        source_model: 'MunicipioTicket',
        legacy_id: 419,
        ticket_id: 419,
        lat: -34.593,
        lng: -60.946,
        client_message_id: clientMessageId,
      }),
      {
        tenantSlug: 'junin',
        headers: { 'Idempotency-Key': clientMessageId },
      },
    );
    expect(panelPostMock.mock.calls[0][1]).not.toHaveProperty('body');
    expect(panelPostMock.mock.calls[0][1]).not.toHaveProperty('message');
    expect(panelPostMock.mock.calls[0][1]).not.toHaveProperty('visibility');
  });

  it('fails closed when a reply has no stable identity or carries conflicting identities', async () => {
    await expect(
      postOmnichannelInboxActionV2('municipio:42', { action: 'reply', message: 'Hola' }, 'junin'),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      postOmnichannelInboxActionV2(
        'municipio:42',
        {
          action: 'reply',
          message: 'Hola',
          client_message_id: 'crm-reply:identity-one',
          idempotency_key: 'crm-reply:identity-two',
        },
        'junin',
      ),
    ).rejects.toMatchObject({ status: 400 });

    expect(panelPostMock).not.toHaveBeenCalled();
  });

  it('preserves delivery, idempotency and outbox evidence from inbox.action_delivery.v2', () => {
    const normalized = normalizeOmnichannelInboxActionV2(responseWithDelivery({
      legacy_contract_version: 'inbox.action_delivery.v1',
      delivery_mode: 'durable_queue',
      channel: 'whatsapp',
      reason: 'domain_effects_durably_staged',
      fallback: 'domain_effect_worker',
      external_dispatch: false,
      timeline_updated: true,
      reply_status: 'queued_for_delivery',
      evidence_stage: 'durably_staged',
      final_delivery: {
        status: 'pending_provider_callback',
        authoritative_source: 'provider_status_callback',
      },
      idempotency: {
        contract_version: 'inbox.reply_idempotency.v1',
        replayed: false,
        source: 'idempotency_key_header',
        raw_value_persisted: false,
      },
      outbox: {
        durably_staged: true,
        effect_count: 4,
        worker_authoritative: true,
        direct_dispatch_performed: false,
      },
      delivery_results: { whatsapp: true, sms: false },
      delivery_results_semantics: 'provider_acceptance',
      requested_channels: ['email', 'sms', 'whatsapp', 'realtime'],
      delivery_skipped: { email: 'recipient_missing' },
    }));

    expect(normalized.delivery).toMatchObject({
      contract_version: 'inbox.action_delivery.v2',
      legacy_contract_version: 'inbox.action_delivery.v1',
      delivery_mode: 'durable_queue',
      evidence_stage: 'durably_staged',
      final_delivery: {
        status: 'pending_provider_callback',
        authoritative_source: 'provider_status_callback',
      },
      idempotency: {
        replayed: false,
        source: 'idempotency_key_header',
        raw_value_persisted: false,
      },
      outbox: {
        durably_staged: true,
        effect_count: 4,
        worker_authoritative: true,
        direct_dispatch_performed: false,
      },
      delivery_results: { whatsapp: true, sms: false },
      delivery_results_semantics: 'provider_acceptance',
      requested_channels: ['email', 'sms', 'whatsapp', 'realtime'],
      delivery_skipped: { email: 'recipient_missing' },
    });
  });

  it('preserves truthful CRM-only artifact evidence and replay state', () => {
    const normalized = normalizeOmnichannelInboxActionV2(responseWithDelivery({
      mode: 'crm_only', status: 'already_recorded', saved_in_crm: true,
      external_dispatch: false, dispatch_attempted: false, provider_accepted: false,
      delivered: false, failed: false, receipt_persisted: true, idempotent_replay: true,
    }));
    expect(normalized.delivery).toMatchObject({
      saved_in_crm: true, external_dispatch: false, dispatch_attempted: false,
      provider_accepted: false, delivered: false, failed: false,
      receipt_persisted: true, idempotent_replay: true,
    });
  });

  it('requires exact source_model and stable identity for attachment actions', async () => {
    await expect(postOmnichannelInboxActionV2('419', {
      action: 'attach_file', attachment_id: 17, client_message_id: 'crm-attach_file:attempt-0001',
    }, 'junin')).rejects.toMatchObject({ status: 400 });
    expect(panelPostMock).not.toHaveBeenCalled();
  });

  it('rejects crossed artifact route, body and source identities before transport', async () => {
    await expect(postOmnichannelInboxActionV2('municipio:419', {
      action: 'share_location',
      payload: { source_model: 'MunicipioTicket', ticket_id: 420, lat: -34.5, lng: -60.9, client_message_id: 'crm-share_location:attempt-0001' },
    }, 'junin')).rejects.toMatchObject({ status: 400 });
    await expect(postOmnichannelInboxActionV2('municipio:419', {
      action: 'share_location',
      payload: { source_model: 'TenantTicket', ticket_id: 419, lat: -34.5, lng: -60.9, client_message_id: 'crm-share_location:attempt-0002' },
    }, 'junin')).rejects.toMatchObject({ status: 400 });
    expect(panelPostMock).not.toHaveBeenCalled();
  });

  it('rejects a crossed artifact response instead of accepting stale cache data', async () => {
    panelPostMock.mockResolvedValue(responseWithDelivery());
    await expect(postOmnichannelInboxActionV2('municipio:419', {
      action: 'share_location',
      payload: { source_model: 'MunicipioTicket', ticket_id: 419, lat: -34.5, lng: -60.9, client_message_id: 'crm-share_location:attempt-0003' },
    }, 'junin')).rejects.toMatchObject({ status: 409 });
  });

  it('normalizes authoritative reply evidence without treating provider acceptance as delivery', () => {
    const normalized = normalizeOmnichannelInboxActionV2(responseWithDelivery({
      evidence: {
        contract_version: 'inbox.reply_delivery_evidence.v1',
        saved_in_crm: true,
        dispatch_attempted: true,
        provider_accepted: true,
        delivered: false,
        failed: false,
        delivered_requires: 'provider_status_callback',
      },
    }));

    expect(normalized.delivery?.evidence).toMatchObject({
      contract_version: 'inbox.reply_delivery_evidence.v1',
      saved_in_crm: true,
      dispatch_attempted: true,
      provider_accepted: true,
      delivered: false,
      failed: false,
      delivered_requires: 'provider_status_callback',
    });
  });

  it('normalizes reply_contract.v1 capabilities and disabled allowed actions', () => {
    const normalized = normalizeOmnichannelInboxDetailV2({
      item: {
        id: 'municipio:419',
        source_model: 'MunicipioTicket',
        title: 'Alumbrado público',
        allowed_actions: [{
          id: 'attach_file',
          label: 'Adjuntar archivo',
          enabled: false,
          disabled: true,
          reason_code: 'attachment_reply_not_supported',
        }],
        reply_contract: {
          contract_version: 'inbox.reply_contract.v1',
          source_model: 'MunicipioTicket',
          ticket_id: '419',
          channel: 'web_demo_widget',
          endpoint: '/api/v2/inbox/omnichannel/actions',
          method: 'POST',
          enabled: true,
          supported_message_types: {
            text: { enabled: true },
            attachment: { enabled: false, reason_code: 'attachment_reply_not_supported' },
            location: { enabled: false, reason_code: 'location_reply_not_supported' },
            form: { enabled: false, reason_code: 'form_reply_not_supported' },
          },
          delivery_channels: [
            { id: 'crm', enabled: true },
            { id: 'whatsapp', enabled: false, reason_code: 'ticket_channel_not_whatsapp' },
          ],
          delivery_state_machine: {
            contract_version: 'inbox.reply_delivery_evidence.v1',
            states: ['saved_in_crm', 'dispatch_attempted', 'provider_accepted', 'delivered', 'failed'],
            delivered_requires: 'provider_status_callback',
            latest_evidence: {
              contract_version: 'inbox.reply_delivery_evidence.v1',
              saved_in_crm: true,
              delivered: false,
            },
          },
        },
      },
    });

    expect(normalized.item.allowed_actions[0]).toMatchObject({
      id: 'attach_file',
      enabled: false,
      disabled: true,
      reason_code: 'attachment_reply_not_supported',
    });
    expect(normalized.item.reply_contract).toMatchObject({
      contract_version: 'inbox.reply_contract.v1',
      source_model: 'MunicipioTicket',
      supported_message_types: {
        text: { enabled: true },
        attachment: { enabled: false, reason_code: 'attachment_reply_not_supported' },
      },
      delivery_channels: [
        { id: 'crm', enabled: true },
        { id: 'whatsapp', enabled: false, reason_code: 'ticket_channel_not_whatsapp' },
      ],
      delivery_state_machine: {
        delivered_requires: 'provider_status_callback',
        latest_evidence: { saved_in_crm: true, delivered: false },
      },
    });
  });

  it('normalizes backend-driven action schemas and the item-level reply contract', () => {
    const actionFixture = {
      id: 'share_form',
      label: 'Compartir formulario',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      method: 'POST',
      requires: ['form_slug'],
      delivery_mode: 'runtime_preflight',
      delivery_modes: ['durable_queue', 'internal_event'],
      external_dispatch: false,
      direct_external_dispatch: false,
      may_queue_external_delivery: true,
      action_response_delivery_authoritative: true,
      final_delivery_authority: 'provider_status_callback',
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
      idempotency: {
        preferred_header: 'Idempotency-Key',
        body_field: 'client_message_id',
        retry_rule: 'reuse_same_value',
      },
    };
    const replyContract = {
      form_selection: {
        options: [{
          id: 'survey-12',
          form_slug: 'reclamo-alumbrado',
          label: 'Reclamo de alumbrado',
          href: '/e/reclamo-alumbrado',
          kind: 'survey',
        }],
      },
    };

    expect(normalizeSaasActions([actionFixture])[0]).toMatchObject({
      id: 'share_form',
      delivery_mode: 'runtime_preflight',
      delivery_modes: ['durable_queue', 'internal_event'],
      external_dispatch: false,
      direct_external_dispatch: false,
      may_queue_external_delivery: true,
      action_response_delivery_authoritative: true,
      final_delivery_authority: 'provider_status_callback',
      input_schema: actionFixture.input_schema,
      idempotency: actionFixture.idempotency,
    });

    const normalized = normalizeOmnichannelInboxDetailV2({
      item: {
        id: 'municipio:419',
        legacy_id: 419,
        source_model: 'MunicipioTicket',
        title: 'Demo reclamo - Alumbrado público',
        allowed_actions: [actionFixture],
        reply_contract: replyContract,
      },
    });
    expect(normalized.item.reply_contract).toMatchObject(replyContract);
    expect(normalized.item.allowed_actions[0]).toMatchObject({
      id: 'share_form',
      delivery_mode: 'runtime_preflight',
      may_queue_external_delivery: true,
      external_dispatch: false,
      input_schema: actionFixture.input_schema,
    });
  });
});
