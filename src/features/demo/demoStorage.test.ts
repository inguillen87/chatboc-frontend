import { beforeEach, describe, expect, it, vi } from 'vitest';
import { safeSessionStorage } from '@/utils/safeLocalStorage';
import {
  clearDemoWhatsappProfileSelection,
  DEMO_WHATSAPP_PROFILE_STORAGE_KEY,
  persistDemoWhatsappProfileSelection,
  readDemoWhatsappProfileSelection,
  subscribeDemoWhatsappProfileSelection,
} from './demoStorage';

describe('demo WhatsApp profile storage', () => {
  beforeEach(() => {
    clearDemoWhatsappProfileSelection();
  });

  it('restores a recent selection only in a compatible scope', () => {
    window.history.replaceState({}, '', '/demo?sector=empresas');
    persistDemoWhatsappProfileSelection({
      key: 'bodega',
      sector: 'empresas',
      tenantSlug: 'bodega-demo',
    });

    expect(
      readDemoWhatsappProfileSelection({ sector: 'empresas', tenantSlug: 'bodega-demo' }),
    ).toBe('bodega');
    expect(readDemoWhatsappProfileSelection({ sector: 'gobierno' })).toBeNull();
    expect(readDemoWhatsappProfileSelection()).toBe('bodega');
    window.history.replaceState({}, '', '/demo?sector=gobierno');
    expect(readDemoWhatsappProfileSelection()).toBeNull();
    window.history.replaceState({}, '', '/');
  });

  it('fails closed and clears malformed or expired state', () => {
    safeSessionStorage.setItem(DEMO_WHATSAPP_PROFILE_STORAGE_KEY, '{not-json');
    expect(readDemoWhatsappProfileSelection()).toBeNull();
    expect(safeSessionStorage.getItem(DEMO_WHATSAPP_PROFILE_STORAGE_KEY)).toBeNull();

    safeSessionStorage.setItem(
      DEMO_WHATSAPP_PROFILE_STORAGE_KEY,
      JSON.stringify({ key: 'bodega', saved_at: Date.now() - 31 * 60 * 1000 }),
    );
    expect(readDemoWhatsappProfileSelection()).toBeNull();
    expect(safeSessionStorage.getItem(DEMO_WHATSAPP_PROFILE_STORAGE_KEY)).toBeNull();
  });

  it('notifies every mounted consumer after persistence and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDemoWhatsappProfileSelection(listener);

    persistDemoWhatsappProfileSelection({ key: 'bodega', sector: 'empresas' });
    expect(listener).toHaveBeenCalledTimes(1);

    clearDemoWhatsappProfileSelection();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    persistDemoWhatsappProfileSelection({ key: 'comercio', sector: 'empresas' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
