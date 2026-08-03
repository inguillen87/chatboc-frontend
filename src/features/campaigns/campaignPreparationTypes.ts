export const CAMPAIGN_PREPARATION_CONTRACT =
  'crm_campaign_prepare.v1' as const;

export type CampaignChannel = 'whatsapp' | 'email';

export interface CampaignPreparationRequest {
  template_id: string;
  context: Record<string, unknown>;
  content_variables: Record<string, unknown>;
  contact_ids: string[];
  max_per_week: number;
  min_interval_hours: number;
  scheduled_for?: string;
  timezone?: string;
}

export interface CampaignQueueReceipt {
  intent_id: string;
  contact_id: string;
  queue_status: 'held' | 'excluded';
  exclusion_reason: string | null;
  transport_status: 'not_attempted';
  attempt_count: 0;
  provider_receipt_present: false;
}

export interface CampaignPreparation {
  contract_version: typeof CAMPAIGN_PREPARATION_CONTRACT;
  campaign: {
    id: string;
    status: 'draft';
    channel: CampaignChannel;
    template: {
      id: string;
      key: string;
      message_template_registry_id: number | null;
    };
    scheduled_for_utc: string | null;
    created_at: string | null;
    idempotent_replay: boolean;
  };
  preview: {
    subject: string | null;
    body: string;
    strict_variable_contract: true;
    contains_unresolved_variables: false;
  };
  audience: {
    requested: number;
    unique_requested: number;
    resolved: number;
    eligible: number;
    excluded: number;
    unresolved: number;
    duplicates_ignored: number;
    exclusion_counts: {
      opt_out: number;
      consent_missing: number;
      missing_whatsapp: number;
      missing_email: number;
      frequency_window: number;
    };
    rate_limit_policy: {
      max_per_week: number;
      min_interval_hours: number;
      legacy_records_are_conservative_guards_only: true;
    };
    consent_policy: {
      purpose: 'marketing';
      explicit_opt_in_required: true;
    };
  };
  readiness: {
    preview_valid: true;
    audience_evaluated: true;
    consent_evaluated: true;
    rate_limit_evaluated: true;
    provider_template_approval_valid: boolean;
    provider_template_ready: boolean;
    transport_readiness_checked: false;
    production_send_allowed: false;
    blockers: string[];
  };
  queue: {
    state: 'held';
    dispatch_authorized: false;
    receipts: CampaignQueueReceipt[];
    transport_outcomes: {
      not_attempted: number;
      unknown: 0;
      accepted: 0;
      sent: 0;
      delivered: 0;
      read: 0;
      failed: 0;
    };
  };
  side_effects: {
    campaigns_created: 0 | 1;
    queue_receipts_created: number;
    notifications_queued: 0;
    provider_calls_performed: false;
    messages_sent: 0;
  };
}

export interface CampaignPreparationFailure {
  reasonCode: string;
  field?: string;
}

export interface CampaignNotificationTemplate {
  id: string;
  key: string;
  channel: CampaignChannel;
  subject_template: string | null;
  body_template: string;
  message_template_registry_id: number | null;
  is_active: boolean;
}
