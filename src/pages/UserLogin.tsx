import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatUserLoginPanel from "@/components/chat/ChatUserLoginPanel";
import { useTenant } from "@/context/TenantContext";
import { buildTenantPath } from "@/utils/tenantPaths";
import type { Role } from "@/utils/roles";
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

const UserLogin = () => {
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
  const registerPath = appendNext(
    buildTenantPath("/user/register", effectiveTenantSlug),
    redirectTo,
  );

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-background via-card to-muted text-foreground">
      <ChatUserLoginPanel
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
        onShowRegister={() =>
          navigate(registerPath, {
            state: redirectTo ? { redirectTo } : undefined,
          })
        }
        entityToken={widgetToken ?? undefined}
        tenantSlug={effectiveTenantSlug}
        returnTo={returnTo}
      />
    </div>
  );
};

export default UserLogin;
