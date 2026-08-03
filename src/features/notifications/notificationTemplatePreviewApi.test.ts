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
  NotificationTemplatePreviewError,
  parseNotificationTemplatePreview,
  previewNotificationTemplate,
} from './notificationTemplatePreviewApi';
import { notificationTemplatePreviewFixture } from './notificationTemplatePreviewTestFixture';

describe('notification template preview API', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it('posts an explicit tenant-scoped no-store preview request', async () => {
    mocks.apiFetch.mockResolvedValue(notificationTemplatePreviewFixture);
    const payload = {
      template_id: '11111111-1111-4111-8111-111111111111',
      context: { claim_code: 'REC-10482', status: 'En tratamiento' },
      content_variables: { '1': 'REC-10482', '2': 'En tratamiento' },
    };

    const response = await previewNotificationTemplate(' junin ', payload);

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/admin/notifications/templates/preview',
      {
        method: 'POST',
        tenantSlug: 'junin',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        body: payload,
      },
    );
    expect(response).toEqual(notificationTemplatePreviewFixture);
  });

  it('rejects a response that claims transport or production send readiness', () => {
    expect(() =>
      parseNotificationTemplatePreview({
        ...notificationTemplatePreviewFixture,
        readiness: {
          ...notificationTemplatePreviewFixture.readiness,
          production_send_allowed: true,
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        reasonCode: 'notification_template_preview_contract_invalid',
      }),
    );
  });

  it.each([
    {
      label: 'unsupported channel',
      value: {
        ...notificationTemplatePreviewFixture,
        template: { ...notificationTemplatePreviewFixture.template, channel: 'sms' },
      },
    },
    {
      label: 'non-positive registry id',
      value: {
        ...notificationTemplatePreviewFixture,
        template: {
          ...notificationTemplatePreviewFixture.template,
          message_template_registry_id: 0,
        },
      },
    },
    {
      label: 'fractional provider registry id',
      value: {
        ...notificationTemplatePreviewFixture,
        provider_template: {
          ...notificationTemplatePreviewFixture.provider_template!,
          registry_id: 31.5,
        },
      },
    },
  ])('rejects $label in the response contract', ({ value }) => {
    expect(() => parseNotificationTemplatePreview(value)).toThrowError(
      expect.objectContaining({
        reasonCode: 'notification_template_preview_contract_invalid',
      }),
    );
  });

  it('exposes only safe reason metadata from backend errors', async () => {
    const sensitiveValue = 'PII-NAME-MUST-NOT-LEAK';
    mocks.apiFetch.mockRejectedValue(
      new ApiError(`unsafe backend message ${sensitiveValue}`, 400, {
        error: 'template_context_missing_variables',
        field: 'context',
        variable_names: ['claim_code'],
        submitted_value: sensitiveValue,
      }),
    );

    let caught: unknown;
    try {
      await previewNotificationTemplate('junin', {
        template_id: '11111111-1111-4111-8111-111111111111',
        context: { name: sensitiveValue },
        content_variables: {},
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(NotificationTemplatePreviewError);
    expect(caught).toMatchObject({
      reasonCode: 'template_context_missing_variables',
      field: 'context',
      variableNames: ['claim_code'],
      message: 'template_context_missing_variables',
    });
    expect(JSON.stringify(caught)).not.toContain(sensitiveValue);
  });
});
