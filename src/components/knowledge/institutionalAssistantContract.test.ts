import {describe,expect,it,vi,beforeEach} from 'vitest';
import {workspace,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import {parseWorkspace,parseAnswer,knowledgeEndpoint,publicKnowledgeUrl,askWorkspace,changeWorkspace} from './institutionalAssistantContract';
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
 it.each(['javascript:alert(1)','http://example.org','https://user:secret@example.org','https://example.org/#secret'])('refuses unsafe resource %s',url=>expect(publicKnowledgeUrl(url)).toBeNull());
 it('uses the real API boundary with one-attempt writes and exact revision',async()=>{
  mocks.fetch.mockResolvedValue(workspace({revision:'c'.repeat(64),visibility:'public'}));
  await changeWorkspace(workspace(),'publish');expect(mocks.fetch).toHaveBeenCalledWith('/api/admin/tenants/qa-knowledge/institutional-assistant',expect.objectContaining({method:'PUT',singleAttempt:true,body:{operation:'publish',expected_revision:'b'.repeat(64)}}));
 });
 it('sends a question to the same tenant and current node',async()=>{mocks.fetch.mockResolvedValue(reply());await askWorkspace(workspace(),'admin',{node_id:'requirements',question:'Consulta'});expect(mocks.fetch.mock.calls[0][1].body).toEqual({revision:'b'.repeat(64),node_id:'requirements',question:'Consulta'});});
});
