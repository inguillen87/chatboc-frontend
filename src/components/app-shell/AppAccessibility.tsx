import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import AccessibilityToggle, {
  applyAccessibilityPrefs,
  readAccessibilityPrefs,
} from "@/components/chat/AccessibilityToggle";

const DOCK_HIDDEN_SEGMENTS = new Set(["iframe", "integracion"]);

function shouldHideDock(pathname: string) {
  return pathname
    .toLowerCase()
    .split("/")
    .filter(Boolean)
    .some((segment) => DOCK_HIDDEN_SEGMENTS.has(segment));
}

export function AppAccessibility() {
  const location = useLocation();
  const hideDock = shouldHideDock(location.pathname);

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
          className="chatboc-a11y-dock"
          role="region"
          aria-label="Accesibilidad de la plataforma"
        >
          <AccessibilityToggle compact className="chatboc-a11y-dock__button" />
        </div>
      ) : null}
    </>
  );
}
