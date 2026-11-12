import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppAccessibility } from './AppAccessibility';
import AccessibilityToggle, { DEFAULT_ACCESSIBILITY_PREFS as defaults, persistAccessibilityPrefs, readAccessibilityPrefs, type Prefs } from '@/components/chat/AccessibilityToggle';

const mocks = vi.hoisted(() => ({ userId: null as number | null, get: vi.fn(), update: vi.fn() }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: mocks.userId === null ? null : { id: mocks.userId } }) }));
vi.mock('@/api/accessibilityPreferences', () => ({ getAccessibilityPreferences: mocks.get, updateAccessibilityPreferences: mocks.update }));
const contract = (id: number, initialized: boolean, preferences: Prefs = defaults) => ({ contract_version: 'user.accessibility_preferences.v1', user_id: id, initialized, preferences });
const page = (second = false) => <MemoryRouter><AppAccessibility />{second ? <AccessibilityToggle /> : null}</MemoryRouter>;
const open = async (index = 0) => { fireEvent.click(screen.getAllByRole('button', { name: 'Abrir ajustes de accesibilidad' })[index]); await screen.findByRole('button', { name: /^Alto contraste/ }); };
const close = () => fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); document.documentElement.className = '';
  mocks.userId = null; mocks.get.mockReset(); mocks.update.mockReset().mockImplementation((id, preferences) => Promise.resolve(contract(id, true, preferences)));
});
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); document.documentElement.className = ''; vi.restoreAllMocks(); });

describe('real AccessibilityToggle account hydration and explicit choices', () => {
  it('keeps only explicit anonymous-session changes after A logout when B has no stored preferences', async () => {
    const ownerA = { ...defaults, dyslexia: true, captions: true };
    mocks.userId = 41; mocks.get.mockResolvedValueOnce(contract(41, true, ownerA)).mockResolvedValueOnce(contract(52, false));
    const view = render(page()); await waitFor(() => expect(readAccessibilityPrefs()).toEqual(ownerA));
    mocks.userId = null; view.rerender(page()); await open();
    fireEvent.click(screen.getByRole('button', { name: /^Alto contraste/ }));
    await waitFor(() => expect(readAccessibilityPrefs().highContrast).toBe(true)); close();
    mocks.userId = 52; view.rerender(page());
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(52, { ...defaults, highContrast: true }));
    expect(readAccessibilityPrefs()).toEqual({ ...defaults, highContrast: true });
  });
  it('never seeds an uninitialized account from an owner-unknown migrated cache', async () => {
    persistAccessibilityPrefs({ ...defaults, dyslexia: true, captions: true });
    expect(localStorage.getItem('chatboc_accessibility_owner')).toBeNull();
    mocks.userId = 52; mocks.get.mockResolvedValue(contract(52, false));
    render(page());
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(52, defaults));
    expect(readAccessibilityPrefs()).toEqual(defaults);
  });
  it('hydrates a real toggle without converting its automatic effect into an extra user save', async () => {
    const remote = { ...defaults, dyslexia: true, captions: true };
    mocks.userId = 41; mocks.get.mockResolvedValue(contract(41, true, remote));
    render(page()); await waitFor(() => expect(readAccessibilityPrefs()).toEqual(remote)); await flush();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('preserves the explicitly clicked field when the pending read settles in the same React batch', async () => {
    let resolveRead!: (value: ReturnType<typeof contract>) => void;
    mocks.userId = 41; mocks.get.mockReturnValue(new Promise<ReturnType<typeof contract>>(resolve => { resolveRead = resolve; }));
    render(page()); await open();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Alto contraste/ }));
      resolveRead(contract(41, true, { ...defaults, dyslexia: true }));
      await Promise.resolve();
    });
    await waitFor(() => expect(readAccessibilityPrefs()).toEqual({ ...defaults, dyslexia: true, highContrast: true }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(41, { ...defaults, dyslexia: true, highContrast: true }));
  });
  it('preserves real local choices after authority rejection and syncs only after a normal account change', async () => {
    let rejectSave!: (error: Error) => void;
    mocks.userId = 41;
    mocks.get.mockResolvedValueOnce(contract(41, true)).mockResolvedValueOnce(contract(52, true));
    mocks.update.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectSave = reject; }));
    const view = render(page()); await waitFor(() => expect(mocks.get).toHaveBeenCalledWith(41)); await open();
    fireEvent.click(screen.getByRole('button', { name: /^Alto contraste/ }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    await act(async () => { rejectSave(Object.assign(new Error('Synthetic identity rejection'), { status: 403 })); await Promise.resolve(); await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: /^Controles grandes/ }));
    await flush();
    expect(readAccessibilityPrefs()).toEqual({ ...defaults, highContrast: true, largeControls: true });
    expect(document.documentElement.classList.contains('a11y-high-contrast')).toBe(true);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    close(); mocks.userId = 52; view.rerender(page());
    await waitFor(() => expect(readAccessibilityPrefs()).toEqual(defaults)); await open();
    fireEvent.click(screen.getByRole('button', { name: /^Alto contraste/ }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(2));
    expect(mocks.update).toHaveBeenLastCalledWith(52, { ...defaults, highContrast: true });
  });
  it('retains an explicit false choice from a second real editor while hydrating untouched fields', async () => {
    let resolveRead!: (value: ReturnType<typeof contract>) => void;
    persistAccessibilityPrefs({ ...defaults, highContrast: true });
    mocks.userId = 41; mocks.get.mockReturnValue(new Promise<ReturnType<typeof contract>>(resolve => { resolveRead = resolve; }));
    render(page(true)); await open(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Alto contraste/ }));
      resolveRead(contract(41, true, { ...defaults, highContrast: true, captions: true }));
      await Promise.resolve();
    });
    await waitFor(() => expect(readAccessibilityPrefs()).toEqual({ ...defaults, highContrast: false, captions: true }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(41, { ...defaults, highContrast: false, captions: true }));
  });
});
