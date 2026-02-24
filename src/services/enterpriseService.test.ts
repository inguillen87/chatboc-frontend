import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { enterpriseService, extractDemoFrontendContract, isSupportedDemoFrontendContract } from '@/services/enterpriseService';

describe('enterpriseService demo endpoints', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({});
  });

  it('requests demo catalog without tenant scope params', async () => {
    await enterpriseService.getDemoCatalog();

    expect(apiFetchMock).toHaveBeenCalledWith('/api/auth/demo/catalog', {
      skipAuth: true,
      omitTenant: true,
    });
  });

  it('posts demo login payload without tenant scope params', async () => {
    await enterpriseService.demoLoginWithPayload({ rubro: 'municipio' });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/auth/demo', {
      method: 'POST',
      body: { rubro: 'municipio' },
      skipAuth: true,
      omitTenant: true,
    });
  });

  it('requests analytics overview through /api/admin namespace', async () => {
    await enterpriseService.getAnalyticsOverview({ scope: 'municipio' });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/analytics/overview?scope=municipio', {
      tenantSlug: undefined,
    });
  });
});


describe('demo frontend contract parsing', () => {
  it('validates frontend contract version pinning', () => {
    expect(isSupportedDemoFrontendContract('1')).toBe(true);
    expect(isSupportedDemoFrontendContract('1.0.2')).toBe(true);
    expect(isSupportedDemoFrontendContract('2')).toBe(false);
  });

  it('parses sector-first selector contract', () => {
    const contract = extractDemoFrontendContract({
      frontend_contract_version: '1.0.0',
      demo_selector: {
        mode: 'sector_first',
        sector_default: 'municipio',
        require_rubro_by_sector: true,
        tenant_slug_field: 'tenant_slug',
      },
    });

    expect(contract.demo_selector?.mode).toBe('sector_first');
    expect(contract.demo_selector?.sector_default).toBe('municipio');
    expect(contract.demo_selector?.require_rubro_by_sector).toBe(true);
    expect(contract.demo_selector?.tenant_slug_field).toBe('tenant_slug');
  });

  it('parses preload hints required before demo login bootstrap', () => {
    const contract = extractDemoFrontendContract({
      frontend_contract_version: '1',
      preload_before_login: ['catalog', 'tenant-info', 'anon-id'],
    });

    expect(contract.preload_before_login).toEqual(['catalog', 'tenant-info', 'anon-id']);
  });

  it('parses onboarding sector defaults and options', () => {
    const contract = extractDemoFrontendContract({
      frontend_contract_version: '1',
      onboarding: {
        default_sector: 'gobierno',
        sector_options: [
          { value: 'gobierno', label: 'Gobierno' },
          { value: 'empresas', label: 'Empresas' },
        ],
      },
    });

    expect(contract.onboarding?.default_sector).toBe('gobierno');
    expect(contract.onboarding?.sector_options).toEqual([
      { value: 'gobierno', label: 'Gobierno' },
      { value: 'empresas', label: 'Empresas' },
    ]);
  });

});
