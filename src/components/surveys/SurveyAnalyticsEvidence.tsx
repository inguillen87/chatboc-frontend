import { useId } from 'react';
import { BarChart3, ChevronDown, Info, ScanLine } from 'lucide-react';
import type { AnalyticsEvidence } from '@/utils/surveyAnalyticsEvidence';
import styles from './SurveyAnalyticsEvidence.module.css';

/** All labels and explanations are published by the authenticated backend. */
export function SurveyAnalyticsEvidence({ evidence }: { evidence: AnalyticsEvidence }) {
  const heading = useId();
  const coverage = evidence.basis.detail_coverage_percent;
  const number = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return <section className={styles.panel} aria-labelledby={heading} data-testid="analytics-evidence" data-mode={evidence.scope.mode}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <span className={styles.icon}><ScanLine size={22} aria-hidden="true" /></span>
        <div><p className={styles.eyebrow}>{evidence.ui.eyebrow}</p><h3 id={heading}>{evidence.ui.heading}</h3></div>
      </div>
      <span className={styles.mode}>{evidence.ui.mode}</span>
    </header>
    <p className={styles.description}>{evidence.ui.description}</p>
    <dl className={styles.cards}>
      {evidence.cards.map(metric => <div key={metric.id} className={styles.card} data-basis={metric.basis}>
        <dt>{metric.label}</dt>
        <dd>{metric.value === null ? '\u2014' : `${metric.basis === 'estimated' ? '\u2248 ' : ''}${number(metric.value)}${metric.unit === 'percent' ? ' %' : ''}`}</dd>
        <span className={styles.badge}>{evidence.ui[metric.basis]}</span>
        <p>{metric.detail}</p>
      </div>)}
    </dl>
    <div className={styles.coverage}>
      <div><BarChart3 size={16} aria-hidden="true" /><span>{evidence.ui.coverage}</span>
        <strong>{number(evidence.basis.detail_records)} / {number(evidence.basis.selected_records)}</strong>
        <span>{coverage === null ? evidence.ui.unavailable : `${number(coverage)} %`}</span>
      </div>
      {coverage !== null ? <progress value={coverage} max={100} aria-label={evidence.ui.coverage} /> : null}
    </div>
    <details className={styles.details}>
      <summary><Info size={18} aria-hidden="true" /><span>{evidence.ui.details}</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <div className={styles.detailsContent}>
        <dl className={styles.facts}>{evidence.facts.map(fact => <div key={fact.id}>
          <dt>{fact.label}</dt><dd>{fact.value}</dd><p>{fact.note}</p>
        </div>)}</dl>
        <div className={styles.notes}>{evidence.limitations.map(note => <div key={note.id}>
          <h4>{note.title}</h4><p>{note.detail}</p>
        </div>)}</div>

      </div>
    </details>
  </section>;
}
