import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WifiOff, X } from 'lucide-react';
import { useRuntimeRecovery } from '@/hooks/useRuntimeRecovery';
import { RUNTIME_RECOVERY_COPY } from '@/config/runtimeRecovery';
import styles from './RuntimeRecoveryBar.module.css';

/** A single non-modal status bar: it never wraps or replaces the active route. */
export const AppShellStatusBar = () => {
  const { phase, retry, dismiss } = useRuntimeRecovery();
  if (phase === 'quiet') return null;
  const copy = RUNTIME_RECOVERY_COPY[phase];
  const busy = phase === 'checking' || phase === 'waiting';
  const Icon = phase === 'offline' ? WifiOff : busy ? Loader2 : phase === 'verified' ? CheckCircle2 : AlertTriangle;
  return <section className={styles.bar} data-state={phase} aria-label="Estado del servicio" data-testid="runtime-recovery-bar">
    <Icon className={busy ? styles.spin : ''} size={20} aria-hidden="true" />
    <div className={styles.content} role="status" aria-live="polite" aria-atomic="true">
      <p className={styles.title}>{copy.title}</p>
      <p className={styles.detail}>{copy.detail}</p>
    </div>
    {phase === 'verified' ? <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Cerrar estado del servicio">
      <X size={18} aria-hidden="true" />
    </button> : <button type="button" className={styles.retry} disabled={busy || phase === 'offline'} onClick={retry}>
      <RefreshCw size={16} aria-hidden="true" /> Comprobar servicio
    </button>}
  </section>;
};
