
import { apiFetch } from '@/utils/api';
import { DEMO_HIERARCHY } from '@/data/demoHierarchy';
import { Rubro } from '@/types/rubro';

// Fetch rubros from the backend, including tenant-scoped hierarchy if available
export const fetchRubros = async (): Promise<Rubro[]> => {
  return await apiFetch<Rubro[]>('/rubros/', {
    omitTenant: true,
    skipAuth: true,
  });
};

// Helper to build the tree from the flat list returned by the backend
export const buildRubroTree = (flatRubros: Rubro[]): Rubro[] => {
  if (!Array.isArray(flatRubros)) return [];

  const map = new Map<number, Rubro>();
  const roots: Rubro[] = [];

  // Initialize map and ensure subrubros array exists
  flatRubros.forEach(r => {
    map.set(r.id, { ...r, subrubros: [] });
  });

  // Build tree
  flatRubros.forEach(r => {
    const node = map.get(r.id)!;
    // Only process if it hasn't been added as a child already (though data is flat, so we iterate once)
    // We rely on padre_id to determine structure.

    if (r.padre_id && map.has(r.padre_id)) {
      const parent = map.get(r.padre_id)!;
      // Prevent duplicates in parent if backend sends redundant data
      if (!parent.subrubros?.some(child => child.id === node.id)) {
        parent.subrubros!.push(node);
      }
    } else {
      // It's a root or orphan
      // Only push to roots if it doesn't have a parent in the map.
      if (!r.padre_id || !map.has(r.padre_id)) {
           roots.push(node);
      }
    }
  });

  return roots;
};

export const getRubrosHierarchy = async (): Promise<Rubro[]> => {
    try {
        const backendData = await fetchRubros();

        // If backend returns data, try to merge it.
        // Even if array is present, it might be incomplete.
        if (Array.isArray(backendData)) {
            const tree = buildRubroTree(backendData);

            // 1. Ensure "Soluciones para Sector Público" (ID 1) exists
            let municipioNode = tree.find(root =>
                root.id === 1 || root.clave === 'municipios_root'
            );

            const demoMunicipios = DEMO_HIERARCHY.find(d => d.id === 1);

            if (!municipioNode && demoMunicipios) {
                // If totally missing, add the demo one
                tree.unshift(JSON.parse(JSON.stringify(demoMunicipios)));
            } else if (municipioNode && demoMunicipios) {
                // If exists, merge children if missing
                if (!municipioNode.subrubros || municipioNode.subrubros.length === 0) {
                     municipioNode.subrubros = JSON.parse(JSON.stringify(demoMunicipios.subrubros));
                }
            }

            // 2. Ensure "Soluciones para Empresas" (ID 2) exists
            let comercialesNode = tree.find(root =>
                root.id === 2 || root.clave === 'comerciales_root'
            );

            const demoComerciales = DEMO_HIERARCHY.find(d => d.id === 2);

            if (!comercialesNode && demoComerciales) {
                tree.push(JSON.parse(JSON.stringify(demoComerciales)));
            } else if (comercialesNode && demoComerciales) {
                 if (!comercialesNode.subrubros || comercialesNode.subrubros.length === 0) {
                     comercialesNode.subrubros = JSON.parse(JSON.stringify(demoComerciales.subrubros));
                 }
            }

            // Final check: if tree is still "empty" (e.g. backend sent [] and logic above failed for some reason), fallback.
            if (tree.length > 0) {
                return tree;
            }
        }

        console.warn("Backend rubros empty or invalid, using fallback hierarchy");
        return DEMO_HIERARCHY;
    } catch (error) {
        console.warn("Error fetching rubros, using fallback hierarchy", error);
        return DEMO_HIERARCHY;
    }
};
