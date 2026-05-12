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
