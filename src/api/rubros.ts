
import { apiFetch } from '@/utils/api';

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

export const fetchRubros = async (): Promise<Rubro[]> => {
  return await apiFetch<Rubro[]>('/rubros/', {
    omitTenant: true,
    skipAuth: true,
  });
};

// Helper to build the tree from the flat list
export const buildRubroTree = (flatRubros: Rubro[]): Rubro[] => {
  const map = new Map<number, Rubro>();
  const roots: Rubro[] = [];

  // Initialize map
  flatRubros.forEach(r => {
    map.set(r.id, { ...r, subrubros: [] });
  });

  // Build tree
  flatRubros.forEach(r => {
    const node = map.get(r.id)!;
    if (r.padre_id && map.has(r.padre_id)) {
      map.get(r.padre_id)!.subrubros!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};
