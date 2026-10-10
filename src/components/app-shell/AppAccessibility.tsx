import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import {
  getAccessibilityPreferences,
  updateAccessibilityPreferences,
} from '@/api/accessibilityPreferences';
import AccessibilityToggle, {
  applyAccessibilityPrefs,
  persistAccessibilityPrefs,
  readAccessibilityPrefs,
  type Prefs,
} from "@/components/chat/AccessibilityToggle";
import { isDisabilityAIAgentDemoPath } from '@/config/publicPresentationRoutes';
import { useUser } from '@/hooks/useUser';

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

export function AppAccessibility() {
  const location = useLocation();
  const { user } = useUser();
  const accountUserId = user?.id;
  const syncGenerationRef = useRef(0);
  const hydratedUserIdRef = useRef<string | null>(null);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideDock = shouldHideDock(location.pathname);
  const publicTicketRoute = isPublicTicketRoute(location.pathname);
  const focusedPublicRoute = isFocusedPublicRoute(location.pathname);

  useEffect(() => {
    applyAccessibilityPrefs(readAccessibilityPrefs());
  }, []);

  useEffect(() => {
    const generation = ++syncGenerationRef.current;
    hydratedUserIdRef.current = null;
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }
    if (accountUserId === undefined) return undefined;

    const expectedUserId = String(accountUserId);
    const localPreferences = readAccessibilityPrefs();
    void getAccessibilityPreferences(accountUserId)
      .then(async (contract) => {
        if (generation !== syncGenerationRef.current) return;
        if (contract.initialized) {
          persistAccessibilityPrefs(contract.preferences);
        } else {
          await updateAccessibilityPreferences(accountUserId, localPreferences);
          if (generation !== syncGenerationRef.current) return;
        }
        hydratedUserIdRef.current = expectedUserId;
      })
      .catch(() => {
        // Local preferences remain fully functional when account sync is unavailable.
      });

    return () => {
      syncGenerationRef.current += 1;
      hydratedUserIdRef.current = null;
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [accountUserId]);

  const handlePreferenceChange = useCallback((preferences: Prefs) => {
    if (
      accountUserId === undefined
      || hydratedUserIdRef.current !== String(accountUserId)
    ) return;
    if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    const expectedGeneration = syncGenerationRef.current;
    updateTimerRef.current = setTimeout(() => {
      if (
        expectedGeneration !== syncGenerationRef.current
        || hydratedUserIdRef.current !== String(accountUserId)
      ) return;
      void updateAccessibilityPreferences(accountUserId, preferences).catch(() => {
        // The next preference change or authenticated session retries synchronization.
      });
    }, 350);
  }, [accountUserId]);

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
            onChange={handlePreferenceChange}
          />
        </div>
      ) : null}
    </>
  );
}
