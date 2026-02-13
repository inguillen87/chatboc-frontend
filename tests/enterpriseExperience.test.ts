import { describe, expect, it, vi } from 'vitest';
import { mapDemoOptionsFromHierarchy, openExportAndTrack } from '@/utils/enterpriseExperience';

describe('enterpriseExperience utilities', () => {
  it('maps backend hierarchy to demo options without hardcoded fallback list', () => {
    const result = mapDemoOptionsFromHierarchy([
      { id: 1, nombre: 'Gobierno Digital' },
      { id: 2, nombre: 'Comercio Inteligente' },
      { id: 99, nombre: 'Otro' },
    ]);

    expect(result).toEqual([
      { value: 'municipio', label: 'Gobierno Digital' },
      { value: 'pyme', label: 'Comercio Inteligente' },
    ]);
  });

  it('opens export immediately even when tracking fails', async () => {
    const events: string[] = [];
    const openWindow = vi.fn((url: string) => {
      events.push(`open:${url}`);
    });
    const track = vi.fn(async () => {
      events.push('track');
      throw new Error('tracking failure');
    });

    openExportAndTrack('/admin/analytics/export.csv?tenant_id=1', track, openWindow);
    await Promise.resolve();

    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledTimes(1);
    expect(events[0]).toBe('open:/admin/analytics/export.csv?tenant_id=1');
  });
});
