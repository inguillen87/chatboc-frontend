import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatMessageBase from './ChatMessageBase';
import BrandBotAvatar, { type RenderBrandAvatar } from './BrandBotAvatar';

vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ tenant: null, currentSlug: 'qa-brand-message' }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));

const palette = ['#AA5500', '#22AA44', '#33BBEE', '#333333'];
const botMessage = { id: 'synthetic-brand-bot', text: 'Respuesta sintética', isBot: true, timestamp: new Date('2026-01-01T00:00:00Z') };
const userMessage = { id: 'synthetic-brand-user', text: 'Consulta sintética', isBot: false, timestamp: new Date('2026-01-01T00:00:00Z') };

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({ matches: false, media,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('ChatMessageBase with an organization mascot', () => {
  it('draws the mascot still beside each bot message instead of the logo', () => {
    const renderAvatar = vi.fn<RenderBrandAvatar>((state, size, still) => (
      <BrandBotAvatar palette={palette} state={state} size={size} still={still} />
    ));
    const view = render(
      <ChatMessageBase message={botMessage} isTyping onButtonClick={vi.fn()} botLogoUrl="https://example.test/logo.png" botAvatar={renderAvatar} />,
    );
    expect(renderAvatar).toHaveBeenCalledWith('idle', 30, true);
    const avatar = view.getByTestId('chat-message-brand-avatar');
    const svg = avatar.querySelector('svg.cbb')!;
    expect(svg).toHaveAttribute('data-reduced-motion', 'true');
    // A long history must not carry one stylesheet per avatar.
    expect(svg.querySelector('style')).toBeNull();
    expect(view.container.querySelector('img[alt="Bot"]')).toBeNull();
  });

  it('keeps the logo avatar without a mascot and never adds one to user messages', () => {
    const renderAvatar = vi.fn<RenderBrandAvatar>(() => null);
    const bot = render(<ChatMessageBase message={botMessage} isTyping={false} onButtonClick={vi.fn()} botLogoUrl="https://example.test/logo.png" />);
    expect(bot.container.querySelector('img[alt="Bot"]')).not.toBeNull();
    expect(bot.queryByTestId('chat-message-brand-avatar')).toBeNull();
    cleanup();
    const user = render(<ChatMessageBase message={userMessage} isTyping={false} onButtonClick={vi.fn()} botAvatar={renderAvatar} />);
    expect(renderAvatar).not.toHaveBeenCalled();
    expect(user.queryByTestId('chat-message-brand-avatar')).toBeNull();
  });
});
