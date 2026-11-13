import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MetaConnectionCheck from './MetaConnectionCheck';
import { metaCredentialApi, type MetaConnectionInspection } from '@/features/metaCredentials/metaCredentialApi';
import { installedStatusFor, tokenFor } from '@/features/metaCredentials/__tests__/fixtures';

vi.mock('@/features/metaCredentials/metaCredentialApi', async () => ({
  ...await vi.importActual('@/features/metaCredentials/metaCredentialApi'),
  metaCredentialApi: { inspectConnection: vi.fn() },
}));
const api = vi.mocked(metaCredentialApi);
const statuses = () => [installedStatusFor('junin-production'), installedStatusFor('tdf-sandbox')];
const result = (): MetaConnectionInspection => ({ checkedAt: Math.floor(Date.now() / 1000),
  validUntil: Math.floor(Date.now() / 1000) + 30, controlIdentified: true, configurationIncomplete: true });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { resolve, promise };
};
beforeEach(() => { vi.resetAllMocks(); api.inspectConnection.mockResolvedValue(result()); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('private connection verification', () => {
  it.each(['one_missing', 'old_revision', 'expired', 'still_editable'])('does not offer inspection with %s', condition => {
    const current = statuses();
    if (condition === 'one_missing') current.pop();
    if (condition === 'old_revision') current[1].currentRevision = 6;
    if (condition === 'expired') current[0].expiresAt = Math.floor(Date.now() / 1000);
    if (condition === 'still_editable') current[0].operationAvailable = true;
    render(<MetaConnectionCheck statuses={current} blocked={false} scopeKey="verified-session" />);
    expect(screen.queryByRole('button', { name: 'Verificar conexión' })).not.toBeInTheDocument();
    expect(api.inspectConnection).not.toHaveBeenCalled();
  });

  it('blocks inspection during uncertain writes or any active parent operation', () => {
    render(<MetaConnectionCheck statuses={statuses()} blocked scopeKey="verified-session" />);
    const button = screen.getByRole('button', { name: 'Verificar conexión' });
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(api.inspectConnection).not.toHaveBeenCalled();
  });

  it('is manual, ignores password fields, suppresses duplicate clicks and presents only a partial result', async () => {
    const pending = deferred<MetaConnectionInspection>();
    api.inspectConnection.mockReturnValueOnce(pending.promise);
    const current = statuses();
    const password = document.createElement('input'); password.type = 'password'; document.body.append(password);
    const readPassword = vi.fn(() => { throw new Error('Inspection must never read a secret input'); });
    Object.defineProperty(password, 'value', { get: readPassword });
    render(<MetaConnectionCheck statuses={current} blocked={false} scopeKey="verified-session" />);
    expect(api.inspectConnection).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Verificar conexión' });
    fireEvent.click(button); fireEvent.click(button);
    expect(api.inspectConnection).toHaveBeenCalledOnce();
    expect(api.inspectConnection.mock.calls[0][0]).toEqual(current);
    expect(api.inspectConnection.mock.calls[0][1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal), isCurrent: expect.any(Function) }));
    expect(screen.getByRole('button', { name: 'Verificando conexión…' })).toBeDisabled();
    await act(async () => pending.resolve(result()));
    expect(screen.getByText('Verificación parcial')).toBeInTheDocument();
    expect(screen.getByText('Meta confirmó el acceso de ambos destinos. La activación de WhatsApp sigue pendiente.')).toBeInTheDocument();
    expect(screen.getByText('Destino autorizado A: acceso confirmado.')).toBeInTheDocument();
    expect(screen.getByText('Destino autorizado B: acceso confirmado.')).toBeInTheDocument();
    expect(screen.getByText('Número de control identificado.')).toBeInTheDocument();
    expect(screen.getByText('No se pudo comprobar toda la configuración de recepción.')).toBeInTheDocument();
    expect(readPassword).not.toHaveBeenCalled(); password.remove();
    for (const value of [current[0].phoneNumberId, current[1].wabaId, 'write_ready', 'schema_verified', 'listo']) {
      expect(document.body.textContent).not.toContain(value);
    }
  });

  it('does not turn a missing control into a successful configuration claim', async () => {
    api.inspectConnection.mockResolvedValueOnce({ ...result(), controlIdentified: false });
    render(<MetaConnectionCheck statuses={statuses()} blocked={false} scopeKey="verified-session" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Verificar conexión' })));
    expect(screen.getByText('No se pudo identificar el número de control.')).toBeInTheDocument();
    expect(screen.getByText('Verificación parcial')).toBeInTheDocument();
  });

  it('shows a fixed error without confirming access or exposing the rejected response', async () => {
    api.inspectConnection.mockRejectedValueOnce(new Error('bad response ' + tokenFor('junin-production')));
    render(<MetaConnectionCheck statuses={statuses()} blocked={false} scopeKey="verified-session" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Verificar conexión' })));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo verificar la conexión.');
    expect(document.body.textContent).not.toContain(tokenFor('junin-production'));
    expect(screen.queryByText('Verificación parcial')).not.toBeInTheDocument();
    expect(api.inspectConnection).toHaveBeenCalledOnce();
  });

  it.each(['session', 'revision', 'blocked', 'unmount'])('retires the in-flight response after %s changes', async condition => {
    const pending = deferred<MetaConnectionInspection>();
    api.inspectConnection.mockReturnValueOnce(pending.promise);
    const current = statuses();
    const view = render(<MetaConnectionCheck statuses={current} blocked={false} scopeKey="session-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar conexión' }));
    const scope = api.inspectConnection.mock.calls[0][1];
    if (condition === 'unmount') view.unmount();
    else view.rerender(<MetaConnectionCheck statuses={condition === 'revision' ? current.map(status => ({ ...status, currentRevision: status.currentRevision! + 1 })) : current}
      blocked={condition === 'blocked'} scopeKey={condition === 'session' ? 'session-b' : 'session-a'} />);
    expect(scope.isCurrent()).toBe(false); expect(scope.signal?.aborted).toBe(true);
    await act(async () => pending.resolve(result()));
    expect(screen.queryByText('Verificación parcial')).not.toBeInTheDocument();
  });

  it('never renders a prior observation under a new session before passive cleanup', async () => {
    const frames: string[] = [];
    const current = statuses();
    function CommitProbe({ scopeKey }: { scopeKey: string }) {
      useLayoutEffect(() => { frames.push(document.body.textContent || ''); });
      return <MetaConnectionCheck statuses={current} blocked={false} scopeKey={scopeKey} />;
    }
    const view = render(<CommitProbe scopeKey="session-a" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Verificar conexión' })));
    expect(screen.getByText('Verificación parcial')).toBeInTheDocument();
    view.rerender(<CommitProbe scopeKey="session-b" />);
    expect(frames.at(-1)).not.toContain('Verificación parcial');
    expect(frames.at(-1)).not.toContain('acceso confirmado');
  });

  it('does not let an aborted request clear a newer request after the same scope returns', async () => {
    const first = deferred<MetaConnectionInspection>();
    const second = deferred<MetaConnectionInspection>();
    api.inspectConnection.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const current = statuses();
    const view = render(<MetaConnectionCheck statuses={current} blocked={false} scopeKey="session-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar conexión' }));
    view.rerender(<MetaConnectionCheck statuses={current} blocked scopeKey="session-a" />);
    view.rerender(<MetaConnectionCheck statuses={current} blocked={false} scopeKey="session-a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar conexión' }));
    const active = api.inspectConnection.mock.calls[1][1];
    await act(async () => first.resolve(result()));
    expect(active.isCurrent()).toBe(true);
    expect(screen.getByRole('button', { name: 'Verificando conexión…' })).toBeDisabled();
    expect(screen.queryByText('Verificación parcial')).not.toBeInTheDocument();
    expect(api.inspectConnection).toHaveBeenCalledTimes(2);
    await act(async () => second.resolve(result()));
    expect(screen.getByText('Verificación parcial')).toBeInTheDocument();
  });

  it('expires the displayed observation without polling or retrying Meta', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T00:20:00Z'));
    api.inspectConnection.mockResolvedValueOnce(result());
    render(<MetaConnectionCheck statuses={statuses()} blocked={false} scopeKey="verified-session" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Verificar conexión' })));
    expect(screen.getByText('Verificación parcial')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30_001));
    expect(screen.queryByText('Verificación parcial')).not.toBeInTheDocument();
    expect(screen.getByText('La verificación venció. Volvé a consultar para obtener un estado vigente.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verificar conexión' })).toBeEnabled();
    expect(api.inspectConnection).toHaveBeenCalledOnce();
  });

  it('removes the action when a stored credential expires', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-13T00:20:00Z'));
    const current = statuses(); current[0].expiresAt = Math.floor(Date.now() / 1000) + 2;
    render(<MetaConnectionCheck statuses={current} blocked={false} scopeKey="verified-session" />);
    expect(screen.getByRole('button', { name: 'Verificar conexión' })).toBeEnabled();
    act(() => vi.advanceTimersByTime(2001));
    expect(screen.queryByRole('button', { name: 'Verificar conexión' })).not.toBeInTheDocument();
    expect(api.inspectConnection).not.toHaveBeenCalled();
  });
});
