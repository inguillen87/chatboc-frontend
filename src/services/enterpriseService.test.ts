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


  it('requests analytics heatmap through /api/admin namespace', async () => {
    await enterpriseService.getAnalyticsHeatmap({ scope: 'municipio' });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/analytics/heatmap?scope=municipio', {
      tenantSlug: undefined,
    });
  });

  it('normalizes collaboration metrics in tenant dashboard bundle', async () => {
    apiFetchMock.mockResolvedValueOnce({
      summary: { active_viewers: '3', unread_viewers: 2 },
      leads: {
        items: [
          {
            ticket_id: 17,
            collaboration_state: {
              active_viewers_count: '2',
              unread_viewer_count: 1,
              has_unread: true,
            },
          },
        ],
      },
    });

    const response = await enterpriseService.getTenantDashboardBundle('demo', { since_days: 30 });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/tenants/demo/dashboard-bundle?since_days=30', {
      tenantSlug: 'demo',
    });
    expect(response.summary?.active_viewers).toBe(3);
    expect(response.summary?.unread_viewers).toBe(2);
    expect(response.leads?.items?.[0].collaboration_state).toMatchObject({
      active_viewers_count: 2,
      unread_viewer_count: 1,
      has_unread: true,
    });
  });


  it('keeps team collaboration metrics in tenant dashboard bundle', async () => {
    apiFetchMock.mockResolvedValueOnce({
      summary: { active_viewers: 1, unread_viewers: 1 },
      team: {
        items: [
          {
            employee_name: 'Ana',
            active_ticket_views: 4,
            idle_ticket_views: 2,
            unread_ticket_views: 3,
          },
        ],
      },
    });

    const response = await enterpriseService.getTenantDashboardBundle('demo');

    expect(response.team?.items?.[0]).toMatchObject({
      employee_name: 'Ana',
      active_ticket_views: 4,
      idle_ticket_views: 2,
      unread_ticket_views: 3,
    });
  });

  it('normalizes collaboration state in tenant unread summary items', async () => {
    apiFetchMock.mockResolvedValueOnce({
      total_tickets_with_unread: 1,
      items: [
        {
          ticket_id: 99,
          unread_count: '4',
          collaboration_state: {
            active_viewers_count: '1',
            unread_viewer_count: '2',
          },
        },
      ],
    });

    const response = await enterpriseService.getTenantUnreadSummary('demo', { since_minutes: 60 });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/admin/tenants/demo/tickets/unread-summary?since_minutes=60', {
      tenantSlug: 'demo',
    });
    expect(response.items?.[0]).toMatchObject({
      ticket_id: 99,
      unread_count: 4,
      collaboration_state: {
        active_viewers_count: 1,
        unread_viewer_count: 2,
      },
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
