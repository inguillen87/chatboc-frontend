import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/utils/api', () => ({
  apiFetch: mocks.apiFetch,
}));

import {
  getWidgetCommerceSession,
  getWidgetTenantHistory,
  hasWidgetCommerceCredential,
} from './widgetCommerce';

describe('widget commerce credential boundary', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset().mockResolvedValue({});
  });

  it.each([
    { label: 'missing', widgetToken: null },
    { label: 'blank', widgetToken: '   ' },
  ])('does not request a commerce session when the widget token is $label', async ({ widgetToken }) => {
    await expect(
      getWidgetCommerceSession({
        tenantSlug: 'municipio',
        widgetToken,
        chatSessionId: 'chat-public-survey',
        anonId: 'anon-public-survey',
      }),
    ).rejects.toThrow('missing_widget_commerce_credential');

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it('does not request tenant history with only public tenant and anonymous context', async () => {
    await expect(
      getWidgetTenantHistory(null, {
        tenantSlug: 'municipio',
        chatSessionId: 'chat-public-survey',
        anonId: 'anon-public-survey',
      }),
    ).rejects.toThrow('missing_widget_commerce_credential');

    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it('keeps authenticated widget commerce requests available', async () => {
    await getWidgetCommerceSession({
      tenantSlug: 'junin',
      widgetToken: 'widget-token',
      chatSessionId: 'chat-session',
    });

    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch.mock.calls[0]?.[0]).toContain('/api/public/widget-commerce-session?');
    expect(mocks.apiFetch.mock.calls[0]?.[0]).toContain('widget_token=widget-token');
  });

  it('accepts a server-issued widget session token for tenant history', async () => {
    const request = {
      tenantSlug: 'junin',
      widgetSessionToken: 'widget-session-token',
      chatSessionId: 'chat-session',
    };

    expect(hasWidgetCommerceCredential(request)).toBe(true);
    await getWidgetTenantHistory(null, request);

    expect(mocks.apiFetch).toHaveBeenCalledTimes(1);
    expect(mocks.apiFetch.mock.calls[0]?.[0]).toContain('/api/public/widget-user/tenant-history?');
    expect(mocks.apiFetch.mock.calls[0]?.[0]).toContain('widget_session_token=widget-session-token');
  });
});
