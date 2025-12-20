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

export interface PortalContent {
  news: any[]; // refine later
  events: any[]; // refine later
  notifications: any[]; // refine later
}

export interface IntegrationStatus {
  provider: 'mercadolibre' | 'tiendanube' | 'whatsapp';
  connected: boolean;
  lastSync?: string;
}
