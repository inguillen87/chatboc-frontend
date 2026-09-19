import React from 'react';
import { ArrowRight, Check, ChevronRight, Eye, EyeOff, LogOut, MessageSquare, ShieldCheck } from 'lucide-react';
import './evaluation.css';

type State = { authenticated: boolean; title: string; institution: string; session_expires_at: number | null; release_sha: string; presentation_url?: string | null };
type Menu = { id: string; title: string; text: string; kind: string; source_pages: number[];
  actions: { code: string; label: string; target: string }[]; source: { label: string; approval_status: string } };
class EvaluationError extends Error { constructor(public status: number, message: string) { super(message); } }
async function request(action: string, body?: object, signal?: AbortSignal) {
  const abort = new AbortController(); const relay = () => abort.abort();
  signal?.addEventListener('abort', relay, { once: true });
  if (signal?.aborted) abort.abort();
  const timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(`/api/evaluation?action=${action}`, { method: body ? 'POST' : 'GET',
      credentials: 'same-origin', cache: 'no-store', signal: abort.signal,
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw new EvaluationError(response.status, data.error || 'unavailable');
    return data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', relay); }
}
export default function EvaluationApp() {
  const [state, setState] = React.useState<State | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [username, setUsername] = React.useState(''); const [password, setPassword] = React.useState('');
  const [visible, setVisible] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const [menu, setMenu] = React.useState<Menu | null>(null);
  const [choice, setChoice] = React.useState('');
  const epoch = React.useRef(0); const panel = React.useRef<HTMLHeadingElement>(null);
  const activeRequest = React.useRef<AbortController | null>(null);
  const reset = React.useCallback(() => {
    epoch.current += 1; activeRequest.current?.abort(); setMenu(null); setChoice(''); setPassword(''); setBusy(false);
    setState((previous) => previous ? { ...previous, authenticated: false, session_expires_at: null } : previous);
  }, []);
  React.useEffect(() => {
    const controller = new AbortController(); let active = true;
    request('session', undefined, controller.signal).then((data) => { if (active) setState(data); })
      .catch(() => { if (active) setError('No pudimos abrir la evaluación. Actualizá la página para reintentar.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); activeRequest.current?.abort(); };
  }, []);
  const choose = React.useCallback(async (node = 'start', selection: string | null = null) => {
    const current = ++epoch.current; activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    setBusy(true); setError('');
    try { const data = await request('menu', { node, selection }, controller.signal);
      if (epoch.current === current) { setMenu(data); setChoice(''); requestAnimationFrame(() => panel.current?.focus()); }
    } catch (failure) { if (epoch.current === current) {
      if (failure instanceof EvaluationError && [401,410].includes(failure.status)) { reset(); setError('La sesión de prueba terminó. Ingresá nuevamente.'); }
      else setError(failure instanceof EvaluationError && failure.status === 400 ? 'Esa opción no está en este menú. Elegí un botón o escribí su número.' : 'No pudimos cargar ese paso. Reintentá; no se envió ningún trámite.');
    } } finally { if (epoch.current === current) setBusy(false); }
  }, [reset]);
  React.useEffect(() => { if (state?.authenticated) void choose(); }, [state?.authenticated, choose]);
  React.useEffect(() => {
    if (!state?.authenticated || !state.session_expires_at) return;
    const timer = setTimeout(reset, Math.max(0, state.session_expires_at * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [state?.authenticated, state?.session_expires_at, reset]);
  async function login(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { const data = await request('login', { username, password }); setPassword(''); setMenu(null); setState(data); }
    catch (failure) {
      setError(failure instanceof EvaluationError && failure.status === 401 ? 'El usuario o la contraseña de prueba no coinciden.'
        : failure instanceof EvaluationError && failure.status === 429 ? 'Esperá un minuto antes de volver a intentar.'
        : failure instanceof EvaluationError && failure.status === 410 ? 'El período de evaluación terminó.'
        : 'No pudimos verificar el acceso. Revisá la conexión e intentá nuevamente.');
    } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); epoch.current += 1; activeRequest.current?.abort();
    try { await request('logout', {}); reset(); setError(''); }
    catch { setError('No pudimos cerrar la sesión en el servidor. Volvé a intentar.'); setBusy(false); }
  }
  const title = state?.title || 'Agente conversacional accesible';
  return (
    <main className="evaluation-app">
      <header className="evaluation-header">
        <div className="evaluation-brand"><span className="evaluation-mark" aria-hidden="true"><MessageSquare size={24} /></span>
          <div><strong>{title}</strong><span>{state?.institution || 'Espacio de evaluación'}</span></div></div>
        <div className="evaluation-header-actions"><span className="evaluation-badge">Demostración</span>
          {state?.authenticated && <button className="evaluation-secondary" onClick={() => void logout()} disabled={busy}><LogOut size={16} aria-hidden="true" /> Salir</button>}</div>
      </header>
      {loading ? <div role="status" className="evaluation-loading">Preparando el acceso…</div> : !state ? (
        <section className="evaluation-card"><h1>No se pudo abrir la evaluación</h1><p role="alert">{error}</p>
          <button onClick={() => window.location.reload()}>Volver a intentar</button></section>
      ) : !state.authenticated ? (
        <div className="evaluation-login-grid">
          <section className="evaluation-intro"><span className="evaluation-eyebrow">Atención accesible, paso a paso</span>
            <h1>Entrá y recorré<br />la experiencia.</h1>
            <p>Un acceso de prueba para explorar la orientación, los menús y la derivación asistida.</p>
            <div className="evaluation-highlights"><p><Check size={18} aria-hidden="true" /> Ingreso y cierre de sesión</p>
              <p><Check size={18} aria-hidden="true" /> Menús con referencia al documento de trabajo</p>
              <p><Check size={18} aria-hidden="true" /> Navegación desde teléfono, tablet o computadora</p></div>
          </section>
          <section className="evaluation-login-card" aria-labelledby="login-title">
            <span className="evaluation-icon"><ShieldCheck size={24} aria-hidden="true" /></span>
            <h2 id="login-title">Ingresar a la demostración</h2><p>Usá las credenciales de prueba que te compartieron.</p>
            <form onSubmit={(event) => void login(event)}>
              <label htmlFor="demo-user">Usuario de prueba</label>
              <input id="demo-user" autoComplete="username" autoCapitalize="none" spellCheck={false}
                maxLength={254} required value={username} onChange={(event) => setUsername(event.target.value)} disabled={busy} />
              <label htmlFor="demo-password">Contraseña de prueba</label>
              <div className="evaluation-password"><input id="demo-password" autoComplete="current-password" type={visible ? 'text' : 'password'}
                maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
                <button type="button" className="evaluation-eye" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
              {error && <p role="alert" className="evaluation-error">{error}</p>}
              <button className="evaluation-primary" type="submit" disabled={busy}>{busy ? 'Verificando acceso…' : 'Entrar'}<ArrowRight size={18} aria-hidden="true" /></button>
            </form>
            <p className="evaluation-note">Acceso de demostración. No verifica un correo ni activa 2FA. No ingreses datos personales reales.</p>
          </section>
        </div>
      ) : (
        <div className="evaluation-workspace">
          <aside className="evaluation-sidebar"><span className="evaluation-eyebrow">Tu espacio de prueba</span>
            <h1>Orientación <br />accesible</h1><p>Elegí una opción y seguí el recorrido. La información viene de la guía del servidor.</p>
            <button className="evaluation-secondary" onClick={() => void choose('main')} disabled={busy}>Menú principal <ChevronRight size={16} /></button>
            <button className="evaluation-secondary" onClick={() => void choose()} disabled={busy}>Cambiar quién consulta</button>
            {state.presentation_url && <a className="evaluation-secondary" href={state.presentation_url} target="_blank" rel="noopener noreferrer">Ver presentación del piloto</a>}
            <details className="evaluation-text-preview"><summary>Para el equipo técnico</summary><p>Paquete de mensajes interactivos para Meta y Twilio. Borrador sin envíos.</p><a className="evaluation-secondary" href="/api/evaluation?action=whatsapp-pack" download>Descargar paquete WhatsApp</a></details>
            <div className="evaluation-boundary"><strong>Entorno de evaluación</strong><p>Sin consultas a registros oficiales, trámites enviados ni respuestas de satisfacción guardadas.</p></div>
          </aside>
          <section className="evaluation-conversation" aria-label="Recorrido conversacional" aria-busy={busy}>
            <div className="evaluation-chat-header"><MessageSquare size={20} aria-hidden="true" /><div><strong>Menús de atención</strong><span>Guía interactiva · canal simulado</span></div></div>
            {error && <div className="evaluation-error" role="alert">{error}<button onClick={() => void choose(menu?.id || 'start')} disabled={busy}>Reintentar</button></div>}
            {!menu ? <p role="status" className="evaluation-loading">Cargando el primer paso…</p> : (
              <div className="evaluation-menu" key={menu.id}>
                <span className="evaluation-badge">{menu.kind === 'handoff' ? 'Derivación de prueba' : menu.kind === 'feedback' ? 'Cierre de prueba' : 'Orientación'}</span>
                <h2 ref={panel} tabIndex={-1}>{menu.title}</h2><p className="evaluation-message">{menu.text}</p>
                <div className="evaluation-options" aria-label="Opciones disponibles">{menu.actions.map((action) => (
                  <button key={action.code} disabled={busy} onClick={() => void choose(menu.id, action.code)}>
                    <span className="evaluation-code" aria-hidden="true">{action.code}</span><span>{action.label}</span><ChevronRight size={17} aria-hidden="true" />
                  </button>))}</div>
                <p className="evaluation-source">{menu.source.label} · páginas {menu.source_pages.join(', ')}. Contenido operativo sujeto a validación institucional.</p>
                <details className="evaluation-text-preview"><summary>Vista de texto para WhatsApp · sin envío</summary>
                  <pre>{`${menu.title}\n\n${menu.text}\n\n${menu.actions.map((a) => `${a.code}. ${a.label}`).join('\n')}`}</pre>
                </details>
              </div>
            )}
            <form className="evaluation-choice" onSubmit={(event) => { event.preventDefault(); if (choice.trim() && !busy) void choose(menu?.id || "start", choice.trim()); }}><label htmlFor="menu-choice">También podés escribir una opción</label><div><input id="menu-choice" inputMode="numeric" maxLength={16} value={choice} onChange={(event) => setChoice(event.target.value)} placeholder="Número, menú o inicio" disabled={busy || !menu} autoComplete="off" /><button className="evaluation-primary" type="submit" disabled={busy || !menu || !choice.trim()}>Continuar</button></div></form>
            <div className="evaluation-chat-footer" role="status">{busy ? 'Consultando el siguiente paso…' : 'Elegí una opción. No hace falta escribir datos personales.'}</div>
          </section>
        </div>
      )}
      <footer className="evaluation-footer">Evaluación aislada · Las credenciales de prueba no dan acceso a clientes ni a la administración de Chatboc.</footer>
    </main>
  );
}
