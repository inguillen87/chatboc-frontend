import {describe,expect,it} from 'vitest';
import {filterFollowUpRows,followUpKey,type FollowUpRow} from './followUpModel';
const now=new Date('2030-01-15T12:00:00Z');
const row=(id:string,name:string,date:string|null,organization='Organización A'):FollowUpRow=>({
  key:followUpKey({tenantSlug:'org-a',contactId:id}),contactId:id,tenantSlug:'org-a',organization,name,nextActionAt:date,
});
describe('verified follow-up ordering',()=>{
  it.each(['2000-02-30T10:00:00Z','01/02/2000','2000-01-01T10:00:00','unverified'])('keeps an unverifiable date behind verified instants: %s',date=>{
    const invalid=row('bad','Ana',date),valid=row('ok','Zoe','2030-01-16T00:00:00Z');
    expect(filterFollowUpRows([invalid,valid],'all','',now)).toEqual([valid,invalid]);
    expect(filterFollowUpRows([invalid,valid],'unverified','',now)).toEqual([invalid]);
  });
  it('uses absolute time across offsets rather than alphabetical timestamp order',()=>{
    const early=row('1','B','2030-01-15T10:00:00+03:00');
    const late=row('2','A','2030-01-15T08:00:00Z');
    expect(filterFollowUpRows([late,early],'all','',now)).toEqual([early,late]);
  });
  it('preserves the input order and contents while returning a sorted copy',()=>{
    const input=Object.freeze([row('b','Beatriz',null),row('a','Ana',null)]);
    const result=filterFollowUpRows(input,'all','',now);
    expect(result.map(item=>item.contactId)).toEqual(['a','b']);
    expect(input.map(item=>item.contactId)).toEqual(['b','a']);
  });
  it('keeps organization and identity as deterministic tie-breakers',()=>{
    const a=row('b','José',null,'Organización A'),b=row('a','José',null,'Organización A'),c=row('c','José',null,'Organización B');
    expect(filterFollowUpRows([c,a,b],'all','',now).map(item=>item.contactId)).toEqual(['a','b','c']);
  });
  it('combines ordinary priority and accent-insensitive search without widening results',()=>{
    const rows=[row('a','José','2000-01-01T00:00:00Z'),row('b','José',null),row('c','Ana','2000-01-01T00:00:00Z')];
    expect(filterFollowUpRows(rows,'overdue',' JOSE ',now).map(item=>item.contactId)).toEqual(['a']);
    expect(filterFollowUpRows(rows,'all','organizacion',now)).toHaveLength(3);
    expect(filterFollowUpRows(rows,'all','inexistente',now)).toEqual([]);
  });
});
