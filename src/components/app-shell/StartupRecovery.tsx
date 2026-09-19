import { useId } from 'react';
import { AlertTriangle, Layers, Loader2, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { STARTUP_COPY, type StartupPhase } from '@/config/startupExperience';
import styles from './StartupRecovery.module.css';

type Props = { phase: StartupPhase; onRetry?: () => void };
export function StartupRecovery({ phase, onRetry }: Props) {
  const id = useId();
  const copy = STARTUP_COPY[phase];
  const busy = phase === 'checking' || phase === 'waiting' || phase === 'session';
  const failed = phase === 'unavailable' || phase === 'mismatch';
  const Icon = phase === 'offline' ? WifiOff : phase === 'mismatch' ? Layers : failed ? AlertTriangle : Loader2;
  return <main id="main-content" className={styles.surface} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
    <section className={styles.card} data-phase={phase} data-testid="startup-recovery">
      <div className={styles.accent} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.eyebrow}><ShieldCheck size={17} aria-hidden="true"/>Inicio de tu espacio</div>
        <div className={styles.icon} aria-hidden="true"><Icon size={30} className={busy ? styles.spin : undefined}/></div>
        <div role={failed ? 'alert' : 'status'} aria-live={failed ? 'assertive' : 'polite'} aria-atomic="true">
          <h1 id={`${id}-title`}>{copy.title}</h1>
          <p id={`${id}-description`} className={styles.description}>{copy.description}</p>
        </div>
        <div className={styles.state}><span className={styles.dot} aria-hidden="true"/>{copy.label}</div>
        {failed && onRetry ? <button className={styles.retry} type="button" onClick={onRetry}>
          <RefreshCw size={17} aria-hidden="true"/>Reintentar inicio
        </button> : null}
        <div className={styles.note}>
          <p>Esta pantalla sólo comprueba el inicio.</p>
          <p>No confirma compras, pagos, reclamos ni envíos de mensajes.</p>
        </div>
        {failed ? <details className={styles.details}>
          <summary>Información para soporte</summary>
          <p>Referencia: <code>{phase === 'mismatch' ? 'START_VERSION_MISMATCH' : 'START_UNAVAILABLE'}</code></p>
          <p>Podés comunicar esta referencia. No incluye tus credenciales ni datos de la organización.</p>
        </details> : null}
      </div>
    </section>
  </main>;
}
