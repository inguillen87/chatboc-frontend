export type ImportStatus =
  | 'uploaded'
  | 'processing'
  | 'preview_ready'
  | 'needs_review'
  | 'failed'
  | 'importing'
  | 'completed';

export type FileType = 'pdf' | 'xlsx' | 'csv' | 'image' | 'unknown';

export interface ImportColumn {
  key: string;      // The key in the 'cells' object (e.g., "col_0" or "precio")
  label: string;    // The header detected in the file (e.g., "PRECIO CAJA")
  type: 'string' | 'number' | 'money' | 'boolean' | 'date';
  confidence?: number;
  sampleValues?: string[]; // Optional: for showing examples in mapping
}

export interface ImportRow {
  row_id: string;
  cells: Record<string, any>; // key matches ImportColumn.key
  row_confidence?: number;
  warnings?: string[];
}

export interface ImportError {
  code: string;
  message: string;
  action?: string; // Suggested action (e.g., "retry_ocr")
  field?: string;
}

export interface ImportSummary {
  detected_rows: number;
  detected_columns: number;
  confidence_global: number;
  warnings: string[];
  total_estimated_rows?: number;
  image_summary?: {
    with_images?: number;
    missing_images?: number;
  };
}

export interface CatalogPreviewV1 {
  job_id: string;
  status: ImportStatus;
  file: {
    name: string;
    type: FileType;
    size?: number;
    pages?: number;
  };
  summary: ImportSummary;
  columns: ImportColumn[];
  rows_sample: ImportRow[]; // A subset (e.g. 50 rows) for preview
  errors: ImportError[];
  image_summary?: {
    with_images?: number;
    missing_images?: number;
  };
  imagenes_detectadas?: number;
}

// Internal fields we map TO
export type CatalogField =
  | 'product_name'
  | 'price'
  | 'sku'
  | 'category'
  | 'stock'
  | 'description'
  | 'currency'
  | 'image_url'
  | 'gallery_urls'
  | 'image_alt'
  | 'ignore'; // Special field to ignore the column

export interface ColumnMapping {
  [columnKey: string]: CatalogField;
}
