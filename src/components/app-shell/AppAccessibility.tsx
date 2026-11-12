import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import {
  getAccessibilityPreferences,
  updateAccessibilityPreferences,
} from '@/api/accessibilityPreferences';
import AccessibilityToggle, {
  ACCESSIBILITY_INTENT_EVENT,
  DEFAULT_ACCESSIBILITY_PREFS,
  applyAccessibilityPrefs,
  persistAccessibilityPrefs,
  readAccessibilityPrefs,
  type AccessibilityPreferenceIntent,
  type Prefs,
} from "@/components/chat/AccessibilityToggle";
import { isDisabilityAIAgentDemoPath } from '@/config/publicPresentationRoutes';
import { useUser } from '@/hooks/useUser';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

const DOCK_HIDDEN_SEGMENTS = new Set(["iframe", "integracion"]);
const PUBLIC_TICKET_SEGMENTS = new Set(["chat", "ticket"]);

function shouldHideDock(pathname: string) {
  return pathname
    .toLowerCase()
    .split("/")
    .filter(Boolean)
    .some((segment) => DOCK_HIDDEN_SEGMENTS.has(segment));
}

function isPublicTicketRoute(pathname: string) {
  return pathname
    .toLowerCase()
    .split("/")
    .filter(Boolean)
    .some((segment) => PUBLIC_TICKET_SEGMENTS.has(segment));
}

function isFocusedPublicRoute(pathname: string) {
  const normalizedPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return (
    normalizedPath === '/demo' ||
    /^\/e\/[^/]+$/.test(normalizedPath) ||
    isDisabilityAIAgentDemoPath(normalizedPath)
  );
}

function isAuthorityRejection(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error
    ? error.status : undefined;
  return status === 401 || status === 403
    || (error instanceof Error && error.message === 'accessibility_preferences_identity_mismatch');
}

export function AppAccessibility() {
  const location = useLocation();
  const { user } = useUser();
  const accountUserId = user?.id;
  type PreferenceSession = {
    userId: number | string;
    observed: Prefs;
    touched: Partial<Prefs>;
    hydrated: boolean;
    writing: boolean;
    pending: Prefs | null;
  };
  const sessionRef = useRef<PreferenceSession | null>(null);
  // Only fields explicitly edited in this anonymous session may cross login.
  const anonymousChoicesRef = useRef<Partial<Prefs>>({});
  const lastAccountRef = useRef<string | null>(safeLocalStorage.getItem('chatboc_accessibility_owner'));
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideDock = shouldHideDock(location.pathname);
  const publicTicketRoute = isPublicTicketRoute(location.pathname);
  const focusedPublicRoute = isFocusedPublicRoute(location.pathname);

  useEffect(() => {
    applyAccessibilityPrefs(readAccessibilityPrefs());
  }, []);

  const retireSession = useCallback((session: PreferenceSession) => {
    // A late failure from A cannot cancel B's current session or debounce.
    if (sessionRef.current !== session) return;
    session.pending = null;
    sessionRef.current = null;
    if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    updateTimerRef.current = null;
  }, []);

  // Serialize writes so an older save cannot land after the user's newer choice.
  const flushPreferences = useCallback(function flush(session: PreferenceSession) {
    if (sessionRef.current !== session || session.writing || !session.pending) return;
    const preferences = session.pending;
    session.pending = null;
    session.writing = true;
    void updateAccessibilityPreferences(session.userId, preferences)
      .catch((error: unknown) => {
        // Keep local choices, but stop this queue when its authority is gone.
        // Recoverable failures still allow a new explicit edit to request a save.
        if (isAuthorityRejection(error)) retireSession(session);
      })
      .finally(() => {
        session.writing = false;
        if (sessionRef.current === session && session.pending) flush(session);
      });
  }, [retireSession]);

  useEffect(() => {
    if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    updateTimerRef.current = null;
    sessionRef.current = null;
    if (accountUserId === undefined) {
      anonymousChoicesRef.current = {};
      return undefined;
    }

    const expectedUserId = String(accountUserId);
    const localPreferences = readAccessibilityPrefs();
    // An unowned/migrated cache is presentation only. It cannot initialize
    // another account. A known account may retain its own cached choices.
    const initialPreferences = lastAccountRef.current === expectedUserId
      ? localPreferences
      : DEFAULT_ACCESSIBILITY_PREFS;
    const anonymousChoices = anonymousChoicesRef.current;
    anonymousChoicesRef.current = {};
    const session: PreferenceSession = {
      userId: accountUserId, observed: localPreferences, touched: { ...anonymousChoices },
      hydrated: false, writing: false, pending: null,
    };
    sessionRef.current = session;
    void getAccessibilityPreferences(accountUserId)
      .then((contract) => {
        if (sessionRef.current !== session) return;
        const preferences = {
          ...(contract.initialized ? contract.preferences : initialPreferences),
          ...session.touched,
        };
        // Mark the merged snapshot before broadcasting it. Hydration itself
        // is not a user edit when AccessibilityToggle reports the new state.
        session.observed = preferences;
        session.hydrated = true;
        lastAccountRef.current = expectedUserId;
        safeLocalStorage.setItem('chatboc_accessibility_owner', expectedUserId);
        persistAccessibilityPrefs(preferences);
        if (!contract.initialized || Object.keys(session.touched).length > 0) {
          session.pending = preferences;
          flushPreferences(session);
        }
      })
      .catch((error: unknown) => {
        // The real editors keep local preferences functional independently.
        if (isAuthorityRejection(error)) retireSession(session);
      });

    return () => {
      if (sessionRef.current === session) sessionRef.current = null;
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    };
  }, [accountUserId, flushPreferences, retireSession]);

  useEffect(() => {
    const handlePreferenceIntent = (event: Event) => {
      const intent = (event as CustomEvent<AccessibilityPreferenceIntent>).detail;
      if (!intent || typeof intent.key !== 'string' || typeof intent.value !== 'boolean'
        || !Object.prototype.hasOwnProperty.call(DEFAULT_ACCESSIBILITY_PREFS, intent.key)) return;
      if (accountUserId === undefined) {
        anonymousChoicesRef.current[intent.key] = intent.value;
        persistAccessibilityPrefs({ ...readAccessibilityPrefs(), [intent.key]: intent.value });
        return;
      }
      const session = sessionRef.current;
      if (!session || String(session.userId) !== String(accountUserId)) return;
      const preferences = { ...session.observed, [intent.key]: intent.value };
      session.touched[intent.key] = intent.value;
      session.observed = preferences;
      // Apply the merged fields to every real editor immediately. A pending
      // render of another editor must not replace untouched server fields.
      persistAccessibilityPrefs(preferences);
      if (!session.hydrated) return;
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = setTimeout(() => {
        if (sessionRef.current !== session) return;
        session.pending = preferences;
        flushPreferences(session);
      }, 350);
    };
    window.addEventListener(ACCESSIBILITY_INTENT_EVENT, handlePreferenceIntent);
    return () => window.removeEventListener(ACCESSIBILITY_INTENT_EVENT, handlePreferenceIntent);
  }, [accountUserId, flushPreferences]);

  return (
    <>
      <a className="chatboc-skip-link" href="#main-content">
        Saltar al contenido principal
      </a>
      {!hideDock ? (
        <div
          className={`chatboc-a11y-dock${
            publicTicketRoute ? " chatboc-a11y-dock--public-ticket" : ""
          }${
            focusedPublicRoute ? " chatboc-a11y-dock--focused-public" : ""
          }`}
          role="region"
          aria-label="Accesibilidad de la plataforma"
        >
          <AccessibilityToggle
            compact
            className="chatboc-a11y-dock__button"
          />
        </div>
      ) : null}
    </>
  );
}
