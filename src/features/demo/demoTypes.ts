import type { Rubro } from '@/types/rubro';
import type {
  ChatAnimationTokens,
  ChatConversionCtasConfig,
  ChatExperienceBlock,
  ChatExperienceBlueprint,
  ChatLeadCaptureConfig,
  ChatMediaCapabilities,
} from '@/types/chat';
import type { HandoffLabels, QuickReplyItem } from '@/features/chat/chatTypes';
import type { RealtimeVoiceCapabilities } from '@/types/realtimeVoice';

export type DemoSector = 'gobierno' | 'empresas' | 'educacion' | (string & {});

export interface DemoSectorGroup {
  key: DemoSector;
  label?: string | null;
  description?: string | null;
  cta_label?: string | null;
  tenant_slug?: string | null;
  demo_tenant_slug?: string | null;
  default_tenant_slug?: string | null;
  default_rubro?: string | null;
  default_rubro_slug?: string | null;
  [key: string]: unknown;
}

export interface DemoCatalogPillar {
  key?: DemoSector | string | null;
  sector?: DemoSector | string | null;
  slug?: string | null;
  label?: string | null;
  description?: string | null;
  cta_label?: string | null;
  default_rubro?: string | null;
  default_rubro_slug?: string | null;
  tenant_slug?: string | null;
  demo_tenant_slug?: string | null;
  default_tenant_slug?: string | null;
  [key: string]: unknown;
}

export interface DemoCatalogResponse {
  contract_version?: string;
  pillar_contract_version?: string;
  sectors?: DemoSector[];
  pillars?: DemoCatalogPillar[];
  sector_groups?: DemoSectorGroup[];
  rubros?: Rubro[];
  catalog_error?: string | null;
}

export interface DemoAdminPreviewModule {
  id?: string | null;
  label?: string | null;
  title?: string | null;
  route?: string | null;
  endpoint?: string | null;
  widgets?: unknown[];
  [key: string]: unknown;
}

export interface DemoAdminPreviewCard {
  id?: string | null;
  key?: string | null;
  label?: string | null;
  title?: string | null;
  value?: string | number | null;
  description?: string | null;
  detail?: string | null;
  status?: string | null;
  icon?: string | null;
  [key: string]: unknown;
}

export interface DemoAdminPreviewTimelineItem {
  id?: string | null;
  label?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface DemoAdminPreviewMapPoint {
  id?: string | number | null;
  label?: string | null;
  title?: string | null;
  description?: string | null;
  address?: string | null;
  direccion?: string | null;
  category?: string | null;
  categoria?: string | null;
  status?: string | null;
  lat?: string | number | null;
  lng?: string | number | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  latitud?: string | number | null;
  longitud?: string | number | null;
  [key: string]: unknown;
}

export interface DemoAdminPreviewMap {
  enabled?: boolean | null;
  title?: string | null;
  label?: string | null;
  description?: string | null;
  points?: DemoAdminPreviewMapPoint[] | null;
  render_contract?: {
    can_render_map?: boolean | null;
    can_render_heatmap?: boolean | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface DemoAdminPreviewResponse {
  contract_version?: string | null;
  request_id?: string | null;
  sector?: DemoSector | string | null;
  tenant_slug?: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  outcome?: string | null;
  status_label?: string | null;
  modules?: DemoAdminPreviewModule[];
  cards?: DemoAdminPreviewCard[];
  timeline?: DemoAdminPreviewTimelineItem[];
  map?: DemoAdminPreviewMap | null;
  catalog?: Record<string, unknown> | null;
  labels?: Record<string, string | null | undefined> | null;
  [key: string]: unknown;
}

export interface DemoSessionResponse {
  contract_version?: string;
  request_id?: string;
  session_id?: string;
  chat_session_id?: string | null;
  demo_session_id?: string;
  tenant_slug?: string | null;
  tenant?: {
    id?: number | string | null;
    slug?: string | null;
    nombre?: string | null;
    tipo?: string | null;
  } | null;
  chat_bootstrap?: DemoChatBootstrap | null;
  workspace?: DemoWorkspaceConfig | null;
  experience_blueprint?: ChatExperienceBlueprint | null;
  lead_capture?: ChatLeadCaptureConfig | null;
  media_capabilities?: ChatMediaCapabilities | null;
  conversion_ctas?: ChatConversionCtasConfig | null;
  animation_tokens?: ChatAnimationTokens | null;
  empty_states?: Record<string, ChatExperienceBlock>;
  realtime_voice?: RealtimeVoiceCapabilities | null;
  support_channels?: {
    voice_call?: {
      enabled?: boolean | null;
      capabilities?: RealtimeVoiceCapabilities | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  chat_seed?: {
    chat_bootstrap?: DemoChatBootstrap | null;
    sample_conversations?: ChatExperienceBlock[];
  } | null;
  welcome_message?: string | null;
  quick_replies?: QuickReplyItem[];
  value_cards?: DemoWorkspaceCard[];
  catalog_resources?: DemoCatalogResource[];
  analytics_summary?: Record<string, unknown> | null;
  handoff_labels?: HandoffLabels | null;
}

export interface DemoChatBootstrap {
  contract_version?: string | null;
  endpoint?: string | null;
  same_origin_endpoint?: string | null;
  fallback_endpoint?: string | null;
  method?: string | null;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  session?: {
    chat_session_id?: string | null;
    demo_session_id?: string | null;
    [key: string]: unknown;
  } | null;
  empty_states?: Record<string, ChatExperienceBlock>;
  supports?: Record<string, boolean>;
}

export interface DemoWorkspaceCard {
  key?: string;
  title: string;
  desc?: string | null;
  description?: string | null;
  status?: string | null;
  cta_label?: string | null;
}

export interface DemoCatalogResource {
  id?: string | null;
  key?: string | null;
  label?: string | null;
  title?: string | null;
  url?: string | null;
  href?: string | null;
  action?: string | null;
  intent?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface DemoWorkspaceConfig {
  title?: string | null;
  welcome_message?: string | null;
  quick_replies?: QuickReplyItem[];
  value_cards?: DemoWorkspaceCard[];
  catalog_resources?: DemoCatalogResource[];
  analytics_summary?: Record<string, unknown> | null;
  handoff_labels?: HandoffLabels | null;
  first_visit?: ChatExperienceBlock | null;
  sample_conversations?: ChatExperienceBlock[];
  trust_signals?: ChatExperienceBlock[];
  experience_blueprint?: ChatExperienceBlueprint | null;
  lead_capture?: ChatLeadCaptureConfig | null;
  media_capabilities?: ChatMediaCapabilities | null;
  conversion_ctas?: ChatConversionCtasConfig | null;
  animation_tokens?: ChatAnimationTokens | null;
  empty_states?: Record<string, ChatExperienceBlock>;
  realtime_voice?: RealtimeVoiceCapabilities | null;
  support_channels?: {
    voice_call?: {
      enabled?: boolean | null;
      capabilities?: RealtimeVoiceCapabilities | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  education?: {
    profile?: Record<string, unknown> | null;
    quick_menu?: unknown[] | null;
    whatsapp_playbook?: Record<string, unknown> | null;
    admin_menu?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
  chat_bootstrap?: DemoChatBootstrap | null;
  chat_seed?: {
    chat_bootstrap?: DemoChatBootstrap | null;
    sample_conversations?: ChatExperienceBlock[];
  } | null;
}

export interface DemoWhatsappSandboxOption {
  id?: string | null;
  key?: string | null;
  value?: string | null;
  slug?: string | null;
  label?: string | null;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  detail?: string | null;
  subtitle?: string | null;
  sector?: DemoSector | string | null;
  rubro?: string | null;
  rubro_slug?: string | null;
  tenant_slug?: string | null;
  disabled?: boolean | null;
  [key: string]: unknown;
}

export interface DemoWhatsappSandboxScript {
  id?: string | null;
  key?: string | null;
  label?: string | null;
  title?: string | null;
  message?: string | null;
  text?: string | null;
  prompt?: string | null;
  description?: string | null;
  steps?: unknown[] | null;
  [key: string]: unknown;
}

export interface DemoWhatsappSandboxResource {
  id?: string | null;
  key?: string | null;
  label?: string | null;
  title?: string | null;
  url?: string | null;
  href?: string | null;
  type?: string | null;
  kind?: string | null;
  [key: string]: unknown;
}

export interface DemoWhatsappSandboxResponse {
  contract_version?: string | null;
  request_id?: string | null;
  requires_auth?: boolean | null;
  session?: {
    demo_session_id?: string | null;
    chat_session_id?: string | null;
    session_id?: string | null;
    max_messages?: number | string | null;
    [key: string]: unknown;
  } | null;
  whatsapp_sandbox?: {
    contract_version?: string | null;
    rubro_options?: DemoWhatsappSandboxOption[];
    sandbox?: {
      display_number?: string | null;
      join_phrase?: string | null;
      activation_message?: string | null;
      requires_join_phrase?: boolean | null;
      wa_deeplink?: string | null;
      qr_url?: string | null;
      [key: string]: unknown;
    } | null;
    trial_policy?: {
      max_messages?: number | string | null;
      free_inputs?: string[] | null;
      [key: string]: unknown;
    } | null;
    scenario_scripts?: DemoWhatsappSandboxScript[];
    catalog?: {
      resources?: DemoWhatsappSandboxResource[];
      pdf_excel_upload_demo?: {
        enabled?: boolean | null;
        label?: string | null;
        title?: string | null;
        description?: string | null;
        [key: string]: unknown;
      } | null;
      [key: string]: unknown;
    } | null;
    surveys_votings?: {
      enabled?: boolean | null;
      label?: string | null;
      title?: string | null;
      description?: string | null;
      endpoint?: string | null;
      url?: string | null;
      href?: string | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}
