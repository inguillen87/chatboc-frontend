import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { apiClient } from '@/api/client';
import {
  getWidgetCartSnapshot,
  getWidgetCommerceSession,
  getWidgetTenantHistory,
  linkWidgetSession,
  registerWidgetUser,
  type WidgetCommerceRequest,
} from '@/api/widgetCommerce';
import type { PortalContent, PortalPremiumBundle } from '@/types/unified';
import type {
  WidgetCommerceCartSnapshot,
  WidgetCommerceHistory,
  WidgetCommerceSession,
  WidgetUserRegisterPayload,
  WidgetUserRegisterResponse,
} from '@/types/widgetCommerce';
import { mergePortalExperience } from '@/utils/portalExperience';
import {
  buildPortalContentFromWidgetHistory,
  normalizeWidgetClaims,
  normalizeWidgetOrders,
  normalizeWidgetProfile,
  overlayPortalContent,
} from '@/utils/widgetPortal';
import { getOrCreateAnonId } from '@/utils/anonId';
import getOrCreateChatSessionId, { persistChatSessionId } from '@/utils/chatSessionId';

const EMPTY_PORTAL_CONTENT: PortalContent = {
  notifications: [],
  events: [],
  news: [],
  catalog: [],
  activities: [],
  surveys: [],
  loyaltySummary: null,
};

const readFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

export function usePortalContent() {
  const { currentSlug, widgetToken } = useTenant();
  const { user } = useUser();
  const [content, setContent] = useState<PortalContent>(EMPTY_PORTAL_CONTENT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [bundle, setBundle] = useState<PortalPremiumBundle | null>(null);
  const [commerceSession, setCommerceSession] = useState<WidgetCommerceSession | null>(null);
  const [widgetHistory, setWidgetHistory] = useState<WidgetCommerceHistory | null>(null);
  const [widgetCart, setWidgetCart] = useState<WidgetCommerceCartSnapshot | null>(null);
  const [registrationResult, setRegistrationResult] = useState<WidgetUserRegisterResponse | null>(null);
  const [registrationError, setRegistrationError] = useState<unknown>(null);

  const buildWidgetRequest = useCallback(
    (session?: WidgetCommerceSession | null): WidgetCommerceRequest => {
      const currentChatSessionId = getOrCreateChatSessionId();
      const adoptedChatSessionId = persistChatSessionId(session?.session?.chat_session_id) ?? currentChatSessionId;
      return {
        tenantSlug: currentSlug,
        widgetToken,
        chatSessionId: adoptedChatSessionId,
        anonId: getOrCreateAnonId(),
        widgetSessionToken: session?.session?.widget_session_token || null,
      };
    },
    [currentSlug, widgetToken],
  );

  const fetchPublicPortal = useCallback(async () => {
    if (!currentSlug) {
      setCommerceSession(null);
      setWidgetHistory(null);
      setWidgetCart(null);
      return {
        session: null as WidgetCommerceSession | null,
        history: null as WidgetCommerceHistory | null,
        cart: null as WidgetCommerceCartSnapshot | null,
        content: EMPTY_PORTAL_CONTENT,
      };
    }

    const baseRequest = buildWidgetRequest(null);
    const session = await getWidgetCommerceSession(baseRequest).catch(() => null);
    if (session?.session?.chat_session_id) {
      persistChatSessionId(session.session.chat_session_id);
    }
    const request = buildWidgetRequest(session);
    const historyEndpoint = readFirstString(
      session?.portal?.history_endpoint,
      session?.history?.history_endpoint,
      session?.history?.endpoint,
    );
    const cartEndpoint = readFirstString(
      session?.cart?.summary_endpoint,
      session?.cart?.items_endpoint,
      session?.cart?.endpoint,
    );

    const shouldFetchCart = session?.cart?.enabled !== false;
    const [historyResponse, cartResponse] = await Promise.allSettled([
      getWidgetTenantHistory(historyEndpoint, request),
      shouldFetchCart ? getWidgetCartSnapshot(cartEndpoint, request) : Promise.resolve(null),
    ]);

    const history = historyResponse.status === 'fulfilled' ? historyResponse.value : null;
    const cart = cartResponse.status === 'fulfilled' ? cartResponse.value : null;
    if (history?.session?.chat_session_id) {
      persistChatSessionId(history.session.chat_session_id);
    }
    if (cart?.session?.chat_session_id) {
      persistChatSessionId(cart.session.chat_session_id);
    }

    setCommerceSession(session);
    setWidgetHistory(history);
    setWidgetCart(cart);

    return {
      session,
      history,
      cart,
      content: buildPortalContentFromWidgetHistory(history, cart),
    };
  }, [buildWidgetRequest, currentSlug]);

  const fetchContent = useCallback(async () => {
    if (!currentSlug) {
      setContent(EMPTY_PORTAL_CONTENT);
      setBundle(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const publicPortal = await fetchPublicPortal();

      if (!user) {
        setContent(publicPortal.content);
        setBundle(null);
        return;
      }

      const includeNetwork = true;
      const [
        contentResponse,
        historyResponse,
        feedResponse,
        benefitsResponse,
        dashboardResponse,
        surveysResponse,
        bundleResponse,
      ] = await Promise.allSettled([
        apiClient.getPortalContent(currentSlug),
        apiClient.getPortalHistory(currentSlug, includeNetwork),
        apiClient.getPortalNetworkFeed(currentSlug),
        apiClient.getPortalBenefits(currentSlug),
        apiClient.getPortalDashboard(currentSlug, includeNetwork),
        apiClient.getPortalSurveysHistory(currentSlug, includeNetwork),
        apiClient.getPortalPremiumBundle(currentSlug),
      ]);

      const baseContent =
        contentResponse.status === 'fulfilled'
          ? mergePortalExperience(
              contentResponse.value,
              historyResponse.status === 'fulfilled' ? historyResponse.value : null,
              feedResponse.status === 'fulfilled' ? feedResponse.value : null,
              benefitsResponse.status === 'fulfilled' ? benefitsResponse.value : null,
              dashboardResponse.status === 'fulfilled' ? dashboardResponse.value : null,
              surveysResponse.status === 'fulfilled' ? surveysResponse.value : null,
            )
          : EMPTY_PORTAL_CONTENT;

      setContent(overlayPortalContent(baseContent, publicPortal.content));
      setBundle(bundleResponse.status === 'fulfilled' ? bundleResponse.value : null);
    } catch (err: any) {
      console.warn('Failed to fetch portal content', err);
      setError(err);
      setContent(EMPTY_PORTAL_CONTENT);
      setBundle(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentSlug, fetchPublicPortal, user]);

  const registerWidgetProfile = useCallback(
    async (payload: WidgetUserRegisterPayload) => {
      if (!currentSlug) return null;
      setRegistrationError(null);
      const request = buildWidgetRequest(commerceSession);
      try {
        const registerEndpoint = readFirstString(
          commerceSession?.portal?.register_endpoint,
          commerceSession?.history?.register_endpoint,
        );
        const result = await registerWidgetUser(request, payload, registerEndpoint);
        setRegistrationResult(result);
        if (result.session?.chat_session_id) {
          persistChatSessionId(result.session.chat_session_id);
        }

        if (result.status !== 'verification_required') {
          const linkEndpoint = readFirstString(
            commerceSession?.portal?.link_session_endpoint,
            commerceSession?.history?.link_session_endpoint,
          );
          await linkWidgetSession(buildWidgetRequest(commerceSession), {}, linkEndpoint).catch(() => null);
          await fetchContent();
        }

        return result;
      } catch (err) {
        setRegistrationError(err);
        throw err;
      }
    },
    [buildWidgetRequest, commerceSession, currentSlug, fetchContent],
  );

  useEffect(() => {
    if (currentSlug) {
      fetchContent();
    }
  }, [currentSlug, fetchContent, user]);

  const publicClaims = useMemo(() => normalizeWidgetClaims(widgetHistory), [widgetHistory]);
  const publicOrders = useMemo(() => normalizeWidgetOrders(widgetHistory), [widgetHistory]);
  const publicProfile = useMemo(
    () => normalizeWidgetProfile(widgetHistory, commerceSession),
    [commerceSession, widgetHistory],
  );

  return {
    content,
    bundle,
    commerceSession,
    widgetHistory,
    widgetCart,
    publicClaims,
    publicOrders,
    publicProfile,
    registrationResult,
    registrationError,
    registerWidgetProfile,
    isLoading,
    isDemo: false,
    error,
    refetch: fetchContent,
  };
}
