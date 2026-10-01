import { apiFetch } from '@/utils/api';
import { sanitizePublicInternalNavigationPath } from '@/utils/tenantPaths';
export type KnowledgeSourceFormat = 'pdf'|'jpeg'|'text';
export interface KnowledgeSourceDelivery {
  contract_version:'chatboc.knowledge_source_delivery.v1'; format:KnowledgeSourceFormat;
  mime_type:string; sha256:string; byte_size?:number; filename:string;
}
export interface KnowledgeSource {
  id:string; title:string; sha256:string; page_count:number; pages?:number[]; url:string|null; excerpts?:Array<{page:number|null;text:string}>;
  source_authority?:'official_norm'|'operational_document'|'project'|'user_supplied_note'|'unknown';
  format?:KnowledgeSourceFormat; mime_type?:string; byte_size?:number;
  pagination?:'native'|'logical_snapshot'; provenance?:string|null; origin_url?:string|null; native_revision?:string|null;
  modified_at?:string|null; printed_year?:number|null;
  review_status?:'unreviewed'|'reviewed'|'needs_review'|'conflict';
  current_validity?:'not_verified'|'official_text_observed'|'conflict'|'superseded';
  delivery?:KnowledgeSourceDelivery;
}
export interface KnowledgeNode { id:string; title:string; text:string; actions:Array<{code:string;label:string;target:string}>; sources:KnowledgeSource[]; links:Array<{id:string;label:string;url:string;review_after:string}> }
export interface KnowledgeWorkspace {
  contract_version:'chatboc.institutional_assistant.v1';
  tenant:{id:number;slug:string;name:string}; revision:string|null; visibility:'empty'|'private'|'public'; can_edit:boolean;
  ui:Record<string,string>;
  knowledge:null|{start:string;node_count:number;version:string;topics:Array<{id:string;label:string}>;sources:KnowledgeSource[];initial:KnowledgeNode};
}
export interface KnowledgeAnswer { tenant:{id:number;slug:string}; revision:string; nodes:KnowledgeNode[]; text:string; business_writes_performed:false }
const string=(v:unknown,max=16000):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const record=(v:unknown):v is Record<string,any>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
export const publicKnowledgeUrl=(value:unknown):string|null=>{
  if(typeof value!=='string')return null;
  try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash?u.href:null;}catch{return null;}
};
const mimeForFormat=(format:KnowledgeSourceFormat,mime:unknown)=>typeof mime==='string'&&
  (format==='pdf'?mime==='application/pdf':format==='jpeg'?mime==='image/jpeg':mime==='text/plain');
const optionalText=(value:unknown,max:number)=>value===undefined||value===null||string(value,max);
const optionalEnum=(value:unknown,allowed:string[])=>value===undefined||(typeof value==='string'&&allowed.includes(value));
export function isKnowledgeSource(value:unknown):value is KnowledgeSource {
  return record(value)&&string(value.id,120)&&string(value.title,250)&&hash(value.sha256)&&
    Number.isSafeInteger(value.page_count)&&value.page_count>0&&
    (value.url===null||publicKnowledgeUrl(value.url)!==null)&&
    optionalEnum(value.source_authority,['official_norm','operational_document','project','user_supplied_note','unknown'])&&
    optionalEnum(value.format,['pdf','jpeg','text'])&&
    (value.mime_type===undefined||(value.format!==undefined&&mimeForFormat(value.format,value.mime_type)))&&
    (value.byte_size===undefined||(Number.isSafeInteger(value.byte_size)&&value.byte_size>0&&value.byte_size<=8*1024*1024))&&
    optionalEnum(value.pagination,['native','logical_snapshot'])&&
    (value.pagination!=='logical_snapshot'||value.page_count===1)&&
    (value.pagination===undefined||value.format===undefined||value.pagination===(value.format==='pdf'?'native':'logical_snapshot'))&&
    optionalText(value.provenance,500)&&
    (value.origin_url===undefined||value.origin_url===null||publicKnowledgeUrl(value.origin_url)!==null)&&
    optionalText(value.native_revision,160)&&optionalText(value.modified_at,64)&&
    (value.modified_at===undefined||value.modified_at===null||(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.modified_at)&&Number.isFinite(Date.parse(value.modified_at))))&&
    (value.printed_year===undefined||value.printed_year===null||(Number.isInteger(value.printed_year)&&value.printed_year>=1900&&value.printed_year<=2100))&&
    optionalEnum(value.review_status,['unreviewed','reviewed','needs_review','conflict'])&&
    optionalEnum(value.current_validity,['not_verified','official_text_observed','conflict','superseded'])&&
    (value.delivery===undefined||(record(value.delivery)&&value.delivery.contract_version==='chatboc.knowledge_source_delivery.v1'&&
      ['pdf','jpeg','text'].includes(value.delivery.format)&&mimeForFormat(value.delivery.format,value.delivery.mime_type)&&
      value.delivery.sha256===value.sha256&&string(value.delivery.filename,200)&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.delivery.filename)&&
      (value.format===undefined||value.delivery.format===value.format)&&
      (value.mime_type===undefined||value.delivery.mime_type===value.mime_type)&&
      (value.delivery.byte_size===undefined||(Number.isSafeInteger(value.delivery.byte_size)&&value.delivery.byte_size>0&&value.delivery.byte_size<=8*1024*1024))&&
      (value.byte_size===undefined||value.delivery.byte_size===value.byte_size)))&&
    (value.excerpts===undefined||(Array.isArray(value.excerpts)&&value.excerpts.every((e:unknown)=>record(e)&&string(e.text,12000)&&(e.page===null||(Number.isSafeInteger(e.page)&&e.page>0&&e.page<=value.page_count)))))&&
    (value.pages===undefined||(Array.isArray(value.pages)&&value.pages.length>0&&value.pages.every((p:unknown)=>typeof p==='number'&&Number.isInteger(p)&&p>0&&p<=value.page_count)));
}
export function sameKnowledgeSourceIdentity(a:KnowledgeSource,b:KnowledgeSource):boolean {
  const keys=['id','sha256','page_count','url','source_authority','format','mime_type','byte_size','pagination','provenance','origin_url','native_revision','modified_at','printed_year','review_status','current_validity'] as const;
  if(keys.some(key=>a[key]!==b[key]))return false;
  if(!a.delivery||!b.delivery)return a.delivery===b.delivery;
  return (['contract_version','format','mime_type','sha256','byte_size','filename'] as const).every(key=>a.delivery![key]===b.delivery![key]);
}
function node(value:unknown):value is KnowledgeNode {
  return record(value)&&string(value.id,120)&&string(value.title,250)&&string(value.text)&&
    Array.isArray(value.actions)&&value.actions.length<=30&&value.actions.every((a:unknown)=>record(a)&&string(a.code,120)&&string(a.label,160)&&string(a.target,120))&&
    Array.isArray(value.sources)&&value.sources.length>0&&value.sources.every(isKnowledgeSource)&&
    Array.isArray(value.links)&&value.links.every((l:unknown)=>record(l)&&string(l.id,120)&&string(l.label,250)&&publicKnowledgeUrl(l.url)!==null&&string(l.review_after,50));
}
const uiKeys=['heading','description','topics','sources','source_details','question','placeholder','send','back','home','loading','unknown','error','retry','import','import_help','empty','choose_file','private','public','publish','retire','confirm','cancel','confirm_publish','confirm_retire','version','preview','large_text','answer','evidence','close','pending'];
export function parseWorkspace(value:unknown,slug:string,mode:'admin'|'public'):KnowledgeWorkspace {
  if(!record(value)||value.contract_version!=='chatboc.institutional_assistant.v1'||!record(value.tenant)||value.tenant.slug!==slug||
    !Number.isSafeInteger(value.tenant.id)||value.tenant.id<1||!string(value.tenant.name,250)||!record(value.ui)||!uiKeys.every(k=>string(value.ui[k],1000))||
    !['empty','private','public'].includes(value.visibility)||typeof value.can_edit!=='boolean'||(mode==='public'&&(value.visibility!=='public'||value.can_edit!==false)))throw new Error('knowledge_response_invalid');
  if(value.knowledge===null){if(value.revision!==null||value.visibility!=='empty')throw new Error('knowledge_response_invalid');}
  else if(!record(value.knowledge)||!hash(value.revision)||!node(value.knowledge.initial)||value.knowledge.initial.id!==value.knowledge.start||
    !Number.isSafeInteger(value.knowledge.node_count)||value.knowledge.node_count<1||!string(value.knowledge.version,60)||
    !Array.isArray(value.knowledge.topics)||!value.knowledge.topics.every((t:unknown)=>record(t)&&string(t.id,120)&&string(t.label,160))||
    !Array.isArray(value.knowledge.sources)||!value.knowledge.sources.every(isKnowledgeSource))throw new Error('knowledge_response_invalid');
  return value as unknown as KnowledgeWorkspace;
}
export function parseAnswer(value:unknown,workspace:KnowledgeWorkspace):KnowledgeAnswer {
  if(!record(value)||value.contract_version!=='chatboc.institutional_assistant.v1'||value.tenant?.id!==workspace.tenant.id||value.tenant.slug!==workspace.tenant.slug||
    value.revision!==workspace.revision||value.business_writes_performed!==false||!string(value.text,40000)||
    !Array.isArray(value.nodes)||value.nodes.length>3||!value.nodes.every(node))throw new Error('knowledge_answer_invalid');
  const known=new Map(workspace.knowledge?.sources.map(s=>[s.id,s]));
  for(const n of value.nodes)for(const s of n.sources){const original=known.get(s.id);
    if(!original||!sameKnowledgeSourceIdentity(original,s))throw new Error('knowledge_source_changed');}
  return value as unknown as KnowledgeAnswer;
}
export function knowledgeEndpoint(slug:string,mode:'admin'|'public') {
  if(!slug||sanitizePublicInternalNavigationPath(`/t/${encodeURIComponent(slug)}/knowledge`)!==`/t/${encodeURIComponent(slug)}/knowledge`)throw new Error('knowledge_scope_invalid');
  return `/api/${mode}/tenants/${encodeURIComponent(slug)}/institutional-assistant`;
}
export async function loadWorkspace(slug:string,mode:'admin'|'public') {
  return parseWorkspace(await apiFetch(knowledgeEndpoint(slug,mode),{tenantSlug:slug,method:'GET',cache:'no-store',singleAttempt:true,allowStartupRecovery:true,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,persistTenantSlug:false,...(mode==='public'?{skipAuth:true,omitCredentials:true}: {})}),slug,mode);
}
export async function askWorkspace(workspace:KnowledgeWorkspace,mode:'admin'|'public',input:{node_id:string;question?:string}) {
  if(input.question===undefined){
    if(!hash(workspace.revision)||!string(input.node_id,120))throw new Error('knowledge_answer_scope_invalid');
    const raw=await apiFetch(knowledgeEndpoint(workspace.tenant.slug,mode)+`/nodes/${encodeURIComponent(input.node_id)}?revision=${workspace.revision}`,{
      method:'GET',tenantSlug:workspace.tenant.slug,cache:'no-store',singleAttempt:true,allowStartupRecovery:true,
      omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,persistTenantSlug:false,
      ...(mode==='public'?{skipAuth:true,omitCredentials:true}: {}),
    });
    const response=parseAnswer(raw,workspace);
    if(!record(raw)||raw.selection_performed!==false||response.nodes.length!==1||response.nodes[0].id!==input.node_id)
      throw new Error('knowledge_canonical_response_invalid');
    return response;
  }
  return parseAnswer(await apiFetch(knowledgeEndpoint(workspace.tenant.slug,mode)+'/answer',{method:'POST',tenantSlug:workspace.tenant.slug,
    cache:'no-store',singleAttempt:true,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,persistTenantSlug:false,body:{revision:workspace.revision,...input},...(mode==='public'?{skipAuth:true,omitCredentials:true}: {})}),workspace);
}
export async function changeWorkspace(workspace:KnowledgeWorkspace,operation:'import'|'publish'|'retire',bundle?:unknown) {
  return parseWorkspace(await apiFetch(knowledgeEndpoint(workspace.tenant.slug,'admin'),{method:'PUT',tenantSlug:workspace.tenant.slug,singleAttempt:true,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,persistTenantSlug:false,
    headers:{'X-Chatboc-Knowledge':'1'},body:{operation,expected_revision:workspace.revision,...(bundle===undefined?{}:{bundle})}}),workspace.tenant.slug,'admin');
}
