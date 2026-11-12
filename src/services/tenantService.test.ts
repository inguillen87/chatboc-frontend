import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { tenantService } from '@/services/tenantService';
import type { TenantConfigBundle } from '@/types/TenantConfig';

const tenantConfigBundle: TenantConfigBundle = {
  tenant: {
    slug: 'junin',
    nombre: 'Municipalidad de Junin',
    tipo: 'municipio',
    plan: 'full',
  },
  configs: {
    menu: {},
    contacts: {},
    links: {},
    widget: {},
  },
  whatsapp: {
    has_number: true,
    phone_number: '+17432643718',
    sender_id: 'whatsapp:+17432643718',
  },
};

describe('tenantService config updates', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('returns the updated config when backend responds with the full bundle', async () => {
    apiFetchMock.mockResolvedValueOnce(tenantConfigBundle);

    const updated = await tenantService.updateTenantConfig('junin', {
      configs: { widget: { default: { welcome_title: 'Hola' } } },
    });

    expect(updated).toBe(tenantConfigBundle);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/tenants/junin/config', expect.objectContaining({
      method: 'PUT',
      tenantSlug: 'junin', persistTenantSlug: false, isWidgetRequest: false,
      omitEntityToken: true, omitChatSessionId: true, singleAttempt: true, allowStartupRecovery: false,
      body: JSON.stringify({
        configs: { widget: { default: { welcome_title: 'Hola' } } },
      }),
    }));
  });

  it('refetches the config when backend responds with an acknowledgement only', async () => {
    apiFetchMock.mockResolvedValueOnce({ message: 'Config updated' }).mockResolvedValueOnce(tenantConfigBundle);

    const updated = await tenantService.updateTenantConfig('junin', {
      configs: { widget: { default: { welcome_title: 'Hola' } } },
    } as any);

    expect(updated).toBe(tenantConfigBundle);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/admin/tenants/junin/config',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/admin/tenants/junin/config', expect.objectContaining({
      tenantSlug: 'junin', persistTenantSlug: false, isWidgetRequest: false, omitEntityToken: true,
      omitChatSessionId: true, omitCredentials: false, singleAttempt: true, allowStartupRecovery: true,
    }));
  });
  it('rejects another organization in the configuration receipt before displaying or saving it', async () => {
    const foreign = { ...tenantConfigBundle, tenant: { ...tenantConfigBundle.tenant, slug: 'foreign-organization' } };
    apiFetchMock.mockResolvedValue(foreign);
    await expect(tenantService.getTenantConfig('junin')).rejects.toMatchObject({ status: 502 });
    await expect(tenantService.updateTenantConfig('junin', { configs: {} })).rejects.toMatchObject({ status: 502 });
  });
  it('requires a versioned saved profile receipt before reading back the institutional logo', async () => {
    const logo = 'https://assets.example.invalid/logo.svg';
    const receipt = { contract_version: 'organization.profile_save.v1', ok: true, saved: true,
      tenant: { id: 17, slug: 'junin' }, profile: { contract_version: 'organization.profile_settings.v1',
        tenant: { id: 17, slug: 'junin' }, revision: 'b'.repeat(64), values: { logo_url: logo } } };
    apiFetchMock.mockResolvedValueOnce(receipt).mockResolvedValueOnce({ ...tenantConfigBundle, tenant: { ...tenantConfigBundle.tenant, logo_url: logo } });
    const payload = { expected_revision: 'a'.repeat(64), organization_profile: { logo_url: logo } };
    const updated = await tenantService.updateTenantConfig('junin', payload);
    expect(updated.tenant.logo_url).toBe(logo);
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/admin/tenants/junin/config', expect.objectContaining({
      method: 'PUT', body: JSON.stringify(payload), singleAttempt: true, allowStartupRecovery: false,
      tenantSlug: 'junin', persistTenantSlug: false, isWidgetRequest: false, omitEntityToken: true, omitChatSessionId: true,
    }));
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/admin/tenants/junin/config', expect.objectContaining({
      tenantSlug: 'junin', persistTenantSlug: false, singleAttempt: true, allowStartupRecovery: true,
    }));
    expect(apiFetchMock.mock.calls[1][1]).not.toHaveProperty('method');
  });
  it.each(['ack_only', 'invalid_saved', 'foreign', 'invalid_revision', 'unconfirmed_logo', 'wrong_profile_contract', 'different_id'])
    ('does not turn an uncertain %s profile receipt into a successful configuration readback', async cause => {
      const receipt: any = { contract_version: 'organization.profile_save.v1', ok: true, saved: true,
        tenant: { id: 17, slug: 'junin' }, profile: { contract_version: 'organization.profile_settings.v1',
          tenant: { id: 17, slug: 'junin' }, revision: 'b'.repeat(64), values: { logo_url: 'https://assets.example.invalid/logo.svg' } } };
      if (cause === 'ack_only') { delete receipt.contract_version; delete receipt.profile; }
      if (cause === 'invalid_saved') receipt.saved = 'false';
      if (cause === 'foreign') receipt.tenant.slug = 'another-organization';
      if (cause === 'invalid_revision') receipt.profile.revision = 'legacy';
      if (cause === 'unconfirmed_logo') receipt.profile.values.logo_url = 'old';
      if (cause === 'wrong_profile_contract') receipt.profile.contract_version = 'legacy';
      if (cause === 'different_id') receipt.profile.tenant.id = 99;
      apiFetchMock.mockResolvedValueOnce(receipt);
      await expect(tenantService.updateTenantConfig('junin', { expected_revision: 'a'.repeat(64),
        organization_profile: { logo_url: 'https://assets.example.invalid/logo.svg' } })).rejects.toMatchObject({ status: 502 });
      expect(apiFetchMock).toHaveBeenCalledOnce();
    });
  it('accepts a valid idempotent profile receipt only with an exact confirmed logo and subsequent readback', async () => {
    const logo = 'https://assets.example.invalid/logo.svg';
    apiFetchMock.mockResolvedValueOnce({ contract_version: 'organization.profile_save.v1', ok: true, saved: false,
      tenant: { id: 17, slug: 'junin' }, profile: { contract_version: 'organization.profile_settings.v1',
        tenant: { id: 17, slug: 'junin' }, revision: 'a'.repeat(64), values: { logo_url: logo } } })
      .mockResolvedValueOnce({ ...tenantConfigBundle, tenant: { ...tenantConfigBundle.tenant, logo_url: logo } });
    await expect(tenantService.updateTenantConfig('junin', { expected_revision: 'a'.repeat(64), organization_profile: { logo_url: logo } }))
      .resolves.toMatchObject({ tenant: { slug: 'junin', logo_url: logo } });
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(['profile', 'configs'])('does not start a readback after a retired %s PUT resolves', async kind => {
    let resolvePut!: (value: unknown) => void;
    apiFetchMock.mockReturnValueOnce(new Promise(resolve => { resolvePut = resolve; }));
    let current = true;
    const isCurrent = () => current;
    const payload = kind === 'profile' ? { expected_revision: 'a'.repeat(64), organization_profile: { logo_url: 'https://assets.example.invalid/logo.svg' } }
      : { configs: {} };
    const pending = tenantService.updateTenantConfig('junin', payload, { isCurrent });
    current = false;
    resolvePut({ message: 'Saved' });
    await expect(pending).rejects.toMatchObject({ status: 409 });
    expect(apiFetchMock).toHaveBeenCalledOnce();
    expect(apiFetchMock.mock.calls[0][1].isCurrent()).toBe(false);
    expect(apiFetchMock.mock.calls[0][1]).toMatchObject({ singleAttempt: true, allowStartupRecovery: false });
  });
  it('blocks already retired config reads and writes before transport', async () => {
    await expect(tenantService.getTenantConfig('junin', { isCurrent: () => false })).rejects.toMatchObject({ status: 409 });
    await expect(tenantService.updateTenantConfig('junin', { configs: {} }, { isCurrent: () => false })).rejects.toMatchObject({ status: 409 });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
  it('propagates the current lifecycle to the readback and retires its late result', async () => {
    let resolveRead!: (value: unknown) => void;
    apiFetchMock.mockResolvedValueOnce({ message: 'Config updated' }).mockReturnValueOnce(new Promise(resolve => { resolveRead = resolve; }));
    let current = true;
    const isCurrent = () => current;
    const pending = tenantService.updateTenantConfig('junin', { configs: {} }, { isCurrent });
    await Promise.resolve();
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock.mock.calls[1][1].isCurrent).toBe(isCurrent);
    current = false; resolveRead(tenantConfigBundle);
    await expect(pending).rejects.toMatchObject({ status: 409 });
  });
  it('pins the private WhatsApp contract read to the requested organization and panel session', async () => {
    apiFetchMock.mockResolvedValue({ contract_version: 'twilio.tech_provider.v1' });
    await tenantService.getWhatsappTechProvider('selected-organization');
    expect(apiFetchMock).toHaveBeenCalledExactlyOnceWith('/api/v2/tenants/selected-organization/whatsapp/tech-provider', expect.objectContaining({
      tenantSlug: 'selected-organization', persistTenantSlug: false, isWidgetRequest: false,
      omitEntityToken: true, omitChatSessionId: true, omitCredentials: false, singleAttempt: true, allowStartupRecovery: true,
    }));
  });

  it('reads and writes the WidgetSettings runtime source with an explicit tenant context', async () => {
    const runtimeConfig = {
      theme_json: { light: { primary: '#0f8f4f' } },
      welcome_message: 'Hola Junín',
    };
    apiFetchMock.mockResolvedValueOnce(runtimeConfig).mockResolvedValueOnce({ status: 'updated' });

    await expect(tenantService.getRuntimeWidgetConfig('junin')).resolves.toBe(runtimeConfig);
    await expect(
      tenantService.updateRuntimeWidgetConfig('junin', {
        theme_json: runtimeConfig.theme_json,
        welcome_message: 'Hola Junín',
        welcome_subtitle: 'Asistente Junín',
        avatar_url: 'https://cdn.example.com/junin.svg',
        primary_color: '#0f8f4f',
        secondary_color: '#075f36',
        bottom: '20px',
        side_offset: '20px',
        position: 'right',
        bubble_shape: 'rounded',
        cta_messages: [{ text: 'Consultanos' }],
        font_family: 'Inter',
        default_open: false,
      }),
    ).resolves.toEqual({ status: 'updated' });

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/tenant/config', {
      tenantSlug: 'junin',
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/tenant/config', {
      method: 'PUT',
      body: expect.objectContaining({
        welcome_message: 'Hola Junín',
        primary_color: '#0f8f4f',
      }),
      tenantSlug: 'junin',
    });
  });

  it('reads the public widget contract used to verify publication', async () => {
    const publicConfig = { contract_version: 'public.widget_config.v1', tenant: { slug: 'junin' } };
    apiFetchMock.mockResolvedValueOnce(publicConfig);

    await expect(tenantService.getPublicRuntimeWidgetConfig('junin')).resolves.toBe(publicConfig);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/public/tenants/junin/widget-config', {
      tenantSlug: 'junin',
    });
  });
});
