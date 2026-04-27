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

export type HandoffState = 'none' | 'requested_by_user' | 'required_by_backend' | 'api_unavailable';

export interface ChatPanelContext {
  sector?: 'gobierno' | 'empresas' | null;
  rubro?: string | null;
  tenantSlug?: string | null;
  tipoChat: ChatVertical;
}
