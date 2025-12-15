
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

            // Ensure "Municipios" (ID 1) is present and has children
            const municipioNodeIndex = tree.findIndex(root =>
                root.nombre.toLowerCase().includes('municipio') ||
                root.clave === 'municipios_root' ||
                root.id === 1
            );

            const demoMunicipios = DEMO_HIERARCHY.find(d => d.id === 1 || d.clave === 'municipios_root');

            if (municipioNodeIndex === -1) {
                // Completely missing, inject demo
                if (demoMunicipios) {
                    tree.unshift(demoMunicipios);
                }
            } else {
                // Exists, check if empty
                const existingNode = tree[municipioNodeIndex];
                if (!existingNode.subrubros || existingNode.subrubros.length === 0) {
                     if (demoMunicipios && demoMunicipios.subrubros) {
                         existingNode.subrubros = demoMunicipios.subrubros;
                     }
                }
            }

            // Ensure "Locales Comerciales" (ID 2) is present and has children
            const comercialesNodeIndex = tree.findIndex(root =>
                root.nombre.toLowerCase().includes('comerciales') ||
                root.clave === 'comerciales_root' ||
                root.id === 2
            );

            const demoComerciales = DEMO_HIERARCHY.find(d => d.id === 2 || d.clave === 'comerciales_root');

            if (comercialesNodeIndex === -1) {
                // Completely missing, inject demo
                if (demoComerciales) {
                    tree.push(demoComerciales);
                }
            } else {
                 // Exists, check if empty
                const existingNode = tree[comercialesNodeIndex];
                if (!existingNode.subrubros || existingNode.subrubros.length === 0) {
                     if (demoComerciales && demoComerciales.subrubros) {
                         existingNode.subrubros = demoComerciales.subrubros;
                     }
                }
            }

            if (tree.length > 0) {
                return tree;
            }
        }

        // If backend returns empty or invalid, fallback to demo hierarchy
        console.warn("Backend rubros empty or invalid, using fallback hierarchy");
        return DEMO_HIERARCHY;
    } catch (error) {
        // If error is 404 or network, use DEMO_HIERARCHY
        console.warn("Error fetching rubros, using fallback hierarchy", error);
        return DEMO_HIERARCHY;
    }
};
