import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster, toast } from 'sonner';

const { registerSW, updateSW } = vi.hoisted(() => ({
  registerSW: vi.fn(),
  updateSW: vi.fn(async () => undefined),
}));
vi.mock('virtual:pwa-register', () => ({ registerSW }));

describe('authenticated PWA update notification', () => {
  let notifyUpdate: () => void;
  let originalWorker: PropertyDescriptor | undefined;
  let restoreDocumentVisibility: () => void;
  let originalStorage: Array<[Storage, string, string | null]>;
  const deleteCache = vi.fn(async () => true);
  const unregister = vi.fn(async () => true);
  const getRegistrations = vi.fn(async () => [{ unregister }]);

  const publishUpdate = async () => {
    await act(async () => {
      notifyUpdate();
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1);
    });
  };

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.stubEnv('PROD', true);
    const documentVisibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    restoreDocumentVisibility = () => documentVisibility.mockRestore();
    // The existing local lifecycle flag enables registration only for this
    // isolated fixture. The real Sonner renderer still owns toast expiry.
    window.history.replaceState({}, '', '/superadmin?pwa-lifecycle-e2e');
    originalWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn(async () => ({ active: {} })),
        getRegistrations,
      },
    });
    vi.stubGlobal('caches', {
      has: vi.fn(async () => true),
      delete: deleteCache,
    });
    registerSW.mockReturnValue(updateSW);
    const { setupPWA } = await import('./pwa');
    setupPWA();
    notifyUpdate = registerSW.mock.calls[0][0].onNeedRefresh;
    await Promise.resolve();
  });

  beforeEach(() => {
    originalStorage = [
      [localStorage, 'authProvider', localStorage.getItem('authProvider')],
      [localStorage, 'user', localStorage.getItem('user')],
      [sessionStorage, 'panel-session-marker', sessionStorage.getItem('panel-session-marker')],
    ];
    updateSW.mockClear();
    deleteCache.mockClear();
    render(<Toaster />);
  });

  afterEach(async () => {
    await act(async () => {
      toast.getToasts().forEach((entry) => toast.dismiss(entry.id));
      await vi.advanceTimersByTimeAsync(50);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    cleanup();
    originalStorage.forEach(([storage, key, value]) => {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    });
  });

  afterAll(() => {
    if (originalWorker) {
      Object.defineProperty(navigator, 'serviceWorker', originalWorker);
    } else {
      Reflect.deleteProperty(navigator, 'serviceWorker');
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    restoreDocumentVisibility();
    vi.useRealTimers();
    window.history.replaceState({}, '', '/');
  });

  it('keeps the real update action available beyond the former four-second expiry', async () => {
    localStorage.setItem('authProvider', 'clerk');
    localStorage.setItem('user', JSON.stringify({ id: 41 }));
    sessionStorage.setItem('panel-session-marker', 'preserved');
    act(() => { toast('Temporary fixture notification'); });
    await publishUpdate();

    expect(screen.getByText('Nueva version disponible')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.queryByText('Temporary fixture notification')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(updateSW).toHaveBeenCalledExactlyOnceWith(true);
    expect(localStorage.getItem('authProvider')).toBe('clerk');
    expect(localStorage.getItem('user')).toBe(JSON.stringify({ id: 41 }));
    expect(sessionStorage.getItem('panel-session-marker')).toBe('preserved');
    expect(deleteCache).not.toHaveBeenCalled();
    expect(getRegistrations).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
  });

  it('deduplicates a waiting notification and can notify a new event after dismissal', async () => {
    await publishUpdate();
    await publishUpdate();
    expect(screen.getAllByText('Nueva version disponible')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Despues' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.queryByText('Nueva version disponible')).not.toBeInTheDocument();
    expect(updateSW).not.toHaveBeenCalled();

    await publishUpdate();
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
    expect(updateSW).not.toHaveBeenCalled();
  });

  it('clears a library dismissal and ignores a delayed callback belonging to an older toast', async () => {
    await publishUpdate();
    const originalToast = toast.getToasts().find((entry) => entry.title === 'Nueva version disponible')!;
    await act(async () => {
      toast.dismiss(originalToast.id);
      await vi.advanceTimersByTimeAsync(50);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(screen.queryByText('Nueva version disponible')).not.toBeInTheDocument();
    await publishUpdate();
    const currentToast = toast.getToasts().find((entry) => entry.title === 'Nueva version disponible')!;
    expect(currentToast.id).not.toBe(originalToast.id);

    originalToast.onAutoClose?.(originalToast);
    await publishUpdate();
    expect(screen.getAllByText('Nueva version disponible')).toHaveLength(1);
    expect(toast.getToasts().filter((entry) => entry.title === 'Nueva version disponible')).toHaveLength(1);
    expect(updateSW).not.toHaveBeenCalled();
  });
});
