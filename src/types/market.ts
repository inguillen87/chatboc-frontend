export interface MarketProduct {
  id: string;
  catalogo_item_id?: string | number | null;
  catalog_item_id?: string | number | null;
  product_id?: string | number | null;
  item_id?: string | number | null;
  tenant_slug?: string | null;
  tenant?: string | null;
  owner_slug?: string | null;
  tenant_id?: string | number | null;
  name: string;
  description: string | null;
  descriptionShort: string | null;
  price: number | null;
  priceText: string | null;
  currency: string | null;
  modality: string | null; // 'venta', 'puntos', 'donacion', etc.
  points: number | null;
  imageUrl: string | null;
  galleryUrls?: string[] | null;
  imageStatus?: "ready" | "missing" | string | null;
  imageAlt?: string | null;
  category: string | null;
  unit: string | null;
  quantity: number | null; // Available stock
  stock_quantity?: number | null;
  stock_status?: string | null;
  available_to_sell?: boolean | null;
  amount_validated?: boolean | null;
  inventory?: Record<string, unknown> | null;
  sku: string | null;
  brand: string | null;
  promoInfo: string | null;
  publicUrl: string | null;
  whatsappShareUrl: string | null;
  disponible?: boolean;
  // Mirror Catalog fields
  checkout_type?: 'mercadolibre' | 'tiendanube' | 'chatboc' | null;
  external_url?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  tags?: string[] | null;
}

export interface MarketCartItem extends MarketProduct {
  quantity: number; // Quantity in cart
}

export interface MarketCustomerProfile {
  name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
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
  conversation_id?: string | null;
  portal_links?: {
    home?: string | null;
    orders?: string | null;
    profile?: string | null;
  } | null;
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

export interface MarketIntegrationAccess {
  enabled?: boolean | null;
  reason_code?: string | null;
  required_plan?: string | null;
  current_plan?: string | null;
  upgrade_url?: string | null;
  [key: string]: unknown;
}

export interface MarketCheckoutExperiencePolicy {
  payment_capture?: string | null;
  card_data_in_chat?: boolean | null;
  client_return_trusted?: boolean | null;
  confirmation_source?: string | null;
  webhook_required_for_paid_state?: boolean | null;
  whatsapp_window_policy?: string | null;
  [key: string]: unknown;
}

export interface MarketCheckoutExperienceStep {
  id?: string | null;
  label?: string | null;
  description?: string | null;
  [key: string]: unknown;
}

export interface MarketCheckoutExperience {
  contract_version?: string | null;
  active_entrypoint?: string | null;
  supported_entrypoints?: string[] | null;
  mode?: string | null;
  ready?: boolean | null;
  reason_code?: string | null;
  integration_access?: MarketIntegrationAccess | null;
  copy?: {
    title?: string | null;
    short?: string | null;
    customer_ready?: string | null;
    customer_pending_gateway?: string | null;
    customer_locked?: string | null;
    [key: string]: unknown;
  } | null;
  policy?: MarketCheckoutExperiencePolicy | null;
  steps?: MarketCheckoutExperienceStep[] | null;
  endpoints?: Record<string, string | null> | null;
  gateway?: {
    name?: string | null;
    configured?: boolean | null;
    provider_label?: string | null;
    [key: string]: unknown;
  } | null;
}

export interface MarketCheckoutPreview {
  state?: string | null;
  next_step_label?: string | null;
  total_monetary?: number | null;
  total_points?: number | null;
  amount_validated?: boolean | null;
  stock_status?: string | null;
  available_to_sell?: boolean | null;
  payment_required?: boolean | null;
  payment_ready?: boolean | null;
  contact_ready?: boolean | null;
  checkout_options?: MarketCheckoutOptions | null;
  checkout_experience?: MarketCheckoutExperience | null;
  next_steps?: MarketNextStep[] | null;
}

export interface MarketCheckoutOptions {
  contract_version?: string | null;
  ready?: boolean | null;
  reason_code?: string | null;
  payment_required?: boolean | null;
  requires_contact_or_auth?: boolean | null;
  gateway?: string | null;
  gateway_hint?: string | null;
  gateway_configured?: boolean | null;
  checkout_urls?: Record<string, string | null> | null;
  missing?: string[] | null;
  capabilities?: Record<string, unknown> | unknown[] | null;
  integration_access?: MarketIntegrationAccess | null;
  policy?: MarketCheckoutExperiencePolicy | null;
  checkout_experience?: MarketCheckoutExperience | null;
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

export interface MarketPaymentCheckoutStatus {
  contract_version?: string | null;
  request_id?: string | null;
  payment_ready?: boolean | null;
  mercadopago_ready?: boolean | null;
  gateway?: string | null;
  gateway_hint?: string | null;
  missing?: string[] | null;
  capabilities?: Record<string, unknown> | unknown[] | null;
  checkout_urls?: Record<string, string | null> | null;
  checkout_options?: MarketCheckoutOptions | null;
  checkout_experience?: MarketCheckoutExperience | null;
  raw?: unknown;
}

export interface MarketPaymentStatusResponse {
  contract_version?: string | null;
  request_id?: string | null;
  payment?: {
    status?: string | null;
    paid?: boolean | null;
    [key: string]: unknown;
  } | null;
  mp_payment_id?: string | number | null;
  preference_id?: string | null;
  order?: Record<string, unknown> | null;
  timeline?: unknown[] | null;
  raw?: unknown;
}

export interface MarketRewardRedemption {
  id?: string | number | null;
  reward_id?: string | number | null;
  label?: string | null;
  title?: string | null;
  description?: string | null;
  points?: number | null;
  cost_points?: number | null;
  disabled?: boolean | null;
  raw?: unknown;
}

export interface MarketRewardsProfile {
  contract_version?: string | null;
  request_id?: string | null;
  wallet?: {
    balance?: number | null;
    pending_cart_points?: number | null;
    [key: string]: unknown;
  } | null;
  rules?: unknown[] | Record<string, unknown> | null;
  available_redemptions?: MarketRewardRedemption[] | null;
  history?: unknown[] | null;
  summary?: Record<string, unknown> | null;
  raw?: unknown;
}

export interface MarketRewardRedeemResponse {
  contract_version?: string | null;
  request_id?: string | null;
  redemption_id?: string | number | null;
  reward_id?: string | number | null;
  balance?: number | null;
  duplicate?: boolean | null;
  raw?: unknown;
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
  checkout_options?: MarketCheckoutOptions | null;
  checkout_experience?: MarketCheckoutExperience | null;
  mercadopago_ready?: boolean | null;
  amount_validated?: boolean | null;
  stock_status?: string | null;
  available_to_sell?: boolean | null;
  inventory_policy?: Record<string, unknown> | null;
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
  productId?: string;
  product_id?: string | number;
  catalogo_item_id?: string | number;
  catalog_item_id?: string | number;
  quantity?: number;
  cantidad?: number;
}

export interface CheckoutStartPayload {
  items?: Array<{ id: string; quantity: number }>;
  customer?: Record<string, any>;
  name?: string;
  phone?: string;
  [key: string]: any;
}

export interface CheckoutStartResponse {
  contract_version?: string | null;
  request_id?: string | null;
  checkoutUrl?: string;
  preferenceId?: string;
  orderId?: string | number;
  order_id?: string | number;
  market_order_id?: string | number;
  preference_id?: string | null;
  init_point?: string | null;
  external_reference?: string | null;
  status?: string; // 'pending', 'confirmed', 'demo'
  estado?: string | null;
  tipo?: string | null;
  message?: string;
  amount_validated?: boolean | null;
  stock_status?: string | null;
  available_to_sell?: boolean | null;
  inventory_policy?: Record<string, unknown> | null;
  order?: Record<string, unknown> | null;
  checkout_options?: MarketCheckoutOptions | null;
  checkout_experience?: MarketCheckoutExperience | null;
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
