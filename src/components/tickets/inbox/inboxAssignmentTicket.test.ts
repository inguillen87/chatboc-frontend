import {describe,expect,it} from 'vitest';
import type {OmnichannelInboxItem} from '@/api/v2/saas';
import {inboxAssignmentTicket} from './inboxAssignmentTicket';
const item=(extra:Partial<OmnichannelInboxItem>={}):OmnichannelInboxItem=>({id:'12',ticket_id:'12',tenant_slug:'org-a',source_model:'municipio_reclamo',title:'Luminaria',status:'nuevo',lastMessageAt:'2026-09-26T12:00:00Z',unreadCount:0,attachments:[],presence:[],timeline:[],actions:[],allowed_actions:[],next_steps:[],agent_copilot_suggestions:[],...extra});
describe('inbox assignment ticket adapter',()=>{
 it('maps only verified routing identity fields',()=>{expect(inboxAssignmentTicket(item({assignee:{id:44},category:'Alumbrado'}))).toMatchObject({id:12,tenant_slug:'org-a',source_model:'municipio_reclamo',assigned_user_id:44,categoria:'Alumbrado'});});
 it.each([{ticket_id:'municipio:12'},{source_model:undefined},{tenant_slug:undefined}])('refuses an incomplete or non numeric routing identity %o',extra=>{expect(inboxAssignmentTicket(item(extra))).toBeNull();});
});

describe('assignment tenant from a verified backend envelope',()=>{
 it.each([{tenant:{slug:'org-a'}},{tenant_slug:'org-a'},{data:{tenant:{slug:'org-a'}}}])('uses published envelope identity %j',response=>{
  expect(inboxAssignmentTicket(item({tenant_slug:undefined}),{tenantSlug:'org-a',response})?.tenant_slug).toBe('org-a');
 });
 it.each([undefined,{}, {tenant:{id:1}}])('does not invent identity from the active scope %j',response=>{
  expect(inboxAssignmentTicket(item({tenant_slug:undefined}),{tenantSlug:'org-a',response})).toBeNull();
 });
 it.each([{tenant:{slug:'org-b'}},{tenant_slug:'org-a',tenant:{slug:'org-b'}},{tenant:{slug:''}},{tenant:{slug:'bad/path'}}])('rejects contradictory or invalid envelopes %j',response=>{
  expect(inboxAssignmentTicket(item({tenant_slug:undefined}),{tenantSlug:'org-a',response})).toBeNull();
 });
 it('rejects disagreement between a ticket and its envelope',()=>{
  expect(inboxAssignmentTicket(item(),{tenantSlug:'org-a',response:{tenant:{slug:'org-b'}}})).toBeNull();
 });
 it('requires a verified active scope when consuming an envelope',()=>{
  expect(inboxAssignmentTicket(item({tenant_slug:undefined}),{tenantSlug:null,response:{tenant:{slug:'org-a'}}})).toBeNull();
 });
});
