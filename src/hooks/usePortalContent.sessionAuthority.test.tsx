import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePortalContent } from './usePortalContent';

const portalMocks = vi.hoisted(() => ({
  currentSlug: 'junin',
  user: null as null | { id: string; email?: string },
  authority: {
    clerkStatus: 'signed_out' as 'disabled' | 'loading' | 'signed_out' | 'syncing' | 'ready',
    hasBearerSession: false,
    hasVerifiedSession: false,
  },
  getWidgetCommerceSession: vi.fn(),
  getWidgetTenantHistory: vi.fn(),
  getWidgetCartSnapshot: vi.fn(),
  getPortalContent: vi.fn(),
  getPortalHistory: vi.fn(),
  getPortalNetworkFeed: vi.fn(),
  getPortalBenefits: vi.fn(),
  getPortalDashboard: vi.fn(),
  getPortalSurveysHistory: vi.fn(),
  getPortalPremiumBundle: vi.fn(),
  persistChatSessionId: vi.fn((value?: string | null) => value ?? null),
}));

const publicContent = {
  notifications: [],
  events: [],
  news: [{ id: 'public-news', title: 'Novedad pública' }],
  catalog: [],
  activities: [],
  surveys: [],
  loyaltySummary: null,
};

const privateContent = {
  notifications: [{ id: 'private-notification', title: 'Aviso privado', message: 'PII privada' }],
  events: [],
  news: [],
  catalog: [],
  activities: [{ id: 'private-activity', title: 'Actividad privada Persona Stale' }],
  surveys: [],
  loyaltySummary: {
    points: 999999,
    level: 'private',
    surveysCompleted: 1,
    suggestionsShared: 1,
    claimsFiled: 1,
  },
};

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: portalMocks.currentSlug, widgetToken: null }),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({ user: portalMocks.user }),
}));

vi.mock('@/components/access/SessionAuthorityContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/access/SessionAuthorityContext')>()),
  useSessionAuthority: () => portalMocks.authority,
}));

vi.mock('@/api/widgetCommerce', () => ({
  getWidgetCommerceSession: portalMocks.getWidgetCommerceSession,
  getWidgetTenantHistory: portalMocks.getWidgetTenantHistory,
  getWidgetCartSnapshot: portalMocks.getWidgetCartSnapshot,
  linkWidgetSession: vi.fn(),
  registerWidgetUser: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  apiClient: {
    getPortalContent: portalMocks.getPortalContent,
    getPortalHistory: portalMocks.getPortalHistory,
    getPortalNetworkFeed: portalMocks.getPortalNetworkFeed,
    getPortalBenefits: portalMocks.getPortalBenefits,
    getPortalDashboard: portalMocks.getPortalDashboard,
    getPortalSurveysHistory: portalMocks.getPortalSurveysHistory,
    getPortalPremiumBundle: portalMocks.getPortalPremiumBundle,
  },
}));

vi.mock('@/utils/widgetPortal', () => ({
  buildPortalContentFromWidgetHistory: (history: any) => history?.portalContent ?? publicContent,
  normalizeWidgetClaims: () => [],
  normalizeWidgetOrders: () => [],
  normalizeWidgetProfile: () => ({ name: '', email: '', phone: '', canRegister: false }),
  overlayPortalContent: (base: unknown) => base,
}));

vi.mock('@/utils/portalExperience', () => ({
  mergePortalExperience: (base: unknown) => base,
}));

vi.mock('@/utils/anonId', () => ({
  getOrCreateAnonId: () => 'anon-test',
}));

vi.mock('@/utils/chatSessionId', () => ({
  default: () => 'chat-session-test',
  persistChatSessionId: portalMocks.persistChatSessionId,
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
};

const expectNoPrivatePortalCalls = () => {
  expect(portalMocks.getPortalContent).not.toHaveBeenCalled();
  expect(portalMocks.getPortalHistory).not.toHaveBeenCalled();
  expect(portalMocks.getPortalNetworkFeed).not.toHaveBeenCalled();
  expect(portalMocks.getPortalBenefits).not.toHaveBeenCalled();
  expect(portalMocks.getPortalDashboard).not.toHaveBeenCalled();
  expect(portalMocks.getPortalSurveysHistory).not.toHaveBeenCalled();
  expect(portalMocks.getPortalPremiumBundle).not.toHaveBeenCalled();
};

describe('usePortalContent session authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portalMocks.currentSlug = 'junin';
    portalMocks.user = null;
    portalMocks.authority = {
      clerkStatus: 'signed_out',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
    portalMocks.getWidgetCommerceSession.mockResolvedValue({ session: {} });
    portalMocks.getWidgetTenantHistory.mockResolvedValue({});
    portalMocks.getWidgetCartSnapshot.mockResolvedValue(null);
    portalMocks.getPortalContent.mockResolvedValue(privateContent);
    portalMocks.getPortalHistory.mockResolvedValue(null);
    portalMocks.getPortalNetworkFeed.mockResolvedValue(null);
    portalMocks.getPortalBenefits.mockResolvedValue(null);
    portalMocks.getPortalDashboard.mockResolvedValue(null);
    portalMocks.getPortalSurveysHistory.mockResolvedValue(null);
    portalMocks.getPortalPremiumBundle.mockResolvedValue({
      member: { email: 'private-bundle@example.test' },
    });
  });

  it.each(['loading', 'signed_out'] as const)(
    'keeps private portal APIs at zero for a stale user while Clerk is %s',
    async (clerkStatus) => {
      portalMocks.user = { id: 'stale-user', email: 'stale-private@example.test' };
      portalMocks.authority = {
        clerkStatus,
        hasBearerSession: clerkStatus === 'loading',
        hasVerifiedSession: false,
      };

      const { result } = renderHook(() => usePortalContent());

      await waitFor(() => {
        expect(result.current.content.news).toEqual(publicContent.news);
      });
      expect(result.current.bundle).toBeNull();
      expectNoPrivatePortalCalls();
    },
  );

  it.each([
    {
      label: 'Clerk ready cookie-only',
      authority: { clerkStatus: 'ready' as const, hasBearerSession: false, hasVerifiedSession: true },
    },
    {
      label: 'verified legacy bearer',
      authority: { clerkStatus: 'disabled' as const, hasBearerSession: true, hasVerifiedSession: true },
    },
  ])('loads private content for $label and masks it synchronously if authority is lost', async ({ authority }) => {
    portalMocks.user = { id: 'verified-user', email: 'verified@example.test' };
    portalMocks.authority = authority;

    const { result, rerender } = renderHook(() => usePortalContent());

    await waitFor(() => {
      expect(result.current.content.notifications[0]?.title).toBe('Aviso privado');
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.bundle).toEqual({
      member: { email: 'private-bundle@example.test' },
    });

    act(() => {
      portalMocks.authority = {
        clerkStatus: 'signed_out',
        hasBearerSession: false,
        hasVerifiedSession: false,
      };
      rerender();
    });

    expect(result.current.content.news).toEqual(publicContent.news);
    expect(result.current.content.notifications).toEqual([]);
    expect(result.current.bundle).toBeNull();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('never re-exposes user A private state while authority transitions to user B', async () => {
    const userAContent = {
      ...privateContent,
      notifications: [{ id: 'private-a', title: 'Aviso privado A', message: 'PII A' }],
    };
    const userBContent = {
      ...privateContent,
      notifications: [{ id: 'private-b', title: 'Aviso privado B', message: 'PII B' }],
    };
    portalMocks.getPortalContent
      .mockResolvedValueOnce(userAContent)
      .mockResolvedValueOnce(userBContent);
    portalMocks.getPortalPremiumBundle
      .mockResolvedValueOnce({ member: { email: 'user-a@example.test' } })
      .mockResolvedValueOnce({ member: { email: 'user-b@example.test' } });
    portalMocks.user = { id: 'user-a', email: 'user-a@example.test' };
    portalMocks.authority = {
      clerkStatus: 'ready',
      hasBearerSession: false,
      hasVerifiedSession: true,
    };

    const { result, rerender } = renderHook(() => usePortalContent());
    await waitFor(() => {
      expect(result.current.content.notifications[0]?.title).toBe('Aviso privado A');
    });

    act(() => {
      portalMocks.authority = {
        clerkStatus: 'syncing',
        hasBearerSession: false,
        hasVerifiedSession: false,
      };
      rerender();
    });
    expect(result.current.content.notifications).toEqual([]);
    expect(result.current.bundle).toBeNull();

    act(() => {
      portalMocks.user = { id: 'user-b', email: 'user-b@example.test' };
      portalMocks.authority = {
        clerkStatus: 'ready',
        hasBearerSession: false,
        hasVerifiedSession: true,
      };
      rerender();
    });
    expect(result.current.content.notifications).toEqual([]);
    expect(result.current.bundle).toBeNull();

    await waitFor(() => {
      expect(result.current.content.notifications[0]?.title).toBe('Aviso privado B');
    });
    expect(result.current.bundle).toEqual({
      member: { email: 'user-b@example.test' },
    });
  });

  it('ignores a late tenant A public response and never persists its session over tenant B', async () => {
    const tenantASession = deferred<any>();
    portalMocks.user = null;
    portalMocks.currentSlug = 'tenant-a';
    portalMocks.authority = {
      clerkStatus: 'signed_out',
      hasBearerSession: false,
      hasVerifiedSession: false,
    };
    portalMocks.getWidgetCommerceSession.mockImplementation((request: any) => {
      if (request.tenantSlug === 'tenant-a') return tenantASession.promise;
      return Promise.resolve({
        session: { chat_session_id: 'chat-tenant-b', widget_session_token: 'widget-b' },
      });
    });
    portalMocks.getWidgetTenantHistory.mockImplementation((_endpoint: unknown, request: any) =>
      Promise.resolve({
        session: { chat_session_id: `history-${request.tenantSlug}` },
        portalContent: {
          ...publicContent,
          news: [{ id: request.tenantSlug, title: `Novedad ${request.tenantSlug}` }],
        },
      }),
    );

    const { result, rerender } = renderHook(() => usePortalContent());
    await waitFor(() => {
      expect(portalMocks.getWidgetCommerceSession).toHaveBeenCalledWith(
        expect.objectContaining({ tenantSlug: 'tenant-a' }),
      );
    });

    act(() => {
      portalMocks.currentSlug = 'tenant-b';
      rerender();
    });

    await waitFor(() => {
      expect(result.current.content.news[0]?.title).toBe('Novedad tenant-b');
      expect(result.current.commerceSession?.session?.chat_session_id).toBe('chat-tenant-b');
    });

    await act(async () => {
      tenantASession.resolve({
        session: { chat_session_id: 'chat-tenant-a', widget_session_token: 'widget-a' },
      });
      await tenantASession.promise;
    });
    await waitFor(() => {
      expect(portalMocks.getWidgetTenantHistory).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ tenantSlug: 'tenant-a' }),
      );
    });

    expect(result.current.content.news[0]?.title).toBe('Novedad tenant-b');
    expect(result.current.commerceSession?.session?.chat_session_id).toBe('chat-tenant-b');
    expect(portalMocks.persistChatSessionId).not.toHaveBeenCalledWith('chat-tenant-a');
    expect(portalMocks.persistChatSessionId).not.toHaveBeenCalledWith('history-tenant-a');
  });
});
