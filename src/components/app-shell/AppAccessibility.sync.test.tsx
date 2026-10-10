import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppAccessibility } from '@/components/app-shell/AppAccessibility';

const mocks = vi.hoisted(() => ({
  apply: vi.fn(),
  get: vi.fn(),
  persist: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  useUser: vi.fn(),
}));

const localPreferences = {
  dyslexia: false,
  simplified: true,
  highContrast: false,
  largeControls: false,
  captions: false,
  reducedMotion: false,
};

const remotePreferences = {
  ...localPreferences,
  dyslexia: true,
  captions: true,
};

vi.mock('@/api/accessibilityPreferences', () => ({
  getAccessibilityPreferences: mocks.get,
  updateAccessibilityPreferences: mocks.update,
}));

vi.mock('@/hooks/useUser', () => ({ useUser: mocks.useUser }));

vi.mock('@/components/chat/AccessibilityToggle', () => ({
  default: ({ onChange }: { onChange?: (preferences: typeof localPreferences) => void }) => (
    <button
      type="button"
      onClick={() => onChange?.({ ...localPreferences, highContrast: true })}
    >
      Accesibilidad
    </button>
  ),
  applyAccessibilityPrefs: mocks.apply,
  persistAccessibilityPrefs: mocks.persist,
  readAccessibilityPrefs: mocks.read,
}));

const contract = (
  userId: number,
  initialized: boolean,
  preferences = remotePreferences,
) => ({
  contract_version: 'user.accessibility_preferences.v1',
  user_id: userId,
  initialized,
  preferences,
});

const renderApp = () => render(
  <MemoryRouter initialEntries={['/perfil']}>
    <AppAccessibility />
  </MemoryRouter>,
);

describe('AppAccessibility account synchronization', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.read.mockReturnValue(localPreferences);
    mocks.useUser.mockReturnValue({ user: { id: 41 } });
    mocks.update.mockResolvedValue(contract(41, true, localPreferences));
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('hydrates initialized server preferences without overwriting them', async () => {
    mocks.get.mockResolvedValue(contract(41, true));

    renderApp();
    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.get).toHaveBeenCalledWith(41);
    expect(mocks.persist).toHaveBeenCalledWith(remotePreferences);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('seeds a new account from local preferences and debounces later changes', async () => {
    mocks.get.mockResolvedValue(contract(41, false, localPreferences));

    renderApp();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.update).toHaveBeenNthCalledWith(1, 41, localPreferences);

    fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });

    expect(mocks.update).toHaveBeenNthCalledWith(
      2,
      41,
      { ...localPreferences, highContrast: true },
    );
  });

  it('ignores a late response from the previous signed-in account', async () => {
    let resolveFirst!: (value: ReturnType<typeof contract>) => void;
    const firstRequest = new Promise<ReturnType<typeof contract>>((resolve) => {
      resolveFirst = resolve;
    });
    mocks.get
      .mockReturnValueOnce(firstRequest)
      .mockResolvedValueOnce(contract(52, true, localPreferences));

    const view = renderApp();
    mocks.useUser.mockReturnValue({ user: { id: 52 } });
    view.rerender(
      <MemoryRouter initialEntries={['/perfil']}>
        <AppAccessibility />
      </MemoryRouter>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    resolveFirst(contract(41, true, remotePreferences));
    await act(async () => {
      await firstRequest;
    });

    expect(mocks.persist).toHaveBeenCalledTimes(1);
    expect(mocks.persist).toHaveBeenCalledWith(localPreferences);
  });
});
