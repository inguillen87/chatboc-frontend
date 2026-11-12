import React, { Suspense, startTransition, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from './ChatInput';
import { requestLocation, type PositionCoords } from '@/utils/geolocation';
import { toast } from '@/components/ui/use-toast';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

vi.mock('@/utils/geolocation', () => ({ requestLocation: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

const coords = { latitud: -54.8, longitud: -68.3 };
const field = () => screen.getByRole('textbox', { name: 'Escribir mensaje', exact: true });
const location = () => screen.getByRole('button', { name: 'Ubicacion', exact: true });
const deferred = () => {
  let resolve!: (value: PositionCoords | null) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<PositionCoords | null>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const base = { isTyping: false, tenantSlug: 'qa-location-a', demoSessionId: 'qa-demo-a', chatSessionId: 'qa-chat-a' };

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('TextEncoder', TextEncoder);
  safeLocalStorage.clear(); safeSessionStorage.clear(); advanceChatbocSessionRevision();
  vi.mocked(requestLocation).mockReset(); vi.mocked(toast).mockReset();
});
afterEach(() => { cleanup(); safeLocalStorage.clear(); safeSessionStorage.clear(); vi.unstubAllGlobals(); });

describe('ChatInput location ownership and text preservation', () => {
  it('keeps the existing successful location payload and blocks a duplicate pending click', async () => {
    const pending = deferred(); vi.mocked(requestLocation).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.click(location()); fireEvent.click(location());
    expect(requestLocation).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(coords); await pending.promise; });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ text: '', location: { lat: coords.latitud, lon: coords.longitud }, source: 'system' });
    expect(location()).toBeEnabled();
  });

  it('does not request location while the composer is unavailable', () => {
    render(<ChatInput {...base} disabled onSendMessage={vi.fn()} />);
    fireEvent.click(location());
    expect(requestLocation).not.toHaveBeenCalled();
  });

  it.each(['unavailable', 'rejected', 'success'] as const)('preserves the text draft when location is %s', async result => {
    const send = vi.fn();
    if (result === 'rejected') vi.mocked(requestLocation).mockRejectedValueOnce(new Error('GPS fixture unavailable'));
    else vi.mocked(requestLocation).mockResolvedValueOnce(result === 'success' ? coords : null);
    render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.change(field(), { target: { value: 'Mi consulta todavía está en preparación' } });
    await waitFor(() => expect(Object.values(window.localStorage)).toContain('Mi consulta todavía está en preparación'));
    await act(async () => { fireEvent.click(location()); });
    expect(field()).toHaveValue('Mi consulta todavía está en preparación');
    expect(Object.values(window.localStorage)).toContain('Mi consulta todavía está en preparación');
    expect(send).toHaveBeenCalledTimes(result === 'success' ? 1 : 0);
    if (result === 'success') expect(send).toHaveBeenCalledWith({ text: '', location: { lat: coords.latitud, lon: coords.longitud }, source: 'system' });
    expect(location()).toBeEnabled();
  });

  it.each(['tenant', 'conversation', 'capability', 'disabled', 'typing', 'ABA'] as const)(
    'retires a delayed location result after %s changes', async change => {
      const pending = deferred();
      vi.mocked(requestLocation).mockReturnValueOnce(pending.promise);
      const oldSend = vi.fn(), nextSend = vi.fn();
      const view = render(<ChatInput {...base} onSendMessage={oldSend} />);
      fireEvent.click(location());
      const next = change === 'tenant' || change === 'ABA' ? { ...base, tenantSlug: 'qa-location-b' }
        : change === 'conversation' ? { ...base, chatSessionId: 'qa-chat-b' }
        : change === 'capability' ? { ...base, channelCapabilities: { supports_location_share: false } }
        : change === 'disabled' ? { ...base, disabled: true } : { ...base, isTyping: true };
      view.rerender(<ChatInput {...next} onSendMessage={nextSend} />);
      if (change === 'ABA') view.rerender(<ChatInput {...base} onSendMessage={nextSend} />);
      fireEvent.change(field(), { target: { value: 'Borrador del contexto actual' } });
      vi.mocked(toast).mockClear();
      await act(async () => { pending.resolve(coords); await pending.promise; });
      expect(oldSend).not.toHaveBeenCalled(); expect(nextSend).not.toHaveBeenCalled();
      expect(field()).toHaveValue('Borrador del contexto actual');
      expect(toast).not.toHaveBeenCalled();
    },
  );

  it('retires a pending request on session revocation even with unchanged props', async () => {
    const pending = deferred(); vi.mocked(requestLocation).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.click(location());
    act(() => { advanceChatbocSessionRevision(); });
    vi.mocked(toast).mockClear();
    await act(async () => { pending.resolve(coords); await pending.promise; });
    expect(send).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled();
    expect(location()).toBeEnabled();
  });

  it('does not send or announce a delayed result after unmount', async () => {
    const pending = deferred(); vi.mocked(requestLocation).mockReturnValueOnce(pending.promise);
    const send = vi.fn(); const view = render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.click(location()); view.unmount(); vi.mocked(toast).mockClear();
    await act(async () => { pending.resolve(coords); await pending.promise; });
    expect(send).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled();
  });

  it('does not let an old completion unlock or settle a newer request', async () => {
    const first = deferred(), second = deferred();
    vi.mocked(requestLocation).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const oldSend = vi.fn(), nextSend = vi.fn();
    const view = render(<ChatInput {...base} onSendMessage={oldSend} />);
    fireEvent.click(location());
    view.rerender(<ChatInput {...base} tenantSlug="qa-location-b" onSendMessage={nextSend} />);
    expect(location()).toBeEnabled(); fireEvent.click(location());
    await act(async () => { first.resolve(coords); await first.promise; });
    expect(location()).toBeDisabled(); expect(oldSend).not.toHaveBeenCalled(); expect(nextSend).not.toHaveBeenCalled();
    await act(async () => { second.resolve(coords); await second.promise; });
    expect(location()).toBeEnabled(); expect(nextSend).toHaveBeenCalledTimes(1);
    expect(requestLocation).toHaveBeenCalledTimes(2);
  });

  it('does not let a retired rejection announce an error or unlock a newer request', async () => {
    const first = deferred(), second = deferred();
    vi.mocked(requestLocation).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const oldSend = vi.fn(), nextSend = vi.fn();
    const view = render(<ChatInput {...base} onSendMessage={oldSend} />);
    fireEvent.click(location());
    view.rerender(<ChatInput {...base} tenantSlug="qa-location-b" onSendMessage={nextSend} />);
    fireEvent.click(location()); vi.mocked(toast).mockClear();
    await act(async () => { first.reject(new Error('Retired GPS fixture')); await first.promise.catch(() => undefined); });
    expect(oldSend).not.toHaveBeenCalled(); expect(nextSend).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled(); expect(location()).toBeDisabled();
    await act(async () => { second.resolve(coords); await second.promise; });
    expect(nextSend).toHaveBeenCalledTimes(1); expect(location()).toBeEnabled();
  });

  it('keeps a new session request pending after the old same-props request resolves', async () => {
    const first = deferred(), second = deferred();
    vi.mocked(requestLocation).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const send = vi.fn(); render(<ChatInput {...base} onSendMessage={send} />);
    fireEvent.click(location()); act(() => { advanceChatbocSessionRevision(); }); fireEvent.click(location());
    vi.mocked(toast).mockClear();
    await act(async () => { first.resolve(coords); await first.promise; });
    expect(send).not.toHaveBeenCalled(); expect(toast).not.toHaveBeenCalled(); expect(location()).toBeDisabled();
    await act(async () => { second.resolve(coords); await second.promise; });
    expect(send).toHaveBeenCalledTimes(1); expect(location()).toBeEnabled();
  });

  it('settles the visible request when another context render suspends without committing', async () => {
    const gps = deferred(); vi.mocked(requestLocation).mockReturnValueOnce(gps.promise);
    const send = vi.fn(), visited = vi.fn(); const blocker = new Promise<never>(() => {});
    function SuspendInB({ tenant }: { tenant: string }) {
      if (tenant === 'qa-location-b') { visited(); throw blocker; }
      return null;
    }
    function Harness() {
      const [tenant, setTenant] = useState(base.tenantSlug);
      return <><button onClick={() => startTransition(() => setTenant('qa-location-b'))}>Preparar contexto B</button>
        <Suspense fallback={<span>Preparando B</span>}>
          <ChatInput {...base} tenantSlug={tenant} onSendMessage={send} /><SuspendInB tenant={tenant} />
        </Suspense></>;
    }
    render(<Harness />); fireEvent.click(location()); fireEvent.click(screen.getByRole('button', { name: 'Preparar contexto B' }));
    expect(visited).toHaveBeenCalled(); expect(screen.queryByText('Preparando B')).not.toBeInTheDocument();
    expect(location()).toBeDisabled();
    await act(async () => { gps.resolve(coords); await gps.promise; });
    expect(location()).toBeEnabled(); expect(send).toHaveBeenCalledTimes(1);
  });
});
