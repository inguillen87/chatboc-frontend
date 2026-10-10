import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useCapabilities } from '@/context/CapabilitiesContext';
import { useUser } from '@/hooks/useUser';
import { hasRequiredRole, normalizeRole } from '@/utils/roles';
import { ViewState } from '@/components/app-shell/ViewState';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { Button } from '@/components/ui/button';
import { TenantHostPrivateScope } from '@/components/tenant/TenantHostPrivateScope';

interface AccessRouteProps {
  children: React.ReactElement;
  roles?: string[];
  requiredCapabilities?: string[];
  requiredAllCapabilities?: string[];
  /** Use a fresh /api/me grant, including for administrator roles. */
  enforceCapabilities?: boolean;
}

const readStoredUser = () => {
  try {
    const raw = safeLocalStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const AccessRoute: React.FC<AccessRouteProps> = ({
  children,
  roles,
  requiredCapabilities,
  requiredAllCapabilities,
  enforceCapabilities = false,
}) => {
  const { user, loading, organizationProfileVerified, refreshUser } = useUser();
  const { capabilities = [], hasAllCapabilities, hasAnyCapability } = useCapabilities();
  const location = useLocation();
  const [profileSyncGrace, setProfileSyncGrace] = useState(true);
  const [verificationGrace, setVerificationGrace] = useState(true);
  const storedUser = readStoredUser();
  const effectiveUser = user ?? (enforceCapabilities ? null : storedUser);
  const hasSession = Boolean(
    safeLocalStorage.getItem('authToken') ||
    safeLocalStorage.getItem('chatAuthToken') ||
    safeLocalStorage.getItem('authProvider')?.trim().toLowerCase() === 'clerk',
  );

  useEffect(() => {
    if (!hasSession || effectiveUser) {
      setProfileSyncGrace(false);
      return;
    }
    const timer = window.setTimeout(() => setProfileSyncGrace(false), 8000);
    return () => window.clearTimeout(timer);
  }, [effectiveUser, hasSession]);

  useEffect(() => {
    if (!enforceCapabilities || organizationProfileVerified) {
      setVerificationGrace(false);
      return;
    }
    const timer = window.setTimeout(() => setVerificationGrace(false), 8000);
    return () => window.clearTimeout(timer);
  }, [enforceCapabilities, organizationProfileVerified]);

  if (enforceCapabilities && !organizationProfileVerified) {
    if (loading || verificationGrace) return <ViewState status="loading" title="Validando acceso" />;
    return <ViewState status="error" title="No pudimos validar el acceso"
      action={<Button variant="outline" onClick={() => void refreshUser()}>Reintentar</Button>} />;
  }

  if ((loading && !effectiveUser) || (hasSession && !effectiveUser && profileSyncGrace)) {
    return <ViewState status="loading" title="Validando acceso" />;
  }

  const role = normalizeRole(effectiveUser?.rol);
  const isSuperadmin = hasRequiredRole(effectiveUser?.rol, ['superadmin']);
  const isTenantAdmin = hasRequiredRole(effectiveUser?.rol, ['tenant_admin']);
  const hasAnyRequiredCapability = Boolean(
    requiredCapabilities?.length && hasAnyCapability(requiredCapabilities),
  );
  const hasEveryRequiredCapability = Boolean(
    requiredAllCapabilities?.length && hasAllCapabilities(requiredAllCapabilities),
  );
  const hasCapabilityRouteGrant = hasAnyRequiredCapability || hasEveryRequiredCapability;

  if (roles && roles.length > 0) {
    if (!hasRequiredRole(effectiveUser?.rol, roles) && !hasCapabilityRouteGrant) {
      return (
        <Navigate
          to="/403"
          replace
          state={{
            reason: 'role',
            requiredRoles: roles,
            currentRole: role,
            from: location.pathname,
          }}
        />
      );
    }
  }

  if (isSuperadmin && !enforceCapabilities) {
    return <TenantHostPrivateScope>{children}</TenantHostPrivateScope>;
  }

  const hasDeclaredCapabilities = capabilities.length > 0;

  if (
    requiredAllCapabilities &&
    requiredAllCapabilities.length > 0 &&
    (enforceCapabilities || !isTenantAdmin) &&
    !hasAllCapabilities(requiredAllCapabilities)
  ) {
    return (
      <Navigate
        to="/403"
        replace
        state={{
          reason: 'capability',
          requiredCapabilities: requiredAllCapabilities,
          from: location.pathname,
        }}
      />
    );
  }

  if (
    requiredCapabilities &&
    requiredCapabilities.length > 0 &&
    (enforceCapabilities || hasDeclaredCapabilities) &&
    (enforceCapabilities || !isTenantAdmin) &&
    !hasAnyCapability(requiredCapabilities)
  ) {
    return (
      <Navigate
        to="/403"
        replace
        state={{
          reason: 'capability',
          requiredCapabilities,
          from: location.pathname,
        }}
      />
    );
  }

  return <TenantHostPrivateScope>{children}</TenantHostPrivateScope>;
};

export default AccessRoute;
