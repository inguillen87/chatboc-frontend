import { describe, expect, it } from 'vitest';
import { normalizeOmnichannelInboxItemV2 } from './saas';
const normalize = (event: unknown) => normalizeOmnichannelInboxItemV2({id:'municipio:12',timeline:[event]})!.timeline[0];
describe('inbox timeline source evidence',()=>{
  it('preserves messages carried in the event payload',()=>{
    const event=normalize({type:'message_created',payload:{content:'Consulta del vecino'},actor:{type:'user'}});
    expect(event.type).toBe('message_created'); expect(event.payload?.content).toBe('Consulta del vecino');
  });
  it('does not convert a declared status change into a message because it has a description',()=>{
    const event=normalize({type:'status_changed',content:'Se revisó el caso',payload:{new_status:'en_proceso'}});
    expect(event.type).toBe('status_changed');expect(event.payload?.new_status).toBe('en_proceso');
  });
  it('preserves the target of an assignment change',()=>expect(normalize({type:'assignment_changed',payload:{new_assignee_name:'Equipo de prueba'}}).payload?.new_assignee_name).toBe('Equipo de prueba'));
  it('does not manufacture an event timestamp',()=>expect(normalize({type:'message_created',content:'Sin fecha'}).timestamp).toBe(''));
  it('preserves an explicit timestamp',()=>expect(normalize({type:'message_created',timestamp:'2026-09-23T12:00:00Z',content:'Con fecha'}).timestamp).toBe('2026-09-23T12:00:00Z'));
  it('keeps explicit read evidence without inventing one for an unconfirmed response',()=>{
    expect(normalize({type:'message_created',payload:{content:'Con recibo',read_state:'read'}}).payload?.read_state).toBe('read');
    expect(normalize({type:'message_created',payload:{content:'Sin recibo'}}).payload?.read_state).toBeUndefined();
  });
});
