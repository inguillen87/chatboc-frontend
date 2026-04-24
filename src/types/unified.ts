export interface CustomerProfile {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_key?: string | null;
  channel_group?: string | null;
  whatsapp?: string | null;
}

export interface CommercialState {
  stage?: string | null;
  channel?: string | null;
  supports_handoff?: boolean | null;
  continuation_available?: boolean | null;
}

export interface Order {
  id: string | number;
  tenant_id?: string;
  user_id?: string;
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'confirmed' | 'nuevo';
  items: OrderItem[];
  created_at: string;
  updated_at?: string;
  channel?: string;
  notes?: string;
  // Customer Info
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  contact_name?: string; // Payload alias
  // Dispatch Info
  dispatch_email?: string;
  dispatch_phone?: string;
  // External Refs
  externalId?: string;
  externalUrl?: string;
  external_refs?: Record<string, string | number | null | undefined> | null;
  source_model?: string | null;
  market_order_id?: string | number | null;
  order_id?: string | number | null;
  preference_id?: string | null;
  init_point?: string | null;
  tipo?: string | null;
  customer_profile?: CustomerProfile | null;
  commercial_state?: CommercialState | null;
  commercial_stage?: string | null;
  contact?: CustomerProfile | null;
  totals?: {
    subtotal?: number | null;
    total?: number | null;
    currency?: string | null;
  } | null;
}

export interface OrderItem {
  id: string | number;
  product_id: string | number;
  quantity: number;
  price: number;
  name: string;
  sku?: string;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
  totalPoints?: number;
}

export interface CartItem {
  id: string | number;
  product_id: string | number;
  quantity: number;
  price: number;
  name?: string;
}

export interface Ticket {
  id: string | number;
  subject: string;
  status: 'open' | 'closed' | 'pending';
  created_at: string;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string | number;
  content: string;
  sender: 'user' | 'agent';
  timestamp: string;
}

// Enhanced Portal Content Types
export interface PortalNotification {
  id: string;
  title: string;
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  actionLabel?: string;
  actionHref?: string;
  date?: string;
  read?: boolean;
}

export interface PortalEvent {
  id: string;
  title: string;
  date?: string;
  location?: string;
  status?: string;
  description?: string;
  spots?: number;
  registered?: number;
  coverUrl?: string;
  link?: string;
}

export interface PortalNews {
  id: string;
  title: string;
  category?: string;
  date?: string;
  summary?: string;
  featured?: boolean;
  coverUrl?: string;
  link?: string;
}

export interface PortalCatalogItem {
  id: string;
  title: string;
  description?: string;
  category?: string;
  priceLabel?: string;
  price?: number;
  status?: string;
  imageUrl?: string;
  link?: string;
}

export interface PortalActivity {
  id: string;
  description: string;
  type?: string; // 'pedido', 'reclamo', etc.
  status?: string;
  statusType?: 'info' | 'success' | 'warning' | 'error';
  date?: string;
  link?: string;
}

export interface PortalSurvey {
  id: string;
  title: string;
  link?: string;
}

export interface LoyaltyTransaction {
  id: string;
  description: string;
  points: number;
  date: string;
  type: 'earned' | 'redeemed';
}

export interface LoyaltyReward {
  id: string;
  title: string;
  cost: number;
  type: string;
  description?: string;
}

export interface PortalLoyaltySummary {
  points: number;
  level: string;
  surveysCompleted: number;
  suggestionsShared: number;
  claimsFiled: number;
  transactions?: LoyaltyTransaction[];
  availableRewards?: LoyaltyReward[];
}

export interface PortalQuickAction {
  id: string;
  label: string;
  description?: string;
  href?: string;
}

export interface PortalModuleCard {
  id: string;
  title: string;
  description?: string;
  href?: string;
  badge?: string;
}

export interface PortalBundleSummarySection {
  items?: any[];
  open_count?: number;
  active_count?: number;
  total_spent?: number;
  available?: number;
  history?: any[];
  wallet?: Record<string, unknown> | null;
  benefits?: any[];
  redeems?: any[];
  [key: string]: unknown;
}

export interface PortalPremiumBundle {
  member?: Record<string, unknown> | null;
  club?: Record<string, unknown> | null;
  orders?: PortalBundleSummarySection | null;
  claims?: PortalBundleSummarySection | null;
  promotions?: PortalBundleSummarySection | null;
  surveys?: PortalBundleSummarySection | null;
  rewards?: PortalBundleSummarySection | null;
  suggestions?: PortalBundleSummarySection | null;
  history?: { timeline?: any[]; [key: string]: unknown } | null;
  highlights?: Array<Record<string, unknown>> | null;
  quick_actions?: Array<Record<string, unknown>> | null;
  modules?: Array<Record<string, unknown>> | null;
}

export interface PortalContent {
  notifications: PortalNotification[];
  events: PortalEvent[];
  news: PortalNews[];
  catalog: PortalCatalogItem[];
  activities: PortalActivity[];
  surveys: PortalSurvey[];
  loyaltySummary: PortalLoyaltySummary | null;
}

export interface IntegrationStatus {
  provider: 'mercadolibre' | 'tiendanube' | 'whatsapp';
  connected: boolean;
  lastSync?: string;
}
