import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantAddressesSettings } from './TenantAddressesSettings';
import { readTenantAddresses, TenantAddressesContractError, TenantAddressesUnavailableError, type TenantAddresses } from '@/api/tenantAddresses';
import { addressesPayload, addressesScope } from '@/test/fixtures/tenantAddresses';
import { ApiError } from '@/utils/api';

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), copy: vi.fn() }));
vi.mock('@/api/tenantAddresses', async () => ({
  ...await vi.importActual<typeof import('@/api/tenantAddresses')>('@/api/tenantAddresses'),
  getTenantAddresses: mocks.get, saveTenantAddress: mocks.save,
}));
vi.mock('@/components/tenant/TenantDomainSettings', () => ({ TenantDomainSettings: () => <p>Legacy writer</p> }));

const NOW = 1_800_000_000;
const descriptor = (patch: Record<string, unknown> = {}) => readTenantAddresses(addressesPayload(patch), addressesScope);
const activeSlot = { kind: 'platform', source: 'v2', host: 'alpha.chatboc.ar', status: 'active', active: true,
  valid_until: NOW + 60, dns_proof: null, scope_note: 'Subdominio de la plataforma.' };
const proof = { type: 'TXT', name: '_chatboc-verify.atencion.example.test', value: `chatboc-domain-verification=${'b'.repeat(64)}`, expires_at: NOW + 60 };
const customSlot = { kind: 'custom', source: 'v2', host: 'atencion.example.test', status: 'pending_dns', active: false,
  valid_until: null, dns_proof: proof, scope_note: 'Dominio propio.' };
const capabilities = (kind: 'platform' | 'custom', verify = false) => ({
  ...addressesPayload().capabilities,
  [kind]: { eligible: true, can_request: false, can_verify_dns: verify, can_revoke: true, reason_code: 'ready' },
});
const active = () => descriptor({ platform: activeSlot, capabilities: capabilities('platform') });
const section = (name: string) => within(screen.getByRole('region', { name }));
const flush = async () => { await act(async () => {}); };
async function mount() {
  const view = render(<TenantAddressesSettings tenant={addressesScope} scopeKey="session-a" />);
  await flush();
  return view;
}
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW * 1000);
  mocks.get.mockReset().mockResolvedValue(descriptor());
  mocks.save.mockReset(); mocks.copy.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy } });
});
afterEach(() => {
  cleanup(); vi.useRealTimers();
  if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('address validity while the panel stays open', () => {
  it('shows the lease and retires active state, link and actions exactly at expiry', async () => {
    mocks.get.mockResolvedValue(active());
    const view = await mount();
    expect(view.container.querySelector('time')).toHaveAttribute('datetime', new Date((NOW + 60) * 1000).toISOString());
    expect(section('Subdominio').getByText('Activo')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(section('Subdominio').queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir alpha.chatboc.ar' })).not.toBeInTheDocument();
    expect(section('Subdominio').getByRole('button', { name: 'Desvincular' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeEnabled();
    vi.setSystemTime(NOW * 1000);
    fireEvent(window, new Event('focus'));
    expect(screen.queryByRole('link', { name: 'Abrir alpha.chatboc.ar' })).not.toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(['visibilitychange', 'focus'])('rechecks expiry on %s after a suspended tab', async event => {
    mocks.get.mockResolvedValue(active()); await mount();
    vi.setSystemTime((NOW + 61) * 1000);
    fireEvent(event === 'focus' ? window : document, new Event(event));
    expect(screen.queryByRole('link', { name: 'Abrir alpha.chatboc.ar' })).not.toBeInTheDocument();
    expect(section('Subdominio').getByText('Estado pendiente de actualización')).toBeInTheDocument();
  });

  it('blocks an expired link in its handler before a timer or focus event runs', async () => {
    mocks.get.mockResolvedValue(active()); await mount();
    const link = screen.getByRole('link', { name: 'Abrir alpha.chatboc.ar' });
    vi.setSystemTime((NOW + 61) * 1000);
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.queryByRole('link', { name: 'Abrir alpha.chatboc.ar' })).not.toBeInTheDocument();
  });

  it('blocks an already-open revoke confirmation when its lease expires', async () => {
    mocks.get.mockResolvedValue(active()); await mount();
    fireEvent.click(section('Subdominio').getByRole('button', { name: 'Desvincular' }));
    const confirm = screen.getByRole('button', { name: 'Confirmar' });
    vi.setSystemTime((NOW + 61) * 1000);
    fireEvent.click(confirm); await flush();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(['copy', 'verify'])('blocks an expired pending TXT %s before the timer runs', async action => {
    mocks.get.mockResolvedValue(descriptor({ custom: customSlot, capabilities: capabilities('custom', true) }));
    await mount();
    const control = screen.getByRole('button', { name: action === 'copy' ? 'Copiar valor' : 'Comprobar registro' });
    vi.setSystemTime((NOW + 61) * 1000);
    fireEvent.click(control); await flush();
    expect(mocks.copy).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText(/El plazo de este registro TXT venció/)).toBeInTheDocument();
  });

  it('keeps verified DNS pending after the original challenge deadline', async () => {
    mocks.get.mockResolvedValue(descriptor({ custom: { ...customSlot, status: 'pending_platform' }, capabilities: capabilities('custom') }));
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(61_000); });
    fireEvent(window, new Event('focus'));
    expect(screen.getByText('DNS confirmado · falta publicación y HTTPS')).toBeInTheDocument();
    expect(section('Dominio propio').getByRole('button', { name: 'Desvincular' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Copiar valor' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Comprobar registro' })).not.toBeInTheDocument();
    expect(screen.queryByText(/plazo.*venció/)).not.toBeInTheDocument();
  });

  it.each([
    ['verification_expired', 'address_revoke_required', 'Primero desvinculá'],
    ['suspended', 'full_plan_required', 'requiere el plan Full'],
  ])('explains %s with the backend reason without granting a new request', async (status, reason_code, message) => {
    const caps = capabilities('custom');
    mocks.get.mockResolvedValue(descriptor({ custom: { ...customSlot, status }, capabilities: {
      ...caps, custom: { ...caps.custom, reason_code },
    } }));
    await mount();
    expect(section('Dominio propio').getByText(new RegExp(message))).toBeInTheDocument();
    expect(section('Dominio propio').queryByRole('button', { name: 'Solicitar verificación' })).not.toBeInTheDocument();
    expect(section('Dominio propio').getByRole('button', { name: 'Desvincular' })).toBeEnabled();
  });

  it('keeps a revoked host as history without implying that it opens the organization', async () => {
    mocks.get.mockResolvedValue(descriptor({ platform: { ...activeSlot, active: false, status: 'revoked', valid_until: null } }));
    await mount();
    expect(section('Subdominio').getByText('alpha.chatboc.ar')).toBeInTheDocument();
    expect(section('Subdominio').getByText('Desvinculado · ya no abre la organización')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir alpha.chatboc.ar' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del subdominio')).toBeInTheDocument();
  });
});

describe('write reconciliation', () => {
  it.each([
    new ApiError('uncertain', 503, { contract_version: 'organization.addresses_error.v2', reason_code: 'address_save_unconfirmed', requires_status_check: true }),
    new Error('connection lost'),
    new TenantAddressesContractError(),
  ])('keeps the draft and blocks replay through a failed GET after %s', async error => {
    mocks.save.mockRejectedValue(error);
    await mount();
    const input = section('Subdominio').getByLabelText('Nombre del subdominio');
    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar subdominio' })); await flush();
    expect(input).toHaveValue('alpha');
    expect(screen.getByRole('button', { name: 'Solicitar subdominio' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Actualizar estado' })).toBeEnabled();
    mocks.get.mockRejectedValueOnce(new Error('refresh failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' })); await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar subdominio' }));
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('alpha');
    const refreshed = descriptor({ revision: 'c'.repeat(64) });
    mocks.get.mockResolvedValueOnce(refreshed);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' })); await flush();
    expect(screen.getByRole('button', { name: 'Solicitar subdominio' })).toBeEnabled();
    mocks.save.mockResolvedValueOnce(refreshed);
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar subdominio' })); await flush();
    expect(mocks.save).toHaveBeenLastCalledWith(addressesScope, expect.objectContaining({ revision: 'c'.repeat(64) }), 'platform', 'request', 'alpha', expect.any(Function));
  });

  it('withdraws old activation after an uncertain revoke and cannot escape through v1', async () => {
    mocks.get.mockResolvedValueOnce(active());
    mocks.save.mockRejectedValueOnce(new Error('ack lost'));
    await mount();
    fireEvent.click(section('Subdominio').getByRole('button', { name: 'Desvincular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' })); await flush();
    expect(section('Subdominio').queryByText('Activo')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir alpha.chatboc.ar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar enlace' })).toBeEnabled();
    mocks.get.mockRejectedValueOnce(new TenantAddressesUnavailableError());
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' })); await flush();
    expect(screen.queryByText('Legacy writer')).not.toBeInTheDocument();
    expect(section('Subdominio').getByRole('button', { name: 'Desvincular' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Abrir alpha.chatboc.ar' })).not.toBeInTheDocument();
    mocks.get.mockResolvedValueOnce(active());
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' })); await flush();
    expect(screen.getByRole('link', { name: 'Abrir alpha.chatboc.ar' })).toBeInTheDocument();
  });

  it('allows correcting a definitively rejected request without discarding the draft', async () => {
    mocks.save.mockRejectedValueOnce(new ApiError('conflict', 409, {
      contract_version: 'organization.addresses_error.v2', reason_code: 'address_host_in_use', writes_performed: false,
    }));
    await mount();
    fireEvent.change(screen.getByLabelText('Nombre del subdominio'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar subdominio' })); await flush();
    expect(screen.getByRole('button', { name: 'Solicitar subdominio' })).toBeEnabled();
    expect(screen.getByLabelText('Nombre del subdominio')).toHaveValue('alpha');
    expect(screen.getByRole('alert')).toHaveTextContent('ya está en uso');
  });

  it('ignores a late reconciliation across remounted session scopes', async () => {
    const oldRefresh = deferred<TenantAddresses>(), current = deferred<TenantAddresses>();
    mocks.save.mockRejectedValueOnce(new Error('ack lost'));
    mocks.get.mockResolvedValueOnce(descriptor()).mockReturnValueOnce(oldRefresh.promise).mockReturnValueOnce(current.promise);
    const view = render(<TenantAddressesSettings key="session-a" tenant={addressesScope} scopeKey="session-a" />); await flush();
    fireEvent.change(screen.getByLabelText('Nombre del subdominio'), { target: { value: 'alpha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar subdominio' })); await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }));
    view.rerender(<TenantAddressesSettings key="session-b" tenant={addressesScope} scopeKey="session-b" />); await flush();
    await act(async () => oldRefresh.resolve(active()));
    expect(mocks.get.mock.calls[1][1]()).toBe(false);
    expect(screen.queryByRole('link', { name: 'Abrir alpha.chatboc.ar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar subdominio' })).not.toBeInTheDocument();
    await act(async () => current.resolve(descriptor()));
    expect(screen.getByLabelText('Nombre del subdominio')).toHaveValue('');
  });
});
