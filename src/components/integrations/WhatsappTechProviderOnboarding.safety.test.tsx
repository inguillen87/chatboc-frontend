import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Component from './WhatsappTechProviderOnboarding';
import { tenantService } from '@/services/tenantService';
import { getTenantOpsQaPlaybookV2 } from '@/api/v2/saas';
vi.mock('@/services/tenantService', () => ({ tenantService: {
  getWhatsappTechProvider: vi.fn(), provisionWhatsappTechProvider: vi.fn(), registerWhatsappSender: vi.fn(),
  refreshWhatsappSenderStatus: vi.fn(), provisionWhatsappVoiceApp: vi.fn(), runWhatsappTechProviderSmokeTest: vi.fn(),
} }));
vi.mock('@/api/v2/saas', () => ({ getTenantOpsQaPlaybookV2: vi.fn(), runTenantOpsQaCheckV2: vi.fn() }));
const api = vi.mocked(tenantService);
const contract = (slug = 'first', existing = true) => ({ contract_version: 'twilio.tech_provider.v1', tenant: { slug },
  automation: { env: { ready: true } },
  state: { sender_sid: existing ? `XE-${slug}` : null, sender_id: existing ? 'whatsapp:+15555550100' : null,
    sender_status: 'online', requested_phone_number: '+15555550100', waba_id: null, phone_number_id: null },
  operator_checklist: [],
});
const later = () => { let resolve!: (value: unknown) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(() => {
  vi.clearAllMocks();
  api.getWhatsappTechProvider.mockImplementation(async slug => ({ contract: contract(slug) }));
  vi.mocked(getTenantOpsQaPlaybookV2).mockRejectedValue(new Error('not configured'));
});
describe('existing-organization setup safety', () => {
  it('preserves a legacy sender instead of starting another account', async () => {
    render(<Component tenantSlug="first" />);
    expect(await screen.findByRole('button', { name: 'Revisar conexión existente' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Preparar activación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Registrar sender' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /numero de whatsapp/i })).toBeDisabled();
    expect(api.provisionWhatsappTechProvider).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });
  it('does not infer environment readiness when the field is missing', async () => {
    api.getWhatsappTechProvider.mockResolvedValue({ contract: { ...contract(), automation: {} } });
    render(<Component tenantSlug="first" />);
    expect(await screen.findByText('Bloqueado por plataforma')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Preparar activación' })).toBeDisabled();
  });
  it('rejects a contract belonging to another organization', async () => {
    api.getWhatsappTechProvider.mockResolvedValue({ contract: contract('other') });
    render(<Component tenantSlug="first" />);
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText('XE-other')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /numero de whatsapp/i })).not.toBeInTheDocument();
  });
  it('does not revive a stale first response after A to B to A', async () => {
    const old = later();
    api.getWhatsappTechProvider.mockReturnValueOnce(old.promise);
    const { rerender } = render(<Component tenantSlug="first" />);
    rerender(<Component tenantSlug="second" />);
    expect(await screen.findByText('XE-second')).toBeInTheDocument();
    rerender(<Component tenantSlug="first" />);
    expect(await screen.findByText('XE-first')).toBeInTheDocument();
    await act(async () => old.resolve({ contract: { ...contract('first'), state: { ...contract().state, sender_sid: 'STALE-FIRST' } } }));
    expect(screen.queryByText('STALE-FIRST')).not.toBeInTheDocument();
    expect(screen.queryByText('XE-second')).not.toBeInTheDocument();
  });
  it('removes account and QA context after a rejected refresh', async () => {
    const { container } = render(<Component tenantSlug="first" />);
    expect(await screen.findByText('XE-first')).toBeInTheDocument();
    api.getWhatsappTechProvider.mockRejectedValueOnce({ status: 403 });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar', exact: true }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(container.textContent).not.toContain('XE-first');
    expect(screen.queryByRole('button', { name: 'Registrar sender' })).not.toBeInTheDocument();
  });
  it('allows only one preparation request and never re-registers its confirmed sender', async () => {
    const pending = later();
    api.getWhatsappTechProvider.mockResolvedValue({ contract: contract('first', false) });
    api.provisionWhatsappTechProvider.mockReturnValueOnce(pending.promise);
    render(<Component tenantSlug="first" />);
    const prepare = await waitFor(() => { const button = screen.getByRole('button', { name: /^Preparar activación$/ }); expect(button).toBeEnabled(); return button; });
    fireEvent.click(prepare); fireEvent.click(prepare);
    expect(api.provisionWhatsappTechProvider).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Actualizar', exact: true })).toBeDisabled();
    await act(async () => pending.resolve({ contract: contract() }));
    expect(await screen.findByText('XE-first')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparar activación' })).toBeDisabled();
  });
  it('does not call any endpoint without an organization', () => {
    render(<Component tenantSlug=" " />);
    expect(api.getWhatsappTechProvider).not.toHaveBeenCalled();
    expect(vi.mocked(getTenantOpsQaPlaybookV2)).not.toHaveBeenCalled();
  });
  it('does not mark real delivery completed just because a sender is online', async () => {
    render(<Component tenantSlug="first" />);
    expect(await screen.findByText('XE-first')).toBeInTheDocument();
    expect(screen.getByText('Verificar el circuito real').closest('li')).toHaveTextContent('Pendiente');
    expect(screen.queryByText('Listo para operar')).not.toBeInTheDocument();
  });
});
