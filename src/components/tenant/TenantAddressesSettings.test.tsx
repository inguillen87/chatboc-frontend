import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantAddressesSettings } from './TenantAddressesSettings';
import { readTenantAddresses, TenantAddressesUnavailableError } from '@/api/tenantAddresses';
import { addressesPayload, addressesScope } from '@/test/fixtures/tenantAddresses';

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('@/api/tenantAddresses', async () => ({
  ...await vi.importActual<typeof import('@/api/tenantAddresses')>('@/api/tenantAddresses'),
  getTenantAddresses: mocks.get, saveTenantAddress: mocks.save,
}));
vi.mock('@/components/tenant/TenantDomainSettings', () => ({
  TenantDomainSettings: () => <p>Configuración anterior de dominio</p>,
}));

const descriptor = (patch: Record<string, unknown> = {}) => readTenantAddresses(addressesPayload(patch), addressesScope);
const pendingPlatform = {
  kind: 'platform', source: 'v2', host: 'alpha.chatboc.ar', status: 'pending_platform', active: false,
  valid_until: null, dns_proof: null, allowed_aliases: [], scope_note: 'Subdominio de la plataforma.',
};
const mount = () => render(<TenantAddressesSettings tenant={addressesScope} scopeKey="session-a" />);
const section = (name: string) => screen.getByRole('region', { name });

beforeEach(() => { mocks.get.mockReset().mockResolvedValue(descriptor()); mocks.save.mockReset(); });

describe('organization addresses', () => {
  it('shows the three addresses with the state the server reports', async () => {
    mount();
    expect(await screen.findByText('chatboc.ar/t/institution-alpha')).toBeInTheDocument();
    expect(within(section('Subdominio')).getByText('Sin configurar')).toBeInTheDocument();
    expect(within(section('Dominio propio')).getByText('Sin configurar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /activar|publicar/i })).not.toBeInTheDocument();
  });

  it('requests a platform subdomain and reports it as pending, not active', async () => {
    mocks.save.mockResolvedValue(descriptor({ platform: pendingPlatform }));
    mount();
    const platform = within(await screen.findByRole('region', { name: 'Subdominio' }));
    fireEvent.change(platform.getByLabelText('Nombre del subdominio'), { target: { value: 'Alpha' } });
    fireEvent.click(platform.getByRole('button', { name: 'Solicitar subdominio' }));

    expect(await screen.findByText('Solicitado · falta publicarlo')).toBeInTheDocument();
    expect(mocks.save).toHaveBeenCalledWith(addressesScope, expect.objectContaining({ revision: 'a'.repeat(64) }),
      'platform', 'request', 'Alpha', expect.any(Function));
    expect(screen.getByText('alpha.chatboc.ar')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Abrir alpha/ })).not.toBeInTheDocument();
  });

  it('explains an invalid name without calling the server', async () => {
    mount();
    const platform = within(await screen.findByRole('region', { name: 'Subdominio' }));
    fireEvent.change(platform.getByLabelText('Nombre del subdominio'), { target: { value: 'a b' } });
    fireEvent.click(platform.getByRole('button', { name: 'Solicitar subdominio' }));
    expect(await platform.findByRole('alert')).toHaveTextContent('entre 3 y 40');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('offers no request when the server does not allow it and gives its reason', async () => {
    const blocked = { eligible: false, can_request: false, can_verify_dns: false, can_revoke: false, reason_code: 'full_plan_required' };
    mocks.get.mockResolvedValue(descriptor({ capabilities: { ...addressesPayload().capabilities, custom: blocked } }));
    mount();
    const custom = within(await screen.findByRole('region', { name: 'Dominio propio' }));
    expect(custom.getByText('El dominio propio requiere el plan Full.')).toBeInTheDocument();
    expect(custom.queryByLabelText('Dominio completo')).not.toBeInTheDocument();
  });

  it('is read-only for an account that cannot manage addresses', async () => {
    mocks.get.mockResolvedValue(descriptor({ capabilities: { ...addressesPayload().capabilities, can_manage: false } }));
    mount();
    expect(await screen.findByText(/Sólo un administrador de la organización/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Solicitar/ })).not.toBeInTheDocument();
  });

  it('falls back to the previous domain settings while the server lacks this contract', async () => {
    mocks.get.mockRejectedValue(new TenantAddressesUnavailableError());
    mount();
    expect(await screen.findByText('Configuración anterior de dominio')).toBeInTheDocument();
  });

  it('keeps the draft and marks the prior state unconfirmed when a save fails', async () => {
    mocks.save.mockRejectedValue(new Error('network'));
    mount();
    const platform = within(await screen.findByRole('region', { name: 'Subdominio' }));
    fireEvent.change(platform.getByLabelText('Nombre del subdominio'), { target: { value: 'alpha' } });
    fireEvent.click(platform.getByRole('button', { name: 'Solicitar subdominio' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar o confirmar las direcciones');
    expect(platform.getByLabelText('Nombre del subdominio')).toHaveValue('alpha');
    expect(within(section('Subdominio')).getByText('Estado pendiente de actualización')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Solicitar subdominio' })).toBeDisabled();
  });
});
