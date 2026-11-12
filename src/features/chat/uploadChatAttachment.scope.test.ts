import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ApiError,apiFetch} from '@/utils/api';
import {uploadChatAttachment} from './uploadChatAttachment';

vi.mock('@/utils/api',async(importOriginal)=>{
  const actual=await importOriginal<typeof import('@/utils/api')>();
  return {...actual,apiFetch:vi.fn()};
});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;let reject!:(error:unknown)=>void;
  const promise=new Promise<T>((ok,no)=>{resolve=ok;reject=no;});return {promise,resolve,reject};};
const file=new File(['synthetic-audio'],'nota.webm',{type:'audio/webm'});
const form=()=>{const value=new FormData();value.append('file',file);return value;};
const prepared={ok:true,contract_version:'chat.attachment.direct.v1',operation:'prepare_direct_upload',
  upload_id:'synthetic-upload',intent_token:'synthetic-intent',
  upload:{method:'PUT',url:'https://objects.example.test/synthetic-only',headers:{'Content-Type':'audio/webm'},expires_in_seconds:300},
  constraints:{max_file_bytes:1024,exact_size_required:true}};

describe('audio upload retirement between transport stages',()=>{
  const api=vi.mocked(apiFetch),put=vi.fn();
  let current:boolean;
  const context=()=>({tenantSlug:'scope-a',isCurrent:()=>current});
  beforeEach(()=>{current=true;api.mockReset();put.mockReset();vi.stubGlobal('fetch',put);});
  afterEach(()=>vi.unstubAllGlobals());
  it('does not start an upload after the recording owner retires',async()=>{
    current=false;
    await expect(uploadChatAttachment('/archivos/upload/chat_attachment',form,context())).rejects.toMatchObject({name:'AbortError'});
    expect(api).not.toHaveBeenCalled();expect(put).not.toHaveBeenCalled();
  });
  it('does not release audio bytes after a delayed prepare ACK for a retired owner',async()=>{
    const prepare=deferred<unknown>();api.mockReturnValueOnce(prepare.promise);
    const pending=uploadChatAttachment('/archivos/upload/chat_attachment',form,context());
    current=false;prepare.resolve(prepared);
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    expect(api).toHaveBeenCalledTimes(1);expect(put).not.toHaveBeenCalled();
  });
  it('does not start an alias or legacy fallback after a delayed compatibility error',async()=>{
    const prepare=deferred<unknown>();api.mockReturnValueOnce(prepare.promise);
    const pending=uploadChatAttachment('/archivos/upload/chat_attachment',form,context());
    current=false;prepare.reject(new ApiError('synthetic missing',404,{}));
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    expect(api).toHaveBeenCalledTimes(1);expect(put).not.toHaveBeenCalled();
  });
  it('does not commit audio after the already dispatched object PUT resolves late',async()=>{
    const object=deferred<Response>();api.mockResolvedValueOnce(prepared);
    put.mockReturnValueOnce(object.promise);
    const pending=uploadChatAttachment('/archivos/upload/chat_attachment',form,context());
    await vi.waitFor(()=>expect(put).toHaveBeenCalledTimes(1));
    current=false;object.resolve(new Response('',{status:200}));
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('rejects a delayed legacy ACK instead of accepting it for a retired owner',async()=>{
    const upload=deferred<unknown>();api.mockReturnValueOnce(upload.promise);
    const pending=uploadChatAttachment('/legacy/upload',form,context());
    current=false;upload.resolve({ok:true});
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('passes the recording owner to every application request',async()=>{
    api.mockResolvedValueOnce(prepared).mockResolvedValueOnce({ok:true});
    put.mockResolvedValueOnce(new Response('',{status:200}));
    const bound=context();await uploadChatAttachment('/archivos/upload/chat_attachment',form,bound);
    expect(api).toHaveBeenCalledTimes(2);
    for(const [,options] of api.mock.calls)expect(options?.isCurrent).toBe(bound.isCurrent);
  });
  it('preserves a current prepare, object PUT and confirmed completion',async()=>{
    api.mockResolvedValueOnce(prepared).mockResolvedValueOnce({ok:true,id:123});
    put.mockResolvedValueOnce(new Response('',{status:200}));
    await expect(uploadChatAttachment('/archivos/upload/chat_attachment',form,context())).resolves.toEqual({ok:true,id:123});
    expect(api).toHaveBeenCalledTimes(2);expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1]).toMatchObject({credentials:'omit',referrerPolicy:'no-referrer'});
  });
  it('preserves the current canonical to alias to legacy compatibility path',async()=>{
    api.mockRejectedValueOnce(new ApiError('synthetic missing',404,{}))
      .mockRejectedValueOnce(new ApiError('synthetic missing',404,{})).mockResolvedValueOnce({ok:true});
    await expect(uploadChatAttachment('/archivos/upload/chat_attachment',form,context())).resolves.toEqual({ok:true});
    expect(api).toHaveBeenCalledTimes(3);expect(put).not.toHaveBeenCalled();
  });
});
