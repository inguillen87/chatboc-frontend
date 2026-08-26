import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import AccessibilityToggle, {
  applyAccessibilityPrefs,
  readAccessibilityPrefs,
} from "@/components/chat/AccessibilityToggle";

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
  return normalizedPath === '/demo' || /^\/e\/[^/]+$/.test(normalizedPath);
}

export function AppAccessibility() {
  const location = useLocation();
  const hideDock = shouldHideDock(location.pathname);
  const publicTicketRoute = isPublicTicketRoute(location.pathname);
  const focusedPublicRoute = isFocusedPublicRoute(location.pathname);

  useEffect(() => {
    applyAccessibilityPrefs(readAccessibilityPrefs());
  }, []);

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
          <AccessibilityToggle compact className="chatboc-a11y-dock__button" />
        </div>
      ) : null}
    </>
  );
}
