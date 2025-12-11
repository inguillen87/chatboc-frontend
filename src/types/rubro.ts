
export interface TenantDemoSummary {
  id: number;
  slug: string;
  nombre: string;
  descripcion?: string;
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
