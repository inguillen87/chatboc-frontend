import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import {readInstitutionalAudio,readInstitutionalAudioReading,type InstitutionalAudioScope} from './institutionalAssistantAudio';
const scope:InstitutionalAudioScope={tenant:{id:701,slug:'qa-knowledge'},revision:'b'.repeat(64),nodeIds:['start']};
const bytes=new Uint8Array([0x49,0x44,0x33,4,0,0,0,0,0,2,1,2]);
const headers=()=>({'Content-Type':'audio/mpeg','Content-Length':String(bytes.length),'X-Chatboc-Knowledge-Revision':scope.revision,'X-Chatboc-Tenant-ID':'701'});
const options=()=>({signal:new AbortController().signal,isCurrent:()=>true});
beforeEach(()=>mocks.fetch.mockReset());
afterEach(()=>vi.restoreAllMocks());
describe('canonical institutional audio read',()=>{
  it('requests only published revision-bound nodes without caller text, credentials or retries',async()=>{
    mocks.fetch.mockResolvedValue(new Response(bytes,{headers:headers()}));
    expect((await readInstitutionalAudio(scope,options())).size).toBe(bytes.length);
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith('/api/public/tenants/qa-knowledge/institutional-assistant/audio',expect.objectContaining({
      responseType:'response',method:'POST',body:{revision:scope.revision,node_ids:['start']},headers:{Accept:'audio/mpeg'},
      tenantSlug:'qa-knowledge',singleAttempt:true,skipAuth:true,omitCredentials:true,omitEntityToken:true,omitChatSessionId:true,
      isWidgetRequest:false,persistTenantSlug:false,cache:'no-store',
    }));
  });
  it.each(['tenant','revision','mime','length','magic'])('refuses %s mismatch without returning playable bytes',async fault=>{
    const h=headers();let data=bytes;
    if(fault==='tenant')h['X-Chatboc-Tenant-ID']='702';if(fault==='revision')h['X-Chatboc-Knowledge-Revision']='c'.repeat(64);
    if(fault==='mime')h['Content-Type']='text/html';if(fault==='length')h['Content-Length']=String(bytes.length+1);
    if(fault==='magic'){data=new TextEncoder().encode('<html>error</html>');h['Content-Length']=String(data.length);}
    mocks.fetch.mockResolvedValue(new Response(data,{headers:h}));
    await expect(readInstitutionalAudio(scope,options())).rejects.toThrow('knowledge_audio_response_invalid');
  });
  it.each([[],['start','start'],['a','b','c','d'],['../secret']].map(nodeIds=>({nodeIds})))('rejects invalid node IDs before HTTP',async({nodeIds})=>{
    await expect(readInstitutionalAudio({...scope,nodeIds},options())).rejects.toThrow('knowledge_audio_scope_invalid');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('bounds streamed bytes even when Content-Length is absent',async()=>{
    const h=headers();delete (h as Partial<typeof h>)['Content-Length'];
    mocks.fetch.mockResolvedValue(new Response(new Uint8Array(4*1024*1024+1),{headers:h}));
    await expect(readInstitutionalAudio(scope,options())).rejects.toThrow('knowledge_audio_response_invalid');
  });
  it.each(['answer','signal','session'] as const)('discards a late body after %s retirement',async cause=>{
    let current=true,release!:()=>void;const controller=new AbortController();
    const stream=new ReadableStream<Uint8Array>({start(body){release=()=>{body.enqueue(bytes);body.close();};}});
    mocks.fetch.mockResolvedValue(new Response(stream,{headers:headers()}));
    const result=readInstitutionalAudio(scope,{signal:controller.signal,isCurrent:()=>current});
    await vi.waitFor(()=>expect(mocks.fetch).toHaveBeenCalledOnce());
    if(cause==='signal')controller.abort();else if(cause==='session')advanceChatbocSessionRevision();else current=false;
    release();await expect(result).rejects.toThrow('knowledge_audio_retired');
  });
  it('requires complete backend copy before exposing audio controls',()=>{
    const copy={contract_version:'chatboc.institutional_audio.v1',listen:'Escuchar',pause:'Pausar',resume:'Continuar',stop:'Detener',loading:'Preparando',error:'Podés seguir leyendo',disclosure:'Voz generada con IA'};
    expect(readInstitutionalAudioReading(copy)).toEqual(copy);
    for(const invalid of [undefined,{}, {...copy,stop:' '},{...copy,contract_version:'other'}])expect(readInstitutionalAudioReading(invalid)).toBeNull();
  });
});
