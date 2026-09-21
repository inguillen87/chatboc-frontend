import { describe, expect, it } from 'vitest';
import assistance from '../../tests/fixtures/module-selection-assistance.json';
import { planModuleToggle, readSelectionAssistance } from './moduleSelectionAssistance';
const m = (id: string, requires: string[] = []) => ({ id, requires, label: id, description: id });
const graph = [m('directory'), m('catalog',['directory']), m('payments',['catalog']), m('surveys')];
describe('assisted draft planning', () => {
  it('adds all transitive dependencies in server catalog order', () => {
    expect(planModuleToggle(graph, ['surveys'], 'payments')).toEqual({
      selected:['directory','catalog','payments','surveys'], added:['directory','catalog','payments'], removed:[] });
  });
  it('removes all dependents without removing unrelated functions', () => {
    expect(planModuleToggle(graph, graph.map(m=>m.id), 'directory')).toEqual({
      selected:['surveys'], added:[], removed:['directory','catalog','payments'] });
  });
  it('keeps prerequisites when only their consumer is removed', () => {
    expect(planModuleToggle(graph, ['directory','catalog','payments'], 'payments')?.selected).toEqual(['directory','catalog']);
  });
  it('does not add already selected dependencies to the impact list', () => {
    expect(planModuleToggle(graph, ['directory','catalog'], 'payments')?.added).toEqual(['payments']);
  });
  it('handles a shared prerequisite and reversed server order without duplicates', () => {
    const catalog = [m('d',['b','c']),m('c',['a']),m('b',['a']),m('a')];
    expect(planModuleToggle(catalog, [], 'd')?.selected).toEqual(['d','c','b','a']);
    expect(planModuleToggle(catalog, ['d','c','b','a'], 'b')?.selected).toEqual(['c','a']);
  });
  it('never mutates the catalog or original draft', () => {
    const current = Object.freeze(['surveys']); const catalog = structuredClone(graph);
    const before = JSON.stringify(catalog); planModuleToggle(catalog, [...current], 'payments');
    expect(JSON.stringify(catalog)).toBe(before); expect(current).toEqual(['surveys']);
  });
  it.each([['payments'],['unknown'],['directory','directory']])('rejects malformed starting selections %j', (...current) => {
    expect(planModuleToggle(graph, current, 'surveys')).toBeNull();
  });
  it('rejects unknown targets and malformed graphs', () => {
    expect(planModuleToggle(graph, [], 'unknown')).toBeNull();
    expect(planModuleToggle([m('a',['b']),m('b',['a'])], [], 'a')).toBeNull();
    expect(planModuleToggle([m('a',['absent'])], [], 'a')).toBeNull();
  });
  it('covers every valid subset of a branched graph and keeps closure', () => {
    const catalog = [m('a'),m('b',['a']),m('c',['a']),m('d',['b','c']),m('e')];
    for (let mask=0; mask<32; mask++) {
      const current = catalog.filter((_,i)=>mask & (1<<i)).map(m=>m.id);
      if(catalog.some(m=>current.includes(m.id)&&m.requires.some(id=>!current.includes(id)))) continue;
      for(const item of catalog) {
        const plan=planModuleToggle(catalog,current,item.id)!;
        expect(plan).not.toBeNull();
        expect(plan.selected.includes(item.id)).toBe(!current.includes(item.id));
        expect(new Set(plan.selected).size).toBe(plan.selected.length);
        expect(catalog.every(m=>!plan.selected.includes(m.id)||m.requires.every(id=>plan.selected.includes(id)))).toBe(true);
      }
    }
  });
});
describe('backend assistance copy', () => {
  it('accepts published copy and strips non-contract properties', () => {
    expect(readSelectionAssistance({...assistance, private:'ignored'})).toEqual(assistance);
  });
  it.each([null, [], {}, {...assistance,contract_version:'unknown'}, {...assistance,detail:''},
    {...assistance,cancel:'bad\u0000text'}, {...assistance,hint:'x'.repeat(1601)}])('disables assistance for invalid copy %#', value => {
    expect(readSelectionAssistance(value)).toBeNull();
  });
});
