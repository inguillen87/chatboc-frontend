import {apiFetch} from '@/utils/api';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent} from '@/utils/chatbocSessionRevision';
import {knowledgeEndpoint} from './institutionalAssistantContract';
export {readInstitutionalAudioReading} from './institutionalAssistantContract';
export type {InstitutionalAudioReading} from './institutionalAssistantContract';
export interface InstitutionalAudioScope {tenant:{id:number;slug:string};revision:string;nodeIds:string[]}
const MAX_BYTES=4*1024*1024;

/** The browser requests canonical published nodes, never caller-supplied speech. */
export async function readInstitutionalAudio(scope:InstitutionalAudioScope,
  options:{signal:AbortSignal;isCurrent:()=>boolean}):Promise<Blob> {
  if(!Number.isSafeInteger(scope.tenant.id)||scope.tenant.id<1||!/^[a-f0-9]{64}$/.test(scope.revision)||
    !Array.isArray(scope.nodeIds)||scope.nodeIds.length<1||scope.nodeIds.length>3||new Set(scope.nodeIds).size!==scope.nodeIds.length||
    !scope.nodeIds.every(id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(id)))throw new Error('knowledge_audio_scope_invalid');
  const sessionRevision=captureChatbocSessionRevision();
  const isCurrent=()=>options.isCurrent()&&!options.signal.aborted&&isChatbocSessionRevisionCurrent(sessionRevision);
  const assertCurrent=()=>{if(!isCurrent())throw new Error('knowledge_audio_retired');};
  assertCurrent();
  const response=await apiFetch(knowledgeEndpoint(scope.tenant.slug,'public')+'/audio',{
    responseType:'response',method:'POST',body:{revision:scope.revision,node_ids:scope.nodeIds},
    headers:{Accept:'audio/mpeg'},tenantSlug:scope.tenant.slug,cache:'no-store',singleAttempt:true,
    omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,persistTenantSlug:false,
    skipAuth:true,omitCredentials:true,signal:options.signal,isCurrent,
  });
  assertCurrent();
  const mime=response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  const length=response.headers.get('Content-Length');
  if(!response.ok||mime!=='audio/mpeg'||response.headers.get('X-Chatboc-Knowledge-Revision')!==scope.revision||
    response.headers.get('X-Chatboc-Tenant-ID')!==String(scope.tenant.id)||
    (length!==null&&(!/^\d+$/.test(length)||Number(length)<1||Number(length)>MAX_BYTES)))throw new Error('knowledge_audio_response_invalid');
  const reader=response.body?.getReader();if(!reader)throw new Error('knowledge_audio_response_invalid');
  const chunks:Uint8Array[]=[];let size=0;
  try{
    while(true){assertCurrent();const chunk=await reader.read();assertCurrent();if(chunk.done)break;
      size+=chunk.value.byteLength;if(size>MAX_BYTES)throw new Error('knowledge_audio_response_invalid');chunks.push(chunk.value);}
  }catch(cause){await reader.cancel().catch(()=>{});throw cause;}
  finally{reader.releaseLock();}
  if(!size||(length!==null&&size!==Number(length)))throw new Error('knowledge_audio_response_invalid');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  // MP3 may begin with an ID3 tag or a MPEG audio frame sync. Reject HTML/JSON
  // error bodies even when an intermediary supplied misleading MIME headers.
  const id3=bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33;
  const frame=bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0;
  if(!id3&&!frame)throw new Error('knowledge_audio_response_invalid');
  assertCurrent();return new Blob([bytes],{type:'audio/mpeg'});
}
