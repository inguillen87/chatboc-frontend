
import { apiFetch } from '@/utils/api';
import { DEMO_HIERARCHY } from '@/data/demoHierarchy';
import { Rubro } from '@/types/rubro';

const treeHasDemos = (nodes: Rubro[]): boolean =>
  nodes.some((node) => Boolean(node.demo) || (node.subrubros && treeHasDemos(node.subrubros)));

type RubroHierarchyOptions = {
  /**
   * When true, append the static demo hierarchy to the backend tree if no nodes expose demo metadata.
   * Defaults to false to keep tenant rubros untouched in production contexts.
   */
  allowDemoAugmentation?: boolean;
  /**
   * Tenant slug to scope the hierarchy. Needed for widget contexts where the tenant
   * cannot be inferred automatically.
   */
  tenantSlug?: string | null;
  /**
   * Whether the request originates from the widget/iframe context. Prevents leaking
   * panel credentials.
   */
  isWidgetRequest?: boolean;
};

// Fetch rubros from the backend, including tenant-scoped hierarchy if available
export const fetchRubros = async (
  options: Pick<RubroHierarchyOptions, "tenantSlug" | "isWidgetRequest"> = {},
): Promise<Rubro[]> => {
  const { tenantSlug, isWidgetRequest } = options;

  return await apiFetch<Rubro[]>("/rubros/", {
    skipAuth: true,
    tenantSlug: tenantSlug ?? undefined,
    isWidgetRequest: isWidgetRequest ?? false,
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

export const getRubrosHierarchy = async (
  options: RubroHierarchyOptions = {},
): Promise<Rubro[]> => {
  const {
    allowDemoAugmentation = false,
    tenantSlug = null,
    isWidgetRequest = false,
  } = options;

  try {
    const backendData = await fetchRubros({ tenantSlug, isWidgetRequest });

    if (!Array.isArray(backendData) || backendData.length === 0) {
      console.warn("Backend rubros empty or invalid, using fallback hierarchy");
      return DEMO_HIERARCHY;
    }

    // Build the tree from the backend data
    const tree = buildRubroTree(backendData);

    if (tree.length === 0) {
      console.warn("Backend rubros produced no tree, using fallback hierarchy");
      return DEMO_HIERARCHY;
    }

    // Preserve backend data; append demos when explicitly allowed so demo cards always stay available
    if (allowDemoAugmentation) {
      const mergedRoots = tree.map((root) => ({ ...root, subrubros: root.subrubros ?? [] }));

      DEMO_HIERARCHY.forEach((demoRoot) => {
        const key = demoRoot.clave || demoRoot.nombre.toLowerCase();
        const existingRootIndex = mergedRoots.findIndex(
          (root) => (root.clave || root.nombre.toLowerCase()) === key,
        );

        if (existingRootIndex === -1) {
          mergedRoots.push(demoRoot);
          return;
        }

        const existingRoot = mergedRoots[existingRootIndex];
        const existingChildKeys = new Set(
          (existingRoot.subrubros ?? []).map((child) => child.clave || child.nombre.toLowerCase()),
        );

        const augmentedChildren = [
          ...(existingRoot.subrubros ?? []),
          ...(demoRoot.subrubros ?? []).filter((child) => {
            const childKey = child.clave || child.nombre.toLowerCase();
            return !existingChildKeys.has(childKey);
          }),
        ];

        mergedRoots[existingRootIndex] = {
          ...existingRoot,
          subrubros: augmentedChildren,
        };
      });

      return mergedRoots;
    }

    return tree;
  } catch (error) {
    console.warn("Error fetching rubros, using fallback hierarchy", error);
    return DEMO_HIERARCHY;
  }
};
