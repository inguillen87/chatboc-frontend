import type { DemoRubro } from '@/services/enterpriseService';

interface RubroNode {
  id?: number;
  nombre?: string | null;
  clave?: string | null;
}

export interface DemoOption {
  value: DemoRubro;
  label: string;
}

export const mapDemoOptionsFromHierarchy = (hierarchy: RubroNode[] | null | undefined): DemoOption[] => {
  if (!Array.isArray(hierarchy)) return [];

  return hierarchy
    .map((item) => {
      const value = item?.id === 1 ? 'municipio' : item?.id === 2 ? 'pyme' : null;
      if (!value) return null;
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
