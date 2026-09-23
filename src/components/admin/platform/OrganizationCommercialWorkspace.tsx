import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { commercialFollowUpApi } from './commercialFollowUpApi';
import { COMMERCIAL_STAGES, STAGE_LABELS, downloadCommercialCsv, filterCommercialLeads, stageLabel,
  type CommercialLead, type CommercialList, type CommercialStage } from './commercialFollowUp';
import { CommercialLeadEditor, commercialDateLabel, type EditorLock } from './CommercialLeadEditor';
import './commercialFollowUp.css';

interface Props { tenant: { slug: string; nombre: string }; onClose: () => void; returnFocus?: HTMLElement | null }
export function OrganizationCommercialWorkspace(props: Props) {
  return <WorkspaceSession key={props.tenant.slug} {...props} />;
}
function WorkspaceSession({ tenant, onClose, returnFocus }: Props) {
  const [list, setList] = useState<CommercialList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('all');
  const [selected, setSelected] = useState<CommercialLead | null>(null);
  const [lock, setLock] = useState<EditorLock>({ dirty: false, busy: false });
  const lockRef = useRef(lock);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const version = useRef(0);
  const onLockChange = useCallback((next: EditorLock) => {
    lockRef.current = next;
    setLock((previous) => previous.busy === next.busy && previous.dirty === next.dirty ? previous : next);
  }, []);
  const navigate = (action: () => void) => {
    if (lockRef.current.busy) return;
    if (lockRef.current.dirty) { pendingNavigation.current = action; setDiscardOpen(true); }
    else action();
  };
  const load = async () => {
    if (lockRef.current.busy || lockRef.current.dirty) return;
    const requestVersion = ++version.current;
    setLoading(true); setError(''); setSelected(null);
    try {
      const response = await commercialFollowUpApi.list(tenant.slug);
      if (version.current !== requestVersion) return;
      setList(response);
    } catch {
      if (version.current !== requestVersion) return;
      setList(null); setSelected(null); setError('No pudimos verificar los casos de esta organización. No se muestran datos anteriores.');
    } finally { if (version.current === requestVersion) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { version.current += 1; }; }, []);
  const filtered = useMemo(() => filterCommercialLeads(list?.items || [], query, stage), [list, query, stage]);
  const saved = (newStage?: CommercialStage) => {
    if (!newStage || !selected) return;
    setList((previous) => previous ? { ...previous, items: previous.items.map((row) => row.key === selected.key ? { ...row, stage: newStage } : row) } : previous);
    setSelected((previous) => previous ? { ...previous, stage: newStage } : previous);
  };
  const revoke = () => {
    version.current += 1; setList(null); setSelected(null); setLoading(false);
    onLockChange({ dirty: false, busy: false });
    setError('El acceso al caso fue rechazado o ya no está disponible. Se retiraron sus datos y borradores. Volvé a verificar la organización.');
  };
  return <>
    <Dialog open onOpenChange={(open) => { if (!open) navigate(onClose); }}>
      <DialogContent className="commercial-workspace" onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus?.focus(); }}
        onEscapeKeyDown={(event) => { if (lockRef.current.busy || lockRef.current.dirty) { event.preventDefault(); navigate(onClose); } }}
        onPointerDownOutside={(event) => { if (lockRef.current.busy || lockRef.current.dirty) { event.preventDefault(); navigate(onClose); } }}>
        <DialogHeader><DialogTitle>CRM · {tenant.nombre || tenant.slug}</DialogTitle>
          <DialogDescription>Seguimiento comercial de {tenant.slug}. La organización del caso se mantiene explícita; no cambia tu sesión de SuperAdmin.</DialogDescription>
        </DialogHeader>
        <div className={`commercial-layout ${selected ? 'has-selection' : ''}`}>
          <section className="commercial-list" aria-label="Casos de la organización">
            <div className="commercial-toolbar"><Button variant="outline" disabled={loading || lock.busy || lock.dirty} onClick={() => void load()}>Actualizar casos</Button>
              <Button variant="outline" disabled={loading || Boolean(error) || !filtered.length} onClick={() => downloadCommercialCsv(filtered)}>Exportar casos filtrados</Button></div>
            <label>Buscar casos<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo, teléfono o número" /></label>
            <label>Filtrar por etapa<select value={stage} onChange={(event) => setStage(event.target.value)}><option value="all">Todas las etapas</option><option value="open">Etapas abiertas</option>
              {COMMERCIAL_STAGES.map((value) => <option key={value} value={value}>{STAGE_LABELS[value]}</option>)}
            </select></label>
            <p role="status">{loading ? 'Consultando casos…' : error ? 'Listado no disponible' : `${filtered.length} resultados de ${list?.items.length || 0} casos con identidad verificada.`}</p>
            {list && <p className="commercial-hint">El servicio devolvió {list.received} filas, con un límite solicitado de 100. Los filtros y la exportación sólo incluyen estos casos.
              {list.excluded > 0 ? ` ${list.excluded} filas se excluyeron por identidad ausente, incompatible o duplicada.` : ''}</p>}
            {lock.dirty && <p className="commercial-hint">Hay un borrador abierto. Para actualizar el listado, guardalo o descartalo explícitamente.</p>}
            {error ? <p role="alert" className="commercial-warning">{error}</p> : !loading && !filtered.length ? <p>No hay casos que coincidan con estos filtros.</p> :
              <ul className="commercial-case-list">{filtered.map((row) => <li key={row.key}>
                <button type="button" className={selected?.key === row.key ? 'is-selected' : ''} aria-label={`Seguimiento de ${row.name}, caso ${row.number}`} aria-pressed={selected?.key === row.key} disabled={loading || lock.busy}
                  onClick={() => { if (selected?.key !== row.key) navigate(() => setSelected(row)); }}>
                  <span className="commercial-case-title">{row.name}<span className="commercial-stage">{stageLabel(row.stage)}</span></span>
                  <span>Caso {row.number} · {row.ticketType} · ID {row.ticketId}</span>
                  <span>{row.email || row.phone || 'Sin datos de contacto'}</span>
                  <span className="commercial-hint">Actividad informada: {commercialDateLabel(row.lastSeen)}</span>
                </button>
              </li>)}</ul>}
          </section>
          {selected ? <CommercialLeadEditor lead={selected} onLockChange={onLockChange} onSaved={saved} onRevoked={revoke} onBack={() => navigate(() => setSelected(null))} /> :
            <div className="commercial-start"><h3>Del contacto al seguimiento</h3><p>Elegí un caso para consultar su historial, registrar una nota o revisar un cambio de etapa antes de confirmarlo.</p>
              <p>No se envían WhatsApp, correos ni campañas desde este panel.</p></div>}
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={discardOpen} onOpenChange={(open) => { setDiscardOpen(open); if (!open) pendingNavigation.current = null; }}>
      <AlertDialogContent className="commercial-confirm"><AlertDialogHeader><AlertDialogTitle>Hay cambios sin guardar</AlertDialogTitle><AlertDialogDescription>Podés seguir editando o descartar el borrador antes de cambiar de caso o cerrar el CRM. No se guardará nada al descartar.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><Button variant="outline" onClick={() => { pendingNavigation.current = null; setDiscardOpen(false); }}>Seguir editando</Button>
          <Button onClick={() => { const action = pendingNavigation.current; pendingNavigation.current = null; onLockChange({ dirty: false, busy: false }); setDiscardOpen(false); action?.(); }}>Descartar borrador</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
