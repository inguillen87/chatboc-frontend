import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:mocks.fetch}));
import {taskApi,type TaskOperation} from './taskApi';
const identity={tenantSlug:'tasks-qa',contactId:'contact-qa'};
const id='11111111-1111-4111-8111-111111111111',key='22222222-2222-4222-8222-222222222222';
const task=()=>({id,tenant_id:7,contact_id:'contact-qa',title:'Tarea',description:'',assignee_id:null,due_at:null,priority:'normal',status:'todo',revision:1,created_at:'2026-09-24T12:00:00Z',updated_at:'2026-09-24T12:00:00Z',permissions:{can_edit:true,statuses:[{value:'done',label:'Completada'}]}});
const response=(data:Record<string,unknown>)=>({contract_version:'crm.tasks.v1',tenant_slug:'tasks-qa',...data});
beforeEach(()=>{mocks.fetch.mockReset();});
describe('independent CRM task contracts',()=>{
 it('keeps an uninstalled task API unavailable without enabling a dummy workspace',async()=>{
  mocks.fetch.mockRejectedValue({status:404});expect((await taskApi.capabilities('tasks-qa')).available).toBe(false);expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('does not turn a denied capability response into a legacy fallback',async()=>{
  mocks.fetch.mockRejectedValue({status:403});await expect(taskApi.capabilities('tasks-qa')).rejects.toMatchObject({status:403});expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('requires exact organization and contract',async()=>{
  mocks.fetch.mockResolvedValue(response({tenant_slug:'other',available:true}));await expect(taskApi.capabilities('tasks-qa')).rejects.toThrow();
 });
 it('sends the immutable operation key, revision and explicit tenant',async()=>{
  mocks.fetch.mockResolvedValue(response({task:task(),receipt:{event_id:id,revision:1,key_hash:'b454f82c5857ebabf342b7258e5cf7def78b7cd975814119462973de9a38df10',replayed:false}}));
  const operation:TaskOperation={identity,key,payload:{title:'Tarea',reason:'Creación'}};
  await taskApi.execute(operation);
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/admin/tenants/tasks-qa/contacts/contact-qa/tasks',{tenantSlug:'tasks-qa',persistTenantSlug:false,method:'POST',headers:{'Idempotency-Key':key},body:operation.payload});
 });
 it.each([{}, {task:task(),receipt:{event_id:id,revision:2,replayed:false}}, {task:{...task(),contact_id:'another'},receipt:{event_id:id,revision:1,key_hash:'b454f82c5857ebabf342b7258e5cf7def78b7cd975814119462973de9a38df10',replayed:false}}])('rejects incomplete or mismatched confirmations',async raw=>{
  mocks.fetch.mockResolvedValue(response(raw));await expect(taskApi.execute({identity,key,payload:{title:'Tarea'}})).rejects.toThrow();expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('does not retry an uncertain mutation automatically',async()=>{
  mocks.fetch.mockRejectedValue(new Error('network'));await expect(taskApi.execute({identity,key,payload:{title:'Tarea'}})).rejects.toThrow();expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('preserves an explicit replay flag without inventing another revision',async()=>{
  mocks.fetch.mockResolvedValue(response({task:task(),receipt:{event_id:id,revision:1,key_hash:'b454f82c5857ebabf342b7258e5cf7def78b7cd975814119462973de9a38df10',replayed:true}}));
  expect((await taskApi.execute({identity,key,payload:{title:'Tarea'}})).receipt.replayed).toBe(true);
 });
 it('validates complete contact counts and avoids duplicate rows',async()=>{
  const body={contact_id:'contact-qa',items:[task()],total:1,counts:{todo:1,in_progress:0,done:0,cancelled:0},next_cursor:null};
  mocks.fetch.mockResolvedValue(response(body));expect((await taskApi.list(identity)).items).toHaveLength(1);
  mocks.fetch.mockResolvedValue(response({...body,items:[task(),task()]}));await expect(taskApi.list(identity)).rejects.toThrow();
  mocks.fetch.mockResolvedValue(response({...body,total:9}));await expect(taskApi.list(identity)).rejects.toThrow();
 });
 it('rejects route-shaped task ids before calling the API',async()=>{
  await expect(taskApi.detail(identity,'../other')).rejects.toThrow();expect(mocks.fetch).not.toHaveBeenCalled();
 });
});
describe('task operation proof',()=>{
 it('does not accept a receipt belonging to another request key',async()=>{
  mocks.fetch.mockResolvedValue(response({task:task(),receipt:{event_id:id,revision:1,key_hash:'f'.repeat(64),replayed:false}}));
  await expect(taskApi.execute({identity,key,payload:{title:'Tarea'}})).rejects.toThrow(/operación/);
 });
 it('rejects mismatched persisted content even with the correct receipt key',async()=>{
  const {operationKeyHash}=await import('./taskProtocol');
  mocks.fetch.mockResolvedValue(response({task:{...task(),title:'Otro contenido'},receipt:{event_id:id,revision:1,key_hash:await operationKeyHash(key),replayed:false}}));
  await expect(taskApi.execute({identity,key,payload:{title:'Tarea'}})).rejects.toThrow(/contenido/);
 });
 it('rejects impossible task metadata instead of presenting it as a valid card',async()=>{
  const body={contact_id:'contact-qa',items:[{...task(),updated_at:'yesterday'}],total:1,counts:{todo:1,in_progress:0,done:0,cancelled:0},next_cursor:null};
  mocks.fetch.mockResolvedValue(response(body));await expect(taskApi.list(identity)).rejects.toThrow();
 });
 it('requires a complete interface when the capability is enabled',async()=>{
  mocks.fetch.mockResolvedValue(response({available:true,can_create:true,ui:{title:'Tareas'},statuses:{},priorities:{}}));
  await expect(taskApi.capabilities(identity.tenantSlug)).rejects.toThrow();
 });
 it('rejects duplicate or non-monotonic history records',async()=>{
  const event={id,revision:1,actor_id:9,operation:'created',reason:'Creación',at:'2026-09-24T12:00:00Z'};
  mocks.fetch.mockResolvedValue(response({task:task(),events:[event,event],next_before_revision:null}));
  await expect(taskApi.detail(identity,id)).rejects.toThrow(/historial/);
 });
});
