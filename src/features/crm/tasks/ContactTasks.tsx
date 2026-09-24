import React,{useEffect,useRef,useState} from 'react';
import {ListTodo,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter} from '@/components/ui/alert-dialog';
import {asRecord,followUpKey,fromLocalDateTime,toLocalDateTime,followUpDateLabel,browserTimeZone,type FollowUpIdentity} from '../followup/followUpModel';
import {taskApi,type CrmTask,type TaskCapabilities,type TaskList,type TaskOperation,type TaskEvent} from './taskApi';
import './tasks.css';
export function ContactTasksEntry({identity}:{identity:FollowUpIdentity}){
 const [cap,setCap]=useState<TaskCapabilities|null>(null),[open,setOpen]=useState(false);const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{let active=true;setCap(null);setOpen(false);void taskApi.capabilities(identity.tenantSlug).then(data=>{if(active)setCap(data.available?data:null);}).catch(()=>{if(active)setCap(null);});return()=>{active=false;};},[identity.tenantSlug]);
 if(!cap||cap.tenant_slug!==identity.tenantSlug)return null;
 return <><Button ref={trigger} type="button" variant="outline" size="sm" onClick={()=>setOpen(true)}><ListTodo size={16} aria-hidden="true"/>{cap.ui.title}</Button>
  {open&&<TaskWorkspace key={followUpKey(identity)} identity={identity} cap={cap} returnFocus={trigger.current} onClose={()=>setOpen(false)}/>}</>;
}
export function TaskWorkspace(props:{identity:FollowUpIdentity;cap:TaskCapabilities;onClose:()=>void;returnFocus?:HTMLElement|null}){
 if(!props.cap.available||props.cap.tenant_slug!==props.identity.tenantSlug)return null;
 return <TaskWorkspaceSession key={followUpKey(props.identity)} {...props}/>;
}
function TaskWorkspaceSession({identity,cap,onClose,returnFocus}:{identity:FollowUpIdentity;cap:TaskCapabilities;onClose:()=>void;returnFocus?:HTMLElement|null}){
 const [data,setData]=useState<TaskList|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [selected,setSelected]=useState<CrmTask|'new'|null>(null),[assignees,setAssignees]=useState<Array<{id:number;name:string}>>([]);
 const [discard,setDiscard]=useState(false),[editLock,setEditLock]=useState({dirty:false,busy:false});
 const alive=useRef(false),version=useRef(0),readLock=useRef(false),lock=useRef(editLock);
 const report=(next:typeof editLock)=>{lock.current=next;setEditLock(old=>old.dirty===next.dirty&&old.busy===next.busy?old:next);};
 const load=async(cursor?:string)=>{if(readLock.current||lock.current.busy)return;readLock.current=true;const serial=++version.current;setLoading(true);setError('');if(!cursor){setData(null);setSelected(null);}
  try{const rows=await taskApi.list(identity,cursor);const users=await taskApi.assignees(identity.tenantSlug);if(!alive.current||serial!==version.current)return;
   const merged=cursor&&data?{...rows,items:[...data.items,...rows.items]}:rows;
   if(new Set(merged.items.map(item=>item.id)).size!==merged.items.length)throw new Error('La paginación cambió. Actualizá las tareas.');
   setData(merged);setAssignees(users);
  }catch{if(alive.current&&serial===version.current){setData(null);setSelected(null);setError('No se pudieron verificar las tareas. Se retiraron los datos anteriores.');}}
  finally{if(serial===version.current){readLock.current=false;if(alive.current)setLoading(false);}}
 };
 useEffect(()=>{alive.current=true;readLock.current=false;void load();return()=>{alive.current=false;version.current+=1;};},[]);
 const close=()=>{if(lock.current.busy)return;if(lock.current.dirty)setDiscard(true);else onClose();};
 return <><Dialog open onOpenChange={value=>{if(!value)close();}}><DialogContent className="task-workspace" onCloseAutoFocus={event=>{event.preventDefault();returnFocus?.focus();}}
  onEscapeKeyDown={event=>{if(lock.current.dirty||lock.current.busy){event.preventDefault();close();}}} onPointerDownOutside={event=>{if(lock.current.dirty||lock.current.busy){event.preventDefault();close();}}}>
  <DialogHeader><DialogTitle>{cap.ui.title}</DialogTitle><DialogDescription>{cap.ui.description} · {identity.tenantSlug} · {identity.contactId}</DialogDescription></DialogHeader>
  <div className="task-toolbar"><Button variant="outline" disabled={loading||editLock.busy||editLock.dirty} onClick={()=>void load()}><RefreshCw size={16} aria-hidden="true"/>Actualizar tareas</Button>
   {cap.can_create&&<Button disabled={loading||editLock.busy||editLock.dirty} onClick={()=>setSelected('new')}>{cap.ui.create}</Button>}</div>
  {loading&&<p role="status">Consultando tareas…</p>}{error&&<p role="alert" className="task-warning">{error}</p>}
  {data&&<><div className="task-metrics">{Object.entries(cap.statuses).map(([status,label])=><div key={status}><span>{label}</span><strong>{data.counts[status as keyof typeof data.counts]}</strong></div>)}</div>
   <p className="task-note">{data.items.length} tareas cargadas de {data.total} para este contacto. Zona: {browserTimeZone()}.</p>
   <div className="task-layout"><ul className="task-list" aria-label="Tareas del contacto">{data.items.map(task=><li key={task.id}><button type="button" aria-label={`Abrir tarea ${task.title}`} disabled={loading||editLock.busy||editLock.dirty} aria-pressed={selected!=='new'&&selected?.id===task.id} onClick={()=>setSelected(task)}>
    <strong>{task.title}</strong><span>{cap.statuses[task.status]} · {cap.priorities[task.priority]||task.priority}</span>
    <span>{task.assignee_id?assignees.find(user=>user.id===task.assignee_id)?.name||`Usuario #${task.assignee_id}`:cap.ui.unassigned}</span><span>{followUpDateLabel(task.due_at)}</span><small>Versión {task.revision}</small>
   </button></li>)}{!data.items.length&&<li>No hay tareas registradas para este contacto.</li>}
    {data.next_cursor&&<li><Button variant="outline" disabled={loading||editLock.dirty||editLock.busy} onClick={()=>void load(data.next_cursor!)}>Cargar más tareas</Button></li>}</ul>
    {selected?<TaskEditor key={selected==='new'?'new':`${selected.id}:${selected.revision}`} identity={identity} cap={cap} task={selected==='new'?null:selected} assignees={assignees} report={report}
      onRevoked={()=>{setData(null);setSelected(null);setAssignees([]);report({dirty:false,busy:false});setError('El acceso cambió. Se retiraron las tareas.');}} onSaved={()=>{report({dirty:false,busy:false});setSelected(null);void load();}}/>:<div className="task-placeholder">Elegí una tarea para revisar responsable, vencimiento, estado e historial.</div>}
   </div></>}
 </DialogContent></Dialog>
 <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent className="task-confirm"><AlertDialogHeader><AlertDialogTitle>Descartar edición sin guardar</AlertDialogTitle><AlertDialogDescription>El borrador se perderá. Una operación ya enviada puede haber quedado registrada; revisá las tareas antes de crear otra.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><Button variant="outline" onClick={()=>setDiscard(false)}>Seguir editando</Button><Button onClick={()=>{setDiscard(false);onClose();}}>Descartar y cerrar</Button></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
interface EditorProps {identity:FollowUpIdentity;cap:TaskCapabilities;task:CrmTask|null;assignees:Array<{id:number;name:string}>;report:(state:{dirty:boolean;busy:boolean})=>void;onSaved:()=>void;onRevoked?:()=>void}
export function TaskEditor(props:EditorProps){return <TaskEditorSession key={JSON.stringify([followUpKey(props.identity),props.task?.id,props.task?.revision])} {...props}/>;}
function TaskEditorSession({identity,cap,task,assignees,report,onSaved,onRevoked}:EditorProps){
 const [title,setTitle]=useState(task?.title||''),[description,setDescription]=useState(task?.description||''),[assigned,setAssigned]=useState(task?.assignee_id?.toString()||'');
 const [due,setDue]=useState(toLocalDateTime(task?.due_at||null)),[priority,setPriority]=useState(task?.priority||'normal'),[status,setStatus]=useState(task?.status||'todo'),[reason,setReason]=useState('');
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retryAllowed,setRetryAllowed]=useState(false);
 const [pending,setPending]=useState<TaskOperation|null>(null),[events,setEvents]=useState<TaskEvent[]>([]),[nextEvent,setNextEvent]=useState<number|null>(null),[historyReady,setHistoryReady]=useState(!task),[stale,setStale]=useState(false);
 const alive=useRef(false),writeLock=useRef(false),historyLock=useRef(false),callback=useRef({report,onSaved,onRevoked});callback.current={report,onSaved,onRevoked};
 const [access,setAccess]=useState(task?.permissions||{can_edit:cap.can_create,statuses:[]});
 const historyVersion=useRef(0);
 const editable=task?access.can_edit:cap.can_create;
 const canChange=editable||!!access.statuses.length;
 const dirty=!!pending||title!==(task?.title||'')||description!==(task?.description||'')||assigned!==(task?.assignee_id?.toString()||'')||due!==toLocalDateTime(task?.due_at||null)||priority!==(task?.priority||'normal')||status!==(task?.status||'todo')||!!reason;
 const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
 useEffect(()=>{callback.current.report({dirty,busy});},[dirty,busy]);
 const readHistory=async(before?:number)=>{if(!task||historyLock.current||writeLock.current)return;historyLock.current=true;const serial=++historyVersion.current;
  try{const data=await taskApi.detail(identity,task.id,before);if(!alive.current||serial!==historyVersion.current)return;setAccess(data.task.permissions);setEvents(old=>before?[...old,...data.events]:data.events);setNextEvent(data.next_before_revision);setHistoryReady(true);setStale(data.task.revision!==task.revision);}
  catch(failure){if(alive.current&&serial===historyVersion.current){setHistoryReady(false);setEvents([]);setNextEvent(null);setError('No se pudo verificar el historial. Actualizá la tarea.');if([401,403,404].includes(Number((failure as {status?:number})?.status)))callback.current.onRevoked?.();}}
  finally{if(serial===historyVersion.current)historyLock.current=false;}
 };
 useEffect(()=>{alive.current=true;historyLock.current=false;void readHistory();const warn=(event:BeforeUnloadEvent)=>{if(dirtyRef.current||writeLock.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>{alive.current=false;historyVersion.current+=1;window.removeEventListener('beforeunload',warn);callback.current.report({dirty:false,busy:false});};},[]);
 const buildPayload=()=>{
  const data:Record<string,unknown>={reason:reason.trim()||(!task?'Creación de tarea':'')};
  if(!task||editable)Object.assign(data,{title:title.trim(),description:description.trim(),assignee_id:assigned?Number(assigned):null,due_at:task&&due===toLocalDateTime(task.due_at)?task.due_at:fromLocalDateTime(due),priority});
  if(task){data.expected_revision=task.revision;if(status!==task.status)data.status=status;}
  return data;
 };
 const review=(event:React.FormEvent)=>{event.preventDefault();if(writeLock.current||pending||stale||!historyReady)return;try{buildPayload();setError('');setConfirm(true);}catch(failure){setError((failure as Error).message);}};
 const save=async(retry=false)=>{
  if(writeLock.current||!alive.current||(!retry&&!confirm))return;
  let operation=pending;
  if(!retry){try{operation={identity:{...identity},taskId:task?.id,key:crypto.randomUUID(),payload:buildPayload()};}catch(failure){setError((failure as Error).message);return;}}
  if(!operation)return;writeLock.current=true;setBusy(true);setPending(operation);setError('');setRetryAllowed(false);callback.current.report({dirty:true,busy:true});
  let saved=false;
  try{await taskApi.execute(operation);if(alive.current){saved=true;setPending(null);callback.current.report({dirty:false,busy:false});callback.current.onSaved();}}
  catch(failure){if(!alive.current)return;const statusCode=Number((failure as {status?:number})?.status),body=asRecord((failure as {body?:unknown})?.body),code=asRecord(body.error).code;
   if([401,403,404].includes(statusCode)){setTitle('');setDescription('');setEvents([]);callback.current.onRevoked?.();}
   setRetryAllowed(code==='task_transaction_conflict'||![400,401,403,404,409,428].includes(statusCode));
   setError(code==='stale_revision'?'La versión cambió. Cerrá el borrador y actualizá la tarea antes de editar.':'La operación no se confirmó. No se envió otra solicitud automáticamente.');
  }finally{writeLock.current=false;if(alive.current){setBusy(false);setConfirm(false);if(!saved)callback.current.report({dirty:dirtyRef.current,busy:false});}}
 };
 const disabled=busy||!!pending;
 return <section className="task-editor" aria-label={task?'Editar tarea':'Nueva tarea'}><h3>{task?task.title:cap.ui.create}</h3>
  {error&&<p role="alert" className="task-warning">{error}</p>}{stale&&<p role="alert">La ficha tiene una versión anterior. Cerrá y actualizá antes de guardar.</p>}
  <form onSubmit={review}>
   <label>Título<input value={title} maxLength={160} required disabled={disabled||!editable} onChange={event=>setTitle(event.target.value)}/></label>
   <label>Descripción<textarea rows={3} value={description} maxLength={3000} disabled={disabled||!editable} onChange={event=>setDescription(event.target.value)}/></label>
   <label>{cap.ui.assignee}<select aria-label={cap.ui.assignee} value={assigned} disabled={disabled||!editable} onChange={event=>setAssigned(event.target.value)}><option value="">{cap.ui.unassigned}</option>{assigned&&!assignees.some(user=>String(user.id)===assigned)&&<option value={assigned}>Usuario #{assigned} · no disponible</option>}{assignees.map(user=><option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
   <label>{cap.ui.due}<input aria-label={cap.ui.due} type="datetime-local" value={due} disabled={disabled||!editable} onChange={event=>setDue(event.target.value)}/></label>
   <label>Prioridad<select aria-label="Prioridad" value={priority} disabled={disabled||!editable} onChange={event=>setPriority(event.target.value)}>{Object.entries(cap.priorities).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   {task&&<label>Estado<select aria-label="Estado" value={status} disabled={disabled||!access.statuses.length} onChange={event=>setStatus(event.target.value as CrmTask['status'])}><option value={task.status}>{cap.statuses[task.status]}</option>{access.statuses.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
   <label>{cap.ui.reason}<textarea aria-label={cap.ui.reason} rows={2} maxLength={1200} value={reason} required={!!task} disabled={disabled} onChange={event=>setReason(event.target.value)}/></label>
   <p className="task-note">El vencimiento no envía mensajes ni crea eventos externos. Cada cambio conserva una versión y su motivo.</p>
   <Button type="submit" disabled={disabled||!canChange||!dirty||!title.trim()||!!task&&!reason.trim()||stale||!historyReady}>Revisar cambios</Button>
   {pending&&retryAllowed&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void save(true)}>Verificar y reintentar la misma operación</Button>}
  </form>
  {task&&<details className="task-history"><summary>{cap.ui.history}</summary><p className="task-note">Versión de edición: {task.revision}. El historial se consulta en páginas de 20 eventos.</p>
   <ol>{events.map(event=><li key={event.id}><strong>Versión {event.revision} · {event.operation==='created'?'Creación':'Actualización'}</strong><span>{followUpDateLabel(event.at)} · Usuario #{event.actor_id}</span><p>{event.reason}</p></li>)}</ol>
   {nextEvent&&<Button variant="outline" disabled={busy} onClick={()=>void readHistory(nextEvent)}>Ver eventos anteriores</Button>}
  </details>}
  <AlertDialog open={confirm} onOpenChange={value=>{if(!writeLock.current)setConfirm(value);}}><AlertDialogContent className="task-confirm"><AlertDialogHeader><AlertDialogTitle>Confirmar tarea</AlertDialogTitle><AlertDialogDescription>{identity.tenantSlug} · {identity.contactId}. {task?`Se modificará la versión ${task.revision}.`:'Se creará una tarea independiente.'}</AlertDialogDescription></AlertDialogHeader><p>{title}</p><p>{reason||'Creación de tarea'}</p><AlertDialogFooter><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Volver sin guardar</Button><Button disabled={busy} onClick={()=>void save()}>{busy?'Guardando…':cap.ui.save}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </section>;
}
