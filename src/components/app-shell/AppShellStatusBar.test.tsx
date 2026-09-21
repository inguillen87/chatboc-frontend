import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellStatusBar } from './AppShellStatusBar';
import { BackendBootstrapError } from '@/utils/backendBootstrapGate';
const probe = vi.hoisted(() => ({ enabled: true, run: vi.fn() }));
vi.mock('@/utils/backendBootstrapGate', async importOriginal => ({
  ...(await importOriginal<typeof import('@/utils/backendBootstrapGate')>()), ensureBackendRuntimeReady: probe.run,
}));
vi.mock('@/utils/runtimeRecoveryPolicy', () => ({ isRuntimeRecoveryEnabled: () => probe.enabled }));
const net = (isOnline: boolean) => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: isOnline });
  act(() => window.dispatchEvent(new Event(isOnline ? 'online' : 'offline')));
};
const visible = (value: string) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
};
const flush = () => act(async () => { await Promise.resolve(); });
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-19T12:00:00Z'));
  probe.enabled = true; probe.run.mockReset().mockResolvedValue(undefined); net(true); visible('visible');
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('non-blocking runtime recovery', () => {
  it('does not poll or duplicate the startup probe when a page is mounted', () => {
    render(<AppShellStatusBar />); act(() => vi.advanceTimersByTime(120000));
    expect(probe.run).not.toHaveBeenCalled(); expect(screen.queryByRole('status')).toBeNull();
  });
  it('retains a mounted draft through offline, reconnect and dismissal', async () => {
    const onMount = vi.fn();
    function Draft() { React.useEffect(onMount, []); return <input aria-label="Borrador" defaultValue="Mi edición" />; }
    render(<><AppShellStatusBar /><Draft /></>);
    const input = screen.getByRole('textbox'); fireEvent.change(input, { target: { value: 'No perder' } });
    net(false); expect(screen.getByText('Sin conexión')).toBeVisible();
    expect(screen.getByRole('button')).toBeEnabled(); net(true); await flush();
    expect(probe.run).toHaveBeenCalledWith({ enabled: true, refresh: true });
    expect(screen.getByText('El servicio volvió a responder')).toBeVisible();
    expect(screen.getByText(/Esto no confirma las acciones anteriores/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar estado del servicio' }));
    expect(screen.queryByRole('status')).toBeNull(); expect(input).toHaveValue('No perder'); expect(onMount).toHaveBeenCalledTimes(1);
  });
  it('checks once on a return after the lease but not on every focus event', async () => {
    render(<AppShellStatusBar />); act(() => window.dispatchEvent(new Event('focus')));
    expect(probe.run).not.toHaveBeenCalled(); act(() => vi.advanceTimersByTime(30000));
    act(() => window.dispatchEvent(new Event('focus'))); await flush();
    act(() => window.dispatchEvent(new Event('focus'))); await flush(); expect(probe.run).toHaveBeenCalledTimes(1);
  });
  it('does not contact the backend while hidden and resumes once visible', async () => {
    render(<AppShellStatusBar />); net(false); visible('hidden'); net(true);
    expect(probe.run).not.toHaveBeenCalled(); visible('visible'); await flush(); expect(probe.run).toHaveBeenCalledTimes(1);
  });
  it('keeps explicitly disabled surfaces free of new probes', async () => {
    probe.enabled = false; render(<AppShellStatusBar />); net(false); net(true); await flush();
    act(() => vi.advanceTimersByTime(60000)); act(() => window.dispatchEvent(new Event('focus')));
    expect(probe.run).not.toHaveBeenCalled(); expect(screen.queryByRole('status')).toBeNull();
  });
  it('starts offline without a request, then rechecks on reconnect', async () => {
    net(false); render(<AppShellStatusBar />); expect(probe.run).not.toHaveBeenCalled();
    net(true); await flush(); expect(probe.run).toHaveBeenCalledTimes(1);
  });
  it('shows long wait without enabling duplicate checks', async () => {
    let resolve!: () => void; probe.run.mockImplementation(() => new Promise<void>(r => { resolve = r; }));
    render(<AppShellStatusBar />); net(false); net(true); act(() => vi.advanceTimersByTime(1700));
    expect(screen.getByText('El servicio está tardando')).toBeVisible(); expect(screen.getByRole('button')).toBeDisabled();
    act(() => window.dispatchEvent(new Event('focus'))); expect(probe.run).toHaveBeenCalledTimes(1); await act(async () => resolve());
  });
  it('shows an explicit mismatch without exposing server payloads', async () => {
    probe.run.mockRejectedValue(new BackendBootstrapError('private diagnostic', 409, { reason_code: 'backend_revision_mismatch' }));
    render(<AppShellStatusBar />); net(false); net(true); await flush();
    expect(screen.getByText('La versión del servicio no coincide')).toBeVisible(); expect(screen.queryByText(/private diagnostic/)).toBeNull();
  });
  it('offers an explicit retry after failure without reloading the page', async () => {
    probe.run.mockRejectedValueOnce(new Error('internal details')).mockResolvedValue(undefined);
    render(<AppShellStatusBar />); net(false); net(true); await flush();
    expect(screen.getByText('No pudimos confirmar la conexión')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar servicio' })); await flush();
    expect(probe.run).toHaveBeenCalledTimes(2); expect(screen.getByText('El servicio volvió a responder')).toBeVisible();
  });
  it('ignores a late result after the network is disconnected again', async () => {
    let resolve!: () => void; probe.run.mockImplementation(() => new Promise<void>(r => { resolve = r; }));
    render(<AppShellStatusBar />); net(false); net(true); net(false); await act(async () => resolve());
    expect(screen.getByText('Sin conexión')).toBeVisible(); expect(screen.queryByText('El servicio volvió a responder')).toBeNull();
  });
  it('does not allow a superseded failure to overwrite the new result', async () => {
    let reject!: (e: Error) => void;
    probe.run.mockImplementationOnce(() => new Promise<void>((_, r) => { reject = r; })).mockResolvedValue(undefined);
    render(<AppShellStatusBar />); net(false); net(true); net(false); net(true); await flush();
    await act(async () => reject(new Error('old'))); expect(screen.getByText('El servicio volvió a responder')).toBeVisible();
  });
  it('cleans up events and delay on unmount', async () => {
    probe.run.mockImplementation(() => new Promise(() => {}));
    const view = render(<AppShellStatusBar />); net(false); net(true); view.unmount();
    act(() => vi.advanceTimersByTime(60000)); net(false); net(true);
    expect(probe.run).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('allows an explicit service check despite an offline browser hint', async () => {
    net(false); render(<AppShellStatusBar />);
    const button = screen.getByRole('button', { name: 'Comprobar servicio' });
    expect(button).toBeEnabled(); expect(probe.run).not.toHaveBeenCalled(); fireEvent.click(button); await flush();
    expect(probe.run).toHaveBeenCalledWith({ enabled: true, refresh: true });
    expect(screen.getByText('El servicio volvió a responder')).toBeVisible();
  });
  it('rechecks on reconnect after a manual offline attempt failed', async () => {
    probe.run.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(undefined);
    net(false); render(<AppShellStatusBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar servicio' })); await flush(); net(true); await flush();
    expect(probe.run).toHaveBeenCalledTimes(2); expect(screen.getByText('El servicio volvió a responder')).toBeVisible();
  });
  it('checks BFCache restoration without reloading the mounted form', async () => {
    render(<><AppShellStatusBar /><input aria-label="Draft" defaultValue="Keep this" /></>);
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await flush();
    expect(probe.run).toHaveBeenCalledWith({ enabled: true, refresh: true }); expect(screen.getByRole('textbox')).toHaveValue('Keep this');
  });
  it('does not probe ordinary pageshow or a hidden BFCache restoration', async () => {
    render(<AppShellStatusBar />);
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))); visible('hidden');
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await flush(); expect(probe.run).not.toHaveBeenCalled();
  });
  it('removes the BFCache listener on unmount', async () => {
    const view = render(<AppShellStatusBar />); view.unmount();
    act(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await flush(); expect(probe.run).not.toHaveBeenCalled();
  });
});
