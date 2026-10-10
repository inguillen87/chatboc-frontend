import {describe,expect,it,vi,beforeEach} from 'vitest';
import {workspace,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import {parseWorkspace,parseAnswer,knowledgeEndpoint,publicKnowledgeUrl,knowledgeSourceOriginalAllowed,askWorkspace,changeWorkspace,loadWorkspace,type KnowledgeSource} from './institutionalAssistantContract';
beforeEach(()=>{mocks.fetch.mockReset();});
describe('native institutional workspace contract',()=>{
 it('accepts canonical sources and exact organization',()=>expect(parseWorkspace(workspace(),'qa-knowledge','admin')).toEqual(workspace()));
 it('does not expose private knowledge through public mode',()=>{expect(()=>parseWorkspace(workspace(),'qa-knowledge','public')).toThrow();});
 it.each([{tenant:{id:701,slug:'other',name:'Otra'}},{revision:'bad'},{ui:{}},{can_edit:undefined}])('rejects incoherent workspace %j',patch=>{
  expect(()=>parseWorkspace({...workspace(),...patch},'qa-knowledge','admin')).toThrow();
 });
 it('keeps a verified empty workspace distinct from fake content',()=>{
  expect(parseWorkspace(workspace({revision:null,visibility:'empty',knowledge:null}),'qa-knowledge','admin').knowledge).toBeNull();
 });
 it.each(['../bad','bad/path','','bad?query'])('refuses scope injection %s',slug=>expect(()=>knowledgeEndpoint(slug,'admin')).toThrow());
 it('requires matching revision and document hash in the answer',()=>{
  const data=reply();expect(parseAnswer(data,workspace()).nodes).toHaveLength(1);
  expect(()=>parseAnswer({...data,revision:'c'.repeat(64)},workspace())).toThrow();
  data.nodes[0].sources[0].sha256='c'.repeat(64);expect(()=>parseAnswer(data,workspace())).toThrow();
 });
 it.each([
  {source_authority:'official_norm'}, {current_validity:'official_text_observed'}, {review_status:'reviewed'},
  {provenance:'Otra procedencia'}, {origin_url:'https://example.org/otra'}, {native_revision:'otra-revision'},
  {modified_at:'2026-09-30T00:00:00Z'}, {printed_year:2025},
  {document_visibility:'private'},
 ] satisfies Partial<KnowledgeSource>[])('refuses answer evidence that changes the registered source provenance %j',patch=>{
  const model=workspace(),data=reply();data.nodes[0].sources[0]={...data.nodes[0].sources[0],...patch};
  expect(()=>parseAnswer(data,model)).toThrow('knowledge_source_changed');
 });
 it('accepts informational public answers with explicitly reserved originals',()=>{
  const data=structuredClone(workspace({visibility:'public',can_edit:false}));
  const source=data.knowledge!.sources[0];source.document_visibility='private';delete source.url;
  data.knowledge!.initial.sources=[source];
  expect(parseWorkspace(data,'qa-knowledge','public')).toBe(data);
  expect(knowledgeSourceOriginalAllowed(source,'public')).toBe(false);
  expect(knowledgeSourceOriginalAllowed(source,'admin')).toBe(true);
 });
 it('keeps an omitted URL invalid for legacy or explicitly public sources',()=>{
  for(const visibility of [undefined,'public'] as const){const data=structuredClone(workspace());const source=data.knowledge!.sources[0];delete source.url;source.document_visibility=visibility;
   expect(()=>parseWorkspace(data,'qa-knowledge','admin')).toThrow();}
 });
 it.each(['restricted',null,7])('refuses an unknown original visibility %j',visibility=>{
  const data=structuredClone(workspace());(data.knowledge!.sources[0] as any).document_visibility=visibility;
  expect(()=>parseWorkspace(data,'qa-knowledge','admin')).toThrow();
 });
 it.each(['document_visibility','publicly_accessible'] as const)('binds the answer to registered delivery %s',key=>{
  const data=structuredClone(workspace()),answer=reply();const delivery={contract_version:'chatboc.knowledge_source_delivery.v1' as const,format:'pdf' as const,mime_type:'application/pdf',sha256:data.knowledge!.sources[0].sha256,filename:'document.pdf'};
  data.knowledge!.sources[0].delivery=delivery;data.knowledge!.initial.sources=[data.knowledge!.sources[0]];
  answer.nodes[0].sources[0].delivery={...delivery,...(key==='document_visibility'?{document_visibility:'private' as const}:{publicly_accessible:false})};
  expect(()=>parseAnswer(answer,data)).toThrow('knowledge_source_changed');
 });
 it.each(['javascript:alert(1)','http://example.org','https://user:secret@example.org','https://example.org/#secret'])('refuses unsafe resource %s',url=>expect(publicKnowledgeUrl(url)).toBeNull());
 it('uses the real API boundary with one-attempt writes and exact revision',async()=>{
  mocks.fetch.mockResolvedValue(workspace({revision:'c'.repeat(64),visibility:'public'}));
  await changeWorkspace(workspace(),'publish');expect(mocks.fetch).toHaveBeenCalledWith('/api/admin/tenants/qa-knowledge/institutional-assistant',expect.objectContaining({method:'PUT',singleAttempt:true,body:{operation:'publish',expected_revision:'b'.repeat(64)}}));
 });
 it('allows receipt-backed recovery for canonical reads while questions and writes stay single-attempt',async()=>{
  mocks.fetch.mockResolvedValueOnce(workspace()).mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply()).mockResolvedValueOnce(workspace());
  await loadWorkspace('qa-knowledge','admin');await askWorkspace(workspace(),'admin',{node_id:'requirements'});await askWorkspace(workspace(),'admin',{node_id:'requirements',question:'Consulta'});await changeWorkspace(workspace(),'publish');
  for(const [,options]of mocks.fetch.mock.calls.slice(0,2))expect(options).toMatchObject({method:'GET',singleAttempt:true,allowStartupRecovery:true});
  for(const [,options]of mocks.fetch.mock.calls.slice(2)){expect(options.singleAttempt).toBe(true);expect(options.allowStartupRecovery).not.toBe(true);}
 });
 it.each(['admin','public'] as const)('reads a canonical %s node with exact revision and without an answer POST',async mode=>{
  mocks.fetch.mockResolvedValue(reply());await askWorkspace(workspace(),mode,{node_id:'requirements'});
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(`/api/${mode}/tenants/qa-knowledge/institutional-assistant/nodes/requirements?revision=${'b'.repeat(64)}`,
    expect.objectContaining({method:'GET',allowStartupRecovery:true}));
  expect(mocks.fetch.mock.calls[0][1].body).toBeUndefined();
  if(mode==='public')expect(mocks.fetch.mock.calls[0][1]).toMatchObject({skipAuth:true,omitCredentials:true});
 });
 it.each(['selection','node','count'])('rejects a canonical GET response with incompatible %s',async field=>{
  const data=reply();if(field==='selection')data.selection_performed=true;if(field==='node')data.nodes[0].id='other';if(field==='count')data.nodes=[];
  mocks.fetch.mockResolvedValue(data);await expect(askWorkspace(workspace(),'admin',{node_id:'requirements'})).rejects.toThrow('knowledge_canonical_response_invalid');
 });
 it('sends a question to the same tenant and current node',async()=>{mocks.fetch.mockResolvedValue(reply());await askWorkspace(workspace(),'admin',{node_id:'requirements',question:'Consulta'});expect(mocks.fetch.mock.calls[0][1].body).toEqual({revision:'b'.repeat(64),node_id:'requirements',question:'Consulta'});});
 it('keeps every private knowledge operation on session authority without inheriting a public widget token',async()=>{
  mocks.fetch.mockResolvedValueOnce(workspace()).mockResolvedValueOnce(reply()).mockResolvedValueOnce(workspace());
  await loadWorkspace('qa-knowledge','admin');await askWorkspace(workspace(),'admin',{node_id:'requirements'});await changeWorkspace(workspace(),'publish');
  for(const [path,options] of mocks.fetch.mock.calls){
   expect(path).toMatch(/^\/api\/admin\/tenants\/qa-knowledge\/institutional-assistant/);
   expect(options).toMatchObject({tenantSlug:'qa-knowledge',omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,persistTenantSlug:false});
   expect(options.skipAuth).not.toBe(true);
  }
 });
});
