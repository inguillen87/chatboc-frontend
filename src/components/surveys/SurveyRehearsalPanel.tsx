import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import { ApiError } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { createRehearsal, getRehearsalCreationStatus, listRehearsals, rehearsalPagePath, validRehearsalKey, validRehearsalTenant,
  type Rehearsal, type RehearsalList } from '@/api/surveyRehearsals';

const prefix = 'survey-rehearsal-create-intent.v1:';
const clear = (key: string | null) => { try { if (key) sessionStorage.removeItem(key); } catch { /* Status remains available by the intent key. */ } };
export function SurveyRehearsalPanel({ tenantSlug, listReady, externalBusy }: { tenantSlug: string | null; listReady: boolean; externalBusy?: boolean }) {
  const { user, hasVerifiedSession, organizationProfileVerified } = useUser();
  const revision = captureChatbocSessionRevision();
  const subject = hasVerifiedSession && organizationProfileVerified && validRehearsalTenant(tenantSlug)
    ? buildVerifiedSessionScopeKey({ hasVerifiedSession, user, tenantSlug }) : null;
  const scope = subject && listReady ? JSON.stringify([subject, revision, user?.rol, user?.permissions, user?.capabilities]) : null, storageKey = subject ? prefix + subject : null;
  const active = useRef(scope); active.current = scope;
  const mounted = useRef(false), readSequence = useRef(0), writeSequence = useRef(0), pending = useRef(false), intent = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [list, setList] = useState<RehearsalList | null>(null), [loading, setLoading] = useState(false), [phase, setPhase] = useState<'idle' | 'pending' | 'uncertain' | 'complete'>('idle');
  const [created, setCreated] = useState<Rehearsal | null>(null), [error, setError] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const ui = list?.ui;
  const current = (write = false) => {
    const initiated = scope, seq = write ? ++writeSequence.current : ++readSequence.current;
    return () => mounted.current && initiated !== null && active.current === initiated && isChatbocSessionRevisionCurrent(revision) && (write ? writeSequence.current : readSequence.current) === seq;
  };
  const load = async () => {
    if (!scope || !tenantSlug || pending.current || !isChatbocSessionRevisionCurrent(revision)) return;
    const isCurrent = current(); setLoading(true); setError(null);
    try { const result = await listRehearsals(tenantSlug, isCurrent); if (isCurrent()) { setList(result); setReceivedAt(new Date().toISOString()); if (timer.current) clearTimeout(timer.current); if (result.items.length) timer.current = setTimeout(() => void load(), 5000); } }
    catch { if (isCurrent()) { if (timer.current) clearTimeout(timer.current); setList(null); setError('No pudimos verificar las pruebas de esta organización. Volvé a consultar antes de crear una.'); } }
    finally { if (isCurrent()) setLoading(false); }
  };
  useEffect(() => {
    mounted.current = true; readSequence.current += 1; writeSequence.current += 1; pending.current = false; intent.current = null;
    setList(null); setCreated(null); setError(null); setPhase('idle'); setLoading(false); setReceivedAt(null);
    try { const saved = storageKey ? sessionStorage.getItem(storageKey) : null; if (saved && validRehearsalKey(saved)) { intent.current = saved; setPhase('uncertain'); } else clear(storageKey); } catch { /* A new write still requires storage to work. */ }
    if (scope) void load();
    return () => { mounted.current = false; readSequence.current += 1; writeSequence.current += 1; if (timer.current) clearTimeout(timer.current); };
  }, [scope]);
  const create = async () => {
    if (!scope || !list?.create_action.can_create || pending.current || intent.current || loading || externalBusy || !isChatbocSessionRevisionCurrent(revision)) return;
    if (!storageKey || typeof crypto.randomUUID !== 'function') { setError('No pudimos conservar la referencia segura de la operación.'); return; }
    const key = crypto.randomUUID();
    try { sessionStorage.setItem(storageKey, key); if (sessionStorage.getItem(storageKey) !== key) throw new Error('storage'); } catch { setError('Habilitá el almacenamiento de esta sesión antes de crear la prueba.'); return; }
    const isCurrent = current(true); intent.current = key; pending.current = true; setPhase('pending'); setError(null);
    let refresh = false;
    try {
      const result = await createRehearsal(list, key, isCurrent);
      if (isCurrent()) { setCreated(result); setPhase('complete'); clear(storageKey); refresh = true; }
    } catch (failure) {
      if (!isCurrent()) return;
      if (failure instanceof ApiError && [400, 401, 403, 409, 410, 413, 429].includes(failure.status)) {
        clear(storageKey); intent.current = null; setPhase('idle'); setList(null); setError(ui?.error_message || 'La prueba no se creó. Revisá el permiso, la verificación de sesión y los límites antes de volver a consultar.');
      } else { setPhase('uncertain'); setError(ui?.uncertain_message || 'No pudimos comprobar el resultado. Consultá esta misma operación; no repitas el envío.'); }
    } finally { if (isCurrent()) { pending.current = false; if (refresh) void load(); } }
  };
  const status = async () => {
    if (!scope || !tenantSlug || !intent.current || pending.current || loading || !isChatbocSessionRevisionCurrent(revision)) return;
    const isCurrent = current(true); setLoading(true); setError(null);
    let refresh = false;
    try { const result = await getRehearsalCreationStatus(tenantSlug, intent.current, isCurrent); if (isCurrent()) { setCreated(result); setPhase('complete'); clear(storageKey); refresh = true; } }
    catch { if (isCurrent()) { setPhase('uncertain'); setError(ui?.uncertain_message || 'No pudimos comprobar el resultado. Consultá esta misma operación; no repitas el envío.'); } }
    finally { if (isCurrent()) { setLoading(false); if (refresh) void load(); } }
  };
  if (!scope) return null;
  const runs = created && !(list?.items ?? []).some(item => item.run_id === created.run_id) ? [created, ...(list?.items ?? [])] : list?.items ?? [];
  return <section className="space-y-3 rounded-xl border p-4" aria-label={ui?.title || 'Pruebas técnicas'}>
    <h2 className="font-medium">{ui?.title || 'Pruebas técnicas'}</h2>
    {list && <><p className="text-sm">{list.source_tenant.display_name}</p><p className="text-sm font-medium">{ui?.warning}</p><p className="text-sm text-muted-foreground">{list.create_action.ui.description}</p></>}
    {loading && <p role="status">Consultando información actual…</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <ul className="space-y-3">{runs.map(run => <li key={run.run_id} className="space-y-1 rounded-md border p-3 text-sm"><p className="font-medium">{run.ui.label}</p>
      <p>{run.ui.total_label}: {run.metrics.total_responses} / {run.max_responses}</p><p>{run.ui.expires_label}: {new Date(run.expires_at).toLocaleString('es-AR')}</p>
      <a className="underline" href={rehearsalPagePath(run.tenant_slug, run.run_id)}>{ui?.open_label || run.ui.label}</a></li>)}</ul>
    {receivedAt && <p className="text-sm text-muted-foreground">{runs[0]?.ui.read_at_label || 'Última lectura'}: <time dateTime={receivedAt}>{new Date(receivedAt).toLocaleString('es-AR')}</time></p>}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={loading || phase === 'pending' || externalBusy} onClick={() => void load()}>{ui?.refresh_label || 'Consultar pruebas'}</Button>
      {phase === 'uncertain' ? <Button type="button" disabled={loading || externalBusy} onClick={() => void status()}>{ui?.check_status_label || 'Consultar estado'}</Button>
        : phase === 'complete' ? null : list && <Button type="button" disabled={!list.create_action.can_create || loading || phase === 'pending' || externalBusy} onClick={() => void create()}>{list.create_action.ui.label}</Button>}
    </div>
  </section>;
}
