import React from "react";
import { Navigate, useLocation } from "react-router-dom";

import { ViewState } from "@/components/app-shell/ViewState";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { normalizeRole } from "@/utils/roles";

import OperationsDashboardPage from "./OperationsDashboardPage";
import { OperationsDashboardPanel } from "./OperationsDashboardPanel";

const AdvancedAnalyticsPage = React.lazy(
  () => import("@/pages/analytics/AnalyticsPage"),
);
const AdvancedAnalyticsHubPage = React.lazy(() => import("./AnalyticsHubPage"));

export type AnalyticsAccessMode = "advanced" | "operations" | "denied";

export const resolveAnalyticsAccessMode = (
  role?: string | null,
): AnalyticsAccessMode => {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "employee") return "operations";
  if (
    ["tenant_admin", "superadmin", "analytics_viewer"].includes(normalizedRole)
  )
    return "advanced";
  return "denied";
};

const readStoredRole = (): string | null => {
  try {
    const rawUser = safeLocalStorage.getItem("user");
    if (!rawUser) return null;
    const storedUser = JSON.parse(rawUser) as { rol?: unknown; role?: unknown };
    const role = storedUser.rol ?? storedUser.role;
    return typeof role === "string" && role.trim() ? role.trim() : null;
  } catch {
    return null;
  }
};

interface AnalyticsAccessPageProps {
  embedded?: boolean;
  variant?: "dashboard" | "hub";
}

type AuthoritativeAccessState =
  | { status: "idle" | "loading" }
  | { status: "resolved"; mode: AnalyticsAccessMode }
  | { status: "error" };

/**
 * Keeps operational staff on the scoped operations contract. Tenant-wide
 * analytics is mounted only for roles that can read the complete tenant view.
 */
export default function AnalyticsAccessPage({
  embedded = false,
  variant = "dashboard",
}: AnalyticsAccessPageProps) {
  const { user, loading } = useUser();
  const location = useLocation();
  const liveRole = user?.rol ?? user?.role ?? null;
  const storedRole = readStoredRole();
  const liveAccessMode = resolveAnalyticsAccessMode(liveRole);
  const storedAccessMode = resolveAnalyticsAccessMode(storedRole);
  const canDegradeToOperations =
    liveAccessMode === "operations" || storedAccessMode === "operations";
  const profileIdentity = user?.id ?? user?.email ?? null;
  const [authoritativeAccess, setAuthoritativeAccess] =
    React.useState<AuthoritativeAccessState>({ status: "idle" });

  React.useEffect(() => {
    if (loading) {
      setAuthoritativeAccess({ status: "idle" });
      return;
    }

    let cancelled = false;
    setAuthoritativeAccess({ status: "loading" });

    void apiFetch<{ rol?: unknown; role?: unknown }>("/api/me", {
      preserveAuthOn401: true,
      suppressPanel401Redirect: true,
      omitEntityToken: true,
      omitTenant: true,
    })
      .then((profile) => {
        if (cancelled) return;
        const authoritativeRole = profile?.rol ?? profile?.role;
        setAuthoritativeAccess({
          status: "resolved",
          mode: resolveAnalyticsAccessMode(
            typeof authoritativeRole === "string" ? authoritativeRole : null,
          ),
        });
      })
      .catch(() => {
        if (!cancelled) setAuthoritativeAccess({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [loading, profileIdentity]);

  const operationsView = embedded ? (
    <OperationsDashboardPanel />
  ) : (
    <OperationsDashboardPage />
  );

  if (loading) {
    return canDegradeToOperations ? (
      operationsView
    ) : (
      <ViewState status="loading" title="Validando acceso a métricas" />
    );
  }

  if (
    authoritativeAccess.status === "idle" ||
    authoritativeAccess.status === "loading"
  ) {
    return canDegradeToOperations ? (
      operationsView
    ) : (
      <ViewState status="loading" title="Validando acceso a métricas" />
    );
  }

  if (authoritativeAccess.status === "error") {
    return canDegradeToOperations ? (
      operationsView
    ) : (
      <ViewState
        status="error"
        title="No pudimos validar el acceso a analítica"
        description="Actualiza la página para reintentar la validación segura de tu perfil."
      />
    );
  }

  if (authoritativeAccess.mode === "operations") {
    return operationsView;
  }

  if (authoritativeAccess.mode === "advanced") {
    return variant === "hub" ? (
      <AdvancedAnalyticsHubPage />
    ) : (
      <AdvancedAnalyticsPage />
    );
  }

  if (embedded) {
    return (
      <ViewState
        status="denied"
        title="Analítica no habilitada"
        description="Solicita a un administrador el acceso correspondiente para consultar este modulo."
      />
    );
  }

  return (
    <Navigate
      to="/403"
      replace
      state={{
        reason: "role",
        requiredRoles: [
          "tenant_admin",
          "employee",
          "superadmin",
          "analytics_viewer",
        ],
        currentRole: normalizeRole(liveRole),
        from: location.pathname,
      }}
    />
  );
}
