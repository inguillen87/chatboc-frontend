import {webcrypto} from 'node:crypto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import type {KnowledgeSource,KnowledgeSourceFormat} from './institutionalAssistantContract';
import {safeLocalStorage} from '@/utils/safeLocalStorage';
import {usePanelSessionStore} from '@/stores';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import {readKnowledgeSource,knowledgeSourceReadMessage} from './institutionalAssistantSource';
const bytes={pdf:new TextEncoder().encode('%PDF-1.7\nSynthetic local document'),jpeg:new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,0xff,0xd9]),text:new TextEncoder().encode('<script>LOCAL_SENTINEL</script>\nTexto extraído')};
const mime={pdf:'application/pdf',jpeg:'image/jpeg',text:'text/plain'};
async function fixture(format:KnowledgeSourceFormat='pdf'){
 const data=bytes[format];const sha256=Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
 const source:KnowledgeSource={id:'synthetic-source',title:'Documento de prueba local',sha256,page_count:1,url:null,format,mime_type:mime[format],byte_size:data.length,pagination:format==='pdf'?'native':'logical_snapshot',delivery:{contract_version:'chatboc.knowledge_source_delivery.v1',format,mime_type:mime[format],sha256,byte_size:data.length,filename:'documento.'+(format==='jpeg'?'jpg':format==='text'?'txt':'pdf')}};
 const model=workspace();model.knowledge!.sources=[source];model.knowledge!.initial.sources=[source];return {model,source,data};
}
const response=(data:Uint8Array,type:string)=>new Response(data,{headers:{'Content-Type':type,'Content-Length':String(data.length)}});
beforeEach(()=>{mocks.fetch.mockReset();vi.stubGlobal('crypto',webcrypto);safeLocalStorage.clear();usePanelSessionStore.setState({authToken:null,user:null});});
afterEach(()=>{vi.unstubAllGlobals();safeLocalStorage.clear();usePanelSessionStore.setState({authToken:null,user:null});});
describe('tenant/revision-bound source delivery',()=>{
 it.each(['pdf','jpeg','text'] as const)('opens %s only after format, MIME, size and SHA checks',async format=>{
  const {model,source,data}=await fixture(format);mocks.fetch.mockResolvedValue(response(data,mime[format]+(format==='text'?'; charset=utf-8':'')));
  const result=await readKnowledgeSource(model,source,'admin',{isCurrent:()=>true});expect(result.format).toBe(format);expect(result.blob.size).toBe(data.length);expect(result.filename).toBe(source.delivery!.filename);
  expect(result.text).toBe(format==='text'?new TextDecoder().decode(data):null);
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(`/api/admin/tenants/qa-knowledge/institutional-assistant/sources/synthetic-source?revision=${model.revision}`,expect.objectContaining({responseType:'response',method:'GET',tenantSlug:'qa-knowledge',persistTenantSlug:false,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,singleAttempt:true,allowStartupRecovery:true,cache:'no-store'}));
 });
 it.each(['mime','sha','size','magic'])('rejects an unverified %s without returning a downloadable document',async fault=>{
  const {model,source,data}=await fixture();let body=data;if(fault==='sha'){body=data.slice();body[10]^=1;}if(fault==='magic')body=new TextEncoder().encode('HTML: untrusted');
  const headers={'Content-Type':fault==='mime'?'text/html':'application/pdf','Content-Length':String(fault==='size'?data.length+1:body.length)};mocks.fetch.mockResolvedValue(new Response(body,{headers}));
  await expect(readKnowledgeSource(model,source,'admin',{isCurrent:()=>true})).rejects.toMatchObject({reason:'invalid'});
 });
 it('refuses a foreign source or malformed delivery before any HTTP request',async()=>{
  const {model,source}=await fixture();await expect(readKnowledgeSource(model,{...source,id:'foreign'},'admin',{isCurrent:()=>true})).rejects.toMatchObject({reason:'unavailable'});
  await expect(readKnowledgeSource(model,{...source,delivery:{...source.delivery!,mime_type:'text/html'}},'admin',{isCurrent:()=>true})).rejects.toMatchObject({reason:'unavailable'});expect(mocks.fetch).not.toHaveBeenCalled();
 });
 it('never sends panel credentials for a published public document',async()=>{
  const {model,source,data}=await fixture();model.visibility='public';model.can_edit=false;mocks.fetch.mockResolvedValue(response(data,'application/pdf'));
  await readKnowledgeSource(model,source,'public',{isCurrent:()=>true});expect(mocks.fetch.mock.calls[0][1]).toMatchObject({skipAuth:true,omitCredentials:true});
  model.visibility='private';await expect(readKnowledgeSource(model,source,'public',{isCurrent:()=>true})).rejects.toMatchObject({reason:'unavailable'});expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it.each(['session','actor','token','scope','unmount'] as const)('discards bytes when %s retires while its body is pending',async cause=>{
  const {model,source,data}=await fixture();let current=true;let release!:()=>void;let cancel=false;
  const stream=new ReadableStream<Uint8Array>({start(controller){release=()=>{controller.enqueue(data);controller.close();};},cancel(){cancel=true;}});
  mocks.fetch.mockResolvedValue(new Response(stream,{headers:{'Content-Type':'application/pdf','Content-Length':String(data.length)}}));
  const read=readKnowledgeSource(model,source,'admin',{isCurrent:()=>current});await vi.waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());
  if(cause==='session')advanceChatbocSessionRevision();else if(cause==='actor')usePanelSessionStore.setState({user:{id:'other-actor'} as any});else if(cause==='token')usePanelSessionStore.setState({authToken:'synthetic-other-token'});else current=false;
  release();await expect(read).rejects.toMatchObject({reason:'retired'});expect(mocks.fetch).toHaveBeenCalledOnce();expect(cancel||stream.locked===false).toBe(true);
 });
 it('uses bounded streaming and refuses bytes beyond the maximum even without Content-Length',async()=>{
  const {model,source}=await fixture();mocks.fetch.mockResolvedValue(new Response(new Uint8Array(8*1024*1024+1),{headers:{'Content-Type':'application/pdf'}}));
  await expect(readKnowledgeSource(model,source,'admin',{isCurrent:()=>true})).rejects.toMatchObject({reason:'invalid'});
 });
 it.each([401,403,404,412,503])('keeps status %i visible through a sanitized explanation without provider detail',async status=>{
  const {model,source}=await fixture();const error={status,message:'PRIVATE_PROVIDER_BODY'};mocks.fetch.mockRejectedValue(error);await expect(readKnowledgeSource(model,source,'admin',{isCurrent:()=>true})).rejects.toBe(error);
  expect(knowledgeSourceReadMessage(error)).not.toContain('PRIVATE_PROVIDER_BODY');expect(mocks.fetch).toHaveBeenCalledOnce();
 });
});
