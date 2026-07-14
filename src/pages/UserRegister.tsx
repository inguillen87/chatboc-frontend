import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatUserRegisterPanel from "@/components/chat/ChatUserRegisterPanel";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";
import type { Role } from "@/utils/roles";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getSafeAuthNextPath } from "@/utils/authRedirect";
import { resolvePortalAuthTenantSlug, sanitizeClerkReturnPath } from "@/utils/clerkAuthContext";

const sanitizePortalReturnTo = (value?: string | null) => {
  const safePath = sanitizeClerkReturnPath(value);
  if (!safePath) return null;

  const pathOnly = safePath.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  const isPortalAuthRoute =
    /^\/user\/(?:login|register)$/i.test(pathOnly) ||
    /^\/(?:t|portal)\/[^/]+\/user\/(?:login|register)$/i.test(pathOnly);

  return isPortalAuthRoute ? null : safePath;
};

const appendNext = (path: string, next: string | null) =>
  next ? `${path}?next=${encodeURIComponent(next)}` : path;

const UserRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { widgetToken, currentSlug } = useTenant();

  const effectiveTenantSlug = useMemo(
    () => resolvePortalAuthTenantSlug({
      pathname: location.pathname,
      search: location.search,
      currentSlug,
      hasWidgetToken: Boolean(widgetToken),
    }),
    [currentSlug, location.pathname, location.search, widgetToken],
  );

  const requestedStateRedirect = (location.state as { redirectTo?: string } | null)?.redirectTo;
  const redirectTo = useMemo(
    () =>
      sanitizePortalReturnTo(requestedStateRedirect) ||
      sanitizePortalReturnTo(getSafeAuthNextPath(location.search)),
    [location.search, requestedStateRedirect],
  );
  const defaultDashboard = buildTenantPath("/portal/dashboard", effectiveTenantSlug);
  const returnTo = redirectTo || defaultDashboard;
  const loginPath = appendNext(
    buildTenantPath("/user/login", effectiveTenantSlug),
    redirectTo,
  );

  return (
    <ErrorBoundary fallbackMessage="Ocurrió un problema al cargar el formulario de registro. Por favor, intente recargar la página o deshabilitar extensiones del navegador que puedan interferir.">
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
        <ChatUserRegisterPanel
          onSuccess={(rol?: Role) => {
            if (redirectTo) {
              navigate(redirectTo);
              return;
            }
            if (rol === "admin" || rol === "empleado") {
              navigate("/perfil");
            } else {
              navigate(defaultDashboard);
            }
          }}
          onShowLogin={() =>
            navigate(loginPath, {
              state: redirectTo ? { redirectTo } : undefined,
            })
          }
          entityToken={widgetToken ?? undefined}
          tenantSlug={effectiveTenantSlug}
          returnTo={returnTo}
        />
      </div>
    </ErrorBoundary>
  );
};

export default UserRegister;
