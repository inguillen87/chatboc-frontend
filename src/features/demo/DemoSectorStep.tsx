import React from 'react';
import type { DemoSector, DemoSectorGroup } from './demoTypes';

const DEFAULT_SECTORS: DemoSector[] = ['gobierno', 'empresas'];

const fallbackSectorLabel = (sector: DemoSector) => {
  if (sector === 'gobierno') return 'Gobierno';
  if (sector === 'empresas') return 'Empresas';
  return String(sector);
};

export default function DemoSectorStep({
  onSelect,
  sectors,
  sectorGroups,
  selectedSector,
}: {
  onSelect: (sector: DemoSector) => void;
  sectors?: DemoSector[];
  sectorGroups?: DemoSectorGroup[];
  selectedSector?: DemoSector | null;
}) {
  const availableSectors = sectors?.length ? sectors : DEFAULT_SECTORS;
  const groupByKey = new Map((sectorGroups ?? []).map((group) => [String(group.key), group]));

  return (
    <div className="flex flex-wrap gap-2">
      {availableSectors.map((sector) => {
        const group = groupByKey.get(String(sector));
        const label = group?.label?.trim() || fallbackSectorLabel(sector);
        const selected = selectedSector === sector;
        return (
          <button
            key={String(sector)}
            className={`rounded border px-3 py-1 text-sm transition-colors ${
              selected ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
            type="button"
            onClick={() => onSelect(sector)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
