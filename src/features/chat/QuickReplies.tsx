import React from 'react';
import type { QuickReplyItem } from './chatTypes';

export default function QuickReplies({
  items,
  onSelect,
}: {
  items: QuickReplyItem[];
  onSelect: (item: QuickReplyItem) => void;
}) {
  if (!items.length) return null;

  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Sugerencias rápidas">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onSelect(item)}
            aria-label={`Enviar sugerencia: ${item.label}`}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
