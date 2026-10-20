import React from 'react';
import { Activity, AlertCircle, CheckCircle2, ChevronDown, Clock3, MapPin } from 'lucide-react';
import { operationsSourceState, type OperationsReadSource, type OperationsSourceState } from './operationsReadState';
import './operationsWorkspace.css';
const stateLabels: Record<OperationsSourceState, string> = { paused: 'Esperando conexión', error: 'Consulta fallida', loading: 'Consultando', refreshing: 'Actualizando lectura', ready: 'Respuesta disponible', empty: 'Sin publicación' };
const sections = [
  ['operations-overview', 'Resumen'], ['operations-tickets', 'Reclamos'], ['operations-engagement', 'Encuestas y canales'],
  ['operations-team', 'Equipo'], ['operations-heatmap', 'Mapa de calor'], ['operations-actions', 'Acciones'],
  ['operations-ai-provider-status', 'Integraciones IA'],
] as const;
export function OperationsWorkspaceStatus({ tenantSlug, sources, paused, mapFilterCount, labels = {} }: {
  tenantSlug: string; sources: OperationsReadSource[]; paused: boolean; mapFilterCount: number; labels?: Record<string, string>;
}) {
  const failures = sources.filter((source) => source.isError).length;
  const available = sources.filter((source) => source.data !== null && source.data !== undefined && !source.isError).length;
  const loading = sources.some((source) => source.isFetching);
  const go = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduceMotion === 'true';
    target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
    target.scrollIntoView?.({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  return <div className="operations-workspace-status" data-testid="operations-workspace-status">
    <nav aria-label="Secciones del centro de decisiones" className="operations-workspace-nav">
      {sections.map(([id, label]) => <a key={id} href={`#${id}`} onClick={(event) => go(event, id)}>{labels[`navigation_${id}`] || label}</a>)}
    </nav>
    <details className="operations-source-details">
      <summary><span className="operations-source-title"><Activity size={18} aria-hidden="true" />{labels.source_status_title || 'Fuentes y alcance de esta vista'}<ChevronDown size={16} aria-hidden="true" className="operations-source-disclosure" /></span>
        <span className="operations-source-summary">{available}/{sources.length} disponibles{failures ? ` · ${failures} con error` : ''}{loading ? ' · consultando' : ''}{paused ? ' · actualización en pausa' : ''}</span>
      </summary>
      <p className="operations-source-context">Organización: <strong>{tenantSlug}</strong>. Cada fuente se consulta por separado. La hora de lectura no acredita la actualidad de los registros originales.</p>
      <ul className="operations-source-grid">{sources.map((source) => {
        const state = operationsSourceState(source);
        const Icon = state === 'error' ? AlertCircle : state === 'ready' ? CheckCircle2 : Clock3;
        const timestamp = source.dataUpdatedAt;
        const time = typeof timestamp === 'number' && timestamp > 0 && timestamp <= Date.now() ? new Date(timestamp) : null;
        return <li key={source.id} data-state={state}>
          <span className="operations-source-name"><Icon size={16} aria-hidden="true" /><strong>{source.label}</strong></span>
          <span>{stateLabels[state]}</span>
          <small>{state === 'error' ? 'Se retiró la información anterior.' : time ? `Última lectura: ${time.toLocaleTimeString('es-AR', { timeZoneName: 'short' })}` : 'Sin lectura confirmada.'}</small>
        </li>;
      })}</ul>
    </details>
    <p className="operations-map-scope"><MapPin size={16} aria-hidden="true" />
      {mapFilterCount ? `${mapFilterCount} filtros territoriales aplicados sólo al mapa. ` : 'Los filtros territoriales se aplican sólo al mapa. '}
      El período se comparte con el resumen; un segmento del mapa no filtra toda la cola ni demuestra representatividad de una encuesta.
    </p>
  </div>;
}
