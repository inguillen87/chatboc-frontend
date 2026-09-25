import type {PublishedTenantIdentity} from '@/utils/publishedTenantIdentity';
import type { RealtimeVoiceCapabilities } from './realtimeVoice';

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
  /** Explicit public identity validated before a requested slug can override it. */
  publishedIdentity?: PublishedTenantIdentity | null;
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
  catalog?: {
    enabled?: boolean | null;
    is_public?: boolean | null;
    share_on_intent?: boolean | null;
    prefer_pdf_on_whatsapp?: boolean | null;
    default_message?: string | null;
    banner_url?: string | null;
  } | null;
  // New engagement fields
  cta_messages?: CtaMessage[];
  default_open?: boolean;
  theme_config?: TenantThemeConfig;
  realtime_voice?: RealtimeVoiceCapabilities | null;
  support_channels?: {
    voice_call?: {
      enabled?: boolean | null;
      capabilities?: RealtimeVoiceCapabilities | null;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  } | null;
  widget?: {
    support_channels?: {
      voice_call?: {
        enabled?: boolean | null;
        capabilities?: RealtimeVoiceCapabilities | null;
        [key: string]: unknown;
      } | null;
      [key: string]: unknown;
    } | null;
    realtime_voice?: RealtimeVoiceCapabilities | null;
    [key: string]: unknown;
  } | null;
  builder_config?: Record<string, unknown> | null;
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

export interface TenantClaimIntakeReceipt {
  contract_version: 'claims.intake_receipt.v1';
  ok: true;
  persisted: true;
  deduplicated: boolean;
  request_id: string;
  claim: {
    id: number | string;
    code: string;
    status: string;
    category: string | null;
    created_at: string;
  };
  access: {
    mode: 'code_pin';
    pin: string;
  };
  tracking: {
    path: string;
    experience_endpoint: string;
    credential_transport: 'x-tracking-pin-header';
    requires_pin: true;
  };
  actions: Array<{
    id: string;
    label: string;
    href: string;
  }>;
}

export interface TenantPublicNavigationItem {
  id: string;
  label: string;
  route?: string | null;
  href?: string | null;
  endpoint?: string | null;
  enabled?: boolean | null;
  visible?: boolean | null;
  reason_code?: string | null;
  disabled_reason?: string | null;
  [key: string]: unknown;
}

export interface TenantPublicNavigationContract {
  contract_version?: string | null;
  tenant_slug?: string | null;
  items: TenantPublicNavigationItem[];
  request_id?: string | null;
  reason_code?: string | null;
}
