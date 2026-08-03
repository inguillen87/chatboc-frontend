import type { NotificationTemplatePreview } from './notificationTemplatePreviewTypes';

export const notificationTemplatePreviewFixture: NotificationTemplatePreview = {
  contract_version: 'professional_message_preview.v1',
  tenant_id: 7,
  template: {
    id: '11111111-1111-4111-8111-111111111111',
    key: 'claim_update_preview',
    channel: 'whatsapp',
    is_active: true,
    message_template_registry_id: 31,
  },
  rendered: {
    subject: 'Caso REC-10482',
    body: 'Actualizaci\u00f3n del caso REC-10482: En tratamiento.',
    required_variables: ['claim_code', 'status'],
    received_variables: ['claim_code', 'status'],
    strict_variable_contract: true,
    contains_unresolved_variables: false,
  },
  provider_template: {
    registry_id: 31,
    provider: 'twilio',
    name: 'chatboc_claim_update_preview_v1',
    language: 'es_AR',
    category: 'UTILITY',
    content_sid_present: true,
    preview_available: true,
    required_content_variables: ['1', '2'],
    received_content_variables: ['1', '2'],
    rendered_body: 'Caso REC-10482: En tratamiento.',
    rendered_components: {
      body: { text: 'Caso REC-10482: En tratamiento.' },
    },
    lifecycle: {
      state: 'approved',
      reason: 'fresh_provider_evidence',
      provider_status: 'approved',
      provider_reference_present: true,
      provider_evidence_at: '2026-08-02T12:00:00Z',
      provider_evidence_fresh: true,
      production_send_allowed: true,
      blockers: [],
    },
  },
  readiness: {
    preview_valid: true,
    provider_template_approval_valid: true,
    provider_template_ready: true,
    transport_readiness_checked: false,
    production_send_allowed: false,
    blockers: ['transport_readiness_not_checked'],
  },
  side_effects: {
    provider_calls_performed: false,
    messages_queued: 0,
    messages_sent: 0,
  },
};
