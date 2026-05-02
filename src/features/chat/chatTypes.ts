import type {
  ChatAnimationTokens,
  ChatConversionCtasConfig,
  ChatExperienceBlock,
  ChatExperienceBlueprint,
  ChatLeadCaptureConfig,
  ChatMediaCapabilities,
} from '@/types/chat';

export type ChatVertical = 'municipio' | 'pyme';

export type ChatRatingValue = 'satisfecho' | 'neutral' | 'insatisfecho';

export interface ChatUiMessage {
  id: string;
  text: string;
  role: 'user' | 'assistant' | 'system';
  timestamp?: string;
}

export interface QuickReplyItem {
  id: string;
  label: string;
  payload?: string;
}

export interface ChatBootstrapConfig {
  contract_version?: string | null;
  endpoint?: string | null;
  fallback_endpoint?: string | null;
  method?: string | null;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  supports?: Record<string, boolean>;
}

export type HandoffState = 'none' | 'requested_by_user' | 'required_by_backend' | 'api_unavailable';

export interface ChatPanelContext {
  sector?: 'gobierno' | 'empresas' | 'educacion' | (string & {}) | null;
  rubro?: string | null;
  tenantSlug?: string | null;
  tipoChat: ChatVertical;
  quickReplies?: QuickReplyItem[];
  welcomeMessage?: string | null;
  emptyTitle?: string | null;
  emptySubtitle?: string | null;
  composerPlaceholder?: string | null;
  sendLabel?: string | null;
  firstVisit?: ChatExperienceBlock | null;
  sampleConversations?: ChatExperienceBlock[];
  trustSignals?: ChatExperienceBlock[];
  experienceBlueprint?: ChatExperienceBlueprint | null;
  leadCapture?: ChatLeadCaptureConfig | null;
  mediaCapabilities?: ChatMediaCapabilities | null;
  conversionCtas?: ChatConversionCtasConfig | null;
  animationTokens?: ChatAnimationTokens | null;
  emptyStates?: Record<string, ChatExperienceBlock>;
  chatBootstrap?: ChatBootstrapConfig | null;
}

export interface HandoffLabels {
  message?: string | null;
  createTicket?: string | null;
  openWhatsApp?: string | null;
  waitOperator?: string | null;
}
