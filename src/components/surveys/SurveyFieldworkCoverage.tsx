import { useId } from 'react';
import { ChevronDown, Info, ListFilter } from 'lucide-react';
import type { SurveyFieldworkCoverage as Coverage } from '@/utils/surveyFieldworkCoverage';
import styles from './SurveyFieldworkCoverage.module.css';

/** Labels and interpretation come from the same authorized aggregate as the counts. */
export function SurveyFieldworkCoverage({ coverage }: { coverage: Coverage }) {
  const headingId = useId();
  const number = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const { ui, basis } = coverage;
  return <section className={styles.panel} aria-labelledby={headingId} data-testid="survey-fieldwork-coverage" data-mode={coverage.scope.mode} data-selected-records={basis.selected_records}>
    <header className={styles.header}>
      <span className={styles.icon}><ListFilter size={21} aria-hidden="true" /></span>
      <div><p className={styles.eyebrow}>{ui.eyebrow}</p><h3 id={headingId}>{ui.heading}</h3></div>
    </header>
    <p className={styles.description}>{ui.description}</p>
    {basis.selected_records === 0 ? <p className={styles.empty} role="status">{ui.empty}</p> : null}
    <ul className={styles.rows} aria-labelledby={headingId}>
      {coverage.dimensions.map(dimension => <li key={dimension.id} className={styles.row} data-dimension={dimension.id}>
        <h4>{dimension.label}</h4>
        <dl className={styles.metrics}>
          <div><dt>{ui.recorded}</dt><dd>{number(dimension.recorded_count)}<span className={styles.denominator}> / {number(basis.selected_records)}</span></dd></div>
          <div><dt>{ui.missing}</dt><dd>{number(dimension.missing_count)}</dd></div>
          <div><dt>{ui.coverage}</dt><dd>{dimension.coverage_percent === null ? '—' : `${number(dimension.coverage_percent)} %`}</dd></div>
        </dl>
      </li>)}
    </ul>
    <details className={styles.details}>
      <summary><Info size={18} aria-hidden="true" /><span>{ui.details}</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <dl className={styles.definitions}>{coverage.dimensions.map(dimension => <div key={dimension.id}>
        <dt>{dimension.label}</dt><dd>{dimension.detail}</dd>
      </div>)}</dl>
      <div className={styles.notes}>{coverage.limitations.map(note => <div key={note.id}><h4>{note.title}</h4><p>{note.detail}</p></div>)}</div>
    </details>
  </section>;
}
