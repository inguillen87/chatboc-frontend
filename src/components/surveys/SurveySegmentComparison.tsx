import { useId } from 'react';
import { ChevronDown, GitCompareArrows, Info } from 'lucide-react';
import type { SurveySegmentComparison as Comparison } from '@/utils/surveySegmentCompare';
import styles from './SurveySegmentComparison.module.css';

export const formatSegmentNumber = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
export const formatSegmentDelta = (value: number | null, unit: string) => value === null ? '—' :
  `${value > 0 ? '+' : ''}${formatSegmentNumber(value)} ${unit}`;

export function SurveySegmentComparison({ comparison, labelA, labelB }: { comparison: Comparison; labelA?: string; labelB?: string }) {
  const heading = useId(); const { ui, basis } = comparison;
  const percent = (value: number | null) => value === null ? '—' : `${formatSegmentNumber(value)} %`;
  return <section className={styles.panel} aria-labelledby={heading} data-testid="survey-segment-compare"
    data-selected-records={basis.selected_records} data-mode={comparison.scope.mode}>
    <header className={styles.header}><span className={styles.icon}><GitCompareArrows size={22} aria-hidden="true" /></span>
      <div><h3 id={heading}>{ui.heading}</h3><p>{ui.description}</p></div></header>
    <dl className={styles.bases}>
      <div><dt>{ui.base}</dt><dd>{formatSegmentNumber(basis.selected_records)}</dd></div>
      <div><dt>{ui.segment_a}</dt><dd>{formatSegmentNumber(basis.segment_a_records)}</dd>{labelA ? <p>{labelA}</p> : null}</div>
      <div><dt>{ui.segment_b}</dt><dd>{formatSegmentNumber(basis.segment_b_records)}</dd>{labelB ? <p>{labelB}</p> : null}</div>
      <div><dt>{ui.overlap}</dt><dd>{formatSegmentNumber(basis.overlap_records)}</dd></div>
    </dl>
    {!comparison.questions.length || basis.selected_records === 0 ? <p className={styles.empty} role="status">{ui.empty}</p> : null}
    <div className={styles.questions}>{comparison.questions.map(question => <article key={question.id} className={styles.question}
      data-question-id={question.id} aria-labelledby={`${heading}-question-${question.id}`}>
      <header><h4 id={`${heading}-question-${question.id}`}>{question.label}</h4>
        <p>{ui.answered}: {ui.segment_a} <strong>{formatSegmentNumber(question.segment_a_answered)}</strong>
          <span aria-hidden="true"> · </span>{ui.segment_b} <strong>{formatSegmentNumber(question.segment_b_answered)}</strong></p>
        {question.segment_a_conflicts > 0 || question.segment_b_conflicts > 0 ? <p>{ui.conflicts}: {ui.segment_a} {formatSegmentNumber(question.segment_a_conflicts)}
          <span aria-hidden="true"> · </span>{ui.segment_b} {formatSegmentNumber(question.segment_b_conflicts)}</p> : null}</header>
      <ul className={styles.options}>{question.options.map(option => <li key={option.id} className={styles.option} data-option-id={option.id}>
        <h5>{option.label}</h5>
        <dl className={styles.metrics}>
          <div><dt>{ui.segment_a}</dt><dd><strong>{percent(option.segment_a_percent)}</strong>
            <span>{ui.selected}: {formatSegmentNumber(option.segment_a_count)} / {formatSegmentNumber(question.segment_a_answered)}</span></dd></div>
          <div><dt>{ui.segment_b}</dt><dd><strong>{percent(option.segment_b_percent)}</strong>
            <span>{ui.selected}: {formatSegmentNumber(option.segment_b_count)} / {formatSegmentNumber(question.segment_b_answered)}</span></dd></div>
          <div><dt>{ui.delta}</dt><dd className={styles.delta}><strong>{formatSegmentDelta(option.delta_percentage_points, ui.delta_unit)}</strong></dd></div>
        </dl>
      </li>)}</ul>
    </article>)}</div>
    <details className={styles.details}><summary><Info size={18} aria-hidden="true" /><span>{ui.details}</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <div className={styles.notes}>{comparison.limitations.map(note => <div key={note.id}><h4>{note.title}</h4><p>{note.detail}</p></div>)}</div>
    </details>
  </section>;
}
