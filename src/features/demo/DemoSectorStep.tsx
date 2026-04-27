import React from 'react';
import type { DemoSector } from './demoTypes';

export default function DemoSectorStep({ onSelect }: { onSelect: (sector: DemoSector) => void }) {
  return (
    <div className="flex gap-2">
      <button className="rounded border px-3 py-1" onClick={() => onSelect('gobierno')}>Gobierno</button>
      <button className="rounded border px-3 py-1" onClick={() => onSelect('empresas')}>Empresas</button>
    </div>
  );
}
