import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPanel from './ChatPanel';

const logic = vi.hoisted(() => ({ messages: [], visitorName: null, isTyping: true,
  institutionalBootstrapPending: false, suppressLegacyInitialMenu: true, handleSend: vi.fn(),
  activeTicketId: null, liveChatTicketId: null, liveChatSocketRoom: null, liveChatAccessToken: null,
  isLiveChatActive: false, setMessages: vi.fn(), setContexto: vi.fn(), setActiveTicketId: vi.fn(),
  contexto: {}, uxContext: {}, addSystemMessage: vi.fn(), initializeConversation: vi.fn() }));
vi.mock('@/hooks/useChatLogic', async original => ({ ...await original<typeof import('@/hooks/useChatLogic')>(), useChatLogic: () => logic }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useBusinessHours', () => ({ useBusinessHours: () => ({ isLiveChatEnabled: false, horariosAtencion: '', availabilityLabel: '', timezone: '' }) }));
vi.mock('./ChatInput', () => ({ default: () => <input aria-label="Borrador sintético" /> }));
vi.mock('./RealtimeAvatarStage', () => ({ default: () => null }));
vi.mock('@/components/ui/ScrollToBottomButton', () => ({ default: () => null }));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: vi.fn() }));
vi.mock('@/utils/widgetTelemetry', () => ({ trackWidgetEvent: vi.fn() }));

// Original MotionConfig and useReducedMotionConfig are intentionally retained.
// The fixture observes animation instructions; it does not certify browser rendering.
vi.mock('framer-motion', async original => {
  const actual = await original<typeof import('framer-motion')>();
  const React = await import('react');
  const wrappers = new Map<string, React.ComponentType<any>>();
  return { ...actual, motion: new Proxy(actual.motion, { get: (_target, tag: string) => {
    if (!wrappers.has(tag)) wrappers.set(tag, React.forwardRef<HTMLElement, any>(function MotionFixture(props, ref) {
      const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
      return React.createElement(tag, { ...rest, ref, 'data-motion-initial': JSON.stringify(initial),
        'data-motion-exit': JSON.stringify(exit), 'data-motion-duration': transition?.duration,
        'data-motion-repeat': transition?.repeat === Infinity ? 'infinite' : undefined });
    }));
    return wrappers.get(tag);
  } }) };
});

const listeners = new Set<() => void>();
const media = { matches: false, media: '(prefers-reduced-motion: reduce)', onchange: null,
  addEventListener: (_name: string, listener: () => void) => listeners.add(listener),
  removeEventListener: (_name: string, listener: () => void) => listeners.delete(listener),
  addListener: (listener: () => void) => listeners.add(listener),
  removeListener: (listener: () => void) => listeners.delete(listener), dispatchEvent: () => true };
const setSystem = (matches: boolean) => act(() => { media.matches = matches; for (const listener of listeners) listener(); });
const base = { dyslexia: false, simplified: true, highContrast: false, largeControls: false, captions: false, reducedMotion: false };
const panel = (local = false) => <ChatPanel tipoChat="municipio" mode="script" tenantSlug="qa-motion-system"
  a11yPrefs={{ ...base, reducedMotion: local }} logoAnimation="bounce"
  conversionCtas={{ actions: [{ id: 'qa-action', label: 'Acción sintética', intent: 'qa-action' }] }} />;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); media.matches = false;
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No network permitted in synthetic motion fixture'); }));
  for (const listener of listeners) listener();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('direct ChatPanel reactive system motion preference', () => {
  it('stops and resumes mounted manual loops on OS change without a manual rerender or focus move', async () => {
    const view = render(<><button>Control externo</button>{panel()}</>);
    const external = screen.getByRole('button', { name: 'Control externo' }); external.focus();
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).toBeInTheDocument();
    setSystem(true);
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
    expect(external).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Ver acciones' }));
    const tray = view.container.querySelector<HTMLElement>('.chatboc-chat-footer [data-motion-duration]')!;
    expect(tray.dataset.motionDuration).toBe('0');
    expect(tray.dataset.motionExit).not.toMatch(/"height"/);
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar acciones' }));
    await waitFor(() => expect(tray).not.toBeInTheDocument());
    setSystem(false);
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).toBeInTheDocument();
  });
  it('keeps local reduction across OS changes and cannot override an active OS reduction with local false', () => {
    const view = render(panel(true));
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
    setSystem(true); view.rerender(panel(false));
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).not.toBeInTheDocument();
    setSystem(false);
    expect(view.container.querySelector('[data-motion-repeat="infinite"]')).toBeInTheDocument();
  });
});
