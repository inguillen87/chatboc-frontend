import type { Rubro } from '@/components/chat/RubroSelector';
import type { HandoffLabels, QuickReplyItem } from '@/features/chat/chatTypes';

export type DemoSector = 'gobierno' | 'empresas';

export interface DemoCatalogResponse {
  sectors?: DemoSector[];
  rubros?: Rubro[];
}

export interface DemoSessionResponse {
  session_id?: string;
  demo_session_id?: string;
  tenant_slug?: string | null;
  workspace?: DemoWorkspaceConfig | null;
  welcome_message?: string | null;
  quick_replies?: QuickReplyItem[];
  value_cards?: DemoWorkspaceCard[];
  handoff_labels?: HandoffLabels | null;
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
}
