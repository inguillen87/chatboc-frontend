export const NOTIFICATION_TEMPLATE_PREVIEW_CONTRACT =
  'professional_message_preview.v1' as const;

export type NotificationTemplateChannel =
  | 'email'
  | 'whatsapp'
  | 'push'
  | 'in_app';

export interface NotificationTemplatePreviewRequest {
  template_id?: string;
  key?: string;
  channel?: NotificationTemplateChannel;
  context: Record<string, unknown>;
  content_variables: Record<string, unknown>;
}

export interface NotificationTemplateProviderLifecycle {
  state: string;
  reason: string;
  provider_status: string | null;
  provider_reference_present: boolean;
  provider_evidence_at: string | null;
  provider_evidence_fresh: boolean;
  production_send_allowed: boolean;
  blockers: string[];
}

export interface NotificationTemplateProviderPreview {
  registry_id: number;
  provider: string;
  name: string;
  language: string;
  category: string | null;
  content_sid_present: boolean;
  preview_available: boolean;
  required_content_variables: string[];
  received_content_variables: string[];
  rendered_body: string;
  rendered_components: unknown;
  lifecycle: NotificationTemplateProviderLifecycle;
}

export interface NotificationTemplatePreview {
  contract_version: typeof NOTIFICATION_TEMPLATE_PREVIEW_CONTRACT;
  tenant_id: number;
  template: {
    id: string;
    key: string;
    channel: NotificationTemplateChannel;
    is_active: boolean;
    message_template_registry_id: number | null;
  };
  rendered: {
    body: string;
    subject: string | null;
    required_variables: string[];
    received_variables: string[];
    strict_variable_contract: true;
    contains_unresolved_variables: false;
  };
  provider_template: NotificationTemplateProviderPreview | null;
  readiness: {
    preview_valid: true;
    provider_template_approval_valid: boolean;
    provider_template_ready: boolean;
    transport_readiness_checked: false;
    production_send_allowed: false;
    blockers: string[];
  };
  side_effects: {
    provider_calls_performed: false;
    messages_queued: 0;
    messages_sent: 0;
  };
}

export interface NotificationTemplatePreviewFailure {
  reasonCode: string;
  field?: string;
  variableNames?: string[];
}
