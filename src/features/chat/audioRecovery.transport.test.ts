import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('@/config',async original=>({...await original<typeof import('@/config')>(),API_BASE_CANDIDATES:['/api','https://unused.example.test/api'],BASE_API_URL:'/api',SAME_ORIGIN_PROXY_BASE:'/api'}));
vi.mock('@/utils/api',async()=>await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
import {createChatBootstrapAudioAttempt} from './chatApi';
import {createChatAttachmentUploadAttempt} from './uploadChatAttachment';
import {resetBackendBootstrapGateForTests} from '@/utils/backendBootstrapGate';
import {usePanelSessionStore,useWidgetSessionStore} from '@/stores';
import {safeLocalStorage} from '@/utils/safeLocalStorage';
import {captureWidgetRequestAuthority} from '@/utils/api';
import type {WidgetConversationHandle} from '@/utils/widgetConversationScope';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const bootstrap=()=>({contract_version:'demo.chat_bootstrap.v1',endpoint:'/api/ask/municipio',method:'POST',
  query:{revision:'original'},payload:{tipo_chat:'municipio',tenant_slug:'synthetic-tdf'},session:{chat_session_id:'frozen-audio-session'}});
const prepare={ok:true,contract_version:'chat.attachment.direct.v1',operation:'prepare_direct_upload',upload_id:'synthetic-upload',intent_token:'same-synthetic-intent',
  upload:{method:'PUT',url:'https://objects.example.test/synthetic-audio',headers:{'Content-Type':'audio/webm'},expires_in_seconds:300},constraints:{max_file_bytes:1024,exact_size_required:true}};
beforeEach(()=>{
  safeLocalStorage.clear();window.sessionStorage.clear();usePanelSessionStore.setState({authToken:null,user:null});
  useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();resetBackendBootstrapGateForTests();});

describe('audio recovery with the actual API transport and synthetic HTTP',()=>{
  it('does not fall through API bases on a lost municipal ACK and preserves the original form, method, query, session and key on explicit reconciliation',async()=>{
    const transport=vi.fn().mockRejectedValueOnce(new TypeError('synthetic_network_loss')).mockResolvedValueOnce(json({message_body:'replayed'}));vi.stubGlobal('fetch',transport);
    const config=bootstrap(),attempt=createChatBootstrapAudioAttempt(config,{text:'consulta',audioBlob:new Blob(['synthetic-bytes'],{type:'audio/webm'}),audioFilename:'unchanged.webm'});
    let failure:unknown;try{await attempt.run();}catch(error){failure=error;}
    expect(transport).toHaveBeenCalledOnce();expect(attempt.canRetry(failure)).toBe(true);
    config.method='PUT';config.endpoint='/api/ask/pyme';config.query.revision='mutated';config.session.chat_session_id='new-session';
    await expect(attempt.run()).resolves.toMatchObject({message_body:'replayed'});expect(transport).toHaveBeenCalledTimes(2);
    const [firstUrl,first]=transport.mock.calls[0], [secondUrl,second]=transport.mock.calls[1];
    expect(secondUrl).toBe(firstUrl);expect(String(firstUrl)).toContain('/ask/municipio');expect(String(firstUrl)).toContain('revision=original');
    expect(first.method).toBe('POST');expect(second.method).toBe('POST');expect(second.body).toBe(first.body);
    expect((first.body as FormData).get('chat_session_id')).toBe('frozen-audio-session');expect((first.body as FormData).get('audio_file')).toMatchObject({name:'unchanged.webm',type:'audio/webm',size:15});
    expect(new Headers(second.headers).get('Idempotency-Key')).toBe(new Headers(first.headers).get('Idempotency-Key'));
    expect(attempt.canRetry(failure)).toBe(false);
  });
  it('uses only the chosen PYME destination after an uncertain POST and does not offer reconciliation',async()=>{
    const transport=vi.fn().mockRejectedValue(new TypeError('synthetic_network_loss'));vi.stubGlobal('fetch',transport);
    const config={...bootstrap(),endpoint:'/api/ask/pyme',payload:{tipo_chat:'pyme',tenant_slug:'synthetic-tdf'}};
    const attempt=createChatBootstrapAudioAttempt(config,{audioBlob:new Blob(['synthetic-bytes'],{type:'audio/webm'})});
    let failure:unknown;try{await attempt.run();}catch(error){failure=error;}
    expect(transport).toHaveBeenCalledOnce();expect(attempt.canRetry(failure)).toBe(false);
  });
  it('keeps direct completion POST on the same signed intent, without alias fallthrough, new prepare or a second object PUT',async()=>{
    const transport=vi.fn().mockResolvedValueOnce(json(prepare)).mockResolvedValueOnce(new Response('',{status:200}))
      .mockResolvedValueOnce(json({error:'completion_unavailable'},503)).mockResolvedValueOnce(json({ok:true,url:'/synthetic-audio',id:7}));vi.stubGlobal('fetch',transport);
    const form=()=>{const value=new FormData();value.append('file',new Blob(['synthetic-bytes'],{type:'audio/webm'}),'unchanged.webm');return value;};
    const attempt=createChatAttachmentUploadAttempt('/archivos/upload/chat_attachment',form,{tenantSlug:'synthetic-tdf'});
    let failure:unknown;try{await attempt.run();}catch(error){failure=error;}
    expect(transport).toHaveBeenCalledTimes(3);expect(attempt.canRetry(failure)).toBe(true);
    await expect(attempt.run()).resolves.toMatchObject({id:7});expect(transport).toHaveBeenCalledTimes(4);
    const completion=transport.mock.calls[2],reconciliation=transport.mock.calls[3];expect(reconciliation[0]).toBe(completion[0]);
    expect(JSON.parse(completion[1].body)).toEqual({operation:'complete_direct_upload',intent_token:'same-synthetic-intent'});
    expect(reconciliation[1].body).toBe(completion[1].body);expect(transport.mock.calls.filter(([,request])=>request.method==='PUT')).toHaveLength(1);
  });
  it('retires the attempt before another transport dispatch when identity changes after the first unacknowledged request',async()=>{
    const transport=vi.fn().mockRejectedValue(new TypeError('synthetic_network_loss'));vi.stubGlobal('fetch',transport);
    const attempt=createChatBootstrapAudioAttempt(bootstrap(),{audioBlob:new Blob(['synthetic-bytes'],{type:'audio/webm'})});
    let failure:unknown;try{await attempt.run();}catch(error){failure=error;}
    safeLocalStorage.setItem('chatboc_anon_id','different-synthetic-identity');expect(attempt.canRetry(failure)).toBe(false);
    await expect(attempt.run()).rejects.toMatchObject({name:'AbortError'});expect(transport).toHaveBeenCalledOnce();
  });
  it('uses explicit scoped headers and anonymous policy through prepare and completion recovery without the legacy session',async()=>{
    const transport=vi.fn().mockResolvedValueOnce(json(prepare)).mockResolvedValueOnce(new Response('',{status:200}))
      .mockRejectedValueOnce(new TypeError('synthetic_completion_ack_lost')).mockResolvedValueOnce(json({ok:true,id:7}));
    vi.stubGlobal('fetch',transport);
    safeLocalStorage.setItem('chat_session_id','11111111-1111-4111-8111-111111111111');
    const owner={scopeKey:'synthetic-owned-scope',tenantSlug:'synthetic-tdf',
      sessionId:'22222222-2222-4222-8222-222222222222',anonId:'synthetic-owned-anon',
      isCurrent:()=>true,retire:()=>false,adoptConfirmed:()=>false,
      authority:captureWidgetRequestAuthority({skipAuth:true,omitCredentials:true})} satisfies WidgetConversationHandle;
    const form=()=>{const value=new FormData();value.append('file',new Blob(['synthetic-bytes'],{type:'audio/webm'}),'owned.webm');return value;};
    const attempt=createChatAttachmentUploadAttempt('/archivos/upload/chat_attachment',form,{
      tenantSlug:owner.tenantSlug,chatSessionId:owner.sessionId,anonId:owner.anonId,
      conversationOwner:owner,isCurrent:()=>true,skipAuth:true,omitCredentials:true,
    });
    const failure=await attempt.run().catch(error=>error);
    safeLocalStorage.setItem('chat_session_id','33333333-3333-4333-8333-333333333333');
    expect(attempt.canRetry(failure)).toBe(true);
    await expect(attempt.run()).resolves.toMatchObject({id:7});
    expect(transport).toHaveBeenCalledTimes(4);
    const applicationRequests=transport.mock.calls.filter(([,options])=>options.method==='POST');
    expect(applicationRequests).toHaveLength(3);
    for(const [,options] of applicationRequests){
      const headers=new Headers(options.headers);
      expect(headers.get('X-Chat-Session-Id')).toBe(owner.sessionId);
      expect(headers.get('X-Anon-Id')).toBe(owner.anonId);
      expect(headers.has('Authorization')).toBe(false);
      expect(options.credentials).toBe('omit');
    }
    expect(transport.mock.calls.filter(([,options])=>options.method==='PUT')).toHaveLength(1);
    expect(applicationRequests[2][1].body).toBe(applicationRequests[1][1].body);
  });
});
