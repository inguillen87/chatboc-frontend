import React from 'react';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import GovernmentJurisdictionReadinessPanel from '@/components/implementation/GovernmentJurisdictionReadinessPanel';
import GovernmentMesaUnicaLaunchPanel from '@/components/implementation/GovernmentMesaUnicaLaunchPanel';
import TenantBlueprintProvisioningPanel from '@/components/implementation/TenantBlueprintProvisioningPanel';
import TenantProvisioningReadinessPanel from '@/components/implementation/TenantProvisioningReadinessPanel';
import ChannelActivationChecklist from '@/components/profile/ChannelActivationChecklist';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { normalizeRole } from '@/utils/roles';
import {
  activationAuthorizesTenant,
  normalizeProfileTenantSlug,
  readExplicitTenantRequest,
} from '@/utils/profileTenantAuthority';

const TenantImplementationCenterPage = () => {
  const [searchParams] = useSearchParams();
  const { currentSlug, tenant } = useTenant();
  const { user, loading } = useUser();
  const [activationRevision, setActivationRevision] = React.useState(0);
  const [blueprintRefreshRevision, setBlueprintRefreshRevision] = React.useState(0);
  const [blueprintApplied, setBlueprintApplied] = React.useState(false);

  const explicitTenantRequest = React.useMemo(
    () => readExplicitTenantRequest(searchParams),
    [searchParams],
  );
  const contextTenantSlug = normalizeProfileTenantSlug(currentSlug);
  const sessionTenantSlug = normalizeProfileTenantSlug(
    user?.tenant_slug || user?.tenantSlug || user?.tenant?.slug || user?.tenant?.tenant_slug,
  );
  const tenantSlug = explicitTenantRequest.present
    ? explicitTenantRequest.slug
    : contextTenantSlug || sessionTenantSlug;
  const requestIsInvalid = explicitTenantRequest.present
    && (!explicitTenantRequest.valid || !explicitTenantRequest.slug);
  const initialActivation = activationAuthorizesTenant(user?.channel_activation, tenantSlug)
    ? user?.channel_activation
    : null;
  const contextMatchesScope = Boolean(
    tenantSlug && contextTenantSlug && tenantSlug === contextTenantSlug,
  );
  const tenantLabel = initialActivation?.tenant?.nombre
    || (contextMatchesScope ? tenant?.nombre : null)
    || tenantSlug;
  const profileHref = tenantSlug
    ? `/perfil?tenant_slug=${encodeURIComponent(tenantSlug)}`
    : '/perfil';
  const implementationReturnTo = tenantSlug
    ? `/implementacion?tenant_slug=${encodeURIComponent(tenantSlug)}`
    : '/implementacion';
  const normalizedUserRole = normalizeRole(user?.rol || user?.role);
  const canApplyBlueprint = normalizedUserRole === 'superadmin';
  const canSubmitJurisdictionEvidence = normalizedUserRole === 'tenant_admin';
  const canReviewJurisdictionEvidence = normalizedUserRole === 'superadmin';
  const handleBlueprintApplied = React.useCallback(() => {
    setActivationRevision((value) => value + 1);
  }, []);
  const handleGovernmentLaunchApplied = React.useCallback(() => {
    setBlueprintRefreshRevision((value) => value + 1);
    setActivationRevision((value) => value + 1);
  }, []);
  const handleBlueprintApplicationStateChange = React.useCallback((applied: boolean, blueprintId: string) => {
    if (blueprintId === 'government-core') setBlueprintApplied(applied);
  }, []);

  React.useEffect(() => {
    setBlueprintApplied(false);
  }, [tenantSlug]);

  if (loading && !tenantSlug && !requestIsInvalid) {
    return (
      <section className="mx-auto w-full max-w-6xl py-8" aria-live="polite">
        <div className="rounded-2xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
          Validando el espacio de trabajo…
        </div>
      </section>
    );
  }

  if (requestIsInvalid || !tenantSlug) {
    return (
      <section className="mx-auto w-full max-w-3xl py-8">
        <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">No pudimos validar el espacio de trabajo</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Volvé al perfil institucional y elegí una organización autorizada antes de continuar.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/perfil">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al perfil
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 py-6">
      <EnterprisePageHeader
        badge="Implementación"
        title="Preparar la organización para operar"
        description="Marca, equipo, contenido, canales y controles de salida en un recorrido institucional reutilizable."
        meta={`Contexto de trabajo: ${tenantLabel || tenantSlug}`}
        actions={(
          <Button asChild variant="outline">
            <Link to={profileHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al centro de control
            </Link>
          </Button>
        )}
      />

      <TenantProvisioningReadinessPanel tenantSlug={tenantSlug} />

      <div id="configuracion-base" className="scroll-mt-24">
        <TenantBlueprintProvisioningPanel
          tenantSlug={tenantSlug}
          canApply={canApplyBlueprint}
          compactWhenApplied
          refreshRevision={blueprintRefreshRevision}
          onApplicationStateChange={handleBlueprintApplicationStateChange}
          onApplied={handleBlueprintApplied}
        />
      </div>

      {blueprintApplied ? (
        <>
          <GovernmentMesaUnicaLaunchPanel
            tenantSlug={tenantSlug}
            canApply={canApplyBlueprint}
            onApplied={handleGovernmentLaunchApplied}
          />
          <GovernmentJurisdictionReadinessPanel
            tenantSlug={tenantSlug}
            canSubmitEvidence={canSubmitJurisdictionEvidence}
            canReview={canReviewJurisdictionEvidence}
          />
        </>
      ) : null}

      <div
        id="controles-salida"
        className="scroll-mt-24"
        data-testid="implementation-tenant-scope"
        data-tenant-slug={tenantSlug}
      >
        <ChannelActivationChecklist
          key={`${tenantSlug}:${activationRevision}`}
          tenantSlug={tenantSlug}
          initialData={initialActivation}
          highlighted
          presentation="launch-journey"
          returnTo={implementationReturnTo}
        />
      </div>
    </section>
  );
};

export default TenantImplementationCenterPage;
