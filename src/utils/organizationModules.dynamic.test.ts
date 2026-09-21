import { describe, expect, it } from 'vitest';
import fixtures from '../../tests/fixtures/organization-modules.json';
import { readModuleSelection, validModules } from './organizationModules';
const full = fixtures.full;
const module = (id: string, requires: string[] = []) => ({ id, requires, label: id, description: `Prepare ${id}` });
const contract = (catalog: unknown[], selected: string[] = []) => ({ ...full, catalog, selected });
const read = (value: unknown) => readModuleSelection(value, full.tenant.slug);
describe('backend-owned module catalog', () => {
  it('accepts a reordered catalog and selection in the published order', () => {
    const catalog = [...full.catalog].reverse();
    const selected = catalog.filter(m => full.selected.includes(m.id)).map(m => m.id);
    expect(read(contract(catalog, selected))?.catalog).toEqual(catalog);
  });
  it('accepts a reduced catalog without inventing omitted modules', () => {
    expect(read(contract([module('surveys')], ['surveys']))?.selected).toEqual(['surveys']);
  });
  it('accepts an extended catalog with server-declared dependencies', () => {
    const catalog = [module('directory'), module('appointments', ['directory']), module('reminders', ['appointments'])];
    const parsed = read(contract(catalog, ['directory', 'appointments']));
    expect(parsed?.catalog).toEqual(catalog);
    expect(validModules(['reminders'], parsed!.catalog)).toBe(false);
    expect(validModules(['directory', 'appointments', 'reminders'], parsed!.catalog)).toBe(true);
  });
  it('treats catalog revision as data rather than a hard-coded frontend list', () => {
    expect(read({ ...contract([module('directory')]), catalog_version: 2 })?.catalog_version).toBe(2);
  });
  it('accepts an empty optional catalog and no selections', () => { expect(read(contract([]))?.selected).toEqual([]); });
  it.each([
    [module('a'), module('a')], [module('a', ['missing'])], [module('a', ['a'])],
    [module('a', ['b']), module('b', ['a'])],
    [module('a', ['b']), module('b', ['c']), module('c', ['a'])],
    [module('a'), module('b', ['a', 'a'])], [module('../admin')], [module('a\u0085b')],
    [{ ...module('a'), label: 'a\u0000b' }], [{ ...module('a'), requires: null }],
    Array.from({length: 101}, (_, i) => module(`module-${i}`)),
  ])('rejects malformed, ambiguous or cyclic catalogs %#', (...catalog) => { expect(read(contract(catalog))).toBeNull(); });
  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid catalog version %s', catalog_version => {
    expect(read({ ...full, catalog_version })).toBeNull();
  });
  it('preserves tenant, endpoint, permission and side-effect boundaries', () => {
    for (const change of [{ tenant: { id: 2, slug: 'other' } }, { save_endpoint: '/api/private' },
      { can_edit: true, reason_code: 'full' }, { provider_calls_performed: true },
      { changes_runtime_access: true }, { selected: ['unknown'] }]) expect(read({ ...full, ...change })).toBeNull();
  });
});
