import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import { ApiError } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { getRehearsal, getRehearsalAccountStatus, getRehearsalResponseStatus, rehearsalPagePath, respondToRehearsal, validRehearsalKey, validRehearsalRun, validRehearsalTenant,
  type Rehearsal, type RehearsalResponse, type RehearsalAccountStatus } from '@/api/surveyRehearsals';

interface Intent { key: string; option: 'yes' | 'no'; instrument: string }
const prefix = 'survey-rehearsal-response-intent.v1:';
export function PublicSurveyRehearsal({ tenantSlug, runId }: { tenantSlug: string; runId: string }) {
  const { user, hasVerifiedSession } = useUser();
  const validScope = validRehearsalTenant(tenantSlug) && validRehearsalRun(runId), route = validScope ? JSON.stringify([tenantSlug, runId]) : null;
  const revision = captureChatbocSessionRevision(), subject = validScope ? buildVerifiedSessionScopeKey({ hasVerifiedSession, user, tenantSlug }) : null;
  const authority = subject ? JSON.stringify([subject, runId, revision]) : null, storageKey = subject ? prefix + JSON.stringify([subject, runId]) : null;
  const activeRoute = useRef(route); activeRoute.current = route; const activeAuthority = useRef(authority); activeAuthority.current = authority;
  const mounted = useRef(false), reads = useRef(0), writes = useRef(0), accountReads = useRef(0), pending = useRef(false), intent = useRef<Intent | null>(null), latest = useRef<Rehearsal | null>(null);
  const [data, setData] = useState<Rehearsal | null>(null), [loading, setLoading] = useState(false), [readError, setReadError] = useState<string | null>(null), [writeError, setWriteError] = useState<string | null>(null);
  const [option, setOption] = useState<'yes' | 'no' | null>(null), [phase, setPhase] = useState<'idle' | 'pending' | 'uncertain' | 'accepted' | 'blocked'>('idle'), [receipt, setReceipt] = useState<RehearsalResponse | null>(null);
  const [account, setAccount] = useState<RehearsalAccountStatus | null>(null), [accountError, setAccountError] = useState<string | null>(null), [receivedAt, setReceivedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const read = async (results = false) => {
    if (!route || !isChatbocSessionRevisionCurrent(revision)) return;
    const initiated = route, seq = ++reads.current;
    const isCurrent = () => mounted.current && activeRoute.current === initiated && reads.current === seq && isChatbocSessionRevisionCurrent(revision);
    setLoading(true);
    try {
      const result = await getRehearsal(tenantSlug, runId, isCurrent, results);
      if (!isCurrent()) return;
      if (latest.current && (result.instrument_sha256 !== latest.current.instrument_sha256 || JSON.stringify(result.question) !== JSON.stringify(latest.current.question))) throw new ApiError('instrument_changed', 502);
      latest.current = result; setData(result); setReadError(null); setReceivedAt(new Date().toISOString());
      if (timer.current) clearTimeout(timer.current);
      if (Date.parse(result.expires_at) > Date.now()) timer.current = setTimeout(() => void read(true), result.refresh.interval_ms);
    } catch (failure) {
      if (!isCurrent()) return;
      setReadError(latest.current?.ui.error_message || 'No pudimos verificar esta prueba. Actualizá su estado antes de responder.');
      if (failure instanceof ApiError && [403, 404, 410].includes(failure.status)) { latest.current = null; setData(null); }
      if (timer.current) clearTimeout(timer.current);
    } finally { if (isCurrent()) setLoading(false); }
  };
  useEffect(() => {
    mounted.current = true; reads.current += 1; latest.current = null; setData(null); setReadError(null); setLoading(false); setReceivedAt(null);
    if (route) void read();
    return () => { mounted.current = false; reads.current += 1; writes.current += 1; accountReads.current += 1; if (timer.current) clearTimeout(timer.current); };
  }, [route, revision]);
  useEffect(() => {
    writes.current += 1; accountReads.current += 1; pending.current = false; intent.current = null; setPhase('idle'); setOption(null); setReceipt(null); setWriteError(null); setAccount(null); setAccountError(null);
    try {
      const saved = storageKey ? sessionStorage.getItem(storageKey) : null;
      if (saved) { const parsed = JSON.parse(saved); if (validRehearsalKey(parsed.key) && ['yes', 'no'].includes(parsed.option) && typeof parsed.instrument === 'string' && /^[a-f0-9]{64}$/.test(parsed.instrument)) { intent.current = parsed; setOption(parsed.option); setPhase('uncertain'); } else if (storageKey) sessionStorage.removeItem(storageKey); }
    } catch { /* A write still requires successful persistence before sending. */ }
  }, [authority]);
  const readAccount = async () => {
    if (!authority || !data || data.tenant_slug !== tenantSlug || data.run_id !== runId || !isChatbocSessionRevisionCurrent(revision)) return;
    const initiated = authority, seq = ++accountReads.current;
    const isCurrent = () => mounted.current && activeAuthority.current === initiated && accountReads.current === seq && isChatbocSessionRevisionCurrent(revision);
    setAccount(null); setAccountError(null);
    try { const result = await getRehearsalAccountStatus(data, isCurrent); if (isCurrent()) setAccount(result); }
    catch { if (isCurrent()) setAccountError(data.ui.error_message); }
  };
  useEffect(() => { if (authority && data?.tenant_slug === tenantSlug && data.run_id === runId) void readAccount(); }, [authority, data?.run_id, data?.instrument_sha256]);
  const writeCurrent = () => {
    const initiated = authority, seq = ++writes.current;
    return () => mounted.current && initiated !== null && activeAuthority.current === initiated && writes.current === seq && isChatbocSessionRevisionCurrent(revision);
  };
  const send = async () => {
    if (!authority || !account || account.participated || !data || !option || pending.current || intent.current || phase !== 'idle' || readError || !isChatbocSessionRevisionCurrent(revision) || Date.parse(data.expires_at) <= Date.now() || data.metrics.total_responses >= data.max_responses) return;
    if (!storageKey || typeof crypto.randomUUID !== 'function') { setWriteError('No pudimos conservar una referencia segura. Actualizá el navegador antes de responder.'); return; }
    const saved: Intent = { key: crypto.randomUUID(), option, instrument: data.instrument_sha256 };
    try { const value = JSON.stringify(saved); sessionStorage.setItem(storageKey, value); if (sessionStorage.getItem(storageKey) !== value) throw new Error('storage'); } catch { setWriteError('Habilitá el almacenamiento de esta sesión antes de responder. Conservamos tu selección.'); return; }
    const isCurrent = writeCurrent(); intent.current = saved; pending.current = true; setPhase('pending'); setWriteError(null);
    try { const result = await respondToRehearsal(data, saved.key, saved.option, isCurrent); if (isCurrent()) { setReceipt(result); setPhase('accepted'); void read(true); } }
    catch (failure) {
      if (!isCurrent()) return;
      if (failure instanceof ApiError && [400, 401, 403, 409, 410, 413, 429].includes(failure.status)) { setPhase('blocked'); setWriteError(data.ui.error_message); }
      else { setPhase('uncertain'); setWriteError(data.ui.uncertain_message); }
    } finally { if (isCurrent()) pending.current = false; }
  };
  const status = async () => {
    const saved = intent.current;
    if (!authority || !data || !saved || pending.current || !isChatbocSessionRevisionCurrent(revision)) return;
    if (saved.instrument !== data.instrument_sha256) { setWriteError(data.ui.error_message); return; }
    const isCurrent = writeCurrent(); pending.current = true; setPhase('pending'); setWriteError(null);
    try { const result = await getRehearsalResponseStatus(data, saved.key, saved.option, isCurrent); if (isCurrent()) { setReceipt(result); setPhase('accepted'); void read(true); } }
    catch (failure) { if (isCurrent()) { setPhase(failure instanceof ApiError && [401, 403, 409, 410].includes(failure.status) ? 'blocked' : 'uncertain'); setWriteError(data.ui.uncertain_message); } }
    finally { if (isCurrent()) pending.current = false; }
  };
  if (!route) return <p role="alert">El enlace no identifica una prueba válida. Pedí un enlace nuevo a la organización.</p>;
  const disabled = !authority || !account || account.participated || Boolean(readError) || phase !== 'idle' || !data || Date.parse(data.expires_at) <= Date.now() || data.metrics.total_responses >= data.max_responses;
  return <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6" data-testid="survey-rehearsal-page">
    {data && <><header className="space-y-2"><p className="text-sm font-medium">{data.branding.display_name}</p><h1 className="text-2xl font-semibold">{data.ui.title}</h1>
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 font-medium">{data.ui.warning}</p><p className="text-sm text-muted-foreground">{data.ui.description}</p></header>
      <form className="space-y-4 rounded-xl border p-4" onSubmit={event => { event.preventDefault(); void send(); }}>
        <fieldset disabled={disabled}><legend className="mb-3 font-medium">{data.question.label}</legend><div className="space-y-3">{data.question.options.map(choice => <label key={choice.id} className="flex items-center gap-2 rounded-md border p-3"><input type="radio" name="technical-form-option" value={choice.id} checked={option === choice.id} onChange={() => setOption(choice.id)} /><span>{choice.label}</span></label>)}</div></fieldset>
        {!authority ? <a className="inline-block underline" href={`/login?${new URLSearchParams({ next: rehearsalPagePath(tenantSlug, runId), tenant_slug: tenantSlug })}`}>{data.ui.login_label}</a>
          : phase === 'uncertain' || (phase === 'blocked' && intent.current) ? <Button type="button" disabled={Boolean(readError) || pending.current} onClick={() => void status()}>{data.ui.check_status_label}</Button>
            : phase !== 'accepted' && <Button type="submit" disabled={disabled || !option}>{data.ui.submit_label}</Button>}
        {receipt && <p role="status">{receipt.ui.label}. {receipt.ui.warning}</p>}{!receipt && account?.participated && <p role="status">{account.ui.label}</p>}
        {writeError && <p role="alert" className="text-sm text-destructive">{writeError}</p>}{accountError && <p role="alert" className="text-sm text-destructive">{accountError}</p>}
      </form>
      <section className="space-y-3 rounded-xl border p-4" aria-label={data.ui.results_label}><h2 className="font-medium">{data.ui.results_label}</h2><p>{data.ui.total_label}: {data.metrics.total_responses}</p>
        <dl className="space-y-2">{data.question.options.map(choice => <div key={choice.id} className="flex items-center justify-between gap-4"><dt>{choice.label}</dt><dd className="tabular-nums">{data.metrics.options.find(row => row.option_id === choice.id)?.count}</dd></div>)}</dl>
        <p className="text-sm text-muted-foreground">{data.ui.expires_label}: {new Date(data.expires_at).toLocaleString('es-AR')} · {data.ui.limit_label}: {data.max_responses}</p>
        {receivedAt && <p className="text-sm text-muted-foreground">{data.ui.read_at_label || 'Última lectura'}: <time dateTime={receivedAt}>{new Date(receivedAt).toLocaleString('es-AR')}</time></p>}
      </section></>}
    {loading && !data && <p role="status">Consultando información actual…</p>}{readError && <p role="alert" className="text-sm text-destructive">{readError}</p>}
    <Button type="button" variant="outline" disabled={loading} onClick={() => { void read(Boolean(data)); if (authority && data) void readAccount(); }}>{data?.ui.refresh_label || 'Volver a consultar'}</Button>
  </main>;
}
export default function RehearsalPage() { const { tenantSlug = '', runId = '' } = useParams(); return <PublicSurveyRehearsal tenantSlug={tenantSlug} runId={runId} />; }
