import { beforeEach, describe, expect, it, vi } from 'vitest';

const panelPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    get: vi.fn(),
    patch: vi.fn(),
    post: (...args: unknown[]) => panelPostMock(...args),
  },
}));

import { postEmployeeRoutingAutoAssignV2 } from './saas';

describe('employee routing transport', () => {
  beforeEach(() => {
    panelPostMock.mockReset().mockResolvedValue({ ok: true });
  });

  it('envía identidades completas en tickets y no el payload ambiguo ticket_ids', async () => {
    await postEmployeeRoutingAutoAssignV2(
      {
        dry_run: true,
        tickets: [{ source_model: 'MunicipioTicket', id: 403 }],
      },
      'junin',
    );

    expect(panelPostMock).toHaveBeenCalledWith(
      '/api/v2/employee-routing/auto-assign',
      {
        dry_run: true,
        tickets: [{ source_model: 'MunicipioTicket', id: 403 }],
      },
      { tenantSlug: 'junin' },
    );
    expect(panelPostMock.mock.calls[0][1]).not.toHaveProperty('ticket_ids');
  });
});
