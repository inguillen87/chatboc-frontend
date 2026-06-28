export interface CatalogColumn {
  key: string;
  label: string;
  type?: string;
  color?: string;
}

export interface CatalogRow {
  id: string | number;
  cells: Record<string, unknown>;
}

export interface CatalogLinks {
  view_url?: string | null;
  download_url?: string | null;
  download_url_pdf?: string | null;
  download_url_json?: string | null;
  download_url_xlsx?: string | null;
  download_url_csv?: string | null;
  history_url?: string | null;
  template_url?: string | null;
  draft_endpoint?: string | null;
  draft_url?: string | null;
  save_draft_endpoint?: string | null;
  view_label?: string | null;
  download_label?: string | null;
  history_label?: string | null;
  template_label?: string | null;
  status_label?: string | null;
  updated_label?: string | null;
  public_link_label?: string | null;
  title_label?: string | null;
  description_label?: string | null;
  banner_label?: string | null;
  default_message_label?: string | null;
  enabled_label?: string | null;
  is_public_label?: string | null;
  share_on_intent_label?: string | null;
  prefer_pdf_on_whatsapp_label?: string | null;
  upload_label?: string | null;
  edit_label?: string | null;
  publish_label?: string | null;
  preview_label?: string | null;
  editor_title?: string | null;
  editor_description?: string | null;
  editor_close_label?: string | null;
  editor_save_label?: string | null;
  add_row_label?: string | null;
  add_column_label?: string | null;
  empty_rows_label?: string | null;
  empty_columns_label?: string | null;
  upload_section_title?: string | null;
  upload_section_description?: string | null;
  upload_section_button_label?: string | null;
  share_label?: string | null;
  share_whatsapp_label?: string | null;
  share_copy_label?: string | null;
  share_hint?: string | null;
  search_placeholder?: string | null;
  cta_label?: string | null;
  promotions_endpoint?: string | null;
}

export interface CatalogPromotionScope {
  id?: string | number | null;
  tipo_alcance?: 'PRODUCTO' | 'CATEGORIA' | 'MARCA' | string | null;
  catalogo_item_id?: string | number | null;
  nombre_categoria?: string | null;
  nombre_marca?: string | null;
}

export interface CatalogPromotion {
  id: string;
  nombre_promocion?: string | null;
  descripcion_publica?: string | null;
  tipo_promocion?: string | null;
  valor_descuento?: number | null;
  monto_minimo_carrito?: number | null;
  cantidad_minima_aplicable?: number | null;
  is_active?: boolean | null;
  codigo_promocion?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  active_now?: boolean | null;
  display_badge?: string | null;
  eligible_product_ids?: Array<string | number> | null;
  countdown?: {
    enabled?: boolean | null;
    seconds_remaining?: number | null;
    ends_at?: string | null;
  } | null;
  terms_short?: string | null;
  priority?: number | null;
  alcances?: CatalogPromotionScope[] | null;
}

export interface CatalogPromotionsOps {
  contract_version?: 'tenant.catalog_promotions_ops.v1' | string | null;
  enabled?: boolean | null;
  reason_code?: string | null;
  total?: number | null;
  active?: number | null;
  inactive?: number | null;
  catalog_items_with_promo_badge?: number | null;
  endpoint?: string | null;
  create_endpoint?: string | null;
  activation_endpoint_template?: string | null;
  deactivation_endpoint_template?: string | null;
  supported_discount_types?: string[] | null;
  recommended_quick_actions?: Array<Record<string, unknown>> | null;
  items?: CatalogPromotion[] | null;
  frontend_contract?: Record<string, unknown> | null;
}

export interface MarketplaceReadinessItem {
  id?: string | null;
  label?: string | null;
  severity?: 'blocker' | 'warning' | 'info' | string | null;
  next_action?: string | null;
}

export interface MarketplaceReadiness {
  contract_version?: 'tenant.marketplace_readiness.v1' | string | null;
  ready?: boolean | null;
  score?: number | null;
  state?: 'ready' | 'blocked' | 'needs_attention' | string | null;
  blockers?: MarketplaceReadinessItem[] | null;
  warnings?: MarketplaceReadinessItem[] | null;
  recommended_actions?: MarketplaceReadinessItem[] | null;
  metrics?: {
    products_total?: number | null;
    products_available?: number | null;
    products_with_images?: number | null;
    products_with_prices?: number | null;
    products_with_promotions?: number | null;
    low_stock?: number | null;
    checkout_configured?: boolean | null;
    pdf_catalog_published?: boolean | null;
    [key: string]: unknown;
  } | null;
  frontend_contract?: Record<string, unknown> | null;
}

export interface CatalogMetadata {
  title?: string | null;
  description?: string | null;
  banner_url?: string | null;
  enabled?: boolean | null;
  is_public?: boolean | null;
  share_on_intent?: boolean | null;
  prefer_pdf_on_whatsapp?: boolean | null;
  default_message?: string | null;
}

export interface TenantCatalog {
  contract_version?: string | null;
  request_id?: string | null;
  reason_code?: string | null;
  action_hint?: string | null;
  message?: string | null;
  status?: string | null;
  has_pdf?: boolean | null;
  updated_at?: string | null;
  published_at?: string | null;
  view_url?: string | null;
  download_url?: string | null;
  download_url_json?: string | null;
  cart?: {
    enabled?: boolean | null;
    items_count?: number | null;
    [key: string]: unknown;
  } | null;
  promotions?: CatalogPromotionsOps | null;
  marketplace_readiness?: MarketplaceReadiness | null;
  items?: unknown[] | null;
  metadata?: CatalogMetadata | null;
  links?: CatalogLinks | null;
  columns?: CatalogColumn[] | null;
  rows?: CatalogRow[] | null;
  draft?: {
    columns?: CatalogColumn[] | null;
    rows?: CatalogRow[] | null;
  } | null;
}
