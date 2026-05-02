import type { Rubro } from '@/components/chat/RubroSelector';
import type {
  ChatAnimationTokens,
  ChatConversionCtasConfig,
  ChatExperienceBlock,
  ChatExperienceBlueprint,
  ChatLeadCaptureConfig,
  ChatMediaCapabilities,
} from '@/types/chat';
import type { HandoffLabels, QuickReplyItem } from '@/features/chat/chatTypes';

export type DemoSector = 'gobierno' | 'empresas';

export interface DemoCatalogResponse {
  sectors?: DemoSector[];
  rubros?: Rubro[];
}

export interface DemoSessionResponse {
  contract_version?: string;
  request_id?: string;
  session_id?: string;
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
  chat_seed?: {
    chat_bootstrap?: DemoChatBootstrap | null;
    sample_conversations?: ChatExperienceBlock[];
  } | null;
  welcome_message?: string | null;
  quick_replies?: QuickReplyItem[];
  value_cards?: DemoWorkspaceCard[];
  handoff_labels?: HandoffLabels | null;
}

export interface DemoChatBootstrap {
  contract_version?: string | null;
  endpoint?: string | null;
  fallback_endpoint?: string | null;
  method?: string | null;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  payload?: Record<string, unknown>;
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

export interface DemoWorkspaceConfig {
  title?: string | null;
  welcome_message?: string | null;
  quick_replies?: QuickReplyItem[];
  value_cards?: DemoWorkspaceCard[];
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
  chat_bootstrap?: DemoChatBootstrap | null;
  chat_seed?: {
    chat_bootstrap?: DemoChatBootstrap | null;
    sample_conversations?: ChatExperienceBlock[];
  } | null;
}
