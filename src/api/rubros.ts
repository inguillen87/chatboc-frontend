
import { apiFetch } from '@/utils/api';
import { DEMO_HIERARCHY } from '@/data/demoHierarchy';
import { Rubro } from '@/types/rubro';

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

// Returns the enforced hierarchy for demos.
// In the future, this can merge real API data (e.g., availability) into the static structure.
// For now, it returns the static structure to ensure "Clean & Organized" presentation.
export const getRubrosHierarchy = async (): Promise<Rubro[]> => {
    try {
        // We attempt to fetch to see if we can get real status/availability if the backend supported it
        // But for now, we strictly prefer the Clean Hierarchy.
        // If we needed to map legacy backend items to this hierarchy, we would do it here.

        // const backendData = await fetchRubros();
        // ... mapping logic ...

        return DEMO_HIERARCHY;
    } catch (error) {
        console.warn("Error fetching rubros, using fallback hierarchy", error);
        return DEMO_HIERARCHY;
    }
};
