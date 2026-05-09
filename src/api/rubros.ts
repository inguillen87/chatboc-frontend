import { apiFetch } from '@/utils/api';
import { DEMO_HIERARCHY } from '@/data/demoHierarchy';
import { Rubro } from '@/types/rubro';

const sortRubrosByName = (items: Rubro[]): Rubro[] =>
  [...items].sort((a, b) =>
    (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }),
  );

const sortRubroTree = (items: Rubro[]): Rubro[] =>
  sortRubrosByName(items).map((item) => ({
    ...item,
    subrubros: Array.isArray(item.subrubros) ? sortRubroTree(item.subrubros) : [],
  }));

export const fetchRubros = async (): Promise<Rubro[]> => {
  return apiFetch<Rubro[]>('/rubros/', {
    omitTenant: true,
    skipAuth: true,
  });
};

export const buildRubroTree = (flatRubros: Rubro[]): Rubro[] => {
  if (!Array.isArray(flatRubros)) return [];

  const map = new Map<number, Rubro>();
  const roots: Rubro[] = [];

  flatRubros.forEach((r) => {
    map.set(r.id, { ...r, subrubros: [] });
  });

  flatRubros.forEach((r) => {
    const node = map.get(r.id);
    if (!node) return;

    if (r.padre_id && map.has(r.padre_id)) {
      const parent = map.get(r.padre_id);
      if (parent && !parent.subrubros?.some((child) => child.id === node.id)) {
        parent.subrubros = [...(parent.subrubros ?? []), node];
      }
      return;
    }

    roots.push(node);
  });

  return roots;
};

const cloneRubro = (item: Rubro): Rubro => JSON.parse(JSON.stringify(item));

const ensureFallbackRoot = (tree: Rubro[], fallbackId: number, fallbackKey: string) => {
  const fallbackRoot = DEMO_HIERARCHY.find((item) => item.id === fallbackId);
  if (!fallbackRoot) return;

  const existingRoot = tree.find(
    (root) => root.id === fallbackId || root.clave === fallbackKey,
  );

  if (!existingRoot) {
    tree.push(cloneRubro(fallbackRoot));
    return;
  }

  if (!existingRoot.subrubros || existingRoot.subrubros.length === 0) {
    existingRoot.subrubros = cloneRubro(fallbackRoot).subrubros;
  }
};

export const getRubrosHierarchy = async (): Promise<Rubro[]> => {
  try {
    let backendData: Rubro[] = [];

    try {
      backendData = await fetchRubros();
    } catch (error) {
      console.warn('Backend rubros fetch failed, using fallback hierarchy', error);
      backendData = [];
    }

    if (!Array.isArray(backendData)) {
      console.warn('Backend rubros invalid format, using fallback hierarchy');
      return sortRubroTree(DEMO_HIERARCHY);
    }

    const tree = buildRubroTree(backendData);

    ensureFallbackRoot(tree, 1, 'municipios_root');
    ensureFallbackRoot(tree, 2, 'comerciales_root');
    ensureFallbackRoot(tree, 3, 'educacion_root');

    if (tree.length === 0) {
      return sortRubroTree(DEMO_HIERARCHY);
    }

    const prioritizedRoots = tree.filter(
      (root) =>
        root.id === 1 ||
        root.id === 2 ||
        root.id === 3 ||
        root.clave === 'municipios_root' ||
        root.clave === 'comerciales_root' ||
        root.clave === 'educacion_root',
    );

    return sortRubroTree(prioritizedRoots.length ? prioritizedRoots : tree);
  } catch (error) {
    console.warn('Error processing rubros hierarchy, using fallback hierarchy', error);
    return sortRubroTree(DEMO_HIERARCHY);
  }
};
