import {apiFetch} from '@/utils/api';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent} from '@/utils/chatbocSessionRevision';
import {isKnowledgeSource,sameKnowledgeSourceIdentity,knowledgeEndpoint,knowledgeSourceOriginalAllowed,type KnowledgeSource,type KnowledgeWorkspace} from './institutionalAssistantContract';
import {usePanelSessionStore} from '@/stores';
import {safeLocalStorage} from '@/utils/safeLocalStorage';

const MAX_BYTES=8*1024*1024;
export class KnowledgeSourceReadError extends Error {
  constructor(public readonly reason:'unavailable'|'invalid'|'retired'){super(`knowledge_source_${reason}`);this.name='KnowledgeSourceReadError';}
}
export interface KnowledgeSourceDocument {blob:Blob;text:string|null;filename:string;format:'pdf'|'jpeg'|'text'}

const sourceTransportKeys=['authToken','authProvider','clerkUserId','clerkSessionTransport'];
const canonicalAuthorityValue=(value:unknown):unknown=>Array.isArray(value)?value.map(canonicalAuthorityValue):
  value&&typeof value==='object'?Object.keys(value).sort().map(key=>[key,canonicalAuthorityValue((value as Record<string,unknown>)[key])]):value??null;
const actorAuthority=(value:unknown)=>{
  const actor=value&&typeof value==='object'?value as Record<string,unknown>:{};
  const grants=(item:unknown)=>Array.isArray(item)&&item.every(entry=>typeof entry==='string')
    ?Array.from(new Set(item)).sort():canonicalAuthorityValue(item);
  return JSON.stringify([actor.id,actor.user_id,actor.clerk_user_id,actor.sub,actor.email,actor.role,actor.rol,
    actor.tenant_slug,actor.tenantSlug,...['permissions','capabilities','scopes'].map(key=>grants(actor[key]))]);
};
const storedActorAuthority=(value:string|null)=>{
  try{return actorAuthority(JSON.parse(value??'null'));}catch{return 'invalid_stored_source_authority';}
};

/** Private comparison only: never log these transport/authority values. */
export function captureKnowledgeSourceAuthority():string {
  const panel=usePanelSessionStore.getState();
  return JSON.stringify([panel.authToken,actorAuthority(panel.user),storedActorAuthority(safeLocalStorage.getItem('user')),
    ...sourceTransportKeys.map(key=>safeLocalStorage.getItem(key))]);
}

/** Observe each transition synchronously, including A -> B -> A before render. */
export function subscribeKnowledgeSourceAuthority(listener:()=>void):()=>void {
  let authority=captureKnowledgeSourceAuthority();
  const changed=(transition=false)=>{
    const next=captureKnowledgeSourceAuthority();
    const retired=transition||next!==authority;authority=next;
    if(retired)listener();
  };
  const unsubscribePanel=usePanelSessionStore.subscribe(()=>changed());
  const storageChanged=(event:StorageEvent)=>{
    try{if(event.storageArea!==window.localStorage)return;}catch{return;}
    // Native storage events can arrive after another tab has already restored A.
    // Compare the projected event values as well as the currently stored value.
    const transition=event.key===null||event.key==='user'
      ?event.key===null||storedActorAuthority(event.oldValue)!==storedActorAuthority(event.newValue)
      :sourceTransportKeys.includes(event.key)&&event.oldValue!==event.newValue;
    changed(transition);
  };
  if(typeof window!=='undefined')window.addEventListener('storage',storageChanged);
  return()=>{unsubscribePanel();if(typeof window!=='undefined')window.removeEventListener('storage',storageChanged);};
}

/** One tenant/revision-bound read through the ordinary authenticated API. */
export async function readKnowledgeSource(workspace:KnowledgeWorkspace,source:KnowledgeSource,mode:'admin'|'public',
  options:{isCurrent:()=>boolean;signal?:AbortSignal}):Promise<KnowledgeSourceDocument>{
  const registered=workspace.knowledge?.sources.find(item=>item.id===source.id);
  if(!workspace.revision||!/^[a-f0-9]{64}$/.test(workspace.revision)||!isKnowledgeSource(source)||!source.delivery||
    !registered||!sameKnowledgeSourceIdentity(registered,source)||
    !knowledgeSourceOriginalAllowed(source,mode)||
    (mode==='public'&&(workspace.visibility!=='public'||workspace.can_edit)))throw new KnowledgeSourceReadError('unavailable');
  const revision=captureChatbocSessionRevision();
  // apiFetch retires an obsolete HTTP response. Continue that same panel fence
  // while reading/verifying its body; public widget presentation is irrelevant.
  const authority=mode==='admin'?captureKnowledgeSourceAuthority():null;
  const request=new AbortController();let authorityCurrent=true;
  const abort=()=>request.abort();
  options.signal?.addEventListener('abort',abort,{once:true});
  if(options.signal?.aborted)abort();
  const unsubscribeAuthority=mode==='admin'?subscribeKnowledgeSourceAuthority(()=>{authorityCurrent=false;abort();}):()=>{};
  const isCurrent=()=>authorityCurrent&&options.isCurrent()&&isChatbocSessionRevisionCurrent(revision)&&!request.signal.aborted&&
    (mode!=='admin'||captureKnowledgeSourceAuthority()===authority);
  const assertCurrent=()=>{if(!isCurrent())throw new KnowledgeSourceReadError('retired');};
  try{
  assertCurrent();
  const response=await apiFetch(knowledgeEndpoint(workspace.tenant.slug,mode)+`/sources/${encodeURIComponent(source.id)}?revision=${workspace.revision}`,{
    responseType:'response',method:'GET',headers:{Accept:source.delivery.mime_type},cache:'no-store',
    tenantSlug:workspace.tenant.slug,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,persistTenantSlug:false,
    singleAttempt:true,allowStartupRecovery:true,isCurrent,signal:request.signal,
    preserveAuthOn401:true,suppressPanel401Redirect:true,
    ...(mode==='public'?{skipAuth:true,omitCredentials:true}:{}),
  });
  assertCurrent();
  const mime=response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  const expectedMime=source.delivery.mime_type.split(';')[0].toLowerCase();
  const length=response.headers.get('Content-Length');
  if(!response.ok||mime!==expectedMime||(length!==null&&(!/^\d+$/.test(length)||Number(length)<1||Number(length)>MAX_BYTES)))
    throw new KnowledgeSourceReadError('invalid');
  const reader=response.body?.getReader();
  if(!reader)throw new KnowledgeSourceReadError('invalid');
  const chunks:Uint8Array[]= [];let size=0;
  try{
    while(true){assertCurrent();const chunk=await reader.read();assertCurrent();if(chunk.done)break;
      size+=chunk.value.byteLength;if(size>MAX_BYTES)throw new KnowledgeSourceReadError('invalid');chunks.push(chunk.value);}
  }catch(cause){await reader.cancel().catch(()=>{});throw cause;}
  finally{reader.releaseLock();}
  if(!size||(length!==null&&size!==Number(length))||(source.delivery.byte_size!==undefined&&size!==source.delivery.byte_size))
    throw new KnowledgeSourceReadError('invalid');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const format=source.delivery.format;
  if((format==='pdf'&&new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')||
    (format==='jpeg'&&(bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)))
    throw new KnowledgeSourceReadError('invalid');
  let text:string|null=null;
  if(format==='text'){try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new KnowledgeSourceReadError('invalid');}}
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  assertCurrent();
  if(Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')!==source.sha256)
    throw new KnowledgeSourceReadError('invalid');
  return {blob:new Blob([bytes],{type:source.delivery.mime_type}),text,filename:source.delivery.filename,format};
  }catch(cause){assertCurrent();throw cause;}
  finally{unsubscribeAuthority();options.signal?.removeEventListener('abort',abort);}
}

/** Errors deliberately exclude provider bodies, keys, URLs and raw bytes. */
export function knowledgeSourceReadMessage(cause:unknown):string{
  const status=cause&&typeof cause==='object'&&'status'in cause?cause.status:null;
  if(status===401||status===403)return 'No pudimos confirmar tu acceso a este documento.';
  if(status===404)return 'Este documento todavía no está disponible para consultar.';
  if(status===412)return 'La versión del conocimiento cambió. Cerrá las fuentes y actualizá la consulta antes de abrir el documento.';
  if(cause instanceof KnowledgeSourceReadError&&cause.reason==='invalid')return 'No pudimos verificar el archivo recibido. El documento no se abrió.';
  return 'No pudimos cargar el documento. Podés volver a consultarlo sin perder tu pregunta.';
}
