import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatMessageBase from './ChatMessageBase';

vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ tenant: null, currentSlug: 'qa-motion-message' }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
const message = { id: 'synthetic-message-motion', text: 'Mensaje sintético de prueba', isBot: true, timestamp: new Date('2026-01-01T00:00:00Z') };
const content = (reduced: boolean) => <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
  <ChatMessageBase message={message} isTyping={false} onButtonClick={vi.fn()} messageEnterAnimation={reduced ? 'none' : 'fade-up'} />
</MotionConfig>;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: false, media,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('ChatMessageBase live reduced motion with real Framer', () => {
  it('removes an in-progress message transform without remounting its content', async () => {
    const view = render(content(false));
    const bubble = view.container.firstElementChild as HTMLElement;
    await act(async () => { await vi.advanceTimersByTimeAsync(32); });
    expect(bubble.style.transform).not.toBe('none');
    view.rerender(content(true));
    await act(async () => { await vi.advanceTimersByTimeAsync(32); });
    expect(view.container.firstElementChild).toBe(bubble);
    expect(bubble.style.transform).toBe('none');
    expect(bubble).toHaveTextContent('Mensaje sintético de prueba');
  });
});
