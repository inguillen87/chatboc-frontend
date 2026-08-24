import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildVerifiedSessionScopeKey,
  useSessionAuthority,
} from '@/components/access/SessionAuthorityContext';
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

interface ScopedPublicPortal {
  tenantKey: string;
  content: PortalContent;
  commerceSession: WidgetCommerceSession | null;
  widgetHistory: WidgetCommerceHistory | null;
  widgetCart: WidgetCommerceCartSnapshot | null;
}

interface ScopedPrivatePortal {
  scopeKey: string;
  content: PortalContent;
  bundle: PortalPremiumBundle | null;
}

interface ScopedRegistrationState {
  tenantKey: string;
  result: WidgetUserRegisterResponse | null;
  error: unknown;
}

const readFirstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

export function usePortalContent() {
  const { currentSlug, widgetToken } = useTenant();
  const { user } = useUser();
  const { hasVerifiedSession } = useSessionAuthority();
  const tenantKey = currentSlug?.trim().toLowerCase() || null;
  const privateScopeKey = buildVerifiedSessionScopeKey({
    hasVerifiedSession,
    tenantSlug: currentSlug,
    user,
  });
  const [privatePortal, setPrivatePortal] = useState<ScopedPrivatePortal | null>(null);
  const [publicPortal, setPublicPortal] = useState<ScopedPublicPortal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [registrationState, setRegistrationState] = useState<ScopedRegistrationState | null>(null);
  const fetchGenerationRef = useRef(0);
  const registrationGenerationRef = useRef(0);
  const activeScopeRef = useRef({ tenantKey, privateScopeKey });
  activeScopeRef.current = { tenantKey, privateScopeKey };

  const buildWidgetRequest = useCallback(
    (session?: WidgetCommerceSession | null): WidgetCommerceRequest => {
      const currentChatSessionId = getOrCreateChatSessionId();
      const adoptedChatSessionId =
        readFirstString(session?.session?.chat_session_id) ?? currentChatSessionId;
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
      return {
        session: null as WidgetCommerceSession | null,
        history: null as WidgetCommerceHistory | null,
        cart: null as WidgetCommerceCartSnapshot | null,
        content: EMPTY_PORTAL_CONTENT,
      };
    }

    const baseRequest = buildWidgetRequest(null);
    const session = await getWidgetCommerceSession(baseRequest).catch(() => null);
    const request: WidgetCommerceRequest = {
      ...baseRequest,
      chatSessionId:
        readFirstString(session?.session?.chat_session_id) ?? baseRequest.chatSessionId,
      widgetSessionToken: session?.session?.widget_session_token || null,
    };
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

    const resolvedPublicContent = buildPortalContentFromWidgetHistory(history, cart);

    return {
      session,
      history,
      cart,
      content: resolvedPublicContent,
    };
  }, [buildWidgetRequest, currentSlug]);

  const fetchContent = useCallback(async () => {
    const fetchGeneration = ++fetchGenerationRef.current;
    const fetchTenantKey = tenantKey;
    const fetchPrivateScopeKey = privateScopeKey;
    const isCurrentFetch = () =>
      fetchGenerationRef.current === fetchGeneration &&
      activeScopeRef.current.tenantKey === fetchTenantKey &&
      activeScopeRef.current.privateScopeKey === fetchPrivateScopeKey;

    if (!currentSlug || !fetchTenantKey) {
      setPrivatePortal(null);
      setPublicPortal(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const publicPortal = await fetchPublicPortal();
      if (!isCurrentFetch()) return;

      [publicPortal.session, publicPortal.history, publicPortal.cart].forEach((source) => {
        const chatSessionId = source?.session?.chat_session_id;
        if (chatSessionId) persistChatSessionId(chatSessionId);
      });
      setPublicPortal({
        tenantKey: fetchTenantKey,
        content: publicPortal.content,
        commerceSession: publicPortal.session,
        widgetHistory: publicPortal.history,
        widgetCart: publicPortal.cart,
      });

      if (!fetchPrivateScopeKey) {
        setPrivatePortal(null);
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
      if (!isCurrentFetch()) return;

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

      setPrivatePortal({
        scopeKey: fetchPrivateScopeKey,
        content: overlayPortalContent(baseContent, publicPortal.content),
        bundle: bundleResponse.status === 'fulfilled' ? bundleResponse.value : null,
      });
    } catch (err: any) {
      if (!isCurrentFetch()) return;
      console.warn('Failed to fetch portal content', err);
      setError(err);
      setPrivatePortal(null);
      setPublicPortal(null);
    } finally {
      if (isCurrentFetch()) setIsLoading(false);
    }
  }, [currentSlug, fetchPublicPortal, privateScopeKey, tenantKey]);

  const visiblePublicPortal = publicPortal?.tenantKey === tenantKey ? publicPortal : null;
  const visiblePrivatePortal =
    privateScopeKey && privatePortal?.scopeKey === privateScopeKey ? privatePortal : null;
  const commerceSession = visiblePublicPortal?.commerceSession ?? null;
  const widgetHistory = visiblePublicPortal?.widgetHistory ?? null;
  const widgetCart = visiblePublicPortal?.widgetCart ?? null;

  const registerWidgetProfile = useCallback(
    async (payload: WidgetUserRegisterPayload) => {
      if (!currentSlug || !tenantKey) return null;
      const registrationGeneration = ++registrationGenerationRef.current;
      const registrationTenantKey = tenantKey;
      const registrationSession = commerceSession;
      const isCurrentRegistration = () =>
        registrationGenerationRef.current === registrationGeneration &&
        activeScopeRef.current.tenantKey === registrationTenantKey;
      setRegistrationState({ tenantKey: registrationTenantKey, result: null, error: null });
      const request = buildWidgetRequest(registrationSession);
      try {
        const registerEndpoint = readFirstString(
          registrationSession?.portal?.register_endpoint,
          registrationSession?.history?.register_endpoint,
        );
        const result = await registerWidgetUser(request, payload, registerEndpoint);
        if (!isCurrentRegistration()) return null;
        setRegistrationState({ tenantKey: registrationTenantKey, result, error: null });
        if (result.session?.chat_session_id) {
          persistChatSessionId(result.session.chat_session_id);
        }

        if (result.status !== 'verification_required') {
          const linkEndpoint = readFirstString(
            registrationSession?.portal?.link_session_endpoint,
            registrationSession?.history?.link_session_endpoint,
          );
          const linkRequest: WidgetCommerceRequest = {
            ...request,
            chatSessionId:
              readFirstString(result.session?.chat_session_id) ?? request.chatSessionId,
            widgetSessionToken:
              result.session?.widget_session_token || request.widgetSessionToken,
          };
          await linkWidgetSession(linkRequest, {}, linkEndpoint).catch(() => null);
          if (!isCurrentRegistration()) return null;
          await fetchContent();
        }

        return result;
      } catch (err) {
        if (isCurrentRegistration()) {
          setRegistrationState({ tenantKey: registrationTenantKey, result: null, error: err });
        }
        throw err;
      }
    },
    [buildWidgetRequest, commerceSession, currentSlug, fetchContent, tenantKey],
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
  const registrationResult =
    registrationState?.tenantKey === tenantKey ? registrationState.result : null;
  const registrationError =
    registrationState?.tenantKey === tenantKey ? registrationState.error : null;
  const visibleContent =
    visiblePrivatePortal?.content ?? visiblePublicPortal?.content ?? EMPTY_PORTAL_CONTENT;

  return {
    content: visibleContent,
    bundle: visiblePrivatePortal?.bundle ?? null,
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
