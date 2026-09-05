import React from 'react';
import { AlertCircle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import TenantBlueprintProvisioningPanel from '@/components/implementation/TenantBlueprintProvisioningPanel';
import ChannelActivationChecklist from '@/components/profile/ChannelActivationChecklist';
import { Badge } from '@/components/ui/badge';
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
  const canApplyBlueprint = normalizeRole(user?.rol || user?.role) === 'superadmin';

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
        title="Preparar la solución para operar"
        description="Un único lugar para revisar identidad, accesibilidad, canales, operación, participación y salida productiva sin perder el contexto del tenant."
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

      <div className="flex flex-col gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Estado publicado por la plataforma</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Los avances, bloqueos y próximos pasos provienen del contrato del backend. Un frente no publicado nunca se presenta como listo.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 bg-background/70">
          Sin estados inferidos
        </Badge>
      </div>

      <TenantBlueprintProvisioningPanel
        tenantSlug={tenantSlug}
        canApply={canApplyBlueprint}
      />

      <div data-testid="implementation-tenant-scope" data-tenant-slug={tenantSlug}>
        <ChannelActivationChecklist
          tenantSlug={tenantSlug}
          initialData={initialActivation}
          highlighted
        />
      </div>
    </section>
  );
};

export default TenantImplementationCenterPage;
