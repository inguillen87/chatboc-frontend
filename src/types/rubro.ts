
export interface TenantDemoSummary {
  id: number;
  slug: string;
  nombre: string;
  descripcion?: string;
  widget_preview?: {
    preset?: string;
    motion_level?: string;
    glassmorphism?: boolean;
    logo_ring?: boolean;
    gradient_start?: string;
    gradient_end?: string;
  };
}

export interface Rubro {
  id: number;
  nombre: string;
  clave?: string;
  padre_id?: number | null;
  demo?: TenantDemoSummary | null;
  // Subrubros will be populated recursively by the frontend helper
  subrubros?: Rubro[];
}
