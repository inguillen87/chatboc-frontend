
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
      // It's a root
      roots.push(node);
    }
  });

  return roots;
};

export const getRubrosHierarchy = async (): Promise<Rubro[]> => {
    try {
        const backendData = await fetchRubros();

        if (Array.isArray(backendData) && backendData.length > 0) {
            // Build the tree from the backend data
            const tree = buildRubroTree(backendData);

            // Ensure "Municipios" is present in the tree if backend missed it
            // Backend logs suggest it might be returning partial data
            const hasMunicipio = tree.some(root =>
                root.nombre.toLowerCase().includes('municipio') ||
                root.clave === 'municipios_root' ||
                root.id === 1
            );

            if (!hasMunicipio) {
                const demoMunicipios = DEMO_HIERARCHY.find(d => d.id === 1 || d.clave === 'municipios_root');
                if (demoMunicipios) {
                    // Prepend to ensure it's first
                    tree.unshift(demoMunicipios);
                }
            }

            // If the tree is empty despite having data (e.g. all orphans with invalid parents), fallback
            if (tree.length > 0) {
                return tree;
            }
        }

        // If backend returns empty or invalid, fallback to demo hierarchy
        console.warn("Backend rubros empty or invalid, using fallback hierarchy");
        return DEMO_HIERARCHY;
    } catch (error) {
        console.warn("Error fetching rubros, using fallback hierarchy", error);
        return DEMO_HIERARCHY;
    }
};
