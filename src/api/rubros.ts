
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
    if (r.padre_id && map.has(r.padre_id)) {
      const parent = map.get(r.padre_id)!;
      if (!parent.subrubros?.some(child => child.id === node.id)) {
        parent.subrubros!.push(node);
      }
    } else {
      if (!r.padre_id || !map.has(r.padre_id)) {
           roots.push(node);
      }
    }
  });

  return roots;
};

// Recursive merge function to blend DEMO_HIERARCHY into the fetched tree
const mergeRubrosRecursively = (target: Rubro[], source: Rubro[]) => {
    source.forEach(sourceItem => {
        // Try to find a match in target by ID, Clave, or roughly by Name
        let match = target.find(t =>
            t.id === sourceItem.id ||
            (t.clave && sourceItem.clave && t.clave === sourceItem.clave) ||
            (!t.padre_id && t.nombre === sourceItem.nombre) // Loose match for roots
        );

        if (match) {
            // If item exists, merge subrubros
            if (sourceItem.subrubros && sourceItem.subrubros.length > 0) {
                if (!match.subrubros) match.subrubros = [];
                mergeRubrosRecursively(match.subrubros, sourceItem.subrubros);
            }
            // Also merge demo data if missing in target
            if (sourceItem.demo && !match.demo) {
                match.demo = sourceItem.demo;
            }
        } else {
            // If item does not exist, add it (deeply copied to avoid mutations)
            target.push(JSON.parse(JSON.stringify(sourceItem)));
        }
    });
};

export const getRubrosHierarchy = async (): Promise<Rubro[]> => {
    try {
        let backendData: Rubro[] = [];
        try {
            backendData = await fetchRubros();
        } catch (e) {
            console.warn("Backend rubros fetch failed, using fallback hierarchy", e);
            backendData = [];
        }

        // Build tree from backend data
        let tree = Array.isArray(backendData) ? buildRubroTree(backendData) : [];

        // Deep merge DEMO_HIERARCHY into the tree
        // This ensures that even if backend returns partial data (e.g. only Publico root but no children),
        // we fill in the missing demo children.
        mergeRubrosRecursively(tree, DEMO_HIERARCHY);

        // Sort roots by ID to maintain order (Publico=1, Empresas=2)
        tree.sort((a, b) => a.id - b.id);

        return tree;
    } catch (error) {
        console.warn("Error processing rubros hierarchy, using fallback hierarchy", error);
        return DEMO_HIERARCHY;
    }
};
