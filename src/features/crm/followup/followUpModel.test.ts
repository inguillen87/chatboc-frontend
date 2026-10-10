import {describe,expect,it} from 'vitest';
import {assertFollowUpIdentity,parseFollowUpHistory,parseFollowUpQueue,followUpState,followUpRevision,fromLocalDateTime,toLocalDateTime,validScheduledInstant} from './followUpModel';
const identity={tenantSlug:'org-a',contactId:'contact-42'};
const history=(preferences:Record<string,unknown>={})=>({contact:{id:identity.contactId,name:'QA',preferences}});
describe('persistent follow-up model',()=>{
  it.each(['../other','bad/id','id?x=1','',' space','contact:42'])('rejects route-unsafe identity %s',contactId=>expect(()=>assertFollowUpIdentity({...identity,contactId})).toThrow());
  it('reads an explicit contact id without deriving it from a user id or visible number',()=>{
    expect(parseFollowUpHistory(history(),identity)).toMatchObject({...identity,notes:'',nextActionAt:null});
    expect(()=>parseFollowUpHistory({contact:{id:42}},identity)).toThrow();
  });
  it('rejects a foreign history envelope',()=>expect(()=>parseFollowUpHistory({...history(),tenant_slug:'other'},identity)).toThrow());
  it('rejects a masked contact and malformed notes',()=>{
    expect(()=>parseFollowUpHistory({contact:{id:identity.contactId,pii_masked:true}},identity)).toThrow();
    expect(()=>parseFollowUpHistory(history({owner_notes:{value:'wrong'}}),identity)).toThrow();
  });
  it('keeps notes, next action and actor as different fields',()=>{
    const value=parseFollowUpHistory(history({owner_notes:'Revisar propuesta',next_action_at:'2026-09-25T15:00:00Z',stage_updated_by:9}),identity);
    expect(value.notes).toBe('Revisar propuesta');expect(value.updatedBy).toBe('9');expect(value.nextActionAt).toBe('2026-09-25T15:00:00Z');
  });
  it.each(['2026-09-25T12:00','tomorrow','',null,'2026-02-30T12:00:00Z'])('does not certify an invalid or zone-less instant %s',value=>expect(validScheduledInstant(value)).toBe(false));
  it('roundtrips a real local time and rejects impossible local dates',()=>{
    const date=fromLocalDateTime('2026-09-25T12:30');expect(toLocalDateTime(date)).toBe('2026-09-25T12:30');
    expect(()=>fromLocalDateTime('2026-02-30T12:30')).toThrow();expect(fromLocalDateTime('')).toBeNull();
  });
  it('changes its comparison key when notes, date or update metadata changes',()=>{
    const base=parseFollowUpHistory(history(),identity);expect(followUpRevision(base)).not.toBe(followUpRevision({...base,updatedBy:'9'}));
  });
  it('excludes ambiguous queue identities and missing contact identity',()=>{
    const row={contact_id:'contact-42',tenant:{slug:'org-a'},name:'QA',next_action_at:null};
    const result=parseFollowUpQueue({items:[row,{...row,name:'Duplicate'},{...row,contact_id:undefined},{...row,contact_id:'contact-43'}]});
    expect(result.items).toHaveLength(1);expect(result.items[0].contactId).toBe('contact-43');expect(result.excluded).toBe(3);
  });
  it('distinguishes missing schedule information from an explicitly unset date',()=>{
    const result=parseFollowUpQueue({items:[{contact_id:'c1',tenant:{slug:'a'},next_action_at:null},{contact_id:'c2',tenant:{slug:'a'}}]});
    const now=new Date();expect(followUpState(result.items[0].nextActionAt,now)).toBe('unscheduled');expect(followUpState(result.items[1].nextActionAt,now)).toBe('unverified');
  });
  it('classifies past instants as overdue and today by the browser calendar',()=>{
    const now=new Date(2026,8,24,12,0,0);
    expect(followUpState(new Date(2026,8,24,11).toISOString(),now)).toBe('overdue');
    expect(followUpState(new Date(2026,8,24,15).toISOString(),now)).toBe('today');
    expect(followUpState(new Date(2026,8,25,15).toISOString(),now)).toBe('scheduled');
  });
});
