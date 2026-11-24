import {apiFetch} from '@/utils/api';
import {captureChatbocSessionRevision,isChatbocSessionRevisionCurrent} from '@/utils/chatbocSessionRevision';
import {knowledgeEndpoint} from './institutionalAssistantContract';

export {readInstitutionalEasyReadCopy} from './institutionalAssistantContract';
export type {InstitutionalEasyReadCopy} from './institutionalAssistantContract';
export interface InstitutionalEasyReadScope {tenant:{id:number;slug:string};revision:string;nodeId:string}
const MAX_TEXT=6000;
const record=(value:unknown):value is Record<string,any>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);

export function isInstitutionalEasyReadText(value:unknown):value is string {
  return typeof value==='string'&&value.trim().length>0&&value.length<=MAX_TEXT;
}

/** The backend rewrites one published answer and verifies it; the browser only asks by id. */
export async function readInstitutionalEasyRead(scope:InstitutionalEasyReadScope,
  options:{signal:AbortSignal;isCurrent:()=>boolean}):Promise<string> {
  if(!Number.isSafeInteger(scope.tenant.id)||scope.tenant.id<1||!/^[a-f0-9]{64}$/.test(scope.revision)||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(scope.nodeId))throw new Error('knowledge_easy_read_scope_invalid');
  const sessionRevision=captureChatbocSessionRevision();
  const isCurrent=()=>options.isCurrent()&&!options.signal.aborted&&isChatbocSessionRevisionCurrent(sessionRevision);
  if(!isCurrent())throw new Error('knowledge_easy_read_retired');
  const value=await apiFetch<unknown>(knowledgeEndpoint(scope.tenant.slug,'public')+'/easy-read',{
    method:'POST',body:{revision:scope.revision,node_id:scope.nodeId},tenantSlug:scope.tenant.slug,cache:'no-store',
    singleAttempt:true,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,persistTenantSlug:false,
    skipAuth:true,omitCredentials:true,signal:options.signal,isCurrent,
  });
  if(!isCurrent())throw new Error('knowledge_easy_read_retired');
  if(!record(value)||value.contract_version!=='chatboc.institutional_easy_read.v1'||!record(value.tenant)||
    value.tenant.id!==scope.tenant.id||value.tenant.slug!==scope.tenant.slug||value.revision!==scope.revision||
    value.node_id!==scope.nodeId||!isInstitutionalEasyReadText(value.text))throw new Error('knowledge_easy_read_response_invalid');
  return value.text;
}
