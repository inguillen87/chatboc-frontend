import { apiFetch } from '@/utils/api';
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

export const getRubrosHierarchy = async (): Promise<Rubro[]> => {
  const backendData = await fetchRubros();
  if (!Array.isArray(backendData)) return [];

  const tree = buildRubroTree(backendData);
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
};
