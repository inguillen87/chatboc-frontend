import React, { useMemo } from 'react';
import { COMMERCIAL_STAGES, STAGE_LABELS, type CommercialLead } from './commercialFollowUp';
import { buildCommercialInsights, type CommercialAttention } from './commercialInsightsModel';
import './commercialInsights.css';
interface Props {
  items: CommercialLead[]; now: number; stage: string; attention: CommercialAttention;
  disabled?: boolean; onStage: (stage: string) => void; onAttention: (attention: CommercialAttention) => void;
}
export function CommercialInsights({ items, now, stage, attention, disabled, onStage, onAttention }: Props) {
  const summary = useMemo(() => buildCommercialInsights(items, now), [items, now]);
  const bars = [...COMMERCIAL_STAGES.map((key) => ({ key, label: STAGE_LABELS[key], value: summary.stages[key] })),
    { key: 'unknown', label: 'Etapa no informada', value: summary.stages.unknown }];
  return <section className="commercial-insights" aria-label="Indicadores de los casos cargados">
    <div className="commercial-kpis">
      <div><span>Casos cargados</span><strong>{summary.total}</strong><small>No es el total global</small></div>
      <button type="button" disabled={disabled} aria-pressed={stage === 'open'} onClick={() => onStage(stage === 'open' ? 'all' : 'open')}>
        <span>En seguimiento</span><strong>{summary.open}</strong><small>Etapas abiertas conocidas</small></button>
      <button type="button" disabled={disabled} aria-pressed={attention === 'quiet'} onClick={() => onAttention(attention === 'quiet' ? 'all' : 'quiet')}>
        <span>Sin actividad reciente</span><strong>{summary.activity.quiet}</strong><small>Abiertos · 7 días o más</small></button>
      <button type="button" disabled={disabled} aria-pressed={attention === 'unknown'} onClick={() => onAttention(attention === 'unknown' ? 'all' : 'unknown')}>
        <span>Actividad no verificable</span><strong>{summary.activity.unknown}</strong><small>Abiertos · revisar datos</small></button>
    </div>
    <details className="commercial-charts" open>
      <summary>Distribución comercial y actividad</summary>
      <div className="commercial-chart-grid">
        <section aria-label="Distribución por etapa">
          <h3>Casos por etapa</h3><p className="commercial-hint">Tocá una barra para filtrar. Base: {summary.total} casos cargados; no es un embudo de conversión.</p>
          <ol className="commercial-bar-chart">{bars.map((bar) => <li key={bar.key}>
            <button type="button" disabled={disabled} aria-pressed={stage === bar.key} aria-label={`Filtrar ${bar.label}: ${bar.value} casos`}
              onClick={() => onStage(stage === bar.key ? 'all' : bar.key)}>
              <span className="commercial-bar-track" aria-hidden="true"><span style={{ width: `${summary.total ? bar.value / summary.total * 100 : 0}%` }} /></span>
              <span>{bar.label}</span><strong>{bar.value}</strong>
            </button>
          </li>)}</ol>
        </section>
        <section aria-label="Antigüedad de actividad en casos abiertos">
          <h3>Última actividad informada</h3><p className="commercial-hint">Base: {summary.open} casos en etapas abiertas conocidas. No mide vencimientos de SLA.</p>
          <ol className="commercial-activity-chart">{([
            ['recent', 'Menos de 7 días', summary.activity.recent], ['quiet', '7 días o más', summary.activity.quiet],
            ['unknown', 'Fecha no verificable', summary.activity.unknown],
          ] as const).map(([key, label, value]) => <li key={key}>
            <div><span>{label}</span><strong>{value}</strong></div>
            <span className="commercial-activity-track" aria-hidden="true"><span style={{ width: `${summary.open ? value / summary.open * 100 : 0}%` }} /></span>
          </li>)}</ol>
          <p className="commercial-hint">Fechas ausentes, futuras, inválidas o sin zona horaria no se convierten en antigüedad. Se usa la fecha publicada por el servidor, no una fecha estimada.</p>
          <div className="commercial-outcomes"><span>Ganados <strong>{summary.won}</strong></span><span>Perdidos <strong>{summary.lost}</strong></span></div>
        </section>
      </div>
    </details>
  </section>;
}
