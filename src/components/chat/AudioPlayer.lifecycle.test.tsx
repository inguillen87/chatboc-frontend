import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AudioPlayer from './AudioPlayer';
import ChatMessageBase from './ChatMessageBase';

vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: 'synthetic-a' }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
const A = 'https://audio-fixture.invalid/a.webm';
const B = 'https://audio-fixture.invalid/b.webm';
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
let play: ReturnType<typeof vi.spyOn>, pause: ReturnType<typeof vi.spyOn>, load: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Synthetic audio tests cannot contact a provider'); }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function audioIn(container: HTMLElement) { return container.querySelector('audio')!; }
function metadata(audio: HTMLAudioElement, duration = 60) {
  Object.defineProperty(audio, 'duration', { configurable: true, value: duration });
  Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 0 });
  fireEvent.loadedMetadata(audio);
}
async function playCurrent() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' })); });
}

describe('AudioPlayer scoped synthetic media lifecycle', () => {
  it('waits for metadata and preserves normal explicit play/pause', async () => {
    const view = render(<AudioPlayer src={A} />);
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeDisabled();
    metadata(audioIn(view.container)); await playCurrent();
    fireEvent.click(screen.getByRole('button', { name: 'Pausar audio de voz' }));
    expect(play).toHaveBeenCalledOnce(); expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeEnabled();
  });
  it('reports a network error and reloads only after the visitor requests it', () => {
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container);
    fireEvent.error(audio);
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el audio');
    const retry = screen.getByRole('button', { name: 'Volver a cargar audio' });
    expect(retry).toBeEnabled(); expect(load).not.toHaveBeenCalled(); expect(play).not.toHaveBeenCalled();
    retry.focus(); fireEvent.click(retry); fireEvent.click(retry);
    expect(load).toHaveBeenCalledOnce(); expect(play).not.toHaveBeenCalled();
    expect(retry).toBeEnabled(); expect(retry).toHaveAttribute('aria-disabled', 'true'); expect(retry).toHaveFocus();
    metadata(audio); expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(play).not.toHaveBeenCalled();
  });
  it('a synchronous reload failure remains recoverable without starting playback', () => {
    load.mockImplementationOnce(() => { throw new Error('synthetic reload failure'); });
    const view = render(<AudioPlayer src={A} />); fireEvent.error(audioIn(view.container));
    fireEvent.click(screen.getByRole('button', { name: 'Volver a cargar audio' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a cargar audio' })).toBeEnabled(); expect(play).not.toHaveBeenCalled();
  });
  it('keeps Pause reachable while a playing source is waiting', async () => {
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container); metadata(audio);
    await playCurrent(); fireEvent.waiting(audio);
    expect(screen.getByRole('status')).toHaveTextContent('Podés pausarlo');
    const button = screen.getByRole('button', { name: 'Pausar audio de voz' }); expect(button).toBeEnabled();
    fireEvent.click(button); expect(pause).toHaveBeenCalledOnce(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('replaces and retires source A before source B receives metadata', () => {
    const view = render(<AudioPlayer src={A} />); const old = audioIn(view.container); metadata(old, 120);
    view.rerender(<AudioPlayer src={B} />); const current = audioIn(view.container);
    expect(current).not.toBe(old); expect(current.getAttribute('src')).toBe(B); expect(pause).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeDisabled();
    expect(screen.getByText('0:00')).toBeInTheDocument(); expect(screen.getByRole('slider')).toBeDisabled();
    fireEvent.loadedMetadata(old); expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeDisabled();
    metadata(current, 15); expect(screen.getByText('0:15')).toBeInTheDocument();
  });
  it('late play fulfillment from A cannot mark B as playing', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); metadata(audioIn(view.container));
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' }));
    view.rerender(<AudioPlayer src={B} />); metadata(audioIn(view.container), 15);
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(screen.queryByRole('button', { name: 'Pausar audio de voz' })).not.toBeInTheDocument();
    expect(screen.getByText('0:15')).toBeInTheDocument(); expect(play).toHaveBeenCalledOnce();
  });
  it('late rejection from A cannot report an error over B playback', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); metadata(audioIn(view.container));
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' }));
    view.rerender(<AudioPlayer src={B} />); metadata(audioIn(view.container)); await playCurrent();
    await act(async () => { pending.reject(new Error('retired A')); await pending.promise.catch(() => {}); });
    expect(screen.getByRole('button', { name: 'Pausar audio de voz' })).toBeEnabled(); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('A to B to A does not revive the first A play request', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); const first = audioIn(view.container); metadata(first);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' }));
    view.rerender(<AudioPlayer src={B} />); view.rerender(<AudioPlayer src={A} />);
    const last = audioIn(view.container); expect(last).not.toBe(first); metadata(last, 30);
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeEnabled(); expect(screen.getByText('0:30')).toBeInTheDocument();
  });
  it('a second activation cancels pending playback without a second play request', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); metadata(audioIn(view.container));
    const button = screen.getByRole('button', { name: 'Reproducir audio de voz' }); button.focus();
    fireEvent.click(button); fireEvent.click(button);
    expect(play).toHaveBeenCalledOnce(); expect(pause).toHaveBeenCalledOnce(); expect(button).toBeEnabled(); expect(button).toHaveAttribute('aria-disabled', 'false'); expect(button).toHaveFocus();
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toHaveFocus();
  });
  it('keeps Pause available before playing when a pending source is waiting', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container); metadata(audio);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' })); fireEvent.waiting(audio);
    const button = screen.getByRole('button', { name: 'Pausar audio de voz' }); expect(button).toBeEnabled(); expect(button).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(button); expect(pause).toHaveBeenCalledOnce();
    fireEvent.playing(audio);
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeEnabled(); expect(screen.queryByRole('status')).not.toBeInTheDocument(); expect(play).toHaveBeenCalledOnce();
  });
  it('a current rejected play exposes a retry and preserves voluntary external focus', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<><button>Control externo</button><AudioPlayer src={A} /></>); metadata(audioIn(view.container));
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' })); screen.getByRole('button', { name: 'Control externo' }).focus();
    await act(async () => { pending.reject(new Error('synthetic refusal')); await pending.promise.catch(() => {}); });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo reproducir el audio');
    expect(screen.getByRole('button', { name: 'Control externo' })).toHaveFocus(); expect(play).toHaveBeenCalledOnce();
    await playCurrent(); expect(play).toHaveBeenCalledTimes(2); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('a synchronous play failure is visible and does not wedge the next activation', async () => {
    play.mockImplementationOnce(() => { throw new Error('synthetic synchronous refusal'); });
    const view = render(<AudioPlayer src={A} />); metadata(audioIn(view.container));
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' }));
    expect(screen.getByRole('alert')).toBeInTheDocument(); await playCurrent();
    expect(screen.getByRole('button', { name: 'Pausar audio de voz' })).toBeEnabled(); expect(play).toHaveBeenCalledTimes(2);
  });
  it('unmount explicitly pauses and retires a pending play fulfillment', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); metadata(audioIn(view.container));
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' })); view.unmount();
    expect(pause).toHaveBeenCalledOnce();
    await act(async () => { pending.resolve(); await pending.promise; }); expect(play).toHaveBeenCalledOnce(); expect(view.container).toBeEmptyDOMElement();
  });
  it('a native pause invalidates the earlier pending promise', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container); metadata(audio);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' })); fireEvent.pause(audio);
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeEnabled(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('an old queued pause cannot retire a newer play when the element is no longer paused', async () => {
    const first = deferred(), second = deferred(); play.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container); metadata(audio);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pausar audio de voz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' }));
    Object.defineProperty(audio, 'paused', { configurable: true, value: false }); fireEvent.pause(audio);
    await act(async () => { first.resolve(); second.resolve(); await Promise.all([first.promise, second.promise]); });
    fireEvent.playing(audio);
    expect(screen.getByRole('button', { name: 'Pausar audio de voz' })).toBeEnabled(); expect(play).toHaveBeenCalledTimes(2); expect(pause).toHaveBeenCalledOnce();
  });
  it('a current queued pause still retires its play when the element is paused', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container); metadata(audio);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' }));
    Object.defineProperty(audio, 'paused', { configurable: true, value: true }); fireEvent.pause(audio);
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeEnabled(); expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('network error during pending playback retires late success', async () => {
    const pending = deferred(); play.mockReturnValueOnce(pending.promise);
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container); metadata(audio);
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir audio de voz' })); fireEvent.error(audio);
    await act(async () => { pending.resolve(); await pending.promise; });
    expect(screen.getByRole('button', { name: 'Volver a cargar audio' })).toBeEnabled(); expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('duration changes alone do not make an unloaded source playable', () => {
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container);
    Object.defineProperty(audio, 'duration', { configurable: true, value: 15 }); fireEvent.durationChange(audio);
    expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeDisabled(); expect(play).not.toHaveBeenCalled();
  });
  it('provides a named native range with finite seek bounds', () => {
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container); metadata(audio, 80);
    const seek = screen.getByRole('slider', { name: 'Posición del audio' }); seek.focus();
    expect(seek).toBeEnabled(); expect(seek).toHaveAttribute('min', '0'); expect(seek).toHaveAttribute('max', '80'); expect(seek).toHaveFocus();
    fireEvent.change(seek, { target: { value: '35' } }); expect(audio.currentTime).toBe(35); expect(seek).toHaveAttribute('aria-valuetext', '0:35 de 1:20');
    fireEvent.change(seek, { target: { value: '500' } }); expect(audio.currentTime).toBe(80);
  });
  it.each([Infinity, NaN, -1])('nonfinite or negative duration %s disables seeking and renders a finite duration', (duration) => {
    const view = render(<AudioPlayer src={A} />); metadata(audioIn(view.container), duration);
    expect(screen.getByRole('slider')).toBeDisabled(); expect(screen.getByRole('slider')).toHaveAttribute('max', '0'); expect(screen.getByText('0:00')).toBeInTheDocument();
  });
  it('clamps native time updates and resets presentation at the end', async () => {
    const view = render(<AudioPlayer src={A} />); const audio = audioIn(view.container); metadata(audio, 10); await playCurrent();
    audio.currentTime = 99; fireEvent.timeUpdate(audio); expect(screen.getByRole('slider')).toHaveValue('10');
    audio.currentTime = NaN; fireEvent.timeUpdate(audio); expect(screen.getByRole('slider')).toHaveValue('0');
    fireEvent.ended(audio); expect(screen.getByRole('button', { name: 'Reproducir audio de voz' })).toBeEnabled(); expect(play).toHaveBeenCalledOnce();
  });
  it('names speed and maintains the explicit preference across sources without autoplay', () => {
    const view = render(<AudioPlayer src={A} />); metadata(audioIn(view.container));
    fireEvent.click(screen.getByRole('button', { name: 'Velocidad de reproducción: 1 veces. Cambiar velocidad.' }));
    expect(audioIn(view.container).playbackRate).toBe(1.5); view.rerender(<AudioPlayer src={B} />);
    expect(screen.getByRole('button', { name: 'Velocidad de reproducción: 1.5 veces. Cambiar velocidad.' })).toBeEnabled(); expect(play).not.toHaveBeenCalled();
  });
  it('actual message audioUrl reaches the player and its error recovery', () => {
    const view = render(<ChatMessageBase message={{ id: 'synthetic', text: '', isBot: false, audioUrl: A } as any} publicVisitorName={null} isTyping={false} onButtonClick={vi.fn()} />);
    const audio = audioIn(view.container); expect(audio.getAttribute('src')).toBe(A); fireEvent.error(audio);
    expect(screen.getByRole('button', { name: 'Volver a cargar audio' })).toBeEnabled(); expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
