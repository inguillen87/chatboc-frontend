import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import OwnerRealtimeVoicePanel from './OwnerRealtimeVoicePanel';

const { apiFetch, start, close, mute } = vi.hoisted(() => ({ apiFetch: vi.fn(), start: vi.fn(), close: vi.fn().mockResolvedValue(true), mute: vi.fn() }));
vi.mock('@/utils/api', () => ({ apiFetch }));
vi.mock('@/utils/ownerRealtimeVoice', () => ({ createOwnerVoiceTransport: vi.fn(() => ({ start, close, mute })) }));
const ui = { title: 'Voz de prueba', description: 'Conversación accesible', disabled: 'No habilitada', consent: 'Activar mi micrófono',
  start: 'Iniciar voz', stop: 'Terminar voz', mute: 'Silenciar micrófono', unmute: 'Activar micrófono', text: 'Volver al texto',
  idle: 'Micrófono apagado', connecting: 'Conectando', live: 'Conectado', captions: 'Subtítulos', avatar_notice: 'Robot ilustrativo',
  limit_notice: 'Temporizador de UX, sin garantía de facturación' };
const capability = { enabled: true, revision: 'r', ui, tenant: { slug: 'a' }, owner_trial: true, contract_version: 'browser.realtime.owner_trial.v1' };
beforeEach(() => { vi.clearAllMocks(); apiFetch.mockResolvedValue(capability); });
afterEach(() => { vi.clearAllMocks(); });

it('keeps the feature disabled and never acquires mic on mount', async () => {
  apiFetch.mockResolvedValue({ ...capability, enabled: false });
  render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  expect(await screen.findByText('No habilitada')).toBeInTheDocument();
  expect(start).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Iniciar voz' })).not.toBeInTheDocument();
});
it('requires explicit consent and keeps authentication on the private endpoint', async () => {
  const rendered = render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  const button = await screen.findByRole('button', { name: 'Iniciar voz' }); expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Activar mi micrófono' })); fireEvent.click(button); fireEvent.click(button);
  expect(start).toHaveBeenCalledOnce();
  expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/a/realtime/browser/capabilities', expect.objectContaining({ omitEntityToken: true, allowSafeBaseFallback: false }));
  expect(apiFetch.mock.calls[0][1].skipAuth).toBeUndefined();
  rendered.unmount(); expect(close).toHaveBeenCalledOnce();
});
it('rejects a stale or foreign tenant capability and ignores it after a tenant change', async () => {
  apiFetch.mockResolvedValue({ ...capability, tenant: { slug: 'other' } });
  const rendered = render(<OwnerRealtimeVoicePanel tenantSlug="a" />);
  await waitFor(() => expect(apiFetch).toHaveBeenCalledOnce());
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  apiFetch.mockResolvedValue({ ...capability, tenant: { slug: 'b' } });
  rendered.rerender(<OwnerRealtimeVoicePanel tenantSlug="b" />);
  expect(await screen.findByRole('checkbox')).toBeInTheDocument();
});

it('uses a static robot when reduced motion is explicitly selected', async () => {
  const rendered=render(<OwnerRealtimeVoicePanel tenantSlug="a" reducedMotion />);
  await screen.findByRole('checkbox');
  expect(rendered.container.querySelector('img')?.getAttribute('src')).toContain('chatboc-agent-mark.svg');
  expect(rendered.container.querySelector('img')?.className).not.toContain('animate-pulse');
});
