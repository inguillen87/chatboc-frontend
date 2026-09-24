import {validScheduledInstant,asRecord,asText} from '../followup/followUpModel';
import type {CrmTask,TaskOperation,TaskEvent} from './taskApi';
export async function operationKeyHash(key:string):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));
 return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');
}
export function assertTaskFields(row:Record<string,unknown>):void{
 if(Number(row.tenant_id)<=0||!validScheduledInstant(row.created_at)||!validScheduledInstant(row.updated_at)
   ||typeof row.title!=='string'||!row.title.trim()||row.title.length>160
   ||typeof row.description!=='string'||row.description.length>3000
   ||!['normal','high','urgent'].includes(String(row.priority)))throw new Error('Campos de tarea no verificables.');
}
export async function assertTaskReceipt(operation:TaskOperation,task:CrmTask,raw:unknown):Promise<void>{
 const receipt=asRecord(raw),payload=operation.payload;
 if(receipt.key_hash!==await operationKeyHash(operation.key))throw new Error('El recibo no corresponde a esta operación.');
 const expected=operation.taskId?Number(payload.expected_revision)+1:1;
 if(!Number.isSafeInteger(expected)||expected<1||task.revision!==expected)throw new Error('La revisión confirmada no coincide.');
 for(const field of ['title','description'] as const){
   if(Object.hasOwn(payload,field)&&(typeof payload[field]!=='string'||task[field]!==String(payload[field]).trim()))throw new Error('El contenido guardado no coincide.');
 }
 for(const field of ['assignee_id','priority','status'] as const){
   if(Object.hasOwn(payload,field)&&task[field]!==payload[field])throw new Error('El cambio solicitado no fue confirmado.');
 }
 if(!operation.taskId&&task.status!=='todo')throw new Error('Estado inicial inesperado.');
 if(Object.hasOwn(payload,'due_at')){
   const due=payload.due_at;
   if(due===null?task.due_at!==null:!validScheduledInstant(due)||!validScheduledInstant(task.due_at)||Date.parse(due)!==Date.parse(task.due_at))throw new Error('Vencimiento confirmado incorrecto.');
 }
}
export function assertTaskLabels(data:Record<string,unknown>):void{
 if(data.available!==true)return;
 if(typeof data.can_create!=='boolean')throw new Error('Permiso de creación no verificable.');
 const ui=asRecord(data.ui),statuses=asRecord(data.statuses),priorities=asRecord(data.priorities);
 for(const key of ['title','create','save','assignee','due','reason','history','unassigned','description']){
   if(!asText(ui[key]))throw new Error('Interfaz de tareas incompleta.');
 }
 for(const key of ['todo','in_progress','done','cancelled'])if(!asText(statuses[key]))throw new Error('Estados no informados.');
 for(const key of ['normal','high','urgent'])if(!asText(priorities[key]))throw new Error('Prioridades no informadas.');
}
export function assertTaskHistory(events:TaskEvent[],revision:number,before?:number,next?:unknown):void{
 const ids=new Set<string>();let upper=before===undefined?revision+1:before;
 for(const event of events){
   if(ids.has(event.id)||event.revision<1||event.actor_id<1||event.revision>=upper||!['created','updated'].includes(event.operation))throw new Error('Secuencia de historial no verificable.');
   ids.add(event.id);upper=event.revision;
 }
 if(next!==null&&(events.length===0||next!==events[events.length-1].revision))throw new Error('Cursor de historial no verificable.');
}
