import {safeSessionStorage} from './safeLocalStorage';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent} from './chatbocSessionRevision';
import {abortablePause,hasUndispatchedStartupReceipt} from './backendRequestContinuity';

export interface SessionRetirementProof {
 contract_version:'chatboc.session_retirement.v1'; actor_id:string; provider:'native'|'clerk';
 lineage_id:string; clerk_session_id:string|null; expires_at:string; proof:string;
}
export interface SessionRetirementBinding {actorId:string|number;provider:'native'|'clerk';clerkSessionId?:string|null}
interface Snapshot {authority:SessionRetirementProof;revision:number}
let active:Snapshot|null=null;
let clerkIdentity:{userId:string;sessionId:string}|null=null;
const DENIED_SESSIONS='chatbocRetiredSessions.v1';
const readDenied=():string[]=>{try{const value=JSON.parse(safeSessionStorage.getItem(DENIED_SESSIONS)??'[]');return Array.isArray(value)?value.filter(item=>typeof item==='string'&&item.length<400).slice(-100):[];}catch{return [];}};
const deny=(id:string)=>{const values=readDenied();if(!values.includes(id))safeSessionStorage.setItem(DENIED_SESSIONS,JSON.stringify([...values,id].slice(-100)));};
export const isClerkSessionRetired=(userId:string|null|undefined,sessionId:string|null|undefined)=>
 Boolean(sessionId&&(readDenied().includes(`clerk-sid:${sessionId}`)||userId&&readDenied().includes(`clerk:${userId}:${sessionId}`)));
export const registerActiveClerkIdentity=(userId:string,sessionId:string|null|undefined)=>{
 clerkIdentity=sessionId?{userId,sessionId}:null;
};
export const readActiveClerkSessionId=()=>clerkIdentity?.sessionId;
export const isActiveClerkSessionRetired=()=>isClerkSessionRetired(clerkIdentity?.userId,clerkIdentity?.sessionId);
export function validateSessionRetirementProof(value:unknown,binding:SessionRetirementBinding):SessionRetirementProof|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(v.contract_version!=='chatboc.session_retirement.v1'||v.actor_id!==String(binding.actorId)||v.provider!==binding.provider||
  typeof v.lineage_id!=='string'||!v.lineage_id||v.lineage_id.length>160||typeof v.proof!=='string'||!v.proof||v.proof.length>8192||/\s/.test(v.proof)||
  typeof v.expires_at!=='string'||!Number.isFinite(Date.parse(v.expires_at))||Date.parse(v.expires_at)<=Date.now()||
  (binding.provider==='clerk'?(typeof v.clerk_session_id!=='string'||!v.clerk_session_id||
    v.clerk_session_id.length>200||isClerkSessionRetired(null,v.clerk_session_id)||
    (binding.clerkSessionId!==undefined&&v.clerk_session_id!==binding.clerkSessionId)):v.clerk_session_id!==null)||
  readDenied().includes(`lineage:${v.lineage_id}`))return null;
 return {contract_version:v.contract_version,actor_id:v.actor_id as string,provider:v.provider as 'native'|'clerk',lineage_id:v.lineage_id,
  clerk_session_id:v.clerk_session_id as string|null,expires_at:v.expires_at,proof:v.proof};
}
/** Only a current verified HTTP identity can register this in-memory authority. */
export function registerSessionRetirement(value:unknown,binding:SessionRetirementBinding,revision=captureChatbocSessionRevision()):boolean{
 if(!isChatbocSessionRevisionCurrent(revision))return false;
 const authority=validateSessionRetirementProof(value,binding);
 if(!authority)return false;
 active={authority,revision};logoutNotice=null;noticeListeners.forEach(listener=>{try{listener();}catch{}});return true;
}
export function captureSessionRetirement(actorId:unknown):SessionRetirementProof|null{
 if(!active||!isChatbocSessionRevisionCurrent(active.revision)||active.authority.actor_id!==String(actorId)||Date.parse(active.authority.expires_at)<=Date.now())return null;
 return {...active.authority};
}
/** Denial markers never contain the proof and cannot grant authentication. */
export function retireLocalSessionAuthority(authority:SessionRetirementProof|null,clerkUserId:string|null,blockClerk:boolean){
 if(authority)deny(`lineage:${authority.lineage_id}`);
 if(blockClerk&&authority?.provider==='clerk'&&authority.clerk_session_id)deny(`clerk-sid:${authority.clerk_session_id}`);
 if(blockClerk&&clerkIdentity&&(!clerkUserId||clerkIdentity.userId===clerkUserId)&&
  (!authority||authority.provider==='clerk'&&authority.clerk_session_id===clerkIdentity.sessionId)){
  deny(`clerk:${clerkIdentity.userId}:${clerkIdentity.sessionId}`);
 }
 active=null;
}
export function clearSessionRetirementAuthority(){active=null;}
export type SessionRetirementResult={status:'retired'|'already_retired'|'uncertain'|'unavailable';providerStatus:'not_applicable'|'pending'|'confirmed'|'failed'|'unknown'};
export type LogoutNotice=SessionRetirementResult|{status:'pending';providerStatus:'unknown'};
let logoutNotice:LogoutNotice|null=null;
const noticeListeners=new Set<()=>void>();
export const readLogoutNotice=()=>logoutNotice;
export const subscribeLogoutNotice=(listener:()=>void)=>{noticeListeners.add(listener);return()=>{noticeListeners.delete(listener);};};
export const setLogoutNotice=(notice:LogoutNotice)=>{logoutNotice=notice;noticeListeners.forEach(listener=>{try{listener();}catch{}});};

/** A frozen A-only operation, with one retry only when the WSGI boundary proves no dispatch. */
export async function dispatchSessionRetirement(authority:SessionRetirementProof|null):Promise<SessionRetirementResult>{
 if(!authority)return {status:'unavailable',providerStatus:'unknown'};
 const frozen={...authority};const uncertain=():SessionRetirementResult=>({status:'uncertain',providerStatus:'unknown'});
 const controller=new AbortController();const expiresAt=Date.now()+10_000;
 let timer:ReturnType<typeof setTimeout>;
 const deadline=new Promise<SessionRetirementResult>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(uncertain());},10_000);});
 const operation=async():Promise<SessionRetirementResult>=>{
  try{
   const body=JSON.stringify({proof:frozen.proof,request_id:crypto.randomUUID()});
   const init:RequestInit={method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body,credentials:'omit',cache:'no-store',redirect:'error',keepalive:true,signal:controller.signal};
   for(let attempt=0;attempt<2;attempt+=1){
    controller.signal.throwIfAborted();
    const response=await fetch('/api/v2/auth/sessions/retire',init);
    controller.signal.throwIfAborted();
    if(!response.ok){
     if(attempt===0&&await hasUndispatchedStartupReceipt(response)){
      controller.signal.throwIfAborted();
      const seconds=Number(response.headers.get('Retry-After')??'2');
      const delay=Number.isFinite(seconds)&&seconds>=0?Math.max(250,seconds*1000):2000;
      // Preserve the server's wait and the original total budget; never replay an ambiguous POST.
      if(delay>5000||Date.now()+delay>=expiresAt)return uncertain();
      await abortablePause(delay,controller.signal);
      continue;
     }
     return uncertain();
    }
    const receipt=await response.json();
    controller.signal.throwIfAborted();
    if(!receipt||receipt.contract_version!=='chatboc.session_retirement_receipt.v1'||receipt.lineage_id!==frozen.lineage_id||
     !['retired','already_retired'].includes(receipt.status)||receipt.local_revoked!==true||
     !['not_applicable','pending','confirmed','failed'].includes(receipt.provider_revocation?.status))return uncertain();
    return {status:receipt.status,providerStatus:receipt.provider_revocation.status};
   }
   return uncertain();
  }catch{return uncertain();}
 };
 try{return await Promise.race([operation(),deadline]);}finally{clearTimeout(timer);}
}
