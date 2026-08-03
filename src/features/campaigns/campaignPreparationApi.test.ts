import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

import { ApiError } from '@/utils/api';

import {
  CampaignPreparationError,
  parseCampaignPreparation,
  prepareCampaign,
} from './campaignPreparationApi';
import { campaignPreparationFixture } from './campaignPreparationTestFixture';

describe('campaign preparation API', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it('posts a tenant-scoped idempotent preparation with no-store semantics', async () => {
    mocks.apiFetch.mockResolvedValue(campaignPreparationFixture);
    const request = {
      template_id: '11111111-1111-4111-8111-111111111111',
      context: { name: 'vecino' },
      content_variables: { '1': 'vecino' },
      contact_ids: ['contact-1', 'contact-2', 'contact-3'],
      max_per_week: 2,
      min_interval_hours: 24,
    };

    const result = await prepareCampaign(
      ' municipalidad-junin ',
      request,
      'crm:test:11111111-1111-4111-8111-111111111111',
    );

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/admin/tenants/municipalidad-junin/campaigns/prepare',
      {
        method: 'POST',
        tenantSlug: 'municipalidad-junin',
        cache: 'no-store',
        headers: {
          'Idempotency-Key': 'crm:test:11111111-1111-4111-8111-111111111111',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: request,
      },
    );
    expect(result).toEqual(campaignPreparationFixture);
  });

  it.each([
    {
      label: 'claims delivery without evidence',
      mutate: () => ({
        ...campaignPreparationFixture,
        queue: {
          ...campaignPreparationFixture.queue,
          transport_outcomes: {
            ...campaignPreparationFixture.queue.transport_outcomes,
            delivered: 1,
          },
        },
      }),
    },
    {
      label: 'claims production readiness',
      mutate: () => ({
        ...campaignPreparationFixture,
        readiness: {
          ...campaignPreparationFixture.readiness,
          production_send_allowed: true,
        },
      }),
    },
    {
      label: 'drops a durable receipt',
      mutate: () => ({
        ...campaignPreparationFixture,
        queue: {
          ...campaignPreparationFixture.queue,
          receipts: campaignPreparationFixture.queue.receipts.slice(0, 2),
        },
      }),
    },
    {
      label: 'marks a receipt unknown without an attempt',
      mutate: () => ({
        ...campaignPreparationFixture,
        queue: {
          ...campaignPreparationFixture.queue,
          receipts: campaignPreparationFixture.queue.receipts.map((receipt, index) =>
            index === 0 ? { ...receipt, transport_status: 'unknown' } : receipt,
          ),
        },
      }),
    },
  ])('rejects a response that $label', ({ mutate }) => {
    expect(() => parseCampaignPreparation(mutate())).toThrowError(
      expect.objectContaining({
        reasonCode: 'campaign_preparation_contract_invalid',
      }),
    );
  });

  it('does not expose values returned in unsafe backend error bodies', async () => {
    const sensitive = '+5492613000001 SECRET-CONTENT';
    mocks.apiFetch.mockRejectedValue(
      new ApiError(`backend leaked ${sensitive}`, 409, {
        error: 'campaign_idempotency_conflict',
        field: 'body',
        recipient: sensitive,
      }),
    );

    let caught: unknown;
    try {
      await prepareCampaign(
        'municipalidad-junin',
        {
          template_id: '11111111-1111-4111-8111-111111111111',
          context: {},
          content_variables: {},
          contact_ids: ['contact-1'],
          max_per_week: 2,
          min_interval_hours: 24,
        },
        'crm:test:22222222-2222-4222-8222-222222222222',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(CampaignPreparationError);
    expect(caught).toMatchObject({
      reasonCode: 'campaign_idempotency_conflict',
      field: 'body',
      message: 'campaign_idempotency_conflict',
    });
    expect(JSON.stringify(caught)).not.toContain(sensitive);
  });
});
