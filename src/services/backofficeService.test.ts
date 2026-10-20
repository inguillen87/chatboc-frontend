import { beforeEach, describe, expect, it, vi } from 'vitest';
import { panelReadOptions } from '@/utils/panelReadOptions';

const apiFetchMock = vi.fn();
const privateReadMock = vi.fn();
vi.mock('@/utils/privateBackendRead', () => ({
  privateBackendRead: (...args: unknown[]) => privateReadMock(...args),
}));

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: unknown;
    constructor(message: string, status = 500, body?: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

import { backofficeService } from '@/services/backofficeService';

describe('backofficeService', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    privateReadMock.mockReset();
  });

  it('loads inbox summary with tenant and scope and validates contract', async () => {
    privateReadMock.mockResolvedValueOnce({
      contract_version: 'backoffice.inbox_summary.v1',
      request_id: 'req-inbox-1',
      tenant_slug: 'junin-1',
      scope: 'municipio',
      summary: { total: 128, open: 42, unread: 9, sla_risk: 6, resolved: 86, unassigned: 4 },
      recommended_views: [{ id: 'sla_risk', label: 'Riesgo SLA', query: { sla: 'risk' } }],
    });

    const result = await backofficeService.getInboxSummary({ tenantSlug: 'junin-1', scope: 'municipio' });

    expect(result.summary?.sla_risk).toBe(6);
    expect(result.recommended_views?.[0]?.label).toBe('Riesgo SLA');
    expect(privateReadMock).toHaveBeenCalledWith(
      '/api/v2/backoffice/operations/inbox-summary?tenant_slug=junin-1&scope=municipio',
      'junin-1', {},
    );
  });

  it('rejects inbox summary when contract_version is not the expected one', async () => {
    privateReadMock.mockResolvedValueOnce({ contract_version: 'legacy' });

    await expect(backofficeService.getInboxSummary({ tenantSlug: 'junin-1' })).rejects.toMatchObject({ status: 502 });
  });

  it('requires the inbox tenant envelope and forwards the caller lifecycle', async () => {
    const lifecycle = { isCurrent: () => true };
    privateReadMock.mockResolvedValueOnce({ contract_version: 'backoffice.inbox_summary.v1', tenant_slug: 'tenant-b' });
    await expect(backofficeService.getInboxSummary({ tenantSlug: 'tenant-a' }, lifecycle)).rejects.toMatchObject({ status: 502 });
    expect(privateReadMock).toHaveBeenCalledWith('/api/v2/backoffice/operations/inbox-summary?tenant_slug=tenant-a', 'tenant-a', lifecycle);
    privateReadMock.mockResolvedValueOnce({ contract_version: 'backoffice.inbox_summary.v1' });
    await expect(backofficeService.getInboxSummary({ tenantSlug: 'tenant-a' })).rejects.toMatchObject({ status: 502 });
  });

  it('loads orders, contacts and team summaries from the CRM endpoints', async () => {
    privateReadMock
      .mockResolvedValueOnce({
        contract_version: 'backoffice.orders_summary.v1', tenant_slug: 'tenant-a', request_id: 'req-orders',
        summary: { active: 3, unassigned: null }, active_orders: [{ id: 1 }],
      })
      .mockResolvedValueOnce({
        contract_version: 'backoffice.contacts_summary.v1', tenant_slug: 'tenant-a', request_id: 'req-contacts',
        summary: { total: 20 }, segments: { channels: [] },
      })
      .mockResolvedValueOnce({
        contract_version: 'backoffice.team_coverage_summary.v1', tenant_slug: 'tenant-a', request_id: 'req-team',
        summary: { active_employees: 5 },
      });

    const orders = await backofficeService.getOrdersSummary('tenant-a');
    const contacts = await backofficeService.getContactsSummary('tenant-a');
    const team = await backofficeService.getTeamCoverageSummary('tenant-a');

    expect(orders.summary?.active).toBe(3);
    expect(orders.summary?.unassigned).toBeNull();
    expect(orders.active_orders).toEqual([{ id: 1 }]);
    expect(contacts.summary?.total).toBe(20);
    expect(team.summary?.active_employees).toBe(5);
    expect(privateReadMock).toHaveBeenNthCalledWith(1, '/api/v2/backoffice/orders/summary?tenant_slug=tenant-a', 'tenant-a', {});
    expect(privateReadMock).toHaveBeenNthCalledWith(2, '/api/v2/backoffice/contacts/summary?tenant_slug=tenant-a', 'tenant-a', {});
    expect(privateReadMock).toHaveBeenNthCalledWith(3, '/api/v2/backoffice/team/coverage-summary?tenant_slug=tenant-a', 'tenant-a', {});
  });

  it.each([
    ['getOrdersSummary', 'backoffice.orders_summary.v1'],
    ['getContactsSummary', 'backoffice.contacts_summary.v1'],
    ['getTeamCoverageSummary', 'backoffice.team_coverage_summary.v1'],
  ] as const)('rejects invalid versions and foreign tenant envelopes for %s', async (method, contractVersion) => {
    privateReadMock.mockResolvedValueOnce({ contract_version: 'legacy', tenant_slug: 'tenant-a', summary: { total: 0 } });
    await expect(backofficeService[method]('tenant-a')).rejects.toMatchObject({ status: 502 });
    privateReadMock.mockResolvedValueOnce({ contract_version: contractVersion, tenant_slug: 'tenant-b', summary: { total: 0 } });
    await expect(backofficeService[method]('tenant-a')).rejects.toMatchObject({ status: 502 });
    privateReadMock.mockResolvedValueOnce({ contract_version: contractVersion, summary: { total: 0 } });
    await expect(backofficeService[method]('tenant-a')).rejects.toMatchObject({ status: 502 });
  });

  it('requests export and validates download_url', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      request_id: 'req-export',
      download_url: 'https://files.example/export.pdf',
      expires_at: '2026-05-16T23:59:59Z',
    });

    const result = await backofficeService.requestExport({
      tenant_slug: 'tenant-a',
      resource: 'tickets',
      format: 'pdf',
      filters: { status: 'open' },
      include_ai_summary: true,
    });

    expect(result.download_url).toBe('https://files.example/export.pdf');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/backoffice/export', {
      ...panelReadOptions('tenant-a'),
      method: 'POST',
      body: {
        tenant_slug: 'tenant-a',
        resource: 'tickets',
        format: 'pdf',
        filters: { status: 'open' },
        include_ai_summary: true,
      },
      singleAttempt: true,
      allowStartupRecovery: false,
      isCurrent: undefined,
    });
  });

  it('requests executive summary without strengthening low-confidence conclusions locally', async () => {
    apiFetchMock.mockResolvedValueOnce({
      request_id: 'req-ai',
      headline: 'Muestra insuficiente',
      confidence: 'low',
      data_quality_notes: ['Pocos casos en el periodo'],
      source_endpoints: ['/api/v2/backoffice/operations/inbox-summary'],
    });

    const result = await backofficeService.requestExecutiveSummary({
      tenant_slug: 'tenant-a',
      resource: 'overview',
      filters: { window: '7d' },
    });

    expect(result.confidence).toBe('low');
    expect(result.data_quality_notes).toEqual(['Pocos casos en el periodo']);
  });
});
