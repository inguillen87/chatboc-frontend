import type { ChatWidgetUiHints } from "@/types/chat";

export interface WidgetCommerceTenant {
  slug?: string | null;
  tenant_slug?: string | null;
  nombre?: string | null;
  display_name?: string | null;
  tipo?: string | null;
  vertical?: string | null;
}

export interface WidgetCommerceSessionInfo {
  chat_session_id?: string | null;
  demo_session_id?: string | null;
  anon_id?: string | null;
  widget_session_token?: string | null;
  is_authenticated?: boolean | null;
  can_checkout_as_guest?: boolean | null;
  can_link_account?: boolean | null;
}

export interface WidgetCommerceEndpointBlock {
  enabled?: boolean | null;
  label?: string | null;
  cta_label?: string | null;
  endpoint?: string | null;
  view_url?: string | null;
  url?: string | null;
  summary_endpoint?: string | null;
  items_endpoint?: string | null;
  quality_endpoint?: string | null;
  checkout_preview_endpoint?: string | null;
  checkout_session_endpoint?: string | null;
  history_endpoint?: string | null;
  login_endpoint?: string | null;
  register_endpoint?: string | null;
  link_session_endpoint?: string | null;
  allow_guest_cart?: boolean | null;
  requires_contact_before_checkout?: boolean | null;
  items_count?: number | null;
  [key: string]: string | number | boolean | null | undefined;
}

export interface WidgetCommerceHistory {
  contract_version?: string | null;
  request_id?: string | null;
  cart?: {
    items_count?: number | null;
    total_items?: number | null;
    [key: string]: unknown;
  } | null;
  claims?: {
    items?: unknown[];
    count?: number | null;
    [key: string]: unknown;
  } | null;
  orders?: {
    items?: unknown[];
    count?: number | null;
    [key: string]: unknown;
  } | null;
  messages?: {
    items?: unknown[];
    count?: number | null;
    [key: string]: unknown;
  } | null;
  summary?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface WidgetCommerceCartSnapshot {
  contract_version?: string | null;
  request_id?: string | null;
  items_count?: number | null;
  total_items?: number | null;
  cart?: {
    items_count?: number | null;
    total_items?: number | null;
    [key: string]: unknown;
  } | null;
  items?: unknown[] | null;
  summary?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface WidgetCommerceSession {
  contract_version?: string | null;
  request_id?: string | null;
  tenant?: WidgetCommerceTenant | null;
  session?: WidgetCommerceSessionInfo | null;
  chat?: WidgetCommerceEndpointBlock | null;
  catalog?: WidgetCommerceEndpointBlock | null;
  cart?: WidgetCommerceEndpointBlock | null;
  checkout?: WidgetCommerceEndpointBlock | null;
  portal?: WidgetCommerceEndpointBlock | null;
  history?: WidgetCommerceEndpointBlock | null;
  accessibility?: ChatWidgetUiHints["accessibility"];
  ui_hints?: ChatWidgetUiHints | null;
  frontend_contract?: {
    render_as?: string | null;
    primary_actions?: string[] | null;
    action_labels?: Record<string, string> | null;
    empty_state_behavior?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}
