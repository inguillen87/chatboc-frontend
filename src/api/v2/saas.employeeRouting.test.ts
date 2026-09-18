import { beforeEach, describe, expect, it, vi } from 'vitest';

const panelPostMock = vi.hoisted(() => vi.fn());

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    get: vi.fn(),
    patch: vi.fn(),
    post: (...args: unknown[]) => panelPostMock(...args),
  },
}));

import { ApiError } from '@/utils/api';
import { postEmployeeRoutingAutoAssignV2, postOmnichannelInboxActionV2 } from './saas';

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

  it.each(['claim', 'assign'])('no reintenta %s por el endpoint legacy ante una respuesta ambigua', async (action) => {
    panelPostMock.mockRejectedValueOnce(new ApiError('not found', 404));

    await expect(
      postOmnichannelInboxActionV2(
        '403',
        {
          action,
          payload: {
            source_model: 'MunicipioTicket',
            ticket_id: 403,
            ...(action === 'assign' ? { assignee_id: 10, expected_assignee_id: null } : {}),
          },
        },
        'junin',
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(panelPostMock).toHaveBeenCalledTimes(1);
    expect(panelPostMock.mock.calls[0][0]).toBe('/api/v2/inbox/omnichannel/403/actions');
  });

  it.each(['claim', 'assign'])('bloquea %s antes de la red si falta source_model', async (action) => {
    await expect(
      postOmnichannelInboxActionV2(
        '403',
        {
          action,
          payload: {
            ticket_id: 403,
            ...(action === 'assign' ? { assignee_id: 10, expected_assignee_id: null } : {}),
          },
        },
        'junin',
      ),
    ).rejects.toMatchObject({ status: 400, body: { code: 'source_model_required' } });

    expect(panelPostMock).not.toHaveBeenCalled();
  });

  it.each([403, 409])('preserva CAS y la sugerencia revisada sin fallback ante %s', async (status) => {
    const payload = {
      dry_run: false,
      tickets: [{ source_model: 'MunicipioTicket', id: '403', expected_assignee_id: null, expected_suggested_assignee_id: '10' }],
      limit: 1,
    };
    panelPostMock.mockRejectedValueOnce(new ApiError('Asignación rechazada', status));
    await expect(postEmployeeRoutingAutoAssignV2(payload, 'junin')).rejects.toMatchObject({ status });
    expect(panelPostMock).toHaveBeenCalledExactlyOnceWith('/api/v2/employee-routing/auto-assign', payload, { tenantSlug: 'junin' });
  });
});
