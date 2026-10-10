import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OwnerRealtimeVoicePanel from './OwnerRealtimeVoicePanel';

const { apiFetch, start, close, mute } = vi.hoisted(() => ({ apiFetch: vi.fn(), start: vi.fn(), close: vi.fn().mockResolvedValue(true), mute: vi.fn() }));
vi.mock('@/utils/api', () => ({ apiFetch }));
vi.mock('@/utils/ownerRealtimeVoice', () => ({ createOwnerVoiceTransport: vi.fn(() => ({ start, close, mute })) }));
const ui = { title: 'Voz de prueba', description: 'Conversación accesible', disabled: 'No habilitada', consent: 'Activar mi micrófono',
  start: 'Iniciar voz', stop: 'Terminar voz', mute: 'Silenciar micrófono', unmute: 'Activar micrófono', text: 'Volver al texto',
  idle: 'Micrófono apagado', connecting: 'Conectando', live: 'Conectado', pending: 'Cierre pendiente de confirmar', ended: 'Voz terminada',
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
  expect(screen.queryByRole('log', { name: 'Subtítulos' })).not.toBeInTheDocument();
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
  expect(screen.getByRole('button', { name: 'Probar conversación por voz' })).toHaveFocus();
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
