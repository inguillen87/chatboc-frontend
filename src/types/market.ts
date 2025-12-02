export interface MarketProduct {
  id: string;
  name: string;
  description?: string | null;
  descriptionShort?: string | null;
  price?: number | null;
  priceText?: string | null;
  currency?: string | null;
  modality?: string | null;
  points?: number | null;
  imageUrl?: string | null;
  category?: string | null;
  unit?: string | null;
  quantity?: number | null;
  sku?: string | null;
  brand?: string | null;
  promoInfo?: string | null;
  publicUrl?: string | null;
  whatsappShareUrl?: string | null;
}

export interface MarketCatalogSection {
  title: string;
  description?: string | null;
  badge?: string | null;
  items?: MarketProduct[] | null;
}

export interface MarketCatalogResponse {
  tenantName?: string;
  tenantLogoUrl?: string;
  products: MarketProduct[];
  publicCartUrl?: string | null;
  whatsappShareUrl?: string | null;
  isDemo?: boolean;
  demoReason?: string;
  heroImageUrl?: string | null;
  heroSubtitle?: string | null;
  sections?: MarketCatalogSection[];
}

export interface MarketCartItem {
  id: string;
  name: string;
  quantity: number;
  price?: number | null;
  points?: number | null;
  imageUrl?: string | null;
  priceText?: string | null;
  currency?: string | null;
}

export interface MarketCartResponse {
  items: MarketCartItem[];
  totalAmount?: number | null;
  totalPoints?: number | null;
  cartUrl?: string | null;
  whatsappShareUrl?: string | null;
  isDemo?: boolean;
}

export interface AddToCartPayload {
  productId: string;
  quantity?: number;
}

export interface CheckoutStartPayload {
  name?: string;
  phone: string;
}

export interface CheckoutStartResponse {
  status?: string;
  message?: string;
}
