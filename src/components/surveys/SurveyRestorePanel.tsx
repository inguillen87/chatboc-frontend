import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import { hasRequiredRole } from '@/utils/roles';
import { ApiError } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { applyRestore, getRestorePreview, getRestoreStatus, readArchivedRelocations, readRelocationAction, readRestorePreview,
  type ArchivedRelocation, type RestorePreview, type RestoreReceipt, type RelocationTenant } from '@/api/surveyEditorialRelocation';
import type { SurveyListResponse } from '@/types/encuestas';

interface Props { tenantSlug: string | null; surveys?: SurveyListResponse; listReady: boolean; externalBusy?: boolean; onCompleted: () => unknown; onPendingChange?: (pending: boolean) => void }
type Phase = 'selection' | 'review' | 'pending' | 'uncertain' | 'completed';
const prefix = 'survey-editorial-restore-intent.v1:';
const deniedError = (error: unknown) => error instanceof ApiError && [401, 403].includes(error.status);
const noWrite = (error: unknown) => error instanceof ApiError && [400, 409, 412].includes(error.status);
const validKey = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const clearIntent = (storageKey: string | null) => { try { if (storageKey) sessionStorage.removeItem(storageKey); } catch { /* Server receipts remain authoritative. */ } };
const persistIntent = (storageKey: string, preview: RestorePreview, key: string) => {
  try {
    // Safe editorial references only; this cache authorizes a GET status, never a replay.
    const value = JSON.stringify({ key, preview: { contract_version: preview.contract_version, source_tenant: preview.source_tenant,
      archive_idempotency_key: preview.archive_idempotency_key, archive_operation_id: preview.archive_operation_id, can_apply: preview.can_apply,
      published: false, preserved_responses: true, items: preview.items.map(item => ({ survey_id: item.survey_id, title: item.title,
        state: item.state, structure_revision: item.structure_revision, editorial_sha256: item.editorial_sha256,
        response_count_all_time: item.response_count_all_time, restore_state: item.restore_state, can_restore: item.can_restore })),
      ui: Object.fromEntries(Object.entries(preview.ui).filter(([, value]) => typeof value === 'string')) } });
    sessionStorage.setItem(storageKey, value); return sessionStorage.getItem(storageKey) === value;
  } catch { return false; }
};
const savedIntent = (storageKey: string, source: RelocationTenant) => {
  try {
    const value = sessionStorage.getItem(storageKey); if (!value) return null;
    const raw = JSON.parse(value); if (!validKey(raw.key) || raw.key === raw.preview?.archive_idempotency_key) throw new Error('invalid_intent');
    return { key: raw.key, preview: readRestorePreview(raw.preview, source, { ...raw.preview, source_editorial_sha256: raw.preview?.items?.[0]?.editorial_sha256 }) };
  } catch { clearIntent(storageKey); return null; }
};

export function SurveyRestorePanel({ tenantSlug, surveys, listReady, externalBusy, onCompleted, onPendingChange }: Props) {
  const { user, hasVerifiedSession, organizationProfileVerified } = useUser();
  const action = readRelocationAction(surveys?.editorial_relocation), sourceId = surveys?.tenant?.id;
  const subject = hasVerifiedSession && organizationProfileVerified && hasRequiredRole(user?.rol, ['superadmin']) ? buildVerifiedSessionScopeKey({ hasVerifiedSession, user, tenantSlug }) : null;
  const scope = subject && action && listReady && surveys?.contract_version === 'surveys.admin_list.v2' && surveys.include_archived === true &&
    surveys.tenant?.slug === tenantSlug && typeof sourceId === 'number' && Number.isSafeInteger(sourceId) && sourceId > 0 &&
    ['restore_title', 'restore_label', 'restore_confirm_label', 'restore_notice', 'restore_success_message'].every(name => typeof action.ui[name] === 'string' && action.ui[name].trim())
    ? JSON.stringify([subject, sourceId, captureChatbocSessionRevision()]) : null;
  const source = scope && tenantSlug && typeof sourceId === 'number' ? { id: sourceId, slug: tenantSlug, nombre: tenantSlug } : null;
  const storageKey = scope ? prefix + JSON.stringify([subject, sourceId]) : null;
  const activeScope = useRef(scope); activeScope.current = scope;
  const mounted = useRef(false), sequence = useRef(0), pending = useRef(false), intent = useRef<{ key: string; preview: RestorePreview } | null>(null);
  const [open, setOpen] = useState(false), [phase, setPhase] = useState<Phase>('selection'), [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<RestorePreview | null>(null), [receipt, setReceipt] = useState<RestoreReceipt | null>(null);
  const [error, setError] = useState<string | null>(null), [denied, setDenied] = useState(false), [archive, setArchive] = useState<ArchivedRelocation | null>(null);
  const ui = action?.ui ?? {};
  const currentRequest = () => {
    const requestScope = scope, requestSequence = ++sequence.current, revision = captureChatbocSessionRevision();
    return () => mounted.current && requestScope !== null && activeScope.current === requestScope && sequence.current === requestSequence && isChatbocSessionRevisionCurrent(revision);
  };
  useEffect(() => {
    mounted.current = true; sequence.current += 1; pending.current = false; intent.current = null;
    setOpen(false); setPhase('selection'); setPreview(null); setReceipt(null); setArchive(null); setError(null); setDenied(false); setLoading(false); onPendingChange?.(false);
    const saved = storageKey && source ? savedIntent(storageKey, source) : null;
    if (saved) { intent.current = saved; setPreview(saved.preview); setPhase('uncertain'); setArchive({ ...saved.preview, source_editorial_sha256: saved.preview.items[0].editorial_sha256 }); }
    return () => { mounted.current = false; sequence.current += 1; };
  }, [scope]);
  const message = (failure: unknown, applying = false) => deniedError(failure) ? 'La sesión ya no tiene acceso a esta acción. Volvé a iniciar sesión y verificar el rol.'
    : noWrite(failure) ? ui.conflict_message : applying ? ui.uncertain_message : ui.preview_error;
  const review = async (selected: ArchivedRelocation) => {
    if (!scope || !source || pending.current || intent.current || loading || denied || externalBusy) return;
    setArchive(selected); setOpen(true); setLoading(true); setError(null); setPreview(null); const isCurrent = currentRequest();
    try { const result = await getRestorePreview(source, selected, isCurrent); if (isCurrent()) { setPreview(result); setPhase('review'); } }
    catch (failure) { if (isCurrent()) { setError(message(failure)); if (deniedError(failure)) setDenied(true); } }
    finally { if (isCurrent()) setLoading(false); }
  };
  const confirm = async () => {
    if (!scope || !preview?.can_apply || phase !== 'review' || pending.current || intent.current || denied || externalBusy) return;
    if (typeof crypto.randomUUID !== 'function') { setError('No pudimos identificar esta operación de forma segura. Actualizá el navegador antes de confirmar.'); return; }
    const key = crypto.randomUUID(), snapshot = preview;
    if (!storageKey || key === snapshot.archive_idempotency_key || !persistIntent(storageKey, snapshot, key)) { setError('No pudimos conservar la referencia de esta operación. Habilitá el almacenamiento de esta sesión antes de confirmar.'); return; }
    const isCurrent = currentRequest(); intent.current = { preview: snapshot, key }; pending.current = true; setPhase('pending'); setError(null); onPendingChange?.(true);
    try { const result = await applyRestore(snapshot, key, isCurrent); if (isCurrent()) { setReceipt(result); setPhase('completed'); } }
    catch (failure) {
      if (noWrite(failure) || deniedError(failure)) clearIntent(storageKey);
      if (!isCurrent()) return;
      setError(message(failure, true));
      if (deniedError(failure)) { setDenied(true); setPhase('uncertain'); }
      else if (noWrite(failure)) { intent.current = null; setPreview(null); setPhase('selection'); }
      else setPhase('uncertain');
    } finally { if (isCurrent()) { pending.current = false; onPendingChange?.(false); } }
  };
  const status = async () => {
    const saved = intent.current; if (!scope || !saved || pending.current || loading || denied) return;
    const isCurrent = currentRequest(); setLoading(true); setError(null);
    try { const result = await getRestoreStatus(saved.preview, saved.key, isCurrent); if (isCurrent()) { setReceipt(result); setPhase('completed'); } }
    catch (failure) { if (isCurrent()) { setError(message(failure, true)); setPhase('uncertain'); if (deniedError(failure)) setDenied(true); } }
    finally { if (isCurrent()) setLoading(false); }
  };
  const close = () => {
    if (pending.current || phase === 'pending') return;
    sequence.current += 1; setOpen(false); setLoading(false);
    if (phase === 'completed') { clearIntent(storageKey); intent.current = null; setReceipt(null); setPreview(null); setArchive(null); setPhase('selection'); void onCompleted(); }
  };
  if (!scope || !source || !action) return null;
  const metadata = readArchivedRelocations(surveys?.archived_editorial_relocations), groups = new Map<string, { archive: ArchivedRelocation; ids: number[] }>();
  for (const row of surveys?.data ?? []) {
    const lineage = metadata[String(row.id)]; if (row.estado !== 'archivada' || !lineage) continue;
    const group = groups.get(lineage.archive_idempotency_key);
    if (group && group.archive.archive_operation_id === lineage.archive_operation_id) group.ids.push(row.id);
    else if (!group) groups.set(lineage.archive_idempotency_key, { archive: lineage, ids: [row.id] });
  }
  if (!groups.size && !intent.current) return null;
  return <section className="space-y-3 rounded-xl border p-4" aria-label={ui.restore_label}>
    <h2 className="font-medium">{ui.restore_title}</h2><p className="text-sm text-muted-foreground">{ui.restore_notice}</p>
    {intent.current ? <Button type="button" variant="outline" disabled={externalBusy || denied} onClick={() => setOpen(true)}>{ui.check_status_label}</Button>
      : [...groups].map(([key, group]) => <Button key={key} type="button" variant="outline" disabled={externalBusy || loading || denied} onClick={() => void review(group.archive)}>{ui.restore_label} · {group.ids.map(id => `#${id}`).join(', ')}</Button>)}
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto" showCloseButton={phase !== 'pending'}
      onEscapeKeyDown={event => { if (phase === 'pending') event.preventDefault(); }} onInteractOutside={event => { if (phase === 'pending') event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{ui.restore_title}</DialogTitle><DialogDescription>{ui.restore_notice}</DialogDescription></DialogHeader>
      {loading && <p role="status">{ui.loading_label}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {preview && <div role="region" aria-label={preview.ui.response_count_label} className="space-y-3 text-sm"><p className="font-medium">{preview.source_tenant.nombre}</p>
        <ul className="space-y-2">{preview.items.map(item => <li key={item.survey_id}>#{item.survey_id} · {item.title} · {item.state} → {item.restore_state}<br />{preview.ui.response_count_label}: {item.response_count_all_time.toLocaleString('es-AR')}</li>)}</ul><p>{preview.ui.restore_notice}</p></div>}
      {receipt && <div role="status" className="space-y-2 text-sm"><p>{ui.restore_success_message}</p><ul>{receipt.items.map(item => <li key={item.source_survey_id}>#{item.source_survey_id} · {item.source_state} · {ui.source_history_label}: {item.source_response_count_all_time.toLocaleString('es-AR')}</li>)}</ul></div>}
      <DialogFooter><Button type="button" variant="outline" disabled={phase === 'pending'} onClick={close}>{ui.cancel_label}</Button>
        {phase === 'uncertain' ? <Button type="button" disabled={loading || denied} onClick={() => void status()}>{ui.check_status_label}</Button>
          : phase === 'selection' ? <Button type="button" disabled={loading || denied || !archive} onClick={() => archive && void review(archive)}>{ui.preview_label}</Button>
            : phase !== 'completed' ? <Button type="button" disabled={loading || denied || externalBusy || !preview?.can_apply || phase === 'pending'} onClick={() => void confirm()}>{phase === 'pending' ? ui.loading_label : preview?.ui.restore_confirm_label}</Button> : null}
      </DialogFooter>
    </DialogContent></Dialog>
  </section>;
}
