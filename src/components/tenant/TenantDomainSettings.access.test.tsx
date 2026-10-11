import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantDomainSettings } from './TenantDomainSettings';
import { readTenantDomain, type TenantDomainDescriptor } from '@/api/tenantDomain';
import { domainPayload, domainScope } from '@/test/fixtures/tenantDomain';
import { ApiError } from '@/utils/api';

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/api/tenantDomain', async () => ({
  ...await vi.importActual<typeof import('@/api/tenantDomain')>('@/api/tenantDomain'),
  getTenantDomain: mocks.get, saveTenantDomain: mocks.save,
}));
const descriptor = (patch: Record<string, unknown> = {}) => readTenantDomain(domainPayload(patch), domainScope);
const active = () => descriptor({ status: 'active', active: true, dns_proof: null, valid_until: Math.floor(Date.now() / 1000) + 3600 });
const blank = () => descriptor({ status: 'unconfigured', host: null, dns_proof: null, can_revoke: false });
const denied = (status: number) => new ApiError('private provider diagnostic', status, { reason_code: 'domain_forbidden' });
const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const mount = () => render(<TenantDomainSettings tenant={domainScope} scopeKey="session-a" />);
beforeEach(() => { mocks.get.mockReset(); mocks.save.mockReset(); });

function expectWithdrawn() {
  expect(screen.queryByText('atencion.example.test')).not.toBeInTheDocument();
  expect(screen.queryByText('_chatboc-verify.atencion.example.test')).not.toBeInTheDocument();
  expect(screen.queryByText('chatboc-domain-verification=' + 'b'.repeat(64))).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Abrir sitio público' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Comprobar TXT' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Copiar valor TXT' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Desvincular dominio' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Dominio completo')).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.queryByText(/private provider diagnostic/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Recargar estado' })).toBeEnabled();
}

describe('domain controls retire after an explicit access rejection', () => {
  it.each([401, 403])('withdraws a previously active domain after GET %s', async status => {
    mocks.get.mockResolvedValueOnce(active()).mockRejectedValueOnce(denied(status)); mount();
    await screen.findByRole('link', { name: 'Abrir sitio público' });
    fireEvent.click(screen.getByRole('button', { name: 'Recargar estado' }));
    await screen.findByRole('alert'); expectWithdrawn();
    expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([401, 403])('withdraws the DNS proof and open confirmation after GET %s', async status => {
    mocks.get.mockResolvedValueOnce(descriptor()).mockRejectedValueOnce(denied(status)); mount();
    await screen.findByText('Pendiente de verificar DNS');
    fireEvent.click(screen.getByRole('button', { name: 'Desvincular dominio' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    // A reload may also be initiated while a local dialog is open.
    fireEvent.click(screen.getByRole('button', { name: 'Recargar estado', hidden: true }));
    await screen.findByRole('alert'); expectWithdrawn(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each([401, 403])('withdraws the form and its draft after PUT %s; only a fresh GET restores it', async status => {
    mocks.get.mockResolvedValueOnce(blank()).mockResolvedValueOnce(blank());
    mocks.save.mockRejectedValueOnce(denied(status)); mount();
    const input = await screen.findByLabelText('Dominio completo');
    fireEvent.change(input, { target: { value: 'atencion.example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    await screen.findByRole('alert'); expectWithdrawn();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Recargar estado' }));
    expect(await screen.findByLabelText('Dominio completo')).toHaveValue('');
    expect(mocks.get).toHaveBeenCalledTimes(2); expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it('keeps an ordinary network failure and the draft recoverable', async () => {
    mocks.get.mockResolvedValueOnce(blank()); mocks.save.mockRejectedValueOnce(new Error('network offline')); mount();
    fireEvent.change(await screen.findByLabelText('Dominio completo'), { target: { value: 'atencion.example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Dominio completo')).toHaveValue('atencion.example.test');
    expect(screen.getByRole('button', { name: 'Solicitar verificación' })).toBeEnabled();
  });
  it('does not withdraw the new scope when an old scope is rejected late', async () => {
    const pending = deferred<TenantDomainDescriptor>();
    mocks.get.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(blank());
    const view = mount(); view.rerender(<TenantDomainSettings tenant={domainScope} scopeKey="session-b" />);
    await screen.findByLabelText('Dominio completo');
    await act(async () => pending.reject(denied(403)));
    expect(screen.getByLabelText('Dominio completo')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each(['resolve', 'reject'] as const)('retires a clipboard %s from before rejection, including after a fresh GET', async outcome => {
    const clipboard = deferred<void>();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(() => clipboard.promise) } });
    mocks.get.mockResolvedValueOnce(descriptor()).mockRejectedValueOnce(denied(403)).mockResolvedValueOnce(descriptor());
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Copiar valor TXT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recargar estado' }));
    await screen.findByRole('alert'); expectWithdrawn();
    fireEvent.click(screen.getByRole('button', { name: 'Recargar estado' }));
    await screen.findByRole('button', { name: 'Copiar valor TXT' });
    await act(async () => outcome === 'resolve' ? clipboard.resolve() : clipboard.reject(new Error('copy failed')));
    expect(screen.queryByText('Valor TXT copiado.')).not.toBeInTheDocument();
    expect(screen.queryByText(/No pudimos copiar el valor/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
