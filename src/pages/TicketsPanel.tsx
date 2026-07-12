import React from 'react';
import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import EnterpriseTopNav from '@/components/enterprise/EnterpriseTopNav';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ViewState } from '@/components/app-shell/ViewState';
import { useCapabilities } from '@/context/CapabilitiesContext';
import { useTenant } from '@/context/TenantContext';
import { TicketProvider } from '@/context/TicketContext';
import { useUser } from '@/hooks/useUser';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';
import { hasRequiredRole } from '@/utils/roles';
import { TICKET_READ_CAPABILITIES } from '@/utils/moduleCapabilities';
import { resolveTenantSlug } from '@/utils/api';

const TICKETS_IDENTITY_COVERAGE_DEFER_MS = 1600;

const TicketsIdentityCoverageAlert = ({
  tenantSlugOverride,
  deferMs = TICKETS_IDENTITY_COVERAGE_DEFER_MS,
}: {
  tenantSlugOverride?: string | null;
  deferMs?: number;
}) => {
  const { currentSlug } = useTenant();
  const resolvedTenantSlug = React.useMemo(
    () => resolveTenantSlug(tenantSlugOverride ?? currentSlug, undefined, { persist: false }),
    [currentSlug, tenantSlugOverride],
  );
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    if (!resolvedTenantSlug) {
      setRequestId(null);
      setMessage(null);
      return () => {
        mounted = false;
      };
    }

    const timer = window.setTimeout(() => {
      apiClient
        .getIdentityCoverage(resolvedTenantSlug, { emit_alert_events: 1 })
        .then((response) => {
          if (!mounted) return;
          if (response.alert_count > 0 && response.slo_status === 'below_target') {
            setRequestId(response.request_id);
            setMessage(response.alerts[0]?.message || 'Falta identidad suficiente para operar conversaciones omnicanal.');
            return;
          }
          setRequestId(null);
          setMessage(null);
        })
        .catch(() => {
          if (!mounted) return;
          setRequestId(null);
          setMessage(null);
        });
    }, Math.max(0, deferMs));

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [deferMs, resolvedTenantSlug]);

  if (!requestId) return null;

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(requestId);
    trackFrontendEvent('support_request_id_copied', {
      request_id: requestId,
      source: 'tickets_identity_coverage',
    });
  };

  return (
    <div className="mb-1 flex shrink-0 flex-col gap-2 rounded-lg border border-border/70 bg-card/80 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="outline" className="shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300">
          Identidad parcial
        </Badge>
        <p className="min-w-0 truncate">{message}</p>
        <p className="font-mono text-[11px] text-muted-foreground/80">request_id: {requestId}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={handleCopy}>
        Copiar request_id
      </Button>
    </div>
  );
};

interface TicketsPanelPageProps {
  tenantSlugOverride?: string | null;
  embedded?: boolean;
  identityCoverageDelayMs?: number;
}

const TicketsPanelPage = ({
  tenantSlugOverride,
  embedded = false,
  identityCoverageDelayMs,
}: TicketsPanelPageProps) => {
  const { user } = useUser();
  const { capabilities, hasAnyCapability } = useCapabilities();

  const hasDeclaredCapabilities = capabilities.length > 0;
  const isOperationalRole = hasRequiredRole(user?.rol, ['tenant_admin', 'employee', 'superadmin']);
  const isTenantOwnerLike = hasRequiredRole(user?.rol, ['tenant_admin', 'superadmin']);
  const hasTicketCapability = hasAnyCapability(TICKET_READ_CAPABILITIES);
  const canReadTickets =
    hasTicketCapability ||
    isTenantOwnerLike ||
    (isOperationalRole && !hasDeclaredCapabilities);

  const rootClassName = embedded
    ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground'
    : 'flex min-h-[100dvh] flex-col bg-background px-2 pb-4 pt-16 text-foreground dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 sm:px-4 sm:pb-6 sm:pt-6 md:px-5 lg:px-6 2xl:px-5';
  const shellClassName = embedded
    ? 'relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden'
    : 'relative mx-auto flex min-h-0 w-full max-w-[min(2400px,calc(100vw-2rem))] flex-1 flex-col';

  return (
    <div className={rootClassName} data-testid="tickets-panel-root">
      <div className={shellClassName}>
        {!embedded ? (
          <>
            <EnterprisePageHeader
              badge="Mesa de atencion"
              title="Reclamos y conversaciones"
              description="Prioriza, asigna y responde cada caso desde un espacio de trabajo claro."
            />
            <EnterpriseTopNav />
          </>
        ) : null}
        {!canReadTickets ? (
          <div className="flex h-full min-h-0 flex-1 items-center justify-center p-4" data-testid="tickets-access-denied">
            <ViewState
              status="denied"
              title="Reclamos no habilitado para esta cuenta"
              description="Tu usuario tiene permisos declarados, pero no incluye acceso a la mesa de tickets. Pedile al administrador que active tickets.read o reclamos.read para este perfil."
              action={
                <Button type="button" variant="outline" onClick={() => window.location.assign('/perfil')}>
                  Volver al panel
                </Button>
              }
              className="w-full max-w-2xl bg-card/80"
            />
          </div>
        ) : (
          <>
            <TicketsIdentityCoverageAlert
              tenantSlugOverride={tenantSlugOverride}
              deferMs={identityCoverageDelayMs}
            />
            <div
              className="relative flex min-h-0 w-full flex-1 overflow-hidden"
              data-testid="tickets-panel-viewport"
            >
              <SectionErrorBoundary
                title="Ocurrio un problema al cargar reclamos"
                description="Recarga la pagina o vuelve a la seccion principal del panel."
                onRetry={() => window.location.reload()}
              >
                <TicketProvider tenantSlugOverride={tenantSlugOverride}>
                  <NewTicketsPanel embedded={embedded} />
                </TicketProvider>
              </SectionErrorBoundary>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TicketsPanelPage;
