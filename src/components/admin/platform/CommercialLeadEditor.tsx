import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { commercialFollowUpApi } from './commercialFollowUpApi';
import { COMMERCIAL_STAGES, STAGE_LABELS, commercialKey, isCommercialStage, stageLabel,
  type CommercialLead, type CommercialEvent, type CommercialStage } from './commercialFollowUp';

export interface EditorLock { dirty: boolean; busy: boolean }
interface Props {
  lead: CommercialLead;
  onLockChange: (lock: EditorLock) => void;
  onSaved: (stage?: CommercialStage) => void;
  onRevoked: () => void;
  onBack: () => void;
}
export const commercialDateLabel = (value: string | null) => !value ? 'Fecha no informada' : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? new Date(value).toLocaleString('es-AR') : `${value.replace('T', ' ')} (zona horaria no informada)`;
const isDenied = (error: unknown) => [401, 403, 404].includes(Number((error as { status?: number } | null)?.status));
const eventLabel = (event: CommercialEvent) => event.event.includes('stage') ? 'Cambio de etapa' : ['note', 'tenant_note'].includes(event.event) ? 'Nota de seguimiento' : event.event || 'Actividad';

export function CommercialLeadEditor(props: Props) {
  // New identity means a new session: requests, drafts and receipts cannot cross it.
  return <EditorSession key={commercialKey(props.lead)} {...props} />;
}
function EditorSession({ lead, onLockChange, onSaved, onRevoked, onBack }: Props) {
  const [events, setEvents] = useState<CommercialEvent[]>([]);
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [historyError, setHistoryError] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [currentStage, setCurrentStage] = useState(lead.stage);
  const [nextStage, setNextStage] = useState(lead.stage);
  const [confirmStage, setConfirmStage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const [writeError, setWriteError] = useState('');
  const alive = useRef(false);
  const readVersion = useRef(0);
  const historyReadLock = useRef(false);
  const writeLock = useRef(false);
  const dirty = Boolean(note.trim() || reason.trim() || nextStage !== currentStage);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const callbacks = useRef({ onLockChange, onSaved, onRevoked }); callbacks.current = { onLockChange, onSaved, onRevoked };
  useEffect(() => { onLockChange({ dirty, busy: saving }); }, [dirty, saving, onLockChange]);
  useEffect(() => { setCurrentStage(lead.stage); setNextStage(lead.stage); }, [lead.stage]);
  const revoke = () => {
    setEvents([]); setNote(''); setReason(''); setConfirmStage(false); setUncertain(true); setHistoryState('error');
    callbacks.current.onRevoked();
  };
  const loadHistory = async () => {
    if (historyReadLock.current || writeLock.current) return;
    historyReadLock.current = true;
    const version = ++readVersion.current;
    setHistoryState('loading'); setHistoryError(''); setEvents([]);
    try {
      const response = await commercialFollowUpApi.timeline(lead);
      if (!alive.current || version !== readVersion.current) return;
      setEvents(response); setHistoryState('ready'); setUncertain(false);
    } catch (error) {
      if (!alive.current || version !== readVersion.current) return;
      if (isDenied(error)) { revoke(); return; }
      setHistoryState('error'); setHistoryError('No pudimos verificar el historial. Las escrituras están en pausa.');
    } finally { if (version === readVersion.current) historyReadLock.current = false; }
  };
  useEffect(() => {
    alive.current = true; historyReadLock.current = false; void loadHistory();
    return () => { alive.current = false; readVersion.current += 1; callbacks.current.onLockChange({ dirty: false, busy: false }); };
  }, []);
  const startWrite = () => {
    if (writeLock.current || historyReadLock.current || uncertain || historyState !== 'ready') return false;
    writeLock.current = true; setSaving(true); setWriteError(''); setMessage('');
    callbacks.current.onLockChange({ dirty: dirtyRef.current, busy: true });
    return true;
  };
  const finishWrite = () => {
    writeLock.current = false;
    if (alive.current) { setSaving(false); callbacks.current.onLockChange({ dirty: dirtyRef.current, busy: false }); }
  };
  const failedWrite = (error: unknown) => {
    if (!alive.current) return;
    if (isDenied(error)) { revoke(); return; }
    setUncertain(true);
    setWriteError('No se confirmó el guardado. Conservamos el borrador y no lo reenviamos. Actualizá el historial y revisá si se registró antes de volver a intentar.');
  };
  const saveNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim() || note.trim().length > 1000 || !startWrite()) return;
    const submitted = note.trim();
    try {
      const response = await commercialFollowUpApi.addNote(lead, submitted);
      if (!alive.current) return;
      setEvents(response); setNote(''); setMessage('Nota guardada y confirmada por el servidor.');
      callbacks.current.onSaved();
    } catch (error) { failedWrite(error); }
    finally { finishWrite(); }
  };
  const saveStage = async () => {
    if (!confirmStage || !isCommercialStage(nextStage) || nextStage === currentStage || !reason.trim() || reason.trim().length > 1000 || !startWrite()) return;
    const submittedStage = nextStage;
    let confirmed = false;
    try {
      await commercialFollowUpApi.changeStage(lead, submittedStage, reason);
      if (!alive.current) return;
      setCurrentStage(submittedStage); setNextStage(submittedStage); setReason('');
      setMessage(`Etapa ${stageLabel(submittedStage)} guardada y confirmada por el servidor.`);
      callbacks.current.onSaved(submittedStage);
      confirmed = true;
    } catch (error) { failedWrite(error); }
    finally { if (alive.current) setConfirmStage(false); finishWrite(); if (confirmed && alive.current) void loadHistory(); }
  };
  const disabled = saving || uncertain || historyState !== 'ready';
  return <section className="commercial-editor" aria-label={`Seguimiento de ${lead.name}`}>
    <header className="commercial-editor-heading">
      <Button type="button" variant="outline" onClick={onBack} disabled={saving}>Volver al listado</Button>
      <h3>{lead.name}</h3><p>{lead.tenantSlug} · {lead.ticketType} · Caso {lead.number} · ID interno {lead.ticketId}</p>
      <p>{lead.email || 'Sin correo informado'} · {lead.phone || 'Sin teléfono informado'}</p>
      <span className="commercial-stage">{stageLabel(currentStage)}</span>
    </header>
    <div role="status" aria-live="polite">{message}</div>
    {writeError && <p role="alert" className="commercial-warning">{writeError}</p>}
    <form onSubmit={saveNote} className="commercial-form">
      <h4>Registrar seguimiento</h4>
      <label>Nota de seguimiento<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} disabled={saving}
        placeholder="Resultado de la llamada, reunión o próximo paso acordado." /></label>
      <p className="commercial-hint">{note.length}/1000 caracteres. La nota se guarda en el caso; no envía mensajes ni crea recordatorios automáticos.</p>
      <Button type="submit" disabled={disabled || !note.trim() || note.trim().length > 1000}>{saving ? 'Guardando…' : 'Guardar nota'}</Button>
    </form>
    <form onSubmit={(event) => { event.preventDefault(); if (!disabled && isCommercialStage(nextStage) && nextStage !== currentStage && reason.trim()) setConfirmStage(true); }} className="commercial-form">
      <h4>Cambiar etapa comercial</h4>
      <label>Nueva etapa<select value={nextStage} disabled={saving} onChange={(event) => setNextStage(event.target.value)}>
        {!isCommercialStage(nextStage) && <option value={nextStage}>Etapa no informada</option>}
        {COMMERCIAL_STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
      </select></label>
      <label>Motivo del cambio<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={2} disabled={saving} /></label>
      <p className="commercial-hint">Se registra el motivo, la fecha y el usuario en el historial. La etapa también modifica el estado del caso.</p>
      <Button type="submit" variant="outline" disabled={disabled || !isCommercialStage(nextStage) || nextStage === currentStage || !reason.trim() || reason.trim().length > 1000}>Revisar cambio de etapa</Button>
    </form>
    <section className="commercial-history" aria-label="Historial comercial">
      <div className="commercial-history-heading"><h4>Historial del caso</h4><Button variant="outline" type="button" disabled={saving || historyState === 'loading'} onClick={() => void loadHistory()}>Actualizar historial</Button></div>
      <p className="commercial-hint">Hasta los últimos 100 eventos que publica el servidor. No es un registro inmutable ni acredita acciones fuera del sistema.</p>
      {historyState === 'loading' ? <p role="status">Consultando historial…</p> : historyError ? <p role="alert">{historyError}</p> : !events.length ? <p>No hay eventos registrados en el historial disponible.</p> :
        <ol>{events.map((event, index) => <li key={`${event.at}:${index}`}><strong>{eventLabel(event)}</strong>
          <p>{commercialDateLabel(event.at)} · {event.actor ? `Usuario #${event.actor}` : 'Usuario no informado'}</p>
          {(event.from || event.to) && <p>{stageLabel(event.from)} → {stageLabel(event.to)}</p>}
          {event.note && <p className="commercial-event-note">{event.note}</p>}
        </li>)}</ol>}
    </section>
    <AlertDialog open={confirmStage} onOpenChange={(open) => { if (!writeLock.current) setConfirmStage(open); }}>
      <AlertDialogContent className="commercial-confirm"><AlertDialogHeader><AlertDialogTitle>Confirmar cambio de etapa</AlertDialogTitle>
        <AlertDialogDescription>Organización {lead.tenantSlug}, caso {lead.number}, ID {lead.ticketId}. {stageLabel(currentStage)} → {stageLabel(nextStage)}.
          {nextStage === 'ganado' ? ' El caso quedará cerrado.' : nextStage === 'perdido' ? ' El caso quedará cancelado.' : ' También se actualizará el estado operativo del caso.'}
        </AlertDialogDescription></AlertDialogHeader>
        <p className="commercial-event-note">{reason}</p>
        <AlertDialogFooter><Button variant="outline" disabled={saving} onClick={() => setConfirmStage(false)}>Cancelar cambio</Button>
          <Button disabled={saving} onClick={() => void saveStage()}>{saving ? 'Confirmando…' : 'Confirmar cambio'}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
