import { apiFetch } from '@/utils/api';
import { sanitizePublicInternalNavigationPath } from '@/utils/tenantPaths';
export interface KnowledgeSource { id:string; title:string; sha256:string; page_count:number; pages?:number[]; url:string|null; excerpts?:Array<{page:number|null;text:string}> }
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
function source(value:unknown):value is KnowledgeSource {
  return record(value)&&string(value.id,120)&&string(value.title,250)&&hash(value.sha256)&&
    Number.isSafeInteger(value.page_count)&&value.page_count>0&&
    (value.url===null||publicKnowledgeUrl(value.url)!==null)&&
    (value.excerpts===undefined||(Array.isArray(value.excerpts)&&value.excerpts.every((e:unknown)=>record(e)&&string(e.text,12000)&&(e.page===null||(Number.isSafeInteger(e.page)&&e.page>0&&e.page<=value.page_count)))))&&
    (value.pages===undefined||(Array.isArray(value.pages)&&value.pages.length>0&&value.pages.every((p:unknown)=>typeof p==='number'&&Number.isInteger(p)&&p>0&&p<=value.page_count)));
}
function node(value:unknown):value is KnowledgeNode {
  return record(value)&&string(value.id,120)&&string(value.title,250)&&string(value.text)&&
    Array.isArray(value.actions)&&value.actions.length<=30&&value.actions.every((a:unknown)=>record(a)&&string(a.code,120)&&string(a.label,160)&&string(a.target,120))&&
    Array.isArray(value.sources)&&value.sources.length>0&&value.sources.every(source)&&
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
    !Array.isArray(value.knowledge.sources)||!value.knowledge.sources.every(source))throw new Error('knowledge_response_invalid');
  return value as unknown as KnowledgeWorkspace;
}
export function parseAnswer(value:unknown,workspace:KnowledgeWorkspace):KnowledgeAnswer {
  if(!record(value)||value.contract_version!=='chatboc.institutional_assistant.v1'||value.tenant?.id!==workspace.tenant.id||value.tenant.slug!==workspace.tenant.slug||
    value.revision!==workspace.revision||value.business_writes_performed!==false||!string(value.text,40000)||
    !Array.isArray(value.nodes)||value.nodes.length>3||!value.nodes.every(node))throw new Error('knowledge_answer_invalid');
  const known=new Map(workspace.knowledge?.sources.map(s=>[s.id,s]));
  for(const n of value.nodes)for(const s of n.sources){const original=known.get(s.id);if(!original||original.sha256!==s.sha256||original.page_count!==s.page_count||original.url!==s.url)throw new Error('knowledge_source_changed');}
  return value as unknown as KnowledgeAnswer;
}
export function knowledgeEndpoint(slug:string,mode:'admin'|'public') {
  if(!slug||sanitizePublicInternalNavigationPath(`/t/${encodeURIComponent(slug)}/knowledge`)!==`/t/${encodeURIComponent(slug)}/knowledge`)throw new Error('knowledge_scope_invalid');
  return `/api/${mode}/tenants/${encodeURIComponent(slug)}/institutional-assistant`;
}
export async function loadWorkspace(slug:string,mode:'admin'|'public') {
  return parseWorkspace(await apiFetch(knowledgeEndpoint(slug,mode),{tenantSlug:slug,method:'GET',cache:'no-store',singleAttempt:true,...(mode==='public'?{skipAuth:true,omitEntityToken:true,omitCredentials:true,persistTenantSlug:false}: {})}),slug,mode);
}
export async function askWorkspace(workspace:KnowledgeWorkspace,mode:'admin'|'public',input:{node_id:string;question?:string}) {
  return parseAnswer(await apiFetch(knowledgeEndpoint(workspace.tenant.slug,mode)+'/answer',{method:'POST',tenantSlug:workspace.tenant.slug,
    cache:'no-store',singleAttempt:true,body:{revision:workspace.revision,...input},...(mode==='public'?{skipAuth:true,omitEntityToken:true,omitCredentials:true,persistTenantSlug:false}: {})}),workspace);
}
export async function changeWorkspace(workspace:KnowledgeWorkspace,operation:'import'|'publish'|'retire',bundle?:unknown) {
  return parseWorkspace(await apiFetch(knowledgeEndpoint(workspace.tenant.slug,'admin'),{method:'PUT',tenantSlug:workspace.tenant.slug,singleAttempt:true,
    headers:{'X-Chatboc-Knowledge':'1'},body:{operation,expected_revision:workspace.revision,...(bundle===undefined?{}:{bundle})}}),workspace.tenant.slug,'admin');
}
