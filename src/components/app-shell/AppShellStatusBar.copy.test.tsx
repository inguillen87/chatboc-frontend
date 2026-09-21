import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../tests/fixtures/runtime-recovery-ui.json';
import { AppShellStatusBar } from './AppShellStatusBar';
const api = vi.hoisted(() => ({ get: vi.fn(), load: vi.fn(), probe: vi.fn() }));
vi.mock('@/services/runtimeRecoveryConfig', () => ({ getRuntimeRecoveryUI: api.get, loadRuntimeRecoveryUI: api.load }));
vi.mock('@/utils/runtimeRecoveryPolicy', () => ({ isRuntimeRecoveryEnabled: () => true }));
vi.mock('@/utils/backendBootstrapGate', async original => ({
  ...(await original<typeof import('@/utils/backendBootstrapGate')>()), ensureBackendRuntimeReady: api.probe,
}));
beforeEach(() => {
  api.get.mockReset().mockReturnValue(fixture); api.load.mockReset().mockResolvedValue(fixture);
  api.probe.mockReset().mockResolvedValue(undefined);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('render only published recovery text', () => {
  it('uses server titles, region and button labels without local replacements', () => {
    api.get.mockReturnValue({ ...fixture, region_label: 'Conexión publicada', check_label: 'Revisar API',
      states: { ...fixture.states, offline: { title: 'Estado publicado', detail: 'Descripción del servidor' } } });
    render(<AppShellStatusBar />);
    expect(screen.getByRole('region', { name: 'Conexión publicada' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Revisar API' })).toBeVisible();
    expect(screen.getByText('Estado publicado')).toBeVisible(); expect(screen.queryByText('Sin conexión')).toBeNull();
  });
  it('renders received markup as text, not executable HTML', () => {
    api.get.mockReturnValue({ ...fixture, check_label: '<img src=x onerror=alert(1)>' });
    const view = render(<AppShellStatusBar />);
    expect(screen.getByRole('button')).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(view.container.querySelector('img')).toBeNull();
  });
  it('does not fabricate a bar on a first offline visit with no configuration', () => {
    api.get.mockReturnValue(null); render(<><AppShellStatusBar /><input aria-label="Edición" defaultValue="Conservar" /></>);
    expect(screen.queryByRole('status')).toBeNull(); expect(screen.getByRole('textbox')).toHaveValue('Conservar');
    expect(api.load).not.toHaveBeenCalled(); expect(api.probe).not.toHaveBeenCalled();
  });
  it('does not use a missing contract to claim service recovery or reset the page', async () => {
    api.get.mockReturnValue(null); api.load.mockResolvedValue(null);
    render(<><AppShellStatusBar /><input aria-label="Edición" defaultValue="Conservar" /></>);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(screen.queryByRole('status')).toBeNull(); expect(api.probe).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('Conservar');
  });
  it('loads valid public copy on reconnect before showing a verified result', async () => {
    api.get.mockReturnValue(null); render(<AppShellStatusBar />);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(api.probe).toHaveBeenCalledOnce(); expect(screen.getByText(fixture.states.verified.title)).toBeVisible();
  });
  it('ignores late copy loading after the recovery component unmounts', async () => {
    let finish!: (value: typeof fixture) => void;
    api.get.mockReturnValue(null); api.load.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<AppShellStatusBar />); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online'))); view.unmount();
    await act(async () => { finish(fixture); }); expect(api.probe).not.toHaveBeenCalled();
  });
});
