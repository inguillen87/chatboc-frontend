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

export interface MarketCartResponse {
  items: MarketCartItem[];
  totalAmount: number | null;
  totalPoints: number | null;
  cartUrl?: string | null;
  whatsappShareUrl?: string | null;
  isDemo?: boolean;
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
  status?: string; // 'pending', 'confirmed', 'demo'
  message?: string;
}

export interface SearchCatalogPayload {
  query?: string;
  en_promocion?: boolean;
  con_stock?: boolean;
  precio_max?: number;
}
