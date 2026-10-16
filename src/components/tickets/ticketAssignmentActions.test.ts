import { describe, expect, it } from 'vitest';
import { normalizeSaasActions, type SaasAction } from '@/api/v2/saas';
import { isTicketAssignmentAction, ticketAssignmentActions } from './ticketAssignmentActions';

const claim: SaasAction = { id: 'claim', label: 'Atender este caso' };
const assign: SaasAction = { id: 'assign', label: 'Elegir responsable oficial' };

describe('published ownership actions', () => {
  it.each([undefined, [], [{id:'reply',label:'Responder'}]])('does not infer ownership from %j', actions => {
    expect(ticketAssignmentActions(actions)).toEqual({assign:null,claim:null});
  });
  it.each([{disabled:true},{enabled:false},{disabled:true,enabled:true},{label:''},{label:'  '}])('rejects unavailable or unlabelled actions %j', overrides => {
    expect(ticketAssignmentActions([{...claim,...overrides}]).claim).toBeNull();
  });
  it('does not turn claim permission into assignment permission', () => {
    expect(ticketAssignmentActions([claim])).toEqual({claim,assign:null});
  });
  it('does not turn assignment permission into claim permission', () => {
    expect(ticketAssignmentActions([assign])).toEqual({assign,claim:null});
  });
  it('retains independent permissions and published labels', () => {
    expect(ticketAssignmentActions([claim,assign])).toEqual({claim,assign});
  });
  it.each([[claim,claim],[claim,{...claim,disabled:true}]])('fails closed for duplicated authority %j', actions => {
    expect(ticketAssignmentActions(actions).claim).toBeNull();
  });
  it.each([[{id:'claim'}],['claim'],[{id:'claim',label:' '}]] )('rejects labels invented by normalization %j', raw => {
    expect(ticketAssignmentActions(normalizeSaasActions(raw)).claim).toBeNull();
  });
  it.each(['label','title','name','action','text'])('preserves a published %s alias', key => {
    expect(ticketAssignmentActions(normalizeSaasActions([{id:'claim',[key]:'Atender por contrato'}])).claim?.label).toBe('Atender por contrato');
  });
  it('recognizes only supported ownership action identifiers', () => {
    expect(isTicketAssignmentAction(claim)).toBe(true);
    expect(isTicketAssignmentAction(assign)).toBe(true);
    expect(isTicketAssignmentAction({id:'delete',label:'Borrar'})).toBe(false);
  });
});
