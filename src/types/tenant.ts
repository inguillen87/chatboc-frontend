export interface TenantThemeConfig {
  mode: 'light' | 'dark' | 'system';
  light: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    [key: string]: string;
  };
  dark: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    [key: string]: string;
  };
}

export interface CtaMessage {
  text: string;
  action?: 'trigger_intent' | 'open_catalog' | 'navigate' | string;
  payload?: string;
}

export interface TenantPublicInfo {
  slug: string;
  nombre: string;
  logo_url?: string | null;
  tema?: TenantThemeConfig | Record<string, unknown> | null;
  tipo?: string | null;
  descripcion?: string | null;
  public_base_url?: string | null;
  public_cart_url?: string | null;
  public_catalog_url?: string | null;
  whatsapp_share_url?: string | null;
  // New engagement fields
  cta_messages?: CtaMessage[];
  default_open?: boolean;
  theme_config?: TenantThemeConfig;
}

export interface TenantSummary {
  slug: string;
  nombre?: string | null;
  logo_url?: string | null;
  tenant_id?: number | string | null;
  tipo?: string | null;
}

export interface TenantNewsItem {
  id: number | string;
  titulo: string;
  resumen?: string | null;
  body?: string | null;
  cover_url?: string | null;
  publicado_at?: string | null;
  tags?: string[] | null;
}

export interface TenantEventItem {
  id: number | string;
  titulo: string;
  descripcion?: string | null;
  cover_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  lugar?: string | null;
  tags?: string[] | null;
}

export interface TenantTicketPayload {
  categoria?: string | null;
  descripcion: string;
  lat?: number | null;
  lng?: number | null;
  metadata?: Record<string, unknown> | null;
}
