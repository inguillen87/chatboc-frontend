import { StrictMode, useRef } from 'react';
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
  default: () => {
    const previous = useRef({ ...localPreferences });
    const choose = (preferences: typeof localPreferences) => {
      for (const key of Object.keys(localPreferences) as Array<keyof typeof localPreferences>) {
        if (previous.current[key] !== preferences[key]) window.dispatchEvent(new CustomEvent('chatboc:a11y-user-intent', { detail: { key, value: preferences[key] } }));
      }
      previous.current = preferences;
    };
    return <>
      <button type="button" onClick={() => choose({ ...previous.current, highContrast: true })}>Accesibilidad</button>
      <button type="button" onClick={() => choose(mocks.read())}>Cambiar preferencia</button>
    </>;
  },
  ACCESSIBILITY_INTENT_EVENT: 'chatboc:a11y-user-intent',
  DEFAULT_ACCESSIBILITY_PREFS: { dyslexia: false, simplified: true, highContrast: false, largeControls: false, captions: false, reducedMotion: false },
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


describe('AppAccessibility pending hydration user choices', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(mocks).forEach(mock => mock.mockReset());
    localStorage.clear();
    mocks.read.mockReturnValue(localPreferences);
    mocks.useUser.mockReturnValue({ user: { id: 41 } });
    mocks.update.mockResolvedValue(contract(41, true, localPreferences));
  });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); localStorage.clear(); });

  it.each([true, false])('preserves touched fields during a delayed initialized=%s read', async initialized => {
    let resolveRead!: (value: ReturnType<typeof contract>) => void;
    mocks.get.mockReturnValue(new Promise<ReturnType<typeof contract>>(resolve => { resolveRead = resolve; }));
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
    const expected = { ...(initialized ? remotePreferences : localPreferences), highContrast: true };
    await act(async () => { resolveRead(contract(41, initialized)); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    expect(mocks.persist).toHaveBeenLastCalledWith(expected);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(41, expected);
  });

  it('does not seed a different account from the preceding account preferences', async () => {
    mocks.get.mockResolvedValueOnce(contract(41, true)).mockResolvedValueOnce(contract(52, false));
    const view = renderApp();
    await act(async () => { await Promise.resolve(); });
    mocks.read.mockReturnValue(remotePreferences);
    mocks.useUser.mockReturnValue({ user: { id: 52 } });
    view.rerender(<MemoryRouter><AppAccessibility /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); vi.advanceTimersByTime(350); });
    expect(mocks.update).toHaveBeenCalledWith(52, localPreferences);
    expect(mocks.update).not.toHaveBeenCalledWith(52, remotePreferences);
  });


  it('serializes a slow first PUT before saving the latest changed fields', async () => {
    mocks.get.mockResolvedValue(contract(41, true, localPreferences));
    let resolveSave!: (value: ReturnType<typeof contract>) => void;
    mocks.update.mockReturnValueOnce(new Promise<ReturnType<typeof contract>>(resolve => { resolveSave = resolve; }));
    renderApp(); await act(async () => { await Promise.resolve(); });
    const first = { ...localPreferences, highContrast: true };
    mocks.read.mockReturnValue(first);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar preferencia' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    const latest = { ...localPreferences, largeControls: true };
    mocks.read.mockReturnValue(latest);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar preferencia' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const localWrites = mocks.persist.mock.calls.length;
    await act(async () => { resolveSave(contract(41, true, first)); await Promise.resolve(); await Promise.resolve(); });
    expect(mocks.update.mock.calls).toEqual([[41, first], [41, latest]]);
    expect(mocks.persist).toHaveBeenCalledTimes(localWrites);
    expect(mocks.persist).toHaveBeenLastCalledWith(latest);
  });

  it('retires the first A read across an A to B to A account round trip', async () => {
    let resolveFirst!: (value: ReturnType<typeof contract>) => void;
    mocks.get.mockReturnValueOnce(new Promise<ReturnType<typeof contract>>(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(contract(52, true, localPreferences))
      .mockResolvedValueOnce(contract(41, true, remotePreferences));
    const view = renderApp();
    for (const id of [52, 41]) {
      mocks.useUser.mockReturnValue({ user: { id } });
      view.rerender(<MemoryRouter><AppAccessibility /></MemoryRouter>);
      await act(async () => { await Promise.resolve(); });
    }
    await act(async () => { resolveFirst(contract(41, true, localPreferences)); await Promise.resolve(); });
    expect(mocks.persist.mock.calls).toEqual([[localPreferences], [remotePreferences]]);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does not apply or continue queued A saves after switching to B', async () => {
    mocks.get.mockResolvedValueOnce(contract(41, true, localPreferences)).mockResolvedValueOnce(contract(52, true, remotePreferences));
    let resolveSave!: (value: ReturnType<typeof contract>) => void;
    mocks.update.mockReturnValueOnce(new Promise<ReturnType<typeof contract>>(resolve => { resolveSave = resolve; }));
    const view = renderApp(); await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    mocks.read.mockReturnValue({ ...localPreferences, largeControls: true });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar preferencia' }));
    await act(async () => { vi.advanceTimersByTime(350); });
    mocks.useUser.mockReturnValue({ user: { id: 52 } });
    view.rerender(<MemoryRouter><AppAccessibility /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); resolveSave(contract(41, true)); await Promise.resolve(); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.persist).toHaveBeenLastCalledWith(remotePreferences);
  });

  it('retires the first StrictMode hydration without a duplicate seed or rollback', async () => {
    let resolveFirst!: (value: ReturnType<typeof contract>) => void;
    mocks.get.mockReturnValueOnce(new Promise<ReturnType<typeof contract>>(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(contract(41, true, remotePreferences));
    render(<StrictMode><MemoryRouter><AppAccessibility /></MemoryRouter></StrictMode>);
    await act(async () => { await Promise.resolve(); resolveFirst(contract(41, false)); await Promise.resolve(); });
    expect(mocks.persist).toHaveBeenCalledTimes(1);
    expect(mocks.persist).toHaveBeenCalledWith(remotePreferences);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('keeps local choices on an aborted save and does not automatically retry it', async () => {
    mocks.get.mockResolvedValue(contract(41, true, localPreferences));
    mocks.update.mockRejectedValueOnce(new DOMException('Synthetic canceled save', 'AbortError'));
    renderApp(); await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.persist.mock.calls).toEqual([[localPreferences], [{ ...localPreferences, highContrast: true }]]);
  });

  // Synthetic API rejections exercise client coordination, not deployed HTTP.
  const authorityErrors = [
    ['401', () => Object.assign(new Error('Synthetic unauthenticated request'), { status: 401 })],
    ['403', () => Object.assign(new Error('Synthetic forbidden request'), { status: 403 })],
    ['DTO mismatch', () => new Error('accessibility_preferences_identity_mismatch')],
  ] as const;

  describe.each(authorityErrors)('retired synchronization after %s', (_label, makeError) => {
    it.each(['queued snapshot', 'pending debounce'])('does not send a second PUT from a %s', async pendingKind => {
      mocks.get.mockResolvedValue(contract(41, true, localPreferences));
      let rejectSave!: (error: Error) => void;
      mocks.update.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectSave = reject; }));
      renderApp(); await act(async () => { await Promise.resolve(); });
      fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
      await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
      mocks.read.mockReturnValue({ ...localPreferences, highContrast: true, largeControls: true });
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar preferencia' }));
      if (pendingKind === 'queued snapshot') await act(async () => { vi.advanceTimersByTime(350); });
      expect(mocks.update).toHaveBeenCalledTimes(1);
      await act(async () => { rejectSave(makeError()); await Promise.resolve(); await Promise.resolve(); });
      await act(async () => { vi.advanceTimersByTime(5000); await Promise.resolve(); });
      expect(mocks.update).toHaveBeenCalledTimes(1);
      // A further edit cannot silently resume the retired account queue.
      mocks.read.mockReturnValue({ ...localPreferences, highContrast: true, largeControls: true, captions: true });
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar preferencia' }));
      await act(async () => { vi.advanceTimersByTime(5000); await Promise.resolve(); });
      expect(mocks.update).toHaveBeenCalledTimes(1);
    });

    it('keeps a rejected GET local and allows a new normal account hydration', async () => {
      mocks.get.mockRejectedValueOnce(makeError()).mockResolvedValueOnce(contract(52, true, remotePreferences));
      const view = renderApp(); await act(async () => { await Promise.resolve(); await Promise.resolve(); });
      fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
      await act(async () => { vi.advanceTimersByTime(5000); await Promise.resolve(); });
      expect(mocks.update).not.toHaveBeenCalled();
      mocks.useUser.mockReturnValue({ user: { id: 52 } });
      view.rerender(<MemoryRouter><AppAccessibility /></MemoryRouter>);
      await act(async () => { await Promise.resolve(); });
      expect(mocks.persist).toHaveBeenLastCalledWith(remotePreferences);
      expect(mocks.update).not.toHaveBeenCalled();
    });
  });

  it('does not let a retired A error cancel the current B debounce', async () => {
    mocks.get.mockResolvedValueOnce(contract(41, true, localPreferences)).mockResolvedValueOnce(contract(52, true, localPreferences));
    let rejectA!: (error: Error) => void;
    mocks.update.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectA = reject; }));
    const view = renderApp(); await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    mocks.useUser.mockReturnValue({ user: { id: 52 } });
    view.rerender(<MemoryRouter><AppAccessibility /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    mocks.read.mockReturnValue({ ...localPreferences, highContrast: true, largeControls: true });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar preferencia' }));
    await act(async () => { rejectA(Object.assign(new Error('Synthetic old A rejection'), { status: 403 })); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenLastCalledWith(52, { ...localPreferences, largeControls: true });
  });

  it('allows an explicit new edit to save after a recoverable 503', async () => {
    mocks.get.mockResolvedValue(contract(41, true, localPreferences));
    mocks.update.mockRejectedValueOnce(Object.assign(new Error('Synthetic unavailable request'), { status: 503 }));
    renderApp(); await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    mocks.read.mockReturnValue({ ...localPreferences, highContrast: true, captions: true });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar preferencia' }));
    await act(async () => { vi.advanceTimersByTime(350); await Promise.resolve(); });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenLastCalledWith(41, { ...localPreferences, highContrast: true, captions: true });
  });

  it('retires a pending account update timer after the account changes', async () => {
    mocks.get.mockResolvedValueOnce(contract(41, true)).mockResolvedValueOnce(contract(52, true, localPreferences));
    const view = renderApp(); await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Accesibilidad' }));
    mocks.useUser.mockReturnValue({ user: { id: 52 } });
    view.rerender(<MemoryRouter><AppAccessibility /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); vi.advanceTimersByTime(350); });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
