import React from 'react';
import type { Rubro } from '@/types/rubro';

export default function DemoRubroStep({ rubros, onSelect }: { rubros: Rubro[]; onSelect: (rubro: Rubro) => void }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {rubros.slice(0, 8).map((rubro) => (
        <button key={rubro.id} className="rounded border px-3 py-2 text-left" onClick={() => onSelect(rubro)}>{rubro.nombre}</button>
      ))}
    </div>
  );
}
