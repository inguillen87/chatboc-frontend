export interface Order {
  id: string | number;
  tenant_id?: string;
  user_id?: string;
  total: number;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  created_at: string;
}

export interface OrderItem {
  id: string | number;
  product_id: string | number;
  quantity: number;
  price: number;
  name: string;
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

export interface PortalLoyaltySummary {
  points: number;
  level: string;
  surveysCompleted: number;
  suggestionsShared: number;
  claimsFiled: number;
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
