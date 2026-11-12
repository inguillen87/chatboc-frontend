import {beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,reply,source} from '../../../tests/fixtures/institutional-assistant.synthetic';
const transport=vi.hoisted(()=>({fetch:vi.fn()}));
// Synthetic HTTP seam; the real contract/parser and request builder are exercised.
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>transport.fetch(...args)}));
import {askWorkspace,isKnowledgeSourceNavigation,parseAnswer} from './institutionalAssistantContract';
import {parseInstitutionalChatMessage,institutionalNumericChatAction} from '@/features/chat/institutionalChatMessage';

const answer=(w=workspace())=>({contract_version:w.contract_version,result_type:'source_navigation' as const,
  tenant:{id:w.tenant.id,slug:w.tenant.slug},revision:w.revision,nodes:[],sources:structuredClone(w.knowledge!.sources),
  text:'Podés consultar el catálogo de documentos de este espacio. Los títulos no prueban el contenido completo.',
  selection_performed:false,business_writes_performed:false});
const channel=()=>{const w=workspace({visibility:'public',can_edit:false}),a=answer(w);return {
  fuente:'institutional_knowledge_sources',knowledge_tenant:a.tenant,context_revision:a.revision,
  knowledge_sources:a.sources,message_body:a.text,
  knowledge_ui:{sources:w.ui.sources,source_details:w.ui.source_details,large_text:w.ui.large_text},
};};
beforeEach(()=>transport.fetch.mockReset());

describe('source navigation is separate from canonical content',()=>{
  it('accepts the exact authorized catalog without creating nodes or citations',()=>{
    const w=workspace(),value=answer(w),parsed=parseAnswer(value,w);
    expect(isKnowledgeSourceNavigation(parsed)).toBe(true);
    expect(parsed.nodes).toEqual([]);expect(parsed).toMatchObject({sources:w.knowledge!.sources,selection_performed:false});
    expect(value.sources[0]).not.toHaveProperty('pages');expect(value.sources[0]).not.toHaveProperty('excerpts');
  });
  it.each(['tenant','revision','hash','title','missing','duplicate','citation','selection','node','unknown-kind'])(
    'rejects source navigation with incompatible %s',field=>{
      const w=workspace(),value:any=answer(w);
      if(field==='tenant')value.tenant.id++;
      if(field==='revision')value.revision='c'.repeat(64);
      if(field==='hash')value.sources[0].sha256='c'.repeat(64);
      if(field==='title')value.sources[0].title='A title not supplied by this workspace';
      if(field==='missing')value.sources=[];
      if(field==='duplicate')value.sources.push({...value.sources[0]});
      if(field==='citation')value.sources[0].excerpts=[{page:1,text:'Invented body'}];
      if(field==='selection')value.selection_performed=true;
      if(field==='node')value.nodes=reply().nodes;
      if(field==='unknown-kind')value.result_type='other';
      expect(()=>parseAnswer(value,w)).toThrow();
    });
  it('does not accept a source-navigation response from a canonical-node GET',async()=>{
    transport.fetch.mockResolvedValue(answer());
    await expect(askWorkspace(workspace(),'admin',{node_id:'start'})).rejects.toThrow('knowledge_canonical_response_invalid');
    expect(transport.fetch).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('/nodes/start?revision='),expect.objectContaining({method:'GET'}));
  });
  it('keeps uncovered and canonical source validation unchanged',()=>{
    expect(parseAnswer({...reply(),nodes:[]},workspace()).nodes).toEqual([]);
    const bad=reply();bad.nodes[0].sources[0].sha256='e'.repeat(64);
    expect(()=>parseAnswer(bad,workspace())).toThrow('knowledge_source_changed');
    expect(isKnowledgeSourceNavigation(parseAnswer(reply(),workspace()))).toBe(false);
  });
  it('sends the navigation question once within the current private tenant and revision',async()=>{
    const w=workspace();transport.fetch.mockResolvedValue(answer(w));
    await askWorkspace(w,'admin',{node_id:'start',question:'¿Dónde puedo ver los documentos que respaldan esta información?'});
    expect(transport.fetch).toHaveBeenCalledExactlyOnceWith('/api/admin/tenants/qa-knowledge/institutional-assistant/answer',
      expect.objectContaining({method:'POST',singleAttempt:true,tenantSlug:w.tenant.slug,omitEntityToken:true,
        body:{revision:w.revision,node_id:'start',question:'¿Dónde puedo ver los documentos que respaldan esta información?'}}));
  });
});

describe('source-only channel envelope',()=>{
  it('accepts public metadata without a canonical menu or numeric action authority',()=>{
    const parsed=parseInstitutionalChatMessage(channel(),'qa-knowledge');
    expect(parsed).toMatchObject({kind:'source_navigation',nodes:[],sources:[source]});
    expect(institutionalNumericChatAction('1',parsed,'qa-knowledge')).toBeNull();
  });
  it.each(['tenant','revision','private-url','origin','duplicate','citation','canonical-node','audio','button','copy'])(
    'rejects a source-only channel envelope with incompatible %s',field=>{
      const value:any=channel();
      if(field==='tenant')value.knowledge_tenant.slug='another-tenant';
      if(field==='revision')value.context_revision='invalid';
      if(field==='private-url')Object.assign(value.knowledge_sources[0],{document_visibility:'private',url:'https://example.invalid/private'});
      if(field==='origin')value.knowledge_sources[0].origin_url='https://example.invalid/internal';
      if(field==='duplicate')value.knowledge_sources.push({...value.knowledge_sources[0]});
      if(field==='citation')value.knowledge_sources[0].pages=[1];
      if(field==='canonical-node')value.knowledge_nodes=[];
      if(field==='audio')value.knowledge_audio_reading={};
      if(field==='button')value.botones=[{texto:'Invented action',action_id:'foreign'}];
      if(field==='copy')value.knowledge_ui.sources='';
      expect(parseInstitutionalChatMessage(value,'qa-knowledge')).toBeNull();
    });
  it('keeps an empty canonical channel envelope invalid',()=>{
    expect(parseInstitutionalChatMessage({...channel(),fuente:'institutional_knowledge',knowledge_nodes:[],botones:[]},'qa-knowledge')).toBeNull();
  });
});
