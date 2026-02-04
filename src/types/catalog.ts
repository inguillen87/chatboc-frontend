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
  view_label?: string | null;
  download_label?: string | null;
  history_label?: string | null;
  template_label?: string | null;
  upload_label?: string | null;
  edit_label?: string | null;
  publish_label?: string | null;
  share_label?: string | null;
  share_whatsapp_label?: string | null;
  share_copy_label?: string | null;
  share_hint?: string | null;
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
  status?: string | null;
  has_pdf?: boolean | null;
  updated_at?: string | null;
  published_at?: string | null;
  view_url?: string | null;
  download_url?: string | null;
  download_url_json?: string | null;
  metadata?: CatalogMetadata | null;
  links?: CatalogLinks | null;
  columns?: CatalogColumn[] | null;
  rows?: CatalogRow[] | null;
  draft?: {
    columns?: CatalogColumn[] | null;
    rows?: CatalogRow[] | null;
  } | null;
}
