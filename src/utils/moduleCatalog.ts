import type { ModuleDefinition } from './organizationModules';
const MAX_MODULES = 100;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim() && value.length <= 1600 && !/\p{Cc}/u.test(value);

/** Validate structure and dependency closure, never a frontend business catalog. */
export function readModuleCatalog(value: unknown): ModuleDefinition[] | null {
  if (!Array.isArray(value) || value.length > MAX_MODULES) return null;
  const catalog: ModuleDefinition[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!object(item) || !identifier(item.id) || ids.has(item.id) ||
        !text(item.label) || !text(item.description) || !Array.isArray(item.requires) ||
        item.requires.length > MAX_MODULES || !item.requires.every(identifier) ||
        new Set(item.requires).size !== item.requires.length) return null;
    ids.add(item.id);
    catalog.push({ id: item.id, label: item.label, description: item.description, requires: [...item.requires] });
  }
  if (catalog.some(item => item.requires.some(id => !ids.has(id) || id === item.id))) return null;
  const definitions = new Map(catalog.map(item => [item.id, item]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const acyclic = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const dependency of definitions.get(id)!.requires) {
      if (!acyclic(dependency)) return false;
    }
    visiting.delete(id); visited.add(id); return true;
  };
  return catalog.every(item => acyclic(item.id)) ? catalog : null;
}
