import React from 'react';
import type { DemoSector, DemoSectorGroup } from './demoTypes';

const readStringArray = (group: DemoSectorGroup | undefined, keys: string[]) => {
  if (!group) return [];

  for (const key of keys) {
    const value = group[key];
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : null))
        .filter((item): item is string => Boolean(item));
    }
  }

  return [];
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
  const availableSectors = sectors?.length
    ? sectors
    : (sectorGroups ?? [])
        .map((group) => group.key)
        .filter((sector): sector is DemoSector => typeof sector === 'string' && sector.trim().length > 0);
  const groupByKey = new Map((sectorGroups ?? []).map((group) => [String(group.key), group]));

  if (!availableSectors.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {availableSectors.map((sector) => {
        const group = groupByKey.get(String(sector));
        const label = group?.label?.trim() || String(sector);
        const description = group?.description?.trim();
        const highlights = readStringArray(group, ['highlights', 'features', 'summary_items', 'tags']).slice(0, 3);
        const selected = selectedSector === sector;
        return (
          <button
            key={String(sector)}
            className={`min-h-[156px] rounded-[8px] border p-4 text-left transition-colors ${
              selected
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'bg-background/80 hover:border-primary/40 hover:bg-primary/5'
            }`}
            type="button"
            onClick={() => onSelect(sector)}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="block text-base font-semibold leading-tight">{label}</span>
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${selected ? 'bg-primary-foreground' : 'bg-primary'}`} />
            </span>
            {description ? (
              <span className={`mt-3 block text-sm leading-5 ${selected ? 'text-primary-foreground/85' : 'text-muted-foreground'}`}>
                {description}
              </span>
            ) : null}
            {highlights.length ? (
              <span className="mt-4 flex flex-wrap gap-1.5">
                {highlights.map((item) => (
                  <span
                    key={item}
                    className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                      selected
                        ? 'border-primary-foreground/30 text-primary-foreground/90'
                        : 'border-border bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
