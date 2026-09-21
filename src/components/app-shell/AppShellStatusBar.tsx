import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WifiOff, X } from 'lucide-react';
import { useRuntimeRecovery } from '@/hooks/useRuntimeRecovery';
import styles from './RuntimeRecoveryBar.module.css';

/** No local text fallback: an older/offline backend must not invent configuration. */
export const AppShellStatusBar = () => {
  const { phase, ui, retry, dismiss } = useRuntimeRecovery();
  if (phase === 'quiet' || !ui) return null;
  const copy = ui.states[phase];
  const busy = phase === 'checking' || phase === 'waiting';
  const Icon = phase === 'offline' ? WifiOff : busy ? Loader2 : phase === 'verified' ? CheckCircle2 : AlertTriangle;
  return <section className={styles.bar} data-state={phase} aria-label={ui.region_label} data-testid="runtime-recovery-bar">
    <Icon className={busy ? styles.spin : ''} size={20} aria-hidden="true" />
    <div className={styles.content} role="status" aria-live="polite" aria-atomic="true">
      <p className={styles.title}>{copy.title}</p>
      <p className={styles.detail}>{copy.detail}</p>
    </div>
    {phase === 'verified' ? <button type="button" className={styles.dismiss} onClick={dismiss} aria-label={ui.dismiss_label}>
      <X size={18} aria-hidden="true" />
    </button> : <button type="button" className={styles.retry} disabled={busy} onClick={retry}>
      <RefreshCw size={16} aria-hidden="true" />{ui.check_label}
    </button>}
  </section>;
};
