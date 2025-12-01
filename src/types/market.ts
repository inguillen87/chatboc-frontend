export interface MarketProduct {
  id: string;
  name: string;
  description?: string | null;
  price?: number | null;
  points?: number | null;
  imageUrl?: string | null;
}

export interface MarketCatalogResponse {
  tenantName?: string;
  tenantLogoUrl?: string;
  products: MarketProduct[];
  isDemo?: boolean;
  demoReason?: string;
}

export interface MarketCartItem {
  id: string;
  name: string;
  quantity: number;
  price?: number | null;
  points?: number | null;
  imageUrl?: string | null;
}

export interface MarketCartResponse {
  items: MarketCartItem[];
  totalAmount?: number | null;
  totalPoints?: number | null;
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
