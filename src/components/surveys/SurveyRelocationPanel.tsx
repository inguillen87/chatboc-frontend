import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import { hasRequiredRole } from '@/utils/roles';
import { ApiError } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { applyRelocation, getRelocationPreview, getRelocationStatus, listRelocationTargets, readRelocationAction, readRelocationPreview,
  type RelocationPreview, type RelocationReceipt, type RelocationTenant } from '@/api/surveyEditorialRelocation';
import type { SurveyListResponse } from '@/types/encuestas';

type Phase = 'selection' | 'review' | 'pending' | 'uncertain' | 'completed';
interface Props {
  tenantSlug: string | null;
  surveys?: SurveyListResponse;
  listReady: boolean;
  externalBusy?: boolean;
  onCompleted: () => unknown;
  onPendingChange?: (pending: boolean) => void;
}
const accessFailure = (error: unknown) => error instanceof ApiError && [401, 403].includes(error.status);
const knownNoWrite = (error: unknown) => error instanceof ApiError && [400, 409, 412].includes(error.status);
const storedIntentPrefix = 'survey-editorial-relocation-intent.v1:';
const clearStoredIntent = (storageKey: string | null) => { if (storageKey) { try { sessionStorage.removeItem(storageKey); } catch { /* A receipt remains authoritative if browser storage is unavailable. */ } } };
const storeIntent = (storageKey: string, preview: RelocationPreview, key: string) => {
  try {
    const value = JSON.stringify({ key, preview: { contract_version: preview.contract_version,
      source_tenant: preview.source_tenant, target_tenant: preview.target_tenant, can_apply: preview.can_apply,
      items: preview.items.map(item => ({ survey_id: item.survey_id, title: item.title, state: item.state,
        structure_revision: item.structure_revision, editorial_sha256: item.editorial_sha256, response_count_all_time: item.response_count_all_time })),
      ui: Object.fromEntries(Object.entries(preview.ui).filter(([, value]) => typeof value === 'string')) } });
    sessionStorage.setItem(storageKey, value);
    return sessionStorage.getItem(storageKey) === value;
  } catch { return false; }
};
const readStoredIntent = (storageKey: string, source: RelocationTenant): { preview: RelocationPreview; key: string } | null => {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (typeof saved.key !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(saved.key) || !Array.isArray(saved.preview?.items)) throw new Error('invalid_intent');
    const preview = readRelocationPreview(saved.preview, source, saved.preview.target_tenant, saved.preview.items.map((item: { survey_id: number }) => item.survey_id));
    return { preview, key: saved.key };
  } catch { clearStoredIntent(storageKey); return null; }
};

export function SurveyRelocationPanel({ tenantSlug, surveys, listReady, externalBusy, onCompleted, onPendingChange }: Props) {
  const { user, hasVerifiedSession, organizationProfileVerified } = useUser();
  const action = readRelocationAction(surveys?.editorial_relocation);
  const sourceId = surveys?.tenant?.id;
  const verifiedSubject = hasVerifiedSession && organizationProfileVerified && hasRequiredRole(user?.rol, ['superadmin'])
    ? buildVerifiedSessionScopeKey({ hasVerifiedSession, user, tenantSlug }) : null;
  const scope = verifiedSubject && listReady && action && surveys?.contract_version === 'surveys.admin_list.v2' &&
    surveys.tenant?.slug === tenantSlug && typeof sourceId === 'number' && Number.isSafeInteger(sourceId) && sourceId > 0
    ? JSON.stringify([verifiedSubject, sourceId, captureChatbocSessionRevision()]) : null;
  // No credentials or response bodies are stored. This key survives a route
  // remount/reload, remains actor/source-bound, and only authorizes a GET status.
  const storageKey = scope ? storedIntentPrefix + JSON.stringify([verifiedSubject, sourceId]) : null;
  const activeScope = useRef(scope); activeScope.current = scope;
  const mounted = useRef(false), sequence = useRef(0), pendingWrite = useRef(false);
  const intent = useRef<{ preview: RelocationPreview; key: string } | null>(null);
  const [open, setOpen] = useState(false), [phase, setPhase] = useState<Phase>('selection');
  const [selected, setSelected] = useState<number[]>([]), [targetId, setTargetId] = useState<number | null>(null);
  const [targets, setTargets] = useState<RelocationTenant[]>([]), [directoryPage, setDirectoryPage] = useState(0), [hasMoreTargets, setHasMoreTargets] = useState(false);
  const [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null), [denied, setDenied] = useState(false);
  const [preview, setPreview] = useState<RelocationPreview | null>(null), [receipt, setReceipt] = useState<RelocationReceipt | null>(null);
  const source: RelocationTenant | null = scope && typeof sourceId === 'number' && tenantSlug ? { id: sourceId, slug: tenantSlug, nombre: tenantSlug } : null;
  const ui = action?.ui ?? {};
  const currentRequest = useCallback(() => {
    const initiatedScope = scope, epoch = ++sequence.current, revision = captureChatbocSessionRevision();
    return () => mounted.current && initiatedScope !== null && activeScope.current === initiatedScope &&
      sequence.current === epoch && isChatbocSessionRevisionCurrent(revision);
  }, [scope]);
  useEffect(() => {
    mounted.current = true; sequence.current += 1; pendingWrite.current = false; intent.current = null;
    setOpen(false); setSelected([]); setTargetId(null); setTargets([]); setDirectoryPage(0); setHasMoreTargets(false);
    setPhase('selection'); setPreview(null); setReceipt(null); setError(null); setLoading(false); setDenied(false);
    const saved = storageKey && source ? readStoredIntent(storageKey, source) : null;
    if (saved) { intent.current = saved; setPreview(saved.preview); setPhase('uncertain'); setSelected(saved.preview.items.map(item => item.survey_id)); setTargetId(saved.preview.target_tenant.id); }
    onPendingChange?.(false);
    return () => { mounted.current = false; sequence.current += 1; };
  }, [scope]);
  const displayError = (failure: unknown, applying = false) => accessFailure(failure)
    ? 'La sesión ya no tiene acceso a esta acción. Volvé a iniciar sesión y verificar el rol.'
    : applying && !knownNoWrite(failure) ? ui.uncertain_message || 'No pudimos comprobar el resultado. Consultá el estado de esta misma operación; no vuelvas a enviarla.'
      : knownNoWrite(failure) ? ui.conflict_message || 'Los datos cambiaron. Conservamos la selección; consultá un nuevo preview antes de confirmar.'
        : ui.preview_error || 'No pudimos verificar los datos. Conservamos la selección para que puedas volver a consultar.';
  const loadDirectory = async (page = 1) => {
    if (!scope || pendingWrite.current || intent.current) return;
    const isCurrent = currentRequest(); setLoading(true); setError(null);
    try {
      const result = await listRelocationTargets(page, isCurrent);
      if (!isCurrent()) return;
      setTargets(previous => page === 1 ? result.items : [...new Map([...previous, ...result.items].map(item => [item.id, item])).values()]);
      setDirectoryPage(page); setHasMoreTargets(result.hasMore);
    } catch (failure) { if (isCurrent()) { setError(ui.directory_error || displayError(failure)); if (accessFailure(failure)) setDenied(true); } }
    finally { if (isCurrent()) setLoading(false); }
  };
  const openPanel = () => {
    if (!scope || externalBusy || denied) return;
    setOpen(true);
    if (!intent.current && !targets.length) void loadDirectory();
  };
  const requestPreview = async () => {
    const target = targets.find(item => item.id === targetId);
    if (!scope || !source || !target || !selected.length || pendingWrite.current || intent.current || denied) return;
    const isCurrent = currentRequest(); setLoading(true); setPreview(null); setError(null);
    try {
      const result = await getRelocationPreview(source, target, selected, isCurrent);
      if (isCurrent()) { setPreview(result); setPhase('review'); }
    } catch (failure) { if (isCurrent()) { setError(displayError(failure)); if (accessFailure(failure)) setDenied(true); } }
    finally { if (isCurrent()) setLoading(false); }
  };
  const confirm = async () => {
    if (!scope || !preview?.can_apply || pendingWrite.current || intent.current || phase !== 'review' || denied) return;
    if (typeof crypto.randomUUID !== 'function') { setError('No pudimos identificar esta operación de forma segura. Conservamos la selección; actualizá el navegador antes de confirmar.'); return; }
    const requestKey = crypto.randomUUID(), snapshot = preview;
    if (!storageKey || !storeIntent(storageKey, snapshot, requestKey)) { setError('No pudimos conservar la referencia de esta operación. Habilitá el almacenamiento de esta sesión antes de confirmar.'); return; }
    const isCurrent = currentRequest();
    intent.current = { preview: snapshot, key: requestKey }; pendingWrite.current = true;
    setPhase('pending'); setError(null); onPendingChange?.(true);
    try {
      const result = await applyRelocation(snapshot, requestKey, isCurrent);
      if (isCurrent()) { setReceipt(result); setPhase('completed'); }
    } catch (failure) {
      if (knownNoWrite(failure) || accessFailure(failure)) clearStoredIntent(storageKey);
      if (!isCurrent()) return;
      setError(displayError(failure, true));
      if (accessFailure(failure)) { setDenied(true); setPhase('uncertain'); }
      else if (knownNoWrite(failure)) { intent.current = null; setPreview(null); setPhase('selection'); }
      else setPhase('uncertain');
    } finally { if (isCurrent()) { pendingWrite.current = false; onPendingChange?.(false); } }
  };
  const checkStatus = async () => {
    const currentIntent = intent.current;
    if (!scope || !currentIntent || pendingWrite.current || loading || denied) return;
    const isCurrent = currentRequest(); setLoading(true); setError(null);
    try {
      const result = await getRelocationStatus(currentIntent.preview, currentIntent.key, isCurrent);
      if (isCurrent()) { setReceipt(result); setPhase('completed'); }
    } catch (failure) { if (isCurrent()) { setPhase('uncertain'); setError(displayError(failure, true)); if (accessFailure(failure)) setDenied(true); } }
    finally { if (isCurrent()) setLoading(false); }
  };
  const closePanel = () => {
    if (pendingWrite.current || phase === 'pending') return;
    sequence.current += 1; setOpen(false); setLoading(false);
    // An uncertain intent survives closing/reopening: only its GET status is offered.
    if (phase === 'completed') { clearStoredIntent(storageKey); intent.current = null; setReceipt(null); setPreview(null); setSelected([]); setTargetId(null); setPhase('selection'); void onCompleted(); }
  };
  const changeSelection = (id: number, checked: boolean) => {
    if (intent.current || loading || denied) return;
    sequence.current += 1; setSelected(previous => checked ? [...previous, id].sort((a, b) => a - b) : previous.filter(value => value !== id));
    setPreview(null); setPhase('selection'); setError(null);
  };
  if (!scope || !source || !action) return null;
  const immutableIntent = phase === 'pending' || phase === 'uncertain' || phase === 'completed';
  const selectable = (surveys?.data ?? []).filter(item => item.estado !== 'archivada');
  return <section className="space-y-2 rounded-xl border p-4" aria-label={action.label}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-medium">{action.label}</h2><p className="text-sm text-muted-foreground">{action.description}</p></div>
      <Button type="button" variant="outline" disabled={externalBusy || denied} onClick={openPanel}>{action.label}</Button></div>
    <a className="text-sm underline" href={`/admin/encuestas?tenant_slug=${encodeURIComponent(source.slug)}&include_archived=true`}>{ui.history_label}</a>
    <Dialog open={open} onOpenChange={value => { if (!value) closePanel(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={phase !== 'pending'}
        onEscapeKeyDown={event => { if (phase === 'pending') event.preventDefault(); }}
        onInteractOutside={event => { if (phase === 'pending') event.preventDefault(); }}
        onOpenAutoFocus={event => { event.preventDefault(); document.getElementById('survey-relocation-cancel')?.focus(); }}>
        <DialogHeader><DialogTitle>{action.label}</DialogTitle><DialogDescription>{action.description}</DialogDescription></DialogHeader>
        {!immutableIntent && <div className="space-y-3">
          <fieldset disabled={loading || denied}><legend className="mb-2 font-medium">{ui.selection_label}</legend>
            <ul className="space-y-2">{selectable.map(item => <li key={item.id}><label className="flex items-start gap-2"><input type="checkbox" checked={selected.includes(item.id)}
              disabled={!selected.includes(item.id) && selected.length >= action.max_surveys} onChange={event => changeSelection(item.id, event.target.checked)} />
              <span>#{item.id} · {item.titulo} · {item.estado}</span></label></li>)}</ul>
          </fieldset>
          <label className="block space-y-1"><span className="font-medium">{ui.target_label}</span><select className="w-full rounded-md border bg-background p-2" value={targetId ?? ''} disabled={loading || denied}
            onChange={event => { setTargetId(event.target.value ? Number(event.target.value) : null); setPreview(null); setPhase('selection'); setError(null); }}>
            <option value="">{ui.target_label}</option>{targets.filter(item => item.id !== source.id && item.slug !== source.slug).map(item => <option key={item.id} value={item.id}>{item.nombre} · {item.slug}</option>)}
          </select></label>
          {hasMoreTargets && <Button type="button" variant="outline" disabled={loading || denied} onClick={() => void loadDirectory(directoryPage + 1)}>{ui.load_more_label || ui.target_label}</Button>}
          {!targets.length && !loading && !denied && <Button type="button" variant="outline" onClick={() => void loadDirectory()}>{ui.target_label}</Button>}
        </div>}
        {loading && <p role="status">{ui.loading_label}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {preview && <div role="region" aria-label={preview.ui.response_count_label} className="space-y-3 rounded-md border p-3 text-sm">
          <p className="font-medium">{preview.source_tenant.nombre} → {preview.target_tenant.nombre}</p>
          <ul className="space-y-2">{preview.items.map(item => <li key={item.survey_id}>#{item.survey_id} · {item.title} · {item.state}<br />{preview.ui.response_count_label}: {item.response_count_all_time.toLocaleString('es-AR')}</li>)}</ul>
          <p>{preview.ui.preservation_notice}</p><p>{preview.ui.draft_notice}</p>
          {preview.items.some(item => item.state === 'publicada') && <p role="status" className="rounded-md bg-amber-500/10 p-2">{preview.ui.published_warning}</p>}
        </div>}
        {receipt && <div className="space-y-2 text-sm" role="status"><p>{ui.success_message || 'Resultado verificado: originales archivados y copias creadas como borradores.'}</p>
          <ul className="space-y-2">{receipt.items.map(item => <li key={item.source_survey_id}>#{item.source_survey_id} → #{item.destination_survey_id}<br />
            {ui.source_history_label || preview?.ui.response_count_label}: {item.source_response_count_all_time.toLocaleString('es-AR')}<br />
            {ui.destination_count_label || preview?.ui.draft_notice}: {item.destination_response_count_all_time}</li>)}</ul>
          <a className="underline" href={`/admin/encuestas?tenant_slug=${encodeURIComponent(source.slug)}&include_archived=true`}>{ui.history_label}</a>
        </div>}
        <DialogFooter><Button id="survey-relocation-cancel" type="button" variant="outline" disabled={phase === 'pending'} onClick={closePanel}>{ui.cancel_label}</Button>
          {phase === 'uncertain' ? <Button type="button" disabled={loading || denied} onClick={() => void checkStatus()}>{ui.check_status_label || 'Consultar estado'}</Button>
            : phase === 'selection' ? <Button type="button" disabled={loading || denied || !selected.length || targetId === null} onClick={() => void requestPreview()}>{ui.preview_label}</Button>
              : phase !== 'completed' ? <Button type="button" disabled={loading || denied || !preview?.can_apply || phase === 'pending'} onClick={() => void confirm()}>{phase === 'pending' ? ui.loading_label : preview?.ui.confirm_label}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
