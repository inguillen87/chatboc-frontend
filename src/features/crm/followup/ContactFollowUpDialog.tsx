import React, { useEffect, useRef, useState } from 'react';
import { CalendarClock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { followUpApi, FollowUpConflict, FollowUpUnconfirmed, validateFollowUpDraft, type FollowUpSavePhase } from './followUpApi';
import { browserTimeZone, followUpDateLabel, followUpKey, fromLocalDateTime, toLocalDateTime, validScheduledInstant,
  type FollowUpIdentity, type FollowUpSnapshot } from './followUpModel';
import './followUp.css';
interface Props { identity: FollowUpIdentity; onClose: ()=>void; onSaved?: ()=>void; returnFocus?: HTMLElement|null }
export function ContactFollowUpDialog(props: Props) {
  return <FollowUpSession key={followUpKey(props.identity)} {...props}/>;
}
function FollowUpSession({identity,onClose,onSaved,returnFocus}:Props) {
  const [snapshot,setSnapshot]=useState<FollowUpSnapshot|null>(null);
  const [notes,setNotes]=useState(''),[dateInput,setDateInput]=useState(''),[clearDate,setClearDate]=useState(false);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[phase,setPhase]=useState<FollowUpSavePhase>('checking');
  const [confirm,setConfirm]=useState(false),[discard,setDiscard]=useState(false);
  const alive=useRef(false),sequence=useRef(0),lock=useRef(false),nextNavigation=useRef<(()=>void)|null>(null);
  const dirty=Boolean(snapshot && (notes!==snapshot.notes || dateInput!==toLocalDateTime(snapshot.nextActionAt) || (clearDate && snapshot.nextActionAt!==null)));
  const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
  const clearPrivate=()=>{setSnapshot(null);setNotes('');setDateInput('');setClearDate(false);setConfirm(false);setMessage('');};
  const load=async()=>{
    if(lock.current)return;lock.current=true;const request=++sequence.current;
    setLoading(true);setError('');setMessage('');clearPrivate();
    try {const data=await followUpApi.read(identity);if(!alive.current||request!==sequence.current)return;
      setSnapshot(data);setNotes(data.notes);setDateInput(toLocalDateTime(data.nextActionAt));setBlocked(false);
    }catch{if(alive.current&&request===sequence.current){clearPrivate();setBlocked(true);setError('No pudimos verificar el contacto. No se muestran datos anteriores ni se habilita el guardado.');}}
    finally{if(request===sequence.current){lock.current=false;if(alive.current)setLoading(false);}}
  };
  useEffect(()=>{alive.current=true;lock.current=false;void load();return()=>{alive.current=false;sequence.current+=1;};},[]);
  useEffect(()=>{
    const warn=(event:BeforeUnloadEvent)=>{if(dirtyRef.current||lock.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[]);
  const navigate=(action:()=>void)=>{if(lock.current)return;if(dirtyRef.current){nextNavigation.current=action;setDiscard(true);}else action();};
  const desired=()=>validateFollowUpDraft({notes,nextActionAt:clearDate?null:dateInput===toLocalDateTime(snapshot?.nextActionAt||null)?snapshot?.nextActionAt||null:fromLocalDateTime(dateInput)});
  const review=(event:React.FormEvent)=>{event.preventDefault();if(!snapshot||blocked||lock.current||!dirty)return;
    try{desired();setError('');setConfirm(true);}catch(failure){setError((failure as Error).message);}
  };
  const save=async()=>{
    if(!confirm||!snapshot||lock.current||blocked)return;
    let draft;try{draft=desired();}catch(failure){setError((failure as Error).message);return;}
    lock.current=true;setBusy(true);setError('');setMessage('');const request=sequence.current;
    try{
      const verified=await followUpApi.save(snapshot,draft,value=>{if(alive.current&&request===sequence.current)setPhase(value);},()=>alive.current&&request===sequence.current);
      if(!alive.current||request!==sequence.current)return;
      setSnapshot(verified);setNotes(verified.notes);setDateInput(toLocalDateTime(verified.nextActionAt));setClearDate(false);
      setMessage('Seguimiento guardado y verificado en el servidor.');onSaved?.();
    }catch(failure){if(!alive.current||request!==sequence.current)return;
      const status=Number((failure as {status?:number})?.status);
      if([401,403,404].includes(status))clearPrivate();
      setBlocked(true);setError(failure instanceof FollowUpConflict||failure instanceof FollowUpUnconfirmed?failure.message:'La comprobación del contacto falló. Actualizá la ficha antes de intentar otra vez.');
    }finally{if(alive.current&&request===sequence.current){setBusy(false);setConfirm(false);lock.current=false;}}
  };
  const phaseLabel={checking:'Comprobando versión…',saving:'Guardando…',verifying:'Verificando persistencia…'}[phase];
  return <><Dialog open onOpenChange={open=>{if(!open)navigate(onClose);}}>
    <DialogContent className="followup-dialog" onCloseAutoFocus={event=>{event.preventDefault();returnFocus?.focus();}}
      onEscapeKeyDown={event=>{if(lock.current||dirtyRef.current){event.preventDefault();navigate(onClose);}}}
      onPointerDownOutside={event=>{if(lock.current||dirtyRef.current){event.preventDefault();navigate(onClose);}}}>
      <DialogHeader><DialogTitle>Seguimiento del contacto</DialogTitle><DialogDescription>Organización {identity.tenantSlug} · Contacto {identity.contactId}</DialogDescription></DialogHeader>
      <div className="followup-toolbar"><p className="followup-note">Zona horaria: {browserTimeZone()}</p><Button variant="outline" disabled={busy||loading} onClick={()=>navigate(()=>void load())}><RefreshCw size={16} aria-hidden="true"/>Actualizar ficha</Button></div>
      {loading && <p role="status">Verificando seguimiento…</p>}
      {error && <p role="alert" className="followup-warning">{error}</p>}
      {message && <p role="status" className="followup-message">{message}</p>}
      {snapshot && <>
        <header className="followup-contact"><h3>{snapshot.name}</h3><p>Próxima acción guardada: <strong>{followUpDateLabel(snapshot.nextActionAt)}</strong></p></header>
        {snapshot.nextActionAt && !validScheduledInstant(snapshot.nextActionAt) && <p className="followup-warning">La fecha guardada no tiene un formato verificable. Elegí una fecha válida o quitá la fecha explícitamente antes de guardar.</p>}
        <form className="followup-form" onSubmit={review}>
          <label>Notas del responsable<textarea aria-label="Notas del responsable" value={notes} onChange={event=>setNotes(event.target.value)} rows={5} maxLength={1200} disabled={busy} placeholder="Próximo paso acordado, contexto y resultado del seguimiento."/></label>
          <p className="followup-note">{notes.length}/1200 caracteres. Estas notas se guardan en el contacto, no se envían al destinatario.</p>
          <label>Próxima acción<input type="datetime-local" aria-label="Próxima acción" value={dateInput} disabled={busy} onChange={event=>{setDateInput(event.target.value);setClearDate(event.target.value==='');}}/></label>
          <div className="followup-toolbar"><Button type="button" variant="outline" disabled={busy||(!dateInput&&!snapshot.nextActionAt)} onClick={()=>{setDateInput('');setClearDate(true);}}>Quitar fecha</Button><span className="followup-note">Quitar la fecha no marca una tarea como completada.</span></div>
          <p className="followup-note">Una próxima acción por contacto. No crea un evento de calendario, una notificación automática ni una asignación a otro usuario.</p>
          <Button type="submit" disabled={busy||blocked||!dirty}>{busy?phaseLabel:'Revisar seguimiento'}</Button>
        </form>
        <details className="followup-details"><summary>Última actualización y alcance</summary><p>Fecha registrada: {followUpDateLabel(snapshot.updatedAt)}. {snapshot.updatedBy?`Usuario #${snapshot.updatedBy}.`:'Usuario no informado.'}</p><p>Se comprueba la versión antes de escribir y se vuelve a leer después. El backend actual no ofrece bloqueo entre editores ni garantía de una sola ejecución ante una reconexión.</p></details>
      </>}
    </DialogContent>
  </Dialog>
  <AlertDialog open={confirm} onOpenChange={value=>{if(!lock.current)setConfirm(value);}}><AlertDialogContent className="followup-confirm">
    <AlertDialogHeader><AlertDialogTitle>Confirmar seguimiento</AlertDialogTitle><AlertDialogDescription>Se actualizarán las notas y la próxima acción de {snapshot?.name || identity.contactId} en {identity.tenantSlug}. No se enviará un mensaje.</AlertDialogDescription></AlertDialogHeader>
    <p className="followup-preview">{notes.trim()||'Sin notas'}</p><p>Fecha: {clearDate||!dateInput?'Sin fecha':`${dateInput.replace('T',' ')} · ${browserTimeZone()}`}</p>
    <AlertDialogFooter><Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>Volver sin guardar</Button><Button disabled={busy} onClick={()=>void save()}>{busy?phaseLabel:'Guardar seguimiento'}</Button></AlertDialogFooter>
  </AlertDialogContent></AlertDialog>
  <AlertDialog open={discard} onOpenChange={value=>{setDiscard(value);if(!value)nextNavigation.current=null;}}><AlertDialogContent className="followup-confirm">
    <AlertDialogHeader><AlertDialogTitle>Hay un borrador sin guardar</AlertDialogTitle><AlertDialogDescription>La acción pendiente descartará el borrador. Si hubo un resultado incierto, revisá lo guardado en el servidor antes de repetir una actualización.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><Button variant="outline" onClick={()=>{setDiscard(false);nextNavigation.current=null;}}>Seguir editando</Button><Button onClick={()=>{const action=nextNavigation.current;nextNavigation.current=null;setDiscard(false);action?.();}}>Descartar y continuar</Button></AlertDialogFooter>
  </AlertDialogContent></AlertDialog></>;
}
export function ContactFollowUpButton({identity,onSaved}:{identity:FollowUpIdentity;onSaved?:()=>void}) {
  const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
  return <><Button ref={trigger} type="button" variant="outline" size="sm" onClick={()=>setOpen(true)}><CalendarClock size={16} aria-hidden="true"/>Programar seguimiento</Button>
    {open && <ContactFollowUpDialog identity={identity} onClose={()=>setOpen(false)} onSaved={onSaved} returnFocus={trigger.current}/>}</>;
}
