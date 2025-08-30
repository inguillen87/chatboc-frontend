/* @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from 'vitest';

// Helper to reload module fresh for each test
async function loadModule() {
  const mod = await import('../src/utils/contacts');
  return mod;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('getSpecializedContact', () => {
  it('returns contact when category exists', async () => {
    const mockData = { Luminaria: { nombre: 'Atención Luminarias' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { getSpecializedContact } = await loadModule();
    const contact = await getSpecializedContact('Luminaria');
    expect(contact).toEqual(mockData.Luminaria);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to default contact when category missing', async () => {
    const mockData = { default: { nombre: 'Atención al Vecino' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => mockData }));
    const { getSpecializedContact } = await loadModule();
    const contact = await getSpecializedContact('Inexistente');
    expect(contact).toEqual(mockData.default);
  });

  it('caches contacts after first load', async () => {
    const mockData = { Luminaria: { nombre: 'Atención Luminarias' } };
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockData });
    vi.stubGlobal('fetch', mockFetch);
    const { getSpecializedContact } = await loadModule();
    await getSpecializedContact('Luminaria');
    await getSpecializedContact('Luminaria');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
