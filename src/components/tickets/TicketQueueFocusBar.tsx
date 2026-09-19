import React from 'react';
import { AlertTriangle, MessagesSquare, UserRound, SlidersHorizontal, X } from 'lucide-react';
import { TICKET_FOCUS_FILTERS, type TicketFocusKey, type TicketFocusState } from '@/utils/ticketFocusFilters';
import styles from './TicketQueueFocusBar.module.css';

type Props = {
  filters: TicketFocusState;
  onToggle: (key: TicketFocusKey) => void;
  onClear: () => void;
};
const shortcuts = [
  { key: 'unread', label: 'No leídos', icon: MessagesSquare, tone: 'violet',
    hint: 'Filtrar conversaciones con mensajes sin leer.' },
  { key: 'sla', label: 'SLA vencido', icon: AlertTriangle, tone: 'amber',
    hint: 'Filtrar casos con un vencimiento informado por el servidor; no se estima por antigüedad.' },
  { key: 'agent', label: 'Sin asignar', icon: UserRound, tone: 'sky',
    hint: 'Filtrar casos sin responsable según la asignación informada.' },
] as const;

export const TicketQueueFocusBar = ({ filters, onToggle, onClear }: Props) => {
  const activeCount = shortcuts.filter(({ key }) => filters[key] === TICKET_FOCUS_FILTERS[key]).length;
  const descriptionId = React.useId();
  return (
    <section className={styles.root} aria-label="Enfoque de atención" data-testid="ticket-queue-focus">
      <div className={styles.heading}>
        <span><SlidersHorizontal size={13} aria-hidden="true" /> Enfoque de atención</span>
        {activeCount > 0 ? <button type="button" onClick={onClear} className={styles.clear}
          aria-label="Quitar enfoque sin borrar los demás filtros"><X size={12} aria-hidden="true" /> Quitar</button> : null}
      </div>
      <div className={styles.grid} role="group" aria-describedby={descriptionId}>
        {shortcuts.map(({ key, label, icon: Icon, tone, hint }) => (
          <button key={key} type="button" className={styles.choice} data-tone={tone}
            aria-label={`Enfocar: ${label}`} aria-pressed={filters[key] === TICKET_FOCUS_FILTERS[key]}
            title={hint} onClick={() => onToggle(key)}>
            <Icon size={16} aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </div>
      <p id={descriptionId} className={styles.help}>
        {activeCount > 1 ? 'Deben cumplirse todos los enfoques elegidos.' : 'Se combina con tu búsqueda y filtros.'}
      </p>
    </section>
  );
};
