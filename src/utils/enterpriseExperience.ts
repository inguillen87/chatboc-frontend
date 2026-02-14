import type { DemoRubro } from '@/services/enterpriseService';

interface RubroNode {
  id?: number;
  nombre?: string | null;
  clave?: string | null;
}

const normalizeRubroValue = (item: RubroNode): DemoRubro | null => {
  const normalizedKey = String(item?.clave ?? item?.nombre ?? '').trim().toLowerCase();

  if (normalizedKey.includes('municipio')) return 'municipio';
  if (normalizedKey.includes('pyme')) return 'pyme';

  if (item?.id === 1) return 'municipio';
  if (item?.id === 2) return 'pyme';

  return null;
};

export interface DemoOption {
  value: DemoRubro;
  label: string;
}

export const mapDemoOptionsFromHierarchy = (hierarchy: RubroNode[] | null | undefined): DemoOption[] => {
  if (!Array.isArray(hierarchy)) return [];

  const seen = new Set<DemoRubro>();

  return hierarchy
    .map((item) => {
      const value = normalizeRubroValue(item);
      if (!value || seen.has(value)) return null;
      seen.add(value);

      return {
        value,
        label: String(item?.nombre ?? item?.clave ?? item?.id ?? value),
      } as DemoOption;
    })
    .filter((item): item is DemoOption => Boolean(item));
};

export const openExportAndTrack = (
  url: string,
  track: () => Promise<unknown>,
  openWindow: (targetUrl: string) => void = (targetUrl) => {
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  },
) => {
  openWindow(url);
  Promise.resolve(track()).catch((error) => {
    console.warn('[enterprise] export tracking failed', error);
  });
};
