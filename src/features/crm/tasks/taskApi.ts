import {assertTaskFields,assertTaskReceipt,assertTaskLabels,assertTaskHistory} from './taskProtocol';
import {apiFetch} from '@/utils/api';
import {assertFollowUpIdentity,asRecord,asText,validScheduledInstant,type FollowUpIdentity} from '../followup/followUpModel';
export type TaskStatus='todo'|'in_progress'|'done'|'cancelled';
export interface CrmTask {id:string;tenant_id:number;contact_id:string;title:string;description:string;assignee_id:number|null;due_at:string|null;priority:string;status:TaskStatus;revision:number;created_at:string;updated_at:string;permissions:{can_edit:boolean;statuses:Array<{value:TaskStatus;label:string}>}}
export interface TaskCapabilities {available:boolean;tenant_slug:string;can_create:boolean;ui:Record<string,string>;statuses:Record<string,string>;priorities:Record<string,string>}
export interface TaskEvent {id:string;revision:number;actor_id:number;reason:string;at:string;operation:string}
export interface TaskList {items:CrmTask[];total:number;counts:Record<TaskStatus,number>;next_cursor:string|null}
export interface TaskOperation {identity:FollowUpIdentity;taskId?:string;key:string;payload:Record<string,unknown>}
const statuses:TaskStatus[]=['todo','in_progress','done','cancelled'];
const strings=(value:unknown):Record<string,string>=>{const row=asRecord(value);if(Object.values(row).some(item=>typeof item!=='string'))throw new Error('Etiquetas no verificables.');return row as Record<string,string>;};
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function envelope(value:unknown,slug:string){const data=asRecord(value);if(data.contract_version!=='crm.tasks.v1'||data.tenant_slug!==slug)throw new Error('Respuesta de tareas no verificable.');return data;}
function parseTask(value:unknown,identity:FollowUpIdentity,requirePermissions=true):CrmTask {
 const row=asRecord(value),permissions=asRecord(row.permissions);
 if(!uuid(row.id)||row.contact_id!==identity.contactId||!Number.isSafeInteger(row.tenant_id)||!Number.isSafeInteger(row.revision)||Number(row.revision)<1||typeof row.title!=='string'||typeof row.description!=='string'||!statuses.includes(row.status as TaskStatus))throw new Error('Identidad o estado de tarea no verificable.');
 if(row.assignee_id!==null&&(!Number.isSafeInteger(row.assignee_id)||Number(row.assignee_id)<=0))throw new Error('Responsable no verificable.');
 if(row.due_at!==null&&!validScheduledInstant(row.due_at))throw new Error('Vencimiento no verificable.');
 if(requirePermissions&&(typeof permissions.can_edit!=='boolean'||!Array.isArray(permissions.statuses)))throw new Error('Permisos de tarea no informados.');
 assertTaskFields(row);
 const transitions=Array.isArray(permissions.statuses)?permissions.statuses.map(value=>{const option=asRecord(value);if(!statuses.includes(option.value as TaskStatus)||!asText(option.label))throw new Error('Transición no verificable.');return {value:option.value as TaskStatus,label:asText(option.label)};}):[];
 return {...row,permissions:{can_edit:permissions.can_edit===true,statuses:transitions}} as unknown as CrmTask;
}
const options=(slug:string)=>({tenantSlug:slug,persistTenantSlug:false});
const collection=(identity:FollowUpIdentity)=>{assertFollowUpIdentity(identity);return `/api/admin/tenants/${encodeURIComponent(identity.tenantSlug)}/contacts/${encodeURIComponent(identity.contactId)}/tasks`;};
const taskPath=(identity:FollowUpIdentity,id:string)=>{if(!uuid(id))throw new Error('Identidad de tarea inválida.');return `${collection(identity)}/${id}`;};
export const taskApi={
 async capabilities(slug:string):Promise<TaskCapabilities>{
  assertFollowUpIdentity({tenantSlug:slug,contactId:'capabilities'});
  try{const data=envelope(await apiFetch<unknown>(`/api/admin/tenants/${encodeURIComponent(slug)}/crm/tasks/capabilities`,options(slug)),slug);
   if(typeof data.available!=='boolean')throw new Error('Disponibilidad no informada.');
   assertTaskLabels(data);
   return {...data,can_create:data.can_create===true,ui:strings(data.ui),statuses:strings(data.statuses),priorities:strings(data.priorities)} as unknown as TaskCapabilities;
  }catch(error){if(Number((error as {status?:number})?.status)===404)return {available:false,tenant_slug:slug,can_create:false,ui:{},statuses:{},priorities:{}};throw error;}
 },
 async list(identity:FollowUpIdentity,cursor?:string):Promise<TaskList>{
  if(cursor&&!uuid(cursor))throw new Error('Cursor no verificable.');
  const raw=await apiFetch<unknown>(collection(identity)+(cursor?`?cursor=${cursor}`:''),options(identity.tenantSlug));
  const data=envelope(raw,identity.tenantSlug),counts=asRecord(data.counts);
  if(data.contact_id!==identity.contactId||!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||Number(data.total)<0)throw new Error('Listado no verificable.');
  const items=data.items.map(row=>parseTask(row,identity));
  if(new Set(items.map(row=>row.id)).size!==items.length)throw new Error('Identidades duplicadas.');
  if(statuses.some(status=>!Number.isSafeInteger(counts[status])||Number(counts[status])<0)||statuses.reduce((sum,status)=>sum+Number(counts[status]),0)!==data.total)throw new Error('Conteos no verificables.');
  if(data.next_cursor!==null&&!uuid(data.next_cursor))throw new Error('Cursor no verificable.');
  return {items,total:Number(data.total),counts:counts as TaskList['counts'],next_cursor:data.next_cursor as string|null};
 },
 async assignees(slug:string):Promise<Array<{id:number;name:string}>>{
  assertFollowUpIdentity({tenantSlug:slug,contactId:'assignees'});
  const data=envelope(await apiFetch<unknown>(`/api/admin/tenants/${encodeURIComponent(slug)}/crm/tasks/assignees`,options(slug)),slug);
  if(!Array.isArray(data.items))throw new Error('Responsables no verificables.');
  return data.items.map(value=>{const row=asRecord(value);if(!Number.isSafeInteger(row.id)||Number(row.id)<1||!asText(row.name))throw new Error('Responsable inválido.');return {id:Number(row.id),name:asText(row.name)};});
 },
 async detail(identity:FollowUpIdentity,id:string,before?:number):Promise<{task:CrmTask;events:TaskEvent[];next_before_revision:number|null}>{
  if(before!==undefined&&(!Number.isSafeInteger(before)||before<1))throw new Error('Cursor de historial inválido.');
  const data=envelope(await apiFetch<unknown>(taskPath(identity,id)+(before?`?before_revision=${before}`:''),options(identity.tenantSlug)),identity.tenantSlug);
  const task=parseTask(data.task,identity);if(task.id!==id||!Array.isArray(data.events))throw new Error('Historial no verificable.');
  const events=data.events.map(value=>{const event=asRecord(value);if(!uuid(event.id)||!Number.isSafeInteger(event.revision)||Number(event.revision)>task.revision||!validScheduledInstant(event.at)||!asText(event.reason)||!Number.isSafeInteger(event.actor_id))throw new Error('Evento no verificable.');return {id:event.id,revision:Number(event.revision),actor_id:Number(event.actor_id),reason:asText(event.reason),at:event.at,operation:asText(event.operation)};});
  if(data.next_before_revision!==null&&(!Number.isSafeInteger(data.next_before_revision)||Number(data.next_before_revision)<1))throw new Error('Cursor no verificable.');
  assertTaskHistory(events,task.revision,before,data.next_before_revision);
  return {task,events,next_before_revision:data.next_before_revision as number|null};
 },
 async execute(operation:TaskOperation){
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(operation.key))throw new Error('Clave de operación inválida.');
  const {identity,taskId,payload,key}=operation;
  const path=taskId?taskPath(identity,taskId):collection(identity);
  const data=envelope(await apiFetch<unknown>(path,{...options(identity.tenantSlug),method:taskId?'PATCH':'POST',headers:{'Idempotency-Key':key},body:payload}),identity.tenantSlug);
  const task=parseTask(data.task,identity,false),receipt=asRecord(data.receipt);
  if(taskId&&task.id!==taskId)throw new Error('La respuesta corresponde a otra tarea.');
  if(!uuid(receipt.event_id)||receipt.revision!==task.revision||typeof receipt.replayed!=='boolean')throw new Error('Confirmación no verificable.');
  await assertTaskReceipt(operation,task,receipt);
  return {task,receipt:{event_id:receipt.event_id,revision:task.revision,replayed:receipt.replayed}};
 },
};
