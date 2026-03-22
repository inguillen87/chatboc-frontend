export interface MarketProduct {
  id: string;
  name: string;
  description: string | null;
  descriptionShort: string | null;
  price: number | null;
  priceText: string | null;
  currency: string | null;
  modality: string | null; // 'venta', 'puntos', 'donacion', etc.
  points: number | null;
  imageUrl: string | null;
  category: string | null;
  unit: string | null;
  quantity: number | null; // Available stock
  sku: string | null;
  brand: string | null;
  promoInfo: string | null;
  publicUrl: string | null;
  whatsappShareUrl: string | null;
  disponible?: boolean;
  // Mirror Catalog fields
  checkout_type?: 'mercadolibre' | 'tiendanube' | 'chatboc' | null;
  external_url?: string | null;
}

export interface MarketCartItem extends MarketProduct {
  quantity: number; // Quantity in cart
}

export interface MarketCustomerProfile {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_key?: string | null;
  channel_group?: string | null;
}

export interface MarketCommercialState {
  stage?: string | null;
  channel?: string | null;
  supports_handoff?: boolean | null;
  continuation_available?: boolean | null;
}

export interface MarketContinuity {
  resume_key?: string | null;
  preferred_handoff_channel?: string | null;
  summary?: string | null;
}

export interface MarketSuggestedAction {
  label?: string | null;
  action?: string | null;
  href?: string | null;
  variant?: string | null;
}

export interface MarketRecommendation {
  id?: string | number | null;
  title?: string | null;
  description?: string | null;
  label?: string | null;
  href?: string | null;
}

export interface MarketCheckoutPreview {
  state?: string | null;
  next_step_label?: string | null;
}

export interface MarketSupportChannel {
  label?: string | null;
  url?: string | null;
  phone?: string | null;
  enabled?: boolean | null;
}

export interface MarketTrackingInfo {
  status_label?: string | null;
  portal_path?: string | null;
}

export interface MarketNextStep {
  title?: string | null;
  description?: string | null;
}

export interface MarketCartResponse {
  items: MarketCartItem[];
  totalAmount: number | null;
  totalPoints: number | null;
  cartUrl?: string | null;
  whatsappShareUrl?: string | null;
  isDemo?: boolean;
  customer_profile?: MarketCustomerProfile | null;
  commercial_state?: MarketCommercialState | null;
  continuity?: MarketContinuity | null;
  suggested_actions?: MarketSuggestedAction[] | null;
  recommendations?: MarketRecommendation[] | null;
  checkout_preview?: MarketCheckoutPreview | null;
}

export interface MarketCatalogSection {
  title: string;
  description: string | null;
  badge: string | null;
  items?: MarketProduct[];
}

export interface MarketCatalogResponse {
  tenantName?: string;
  tenantLogoUrl?: string;
  products: MarketProduct[];
  sections?: MarketCatalogSection[];
  publicCartUrl: string | null;
  whatsappShareUrl: string | null;
  heroImageUrl: string | null;
  heroSubtitle: string | null;
  isDemo?: boolean;
  demoReason?: string;
}

export interface AddToCartPayload {
  productId: string;
  quantity?: number;
}

export interface CheckoutStartPayload {
  items: Array<{ id: string; quantity: number }>;
  customer?: Record<string, any>;
}

export interface CheckoutStartResponse {
  checkoutUrl?: string;
  preferenceId?: string;
  orderId?: string | number;
  order_id?: string | number;
  market_order_id?: string | number;
  preference_id?: string | null;
  init_point?: string | null;
  status?: string; // 'pending', 'confirmed', 'demo'
  estado?: string | null;
  tipo?: string | null;
  message?: string;
  customer_profile?: MarketCustomerProfile | null;
  commercial_state?: MarketCommercialState | null;
  tracking?: MarketTrackingInfo | null;
  next_steps?: MarketNextStep[] | null;
  support_channels?: {
    whatsapp?: MarketSupportChannel | null;
    phone?: MarketSupportChannel | null;
    portal?: MarketSupportChannel | null;
    [key: string]: MarketSupportChannel | null | undefined;
  } | null;
}
