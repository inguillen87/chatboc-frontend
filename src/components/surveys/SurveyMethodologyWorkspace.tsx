import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenText, ChevronDown, Clock3, FilePenLine, Loader2, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { getSurveyMethodology, saveSurveyMethodology } from '@/api/surveyMethodology';
import { getErrorMessage } from '@/utils/api';
import { type Methodology, type MethodologyScope, type MethodologyWrite, sameMethodologyFields } from '@/utils/surveyMethodology';
import { useSurveyWorkspaceLease } from '@/hooks/useSurveyWorkspaceLease';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import styles from './SurveyMethodologyWorkspace.module.css';

const errorStatus=(error:unknown)=>typeof error==='object'&&error!==null&&'status' in error?Number(error.status):0;
const denied=(error:unknown)=>[401,403].includes(errorStatus(error));
const scopeKey=(scope:MethodologyScope,revision:number|null)=>['surveys','methodology',scope.tenantSlug,scope.tenantId,scope.surveyId,revision??'current'] as const;

export function SurveyMethodologyWorkspace({surveyId,tenantId,tenantSlug}:{surveyId?:number;tenantId?:number;tenantSlug?:string}) {
 if(!surveyId||!tenantId||!tenantSlug?.trim())return null;
 const scope={surveyId,tenantId,tenantSlug:tenantSlug.trim()};
 return <MethodologyWorkspace key={JSON.stringify(scope)} scope={scope} />;
}

function MethodologyWorkspace({scope}:{scope:MethodologyScope}) {
 const [revision,setRevision]=useState<number|null>(null);
 const [accessDenied,setAccessDenied]=useState(false);
 const client=useQueryClient();
 const query=useQuery({queryKey:scopeKey(scope,revision),queryFn:()=>getSurveyMethodology(scope,revision),enabled:!accessDenied,
   retry:false,refetchOnWindowFocus:false,staleTime:0});
 const data=query.data;
 // A read can be rejected by cache revalidation, outside the editor reload callback.
 // Latch revocation here and evict every private revision before another refetch.
 useEffect(()=>{
  if(!denied(query.error))return;
  setAccessDenied(true);
  client.removeQueries({queryKey:['surveys','methodology',scope.tenantSlug,scope.tenantId,scope.surveyId]});
 },[query.error,client,scope.tenantSlug,scope.tenantId,scope.surveyId]);
 if(accessDenied||denied(query.error))return null;
 // Backward compatibility with an API that does not yet expose this module.
 if(!data&&errorStatus(query.error)===404)return null;
 if(!data)return query.isPending?<div className={styles.loading} role="status"><Loader2 className={styles.spinner} size={20} aria-hidden="true" /></div>
   :query.error?<p role="alert" className={styles.error}>{getErrorMessage(query.error)}</p>:null;
 if(!data.available)return <section className={styles.unavailable} role="status"><BookOpenText size={18} aria-hidden="true" />{data.ui.disabled}</section>;
 return <MethodologyEditor key={revision??'current'} data={data} busy={query.isFetching} readError={query.error} scope={scope}
   onSelect={setRevision} onDeny={()=>{setAccessDenied(true);client.removeQueries({queryKey:['surveys','methodology',scope.tenantSlug,scope.tenantId,scope.surveyId]});}}
   onReload={async()=>{const result=await query.refetch();if(result.error||!result.data)throw result.error??new Error('methodology_read_unverified');return result.data;}}
   onSaved={value=>{client.setQueryData(scopeKey(scope,revision),value);}}
 />;
}

/** Local edits belong only to this mounted organization, instrument and selected version. */
function MethodologyEditor({data,busy,readError,scope,onSelect,onReload,onSaved,onDeny}:{
 data:Methodology;busy:boolean;readError:unknown;scope:MethodologyScope;onSelect:(revision:number|null)=>void;
 onReload:()=>Promise<Methodology>;onSaved:(value:Methodology)=>void;onDeny:()=>void;
}) {
 const prefix=useId();const captureLease=useSurveyWorkspaceLease();const lock=useRef(false);
 const [base,setBase]=useState(data);const [fields,setFields]=useState({...data.profile.fields});
 const [reason,setReason]=useState('');const [editing,setEditing]=useState(false);const [saving,setSaving]=useState(false);
 const [reviewRequired,setReviewRequired]=useState(false);const [feedback,setFeedback]=useState<{error:boolean;text:string}|null>(null);
 const [confirmDiscard,setConfirmDiscard]=useState(false);
 const changed=!sameMethodologyFields(fields,base.profile.fields);
 const dirty=changed||reason.length>0;
 useEffect(()=>{if(!dirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const conflict=base.latest_revision!==data.latest_revision||base.current_instrument_revision!==data.current_instrument_revision;
 const blocked=busy||saving||!!readError;
 const readonly=!data.capabilities.can_edit||base.profile.revision!==data.latest_revision;
 const copy=data.ui;
 useEffect(()=>{if(!dirty&&!saving){setBase(data);setFields({...data.profile.fields});}},[data]);
 const localMissing=Object.keys(fields).filter(key=>!fields[key].trim()||key==='design'&&fields[key]==='unknown');
 const documented=data.coverage.total-localMissing.length;
 const accept=(value:Methodology)=>{setBase(value);setFields({...value.profile.fields});setReason('');setReviewRequired(false);setEditing(false);};
 const reload=async()=>{
  if(lock.current)return;const current=captureLease();lock.current=true;setSaving(true);
  try{const value=await onReload();if(current()){accept(value);setFeedback(null);}}
  catch(error){if(current()){if(denied(error)){onDeny();return;}setFeedback({error:true,text:getErrorMessage(error)||copy.refresh_failed});}}
  finally{if(current()){lock.current=false;setSaving(false);}}
 };
 const submit=async(event:FormEvent)=>{
  event.preventDefault();
  if(lock.current||blocked||readonly||conflict||reviewRequired||!editing||reason.trim().length<8||reason.length>500||!changed&&!base.linked_instrument_changed)return;
  const current=captureLease();lock.current=true;setSaving(true);setFeedback(null);
  const payload:MethodologyWrite={contract_version:'surveys.methodology.write.v1',expected_revision:base.profile.revision,
   expected_instrument_revision:base.current_instrument_revision,fields:{...fields},change_reason:reason};
  try{
   const value=await saveSurveyMethodology(scope,payload);
   if(current()){onSaved(value);accept(value);setFeedback({error:false,text:value.unchanged?copy.unchanged:copy.saved});}
  }catch(error){
   if(current()){
    if(denied(error)){onDeny();return;}
    setReviewRequired(![400,413,415].includes(errorStatus(error)));
    setFeedback({error:true,text:getErrorMessage(error)||copy.write_error});
   }
  }finally{if(current()){lock.current=false;setSaving(false);}}
 };
 return <section className={styles.panel} aria-labelledby={`${prefix}-title`} data-testid="survey-methodology" aria-busy={blocked}>
  <header className={styles.header}>
   <div className={styles.heading}><span className={styles.symbol}><BookOpenText size={23} aria-hidden="true" /></span>
    <div><p className={styles.eyebrow}>{copy.eyebrow}</p><h2 id={`${prefix}-title`}>{copy.title}</h2></div></div>
   <span className={styles.revision}>{copy.revision} <strong>{base.profile.revision||'\u2014'}</strong></span>
  </header>
  <p className={styles.description}>{copy.description}</p>
  <div className={styles.disclaimer}><ShieldAlert size={18} aria-hidden="true" /><p>{copy.disclaimer}</p></div>
  <div className={styles.progressRow}>
   <span>{copy.coverage}</span><strong>{editing?documented:base.coverage.documented} / {data.coverage.total}</strong>
   <span>{copy.instrument_revision} {base.profile.instrument_revision??base.current_instrument_revision}</span>
  </div>
  <progress className={styles.progress} value={editing?documented:base.coverage.documented} max={data.coverage.total} aria-label={copy.coverage} />
  {base.linked_instrument_changed?<p role="status" className={styles.notice}>{copy.stale}</p>:null}
  {base.profile.revision<data.latest_revision?<p className={styles.notice}>{copy.viewing_history}</p>:null}
  {(conflict||reviewRequired)&&!feedback?<p role="alert" className={styles.notice}>{conflict?copy.conflict:copy.write_error}</p>:null}
  {readError?<p role="alert" className={styles.notice}>{copy.refresh_failed}</p>:null}
  {feedback?<p role={feedback.error?'alert':'status'} className={feedback.error?styles.error:styles.success}>{feedback.text}</p>:null}
  <div className={styles.toolbar}>
   {!editing&&!readonly?<button type="button" className={styles.primary} disabled={blocked||reviewRequired} onClick={()=>setEditing(true)}><FilePenLine size={17} aria-hidden="true" />{copy.edit}</button>:null}
   <button type="button" disabled={blocked} onClick={()=>{if(dirty||reviewRequired)setConfirmDiscard(true);else void reload();}}><RefreshCw size={17} aria-hidden="true" />{dirty||reviewRequired?copy.discard:copy.refresh}</button>
   {dirty?<span className={styles.pending}>{copy.pending}</span>:null}
  </div>
  <form onSubmit={submit}>
   <div className={styles.groups}>
    {data.schema.map((group,index)=><details className={styles.group} key={group.id} open={index===0?true:undefined}>
     <summary><span className={styles.step}>{index+1}</span><span>{group.title}</span><span className={styles.groupCount}>{group.fields.filter(field=>!localMissing.includes(field.key)).length} / {group.fields.length}</span><ChevronDown size={18} aria-hidden="true" /></summary>
     <div className={styles.fields}>
      {group.fields.map(field=><div key={field.key} className={field.kind==='textarea'?styles.wide:styles.field}>
       <label htmlFor={`${prefix}-${field.key}`}>{field.label}</label>
       {editing&&!readonly?field.kind==='textarea'?<textarea id={`${prefix}-${field.key}`} value={fields[field.key]} maxLength={field.max_length} rows={3} disabled={blocked||reviewRequired||conflict}
        aria-describedby={`${prefix}-${field.key}-help`} onChange={event=>setFields(prev=>({...prev,[field.key]:event.target.value}))}/>
        :field.kind==='select'?<select id={`${prefix}-${field.key}`} value={fields[field.key]} disabled={blocked||reviewRequired||conflict} aria-describedby={`${prefix}-${field.key}-help`}
         onChange={event=>setFields(prev=>({...prev,[field.key]:event.target.value}))}>{field.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>
        :<input id={`${prefix}-${field.key}`} type={field.kind==='date'?'date':'text'} value={fields[field.key]} maxLength={field.max_length} disabled={blocked||reviewRequired||conflict}
         aria-describedby={`${prefix}-${field.key}-help`} onChange={event=>setFields(prev=>({...prev,[field.key]:event.target.value}))}/>
        :<p id={`${prefix}-${field.key}`} className={styles.value} data-empty={localMissing.includes(field.key)}>{field.kind==='select'?field.options?.find(option=>option.value===fields[field.key])?.label:fields[field.key]||copy.missing}</p>}
       <p id={`${prefix}-${field.key}-help`} className={styles.help}>{field.help}</p>
      </div>)}
     </div>
    </details>)}
   </div>
   {editing&&!readonly?<footer className={styles.saveArea}>
    <label htmlFor={`${prefix}-reason`}>{copy.change_reason}</label>
    <textarea id={`${prefix}-reason`} value={reason} onChange={event=>setReason(event.target.value)} rows={2} maxLength={500} minLength={8} required disabled={blocked||conflict||reviewRequired} aria-describedby={`${prefix}-reason-help`}/>
    <p id={`${prefix}-reason-help`} className={styles.help}>{copy.change_help}</p>
    <button type="submit" className={styles.primary} disabled={blocked||conflict||reviewRequired||reason.trim().length<8||!changed&&!base.linked_instrument_changed}>
     {saving?<Loader2 size={17} className={styles.spinner} aria-hidden="true" />:<Save size={17} aria-hidden="true" />}{saving?copy.saving:copy.save}</button>
   </footer>:null}
  </form>
  {data.history.length?<details className={styles.history}>
   <summary><Clock3 size={18} aria-hidden="true" /><span>{copy.history}</span><ChevronDown size={18} aria-hidden="true" /></summary>
   <ol>{data.history.map(entry=><li key={entry.revision}><div><strong>{copy.revision} {entry.revision}</strong><span>{new Date(entry.created_at).toLocaleString('es-AR')}</span>
    <p>{entry.change_reason}</p><small>{copy.instrument_revision} {entry.instrument_revision} {" | "}{copy.author} {entry.actor_user_id}</small></div>
    <button type="button" disabled={blocked||dirty||reviewRequired||entry.revision===base.profile.revision} onClick={()=>onSelect(entry.revision===data.latest_revision?null:entry.revision)}>{copy.view_revision} {entry.revision}</button></li>)}</ol>
   {data.history_has_more?<p className={styles.help}>{copy.history_more}</p>:null}
  </details>:null}
  {base.profile.revision<data.latest_revision?<button type="button" className={styles.current} disabled={blocked||dirty} onClick={()=>onSelect(null)}>{copy.current}</button>:null}
  <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
   <AlertDialogContent className={styles.dialog}><AlertDialogHeader><AlertDialogTitle>{copy.discard_title}</AlertDialogTitle><AlertDialogDescription>{copy.discard_description}</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>{copy.cancel}</AlertDialogCancel><AlertDialogAction onClick={()=>{setConfirmDiscard(false);void reload();}}>{copy.confirm_discard}</AlertDialogAction></AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </section>;
}
