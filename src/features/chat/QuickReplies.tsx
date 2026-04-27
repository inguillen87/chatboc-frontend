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
    <div className="flex flex-wrap gap-2" aria-label="Sugerencias rápidas" role="list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => onSelect(item)}
          aria-label={`Enviar sugerencia: ${item.label}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
