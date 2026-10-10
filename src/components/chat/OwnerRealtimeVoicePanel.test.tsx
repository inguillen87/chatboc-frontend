import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OwnerRealtimeVoicePanel from './OwnerRealtimeVoicePanel';
import { createOwnerVoiceTransport } from '@/utils/ownerRealtimeVoice';

const { apiFetch, start, close, mute } = vi.hoisted(() => ({ apiFetch: vi.fn(), start: vi.fn(), close: vi.fn().mockResolvedValue(true), mute: vi.fn() }));
vi.mock('@/utils/api', () => ({ apiFetch }));
vi.mock('@/utils/ownerRealtimeVoice', () => ({ createOwnerVoiceTransport: vi.fn(() => ({ start, close, mute })) }));
const ui = { title: 'Voz de prueba', description: 'Conversación accesible', disabled: 'No habilitada', consent: 'Activar mi micrófono',
  start: 'Iniciar voz', stop: 'Terminar voz', mute: 'Silenciar micrófono', unmute: 'Activar micrófono', text: 'Volver al texto',
  idle: 'Micrófono apagado', connecting: 'Conectando', live: 'Conectado', pending: 'Cierre pendiente de confirmar', ended: 'Voz terminada', error: 'No se pudo conectar la voz',
  you: 'Vos', assistant: 'Asistente', captions: 'Subtítulos', avatar_notice: 'Robot ilustrativo',
  limit_notice: 'Temporizador de UX, sin garantía de facturación' };
const capability = { enabled: true, revision: 'r', ui, tenant: { slug: 'a' }, owner_trial: true, contract_version: 'browser.realtime.owner_trial.v1' };
beforeEach(() => { vi.clearAllMocks(); apiFetch.mockResolvedValue(capability); });
afterEach(() => { vi.clearAllMocks(); });

const openDetails = async () => {
  const button = await screen.findByRole('button', { name: 'Probar conversación por voz' });
  fireEvent.click(button);
  return button;
};

it('keeps the feature disabled and never acquires mic on mount', async () => {
  apiFetch.mockResolvedValue({ ...capability, enabled: false });
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const disclosure = await screen.findByRole('button', { name: 'Probar conversación por voz' });
  expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('No habilitada')).not.toBeVisible();
  fireEvent.click(disclosure);
  expect(screen.getByText('No habilitada')).toBeVisible();
  expect(start).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Iniciar voz' })).not.toBeInTheDocument();
});
it('requires explicit consent and keeps authentication on the private endpoint', async () => {
  const rendered = render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  await openDetails();
  const button = screen.getByRole('button', { name: 'Iniciar voz' }); expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Activar mi micrófono' })); fireEvent.click(button); fireEvent.click(button);
  expect(start).toHaveBeenCalledOnce();
  expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/a/realtime/browser/capabilities', expect.objectContaining({
    omitEntityToken: true, omitChatSessionId: true, allowSafeBaseFallback: false,
    singleAttempt: true, isWidgetRequest: false, persistTenantSlug: false }));
  expect(apiFetch.mock.calls[0][1].skipAuth).toBeUndefined();
  rendered.unmount(); expect(close).toHaveBeenCalledOnce();
});

it('uses a single owner-authenticated attempt for creation and server hangup too', async () => {
  const { createOwnerVoiceTransport } = await import('@/utils/ownerRealtimeVoice');
  const rendered=render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  await openDetails();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar voz' }));
  const options=vi.mocked(createOwnerVoiceTransport).mock.calls.at(-1)![0];
  await options.exchange('synthetic-sdp');
  await options.stop('a'.repeat(32));
  for (const [path, options] of apiFetch.mock.calls.filter(([, options]) => options.method === 'POST')) {
    expect(path).toContain('/api/admin/tenants/a/realtime/browser/sessions');
    expect(options).toEqual(expect.objectContaining({ singleAttempt:true,isWidgetRequest:false,
      persistTenantSlug:false,omitEntityToken:true,omitChatSessionId:true,allowSafeBaseFallback:false }));
    expect(options.skipAuth).toBeUndefined();
  }
  expect(apiFetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(2);
  rendered.unmount();
});
it('rejects a stale or foreign tenant capability and ignores it after a tenant change', async () => {
  apiFetch.mockResolvedValue({ ...capability, tenant: { slug: 'other' } });
  const rendered = render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  apiFetch.mockResolvedValue({ ...capability, tenant: { slug: 'b' } });
  rendered.rerender(<OwnerRealtimeVoicePanel tenantSlug="b" />);
  const disclosure = await openDetails();
  expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('checkbox')).toBeInTheDocument();
});

it('uses a static robot when reduced motion is explicitly selected', async () => {
  const rendered=render(<OwnerRealtimeVoicePanel tenantSlug="a" reducedMotion />);
  await openDetails();
  expect(rendered.container.querySelector('img')?.getAttribute('src')).toContain('chatboc-agent-mark.svg');
  expect(rendered.container.querySelector('img')?.className).not.toContain('animate-pulse');
});

it('starts collapsed and expands locally without a second capability read or voice request', async () => {
  const { createOwnerVoiceTransport } = await import('@/utils/ownerRealtimeVoice');
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const disclosure = await screen.findByRole('button', { name: 'Probar conversación por voz' });
  const details = document.getElementById(disclosure.getAttribute('aria-controls')!);
  expect(details).toHaveAttribute('hidden');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Iniciar voz' })).not.toBeInTheDocument();
  expect(disclosure.className).toContain('min-h-11');
  fireEvent.click(disclosure);
  expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  expect(details).not.toHaveAttribute('hidden');
  expect(screen.getByRole('button', { name: 'Iniciar voz' })).toBeDisabled();
  fireEvent.click(disclosure);
  expect(details).toHaveAttribute('hidden');
  expect(apiFetch).toHaveBeenCalledOnce();
  expect(createOwnerVoiceTransport).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});

it('keeps a visible stop control and preserves subtitles when an active trial is collapsed', async () => {
  const { createOwnerVoiceTransport } = await import('@/utils/ownerRealtimeVoice');
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const disclosure = await openDetails();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar voz' }));
  const options = vi.mocked(createOwnerVoiceTransport).mock.calls.at(-1)![0];
  act(() => {
    options.state('live');
    options.captions([{ id: 'assistant:synthetic', speaker: 'assistant', text: 'Orientación publicada' }]);
  });
  expect(screen.getByRole('log', { name: 'Subtítulos' })).toHaveTextContent('Orientación publicada');
  fireEvent.click(disclosure);
  expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('status')).toHaveTextContent('Conectado');
  expect(screen.getByRole('log', { name: 'Subtítulos' })).toBeVisible();
  expect(screen.getByRole('log', { name: 'Subtítulos' })).toHaveTextContent('Orientación publicada');
  const compactStop = screen.getByRole('button', { name: 'Terminar voz' });
  expect(compactStop).toBeVisible();
  close.mockImplementationOnce(async () => { options.state('ended'); return true; });
  await act(async () => { fireEvent.click(compactStop); });
  expect(close).toHaveBeenCalledOnce();
  expect(disclosure).toHaveFocus();
  fireEvent.click(disclosure);
  expect(screen.getByRole('log', { name: 'Subtítulos' })).toHaveTextContent('Orientación publicada');
  expect(start).toHaveBeenCalledOnce();
  expect(apiFetch).toHaveBeenCalledOnce();
});

it('keeps mute and return-to-text controls functional in the expanded trial', async () => {
  const { createOwnerVoiceTransport } = await import('@/utils/ownerRealtimeVoice');
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  await openDetails();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar voz' }));
  const options = vi.mocked(createOwnerVoiceTransport).mock.calls.at(-1)![0];
  act(() => options.state('live'));
  fireEvent.click(screen.getByRole('button', { name: 'Silenciar micrófono' }));
  expect(mute).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole('button', { name: 'Activar micrófono' })).toHaveAttribute('aria-pressed', 'true');
  close.mockImplementationOnce(async () => { options.state('ended'); return true; });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Volver al texto' })); });
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Iniciar voz' })).toHaveFocus();
});

it('resets the disclosure and retires an in-flight capability when the tenant changes', async () => {
  const rendered = render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  await openDetails();
  let resolve!: (value: typeof capability) => void;
  apiFetch.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
  rendered.rerender(<OwnerRealtimeVoicePanel tenantSlug="b" />);
  expect(screen.queryByRole('button', { name: 'Probar conversación por voz' })).not.toBeInTheDocument();
  rendered.rerender(<OwnerRealtimeVoicePanel tenantSlug="c" />);
  await act(async () => resolve({ ...capability, tenant: { slug: 'b' } }));
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  // The still-foreign default mock cannot restore the previous tenant's UI.
  expect(screen.queryByRole('button', { name: 'Probar conversación por voz' })).not.toBeInTheDocument();
});

it.each(['not_owner', 'denied'])('does not expose an owner trial when the server reports %s', async result => {
  if (result === 'not_owner') apiFetch.mockResolvedValue({ ...capability, owner_trial: false });
  else apiFetch.mockRejectedValue(new Error('synthetic-owner-denial'));
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
  expect(screen.queryByRole('button', { name: 'Probar conversación por voz' })).not.toBeInTheDocument();
  expect(start).not.toHaveBeenCalled();
});

it('does not move focus to a new tenant after an old server close resolves', async () => {
  const { createOwnerVoiceTransport } = await import('@/utils/ownerRealtimeVoice');
  const rendered = render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const disclosure = await openDetails();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar voz' }));
  const options = vi.mocked(createOwnerVoiceTransport).mock.calls.at(-1)![0];
  act(() => options.state('live'));
  fireEvent.click(disclosure);
  let finishClose!: (value: boolean) => void;
  close.mockImplementationOnce(() => new Promise(resolve => { finishClose = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Terminar voz' }));
  apiFetch.mockResolvedValue({ ...capability, tenant: { slug: 'b' } });
  rendered.rerender(<OwnerRealtimeVoicePanel tenantSlug="b" />);
  const newDisclosure = await screen.findByRole('button', { name: 'Probar conversación por voz' });
  expect(newDisclosure).toHaveAttribute('aria-expanded', 'false');
  const sentinel = document.createElement('button');
  document.body.append(sentinel);
  sentinel.focus();
  await act(async () => finishClose(true));
  expect(sentinel).toHaveFocus();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  sentinel.remove();
});

const startUsingKeyboard = async () => {
  const nativeUser = userEvent.setup();
  // Native default keyboard actions (checkbox/change, button/click) and their
  // synthetic transport callbacks must settle in the same React act boundary.
  const user = {
    tab: async (...args: Parameters<typeof nativeUser.tab>) => { await act(async () => { await nativeUser.tab(...args); }); },
    keyboard: async (...args: Parameters<typeof nativeUser.keyboard>) => { await act(async () => { await nativeUser.keyboard(...args); }); },
    click: async (...args: Parameters<typeof nativeUser.click>) => { await act(async () => { await nativeUser.click(...args); }); },
  };
  start.mockImplementationOnce(() => {
    vi.mocked(createOwnerVoiceTransport).mock.calls.at(-1)![0].state('connecting');
  });
  const disclosure = await screen.findByRole('button', { name: 'Probar conversación por voz' });
  await user.tab();
  expect(disclosure).toHaveFocus();
  await user.keyboard('[Space]');
  await user.tab();
  expect(screen.getByRole('checkbox', { name: 'Activar mi micrófono' })).toHaveFocus();
  await user.keyboard('[Space]');
  await user.tab();
  expect(screen.getByRole('button', { name: 'Iniciar voz' })).toHaveFocus();
  await user.keyboard('[Enter]');
  const options = vi.mocked(createOwnerVoiceTransport).mock.calls.at(-1)![0];
  return { user, disclosure, options };
};

it('moves keyboard focus to the stable stop control while connecting and preserves it on collapse', async () => {
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const { user, disclosure, options } = await startUsingKeyboard();
  const stopButton = screen.getByRole('button', { name: 'Terminar voz' });
  expect(stopButton).toHaveFocus();
  expect(screen.queryByRole('button', { name: 'Iniciar voz' })).not.toBeInTheDocument();
  expect(start).toHaveBeenCalledOnce();
  await user.tab({ shift: true });
  expect(disclosure).toHaveFocus();
  await user.keyboard('[Enter]');
  expect(screen.getByRole('button', { name: 'Terminar voz' })).toBe(stopButton);
  expect(disclosure).toHaveFocus();
  await user.tab();
  expect(stopButton).toHaveFocus();
  act(() => options.state('live'));
  expect(stopButton).toHaveFocus();
});

it.each(['ended', 'error'] as const)('restores start focus after %s removes the focused voice action', async state => {
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const { user, options } = await startUsingKeyboard();
  act(() => options.state('live'));
  await user.tab();
  expect(screen.getByRole('button', { name: 'Silenciar micrófono' })).toHaveFocus();
  act(() => options.state(state));
  expect(screen.getByRole('button', { name: 'Iniciar voz' })).toHaveFocus();
  expect(screen.getByRole('status')).toHaveTextContent(ui[state]);
  expect(start).toHaveBeenCalledOnce();
});

it('returns focus to the compact disclosure when a close remains unconfirmed', async () => {
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const { user, disclosure, options } = await startUsingKeyboard();
  close.mockImplementationOnce(async () => { options.state('pending'); return false; });
  await user.keyboard('[Space]');
  expect(close).toHaveBeenCalledOnce();
  expect(disclosure).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Iniciar voz' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(ui.pending);
  expect(start).toHaveBeenCalledOnce();
});

it('does not steal focus from outside the voice controls during a connection or delayed close', async () => {
  render(<><OwnerRealtimeVoicePanel tenantSlug="a" /><button>Continuar por texto</button></>);
  const { user, options } = await startUsingKeyboard();
  await user.click(screen.getByRole('button', { name: 'Continuar por texto' }));
  act(() => {
    options.state('live');
    options.captions([{ id: 'assistant:1', speaker: 'assistant', text: 'Subtítulo completo' }]);
  });
  expect(screen.getByRole('button', { name: 'Continuar por texto' })).toHaveFocus();
  let finishClose!: () => void;
  close.mockImplementationOnce(() => new Promise(resolve => {
    finishClose = () => { options.state('ended'); resolve(true); };
  }));
  await user.click(screen.getByRole('button', { name: 'Terminar voz' }));
  await user.click(screen.getByRole('button', { name: 'Continuar por texto' }));
  await act(async () => finishClose());
  expect(screen.getByRole('button', { name: 'Continuar por texto' })).toHaveFocus();
  expect(close).toHaveBeenCalledOnce();
  expect(start).toHaveBeenCalledOnce();
});

it('keeps the latest caption readable and keyboard-scrollable in compact mode without discarding history', async () => {
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const { user, disclosure, options } = await startUsingKeyboard();
  act(() => {
    options.state('live');
    options.captions([
      { id: 'you:1', speaker: 'you', text: 'Pregunta anterior' },
      { id: 'assistant:1', speaker: 'assistant', text: 'Respuesta más reciente' },
    ]);
  });
  await user.tab({ shift: true });
  await user.keyboard('[Enter]');
  const compactLog = screen.getByRole('log', { name: 'Subtítulos' });
  expect(compactLog).toBeVisible();
  expect(compactLog).toHaveTextContent('Asistente: Respuesta más reciente');
  expect(compactLog).not.toHaveTextContent('Pregunta anterior');
  await user.tab();
  expect(screen.getByRole('button', { name: 'Terminar voz' })).toHaveFocus();
  await user.tab();
  expect(compactLog).toHaveFocus();
  act(() => options.captions([
    { id: 'you:1', speaker: 'you', text: 'Pregunta anterior' },
    { id: 'assistant:1', speaker: 'assistant', text: 'Respuesta más reciente completa' },
  ]));
  expect(compactLog).toHaveFocus();
  expect(compactLog).toHaveTextContent('Respuesta más reciente completa');
  act(() => options.state('ended'));
  expect(compactLog).toBeVisible();
  expect(compactLog).toHaveFocus();
  await user.click(disclosure);
  const expandedLog = screen.getByRole('log', { name: 'Subtítulos' });
  expect(expandedLog).toHaveTextContent('Pregunta anterior');
  expect(expandedLog).toHaveTextContent('Respuesta más reciente completa');
  expect(start).toHaveBeenCalledOnce();
});

it('keeps reduced-motion rendering static when synthetic speaking and captions arrive', async () => {
  const rendered = render(<OwnerRealtimeVoicePanel tenantSlug="a" reducedMotion />);
  const { options } = await startUsingKeyboard();
  act(() => {
    options.state('live'); options.speaking(true);
    options.captions([{ id: 'assistant:1', speaker: 'assistant', text: 'Texto accesible' }]);
  });
  expect(rendered.container.querySelector('img')?.getAttribute('src')).toContain('chatboc-agent-mark.svg');
  expect(rendered.container.querySelector('img')?.className).not.toContain('animate-pulse');
  expect(screen.getByRole('log', { name: 'Subtítulos' })).toHaveTextContent('Texto accesible');
});
