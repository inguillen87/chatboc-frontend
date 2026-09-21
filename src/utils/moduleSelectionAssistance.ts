import { readModuleCatalog } from './moduleCatalog';
import type { ModuleDefinition, ModuleId } from './organizationModules';

export interface SelectionAssistance {
  contract_version: 'organization.setup_module_assistance.v1';
  select_title: string; remove_title: string; detail: string;
  added_heading: string; removed_heading: string; apply_draft: string;
  cancel: string; hint: string;
}
const fields = ['select_title','remove_title','detail','added_heading','removed_heading','apply_draft','cancel','hint'] as const;
export function readSelectionAssistance(value: unknown): SelectionAssistance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.contract_version !== 'organization.setup_module_assistance.v1') return null;
  const result = { contract_version: record.contract_version } as SelectionAssistance;
  for (const key of fields) {
    const text = record[key];
    if (typeof text !== 'string' || !text.trim() || text.length > 1600 || /\p{Cc}/u.test(text)) return null;
    result[key] = text;
  }
  return result;
}

export interface ModuleTogglePlan { selected: ModuleId[]; added: ModuleId[]; removed: ModuleId[] }

/** Pure draft transformation over a validated server graph. Never persists or authorizes. */
export function planModuleToggle(rawCatalog: ModuleDefinition[], current: ModuleId[], target: ModuleId): ModuleTogglePlan | null {
  const catalog = readModuleCatalog(rawCatalog);
  if (!catalog || !Array.isArray(current) || current.length > catalog.length || new Set(current).size !== current.length) return null;
  const byId = new Map(catalog.map(item => [item.id, item]));
  if (!byId.has(target) || current.some(id => !byId.has(id))) return null;
  const before = new Set(current);
  if (catalog.some(item => before.has(item.id) && item.requires.some(id => !before.has(id)))) return null;
  const selected = new Set(before);
  if (!selected.has(target)) {
    const stack = [target];
    while (stack.length) {
      const id = stack.pop()!;
      if (selected.has(id)) continue;
      selected.add(id);
      stack.push(...byId.get(id)!.requires);
    }
  } else {
    selected.delete(target);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of catalog) {
        if (selected.has(item.id) && item.requires.some(id => !selected.has(id))) {
          selected.delete(item.id); changed = true;
        }
      }
    }
  }
  const ids = catalog.map(item => item.id);
  return {
    selected: ids.filter(id => selected.has(id)),
    added: ids.filter(id => selected.has(id) && !before.has(id)),
    removed: ids.filter(id => before.has(id) && !selected.has(id)),
  };
}
