import React from 'react';
import { COMMERCIAL_STAGES, STAGE_LABELS, isCommercialStage, type CommercialLead } from './commercialFollowUp';
import './commercialInsights.css';
interface Props { items: CommercialLead[]; disabled?: boolean; onSelect: (lead: CommercialLead) => void }
export function CommercialKanban({ items, disabled, onSelect }: Props) {
  const columns = [...COMMERCIAL_STAGES.map((stage) => ({ stage, label: STAGE_LABELS[stage], items: items.filter((item) => item.stage === stage) })),
    { stage: 'unknown', label: 'Etapa no informada', items: items.filter((item) => !isCommercialStage(item.stage)) }];
  return <section aria-label="Tablero comercial por etapas" className="commercial-board-region">
    <p className="commercial-hint">Las etapas se cambian desde la ficha, con motivo y confirmación. El tablero no mueve casos al arrastrar.</p>
    <div className="commercial-kanban" tabIndex={0} aria-label="Columnas del tablero; desplazamiento horizontal">
      {columns.filter((column) => column.stage !== 'unknown' || column.items.length > 0).map((column) => <section key={column.stage} className="commercial-kanban-column" aria-label={`${column.label}: ${column.items.length} casos`}>
        <h3><span>{column.label}</span><span className="commercial-stage">{column.items.length}</span></h3>
        {!column.items.length ? <p className="commercial-hint">Sin casos en esta selección.</p> : <ul>
          {column.items.map((lead) => <li key={lead.key}><button type="button" className="commercial-kanban-card" disabled={disabled}
            aria-label={`Seguimiento de ${lead.name}, caso ${lead.number}`} onClick={() => onSelect(lead)}>
            <strong>{lead.name}</strong><span>Caso {lead.number} · ID {lead.ticketId}</span>
            <span>{lead.email || lead.phone || 'Sin datos de contacto'}</span><small>{lead.category || lead.ticketType}</small>
          </button></li>)}
        </ul>}
      </section>)}
    </div>
  </section>;
}
