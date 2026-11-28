import {apiFetch} from '@/utils/api';
import {knowledgeEndpoint,type KnowledgeWorkspace} from './institutionalAssistantContract';

export const QUESTION_OUTCOMES=['answered','uncovered','typed_navigation','sources','unavailable'] as const;
export type QuestionOutcome=(typeof QUESTION_OUTCOMES)[number];
const UI_KEYS=['title','description','period','answered','uncovered','typed_navigation','sources','unavailable',
  'uncovered_rate','uncovered_by_node','answered_by_node','node','count','retired_node','empty','privacy','truncated'] as const;
export interface QuestionNodeCount {node_id:string;count:number;title:string|null;is_start:boolean}
export interface KnowledgeQuestionMetrics {
  tenant:{id:number;slug:string};days:number;truncated:boolean;
  totals:Record<QuestionOutcome,number>;uncovered_rate:number|null;
  /** Share of interpreted questions answered from the sources. Absent on servers that predate it. */
  resolution_rate?:number|null;interpreted?:number;
  uncovered_by_node:QuestionNodeCount[];answered_by_node:QuestionNodeCount[];
  /** «¿Te sirvió?» marks. Absent on servers that predate it, and dropped when malformed. */
  feedback?:{helpful:number;unhelpful:number;helpful_rate:number|null;unhelpful_by_node:QuestionNodeCount[]};
  ui:Record<(typeof UI_KEYS)[number],string>&{resolution_rate?:string;resolution_detail?:string}&
    Partial<Record<(typeof FEEDBACK_UI_KEYS)[number],string>>;
}
const FEEDBACK_UI_KEYS=['feedback_title','feedback_description','feedback_helpful','feedback_unhelpful','feedback_rate','feedback_by_node','feedback_empty'] as const;
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const count=(value:unknown):value is number=>Number.isSafeInteger(value)&&(value as number)>=0;
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const ranking=(value:unknown):value is QuestionNodeCount[]=>Array.isArray(value)&&value.length<=50&&value.every(item=>
  record(item)&&text(item.node_id,120)&&count(item.count)&&item.count>0&&(item.title===null||text(item.title,250))&&typeof item.is_start==='boolean');

/** Accept only the administration metrics of this exact workspace's tenant. */
export function parseQuestionMetrics(value:unknown,workspace:KnowledgeWorkspace):KnowledgeQuestionMetrics {
  if(!record(value)||value.contract_version!=='chatboc.institutional_assistant_metrics.v1'||!record(value.tenant)||
    value.tenant.id!==workspace.tenant.id||value.tenant.slug!==workspace.tenant.slug||
    !count(value.days)||value.days<1||value.days>90||typeof value.truncated!=='boolean'||
    !record(value.totals)||!QUESTION_OUTCOMES.every(outcome=>count((value.totals as Record<string,unknown>)[outcome]))||
    !(value.uncovered_rate===null||(typeof value.uncovered_rate==='number'&&value.uncovered_rate>=0&&value.uncovered_rate<=1))||
    !(value.resolution_rate===undefined||value.resolution_rate===null||(typeof value.resolution_rate==='number'&&value.resolution_rate>=0&&value.resolution_rate<=1))||
    !(value.interpreted===undefined||count(value.interpreted))||
    !ranking(value.uncovered_by_node)||!ranking(value.answered_by_node)||
    !record(value.ui)||!UI_KEYS.every(key=>text((value.ui as Record<string,unknown>)[key],200))||
    !(['resolution_rate','resolution_detail'] as const).every(key=>{const label=(value.ui as Record<string,unknown>)[key];return label===undefined||text(label,200);}))throw new Error('knowledge_metrics_invalid');
  const feedback=value.feedback,labels=value.ui as Record<string,unknown>;
  const usable=record(feedback)&&count(feedback.helpful)&&count(feedback.unhelpful)&&ranking(feedback.unhelpful_by_node)&&
    (feedback.helpful_rate===null||(typeof feedback.helpful_rate==='number'&&feedback.helpful_rate>=0&&feedback.helpful_rate<=1))&&
    FEEDBACK_UI_KEYS.every(key=>text(labels[key],200));
  // The panel of written questions must keep working whatever happens to this optional block.
  return (usable?value:{...value,feedback:undefined}) as unknown as KnowledgeQuestionMetrics;
}

/** Read-only request made when an administrator opens the panel. */
export async function loadQuestionMetrics(workspace:KnowledgeWorkspace,options:{signal?:AbortSignal}={}) {
  const offset=Math.max(-840,Math.min(840,-new Date().getTimezoneOffset()));
  return parseQuestionMetrics(await apiFetch(`${knowledgeEndpoint(workspace.tenant.slug,'admin')}/metrics?days=30&utc_offset_minutes=${offset}`,{
    tenantSlug:workspace.tenant.slug,method:'GET',cache:'no-store',singleAttempt:true,omitEntityToken:true,omitChatSessionId:true,
    isWidgetRequest:false,persistTenantSlug:false,...(options.signal?{signal:options.signal}:{})}),workspace);
}
