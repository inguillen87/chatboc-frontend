import React from 'react';
import type { DemoSector, DemoSectorGroup } from './demoTypes';

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
  const availableSectors = sectors?.length
    ? sectors
    : (sectorGroups ?? [])
        .map((group) => group.key)
        .filter((sector): sector is DemoSector => typeof sector === 'string' && sector.trim().length > 0);
  const groupByKey = new Map((sectorGroups ?? []).map((group) => [String(group.key), group]));

  if (!availableSectors.length) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {availableSectors.map((sector) => {
        const group = groupByKey.get(String(sector));
        const label = group?.label?.trim() || String(sector);
        const description = group?.description?.trim();
        const selected = selectedSector === sector;
        return (
          <button
            key={String(sector)}
            className={`rounded-[8px] border px-3 py-3 text-left transition-colors ${
              selected
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'bg-background/70 hover:border-primary/40 hover:bg-primary/5'
            }`}
            type="button"
            onClick={() => onSelect(sector)}
          >
            <span className="block text-sm font-semibold">{label}</span>
            {description ? (
              <span className={`mt-1 block text-xs ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                {description}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
