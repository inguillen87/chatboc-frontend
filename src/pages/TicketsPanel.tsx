import React from 'react';
import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import EnterpriseTopNav from '@/components/enterprise/EnterpriseTopNav';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import NewTicketsPanel from '@/components/tickets/NewTicketsPanel';
import { apiClient } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/context/TenantContext';
import { TicketProvider } from '@/context/TicketContext';
import useRequireRole from '@/hooks/useRequireRole';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';
import type { Role } from '@/utils/roles';

const TicketsIdentityCoverageAlert = () => {
  const { currentSlug } = useTenant();
  const [requestId, setRequestId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    if (!currentSlug) {
      setRequestId(null);
      setMessage(null);
      return () => {
        mounted = false;
      };
    }

    apiClient
      .getIdentityCoverage(currentSlug, { emit_alert_events: 1 })
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

    return () => {
      mounted = false;
    };
  }, [currentSlug]);

  if (!requestId) return null;

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(requestId);
    trackFrontendEvent('support_request_id_copied', {
      request_id: requestId,
      source: 'tickets_identity_coverage',
    });
  };

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{message}</p>
        <p className="font-mono text-xs">request_id: {requestId}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
        Copiar request_id
      </Button>
    </div>
  );
};

interface TicketsPanelPageProps {
  tenantSlugOverride?: string | null;
  embedded?: boolean;
}

const TicketsPanelPage = ({ tenantSlugOverride, embedded = false }: TicketsPanelPageProps) => {
  useRequireRole(['tenant_admin', 'employee', 'superadmin'] as Role[]);

  const rootClassName = embedded
    ? 'flex min-h-[760px] h-[calc(100dvh-8rem)] flex-col overflow-hidden bg-background text-foreground'
    : 'flex min-h-[100dvh] flex-col bg-background px-2 pb-4 pt-16 text-foreground dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 sm:px-4 sm:pb-6 sm:pt-6 md:px-5 lg:px-6 2xl:px-5';
  const shellClassName = embedded
    ? 'relative flex h-full min-h-0 w-full flex-1 flex-col'
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
        <TicketsIdentityCoverageAlert />
        <div className="relative flex h-full min-h-0 w-full flex-1">
          <SectionErrorBoundary
            title="Ocurrio un problema al cargar reclamos"
            description="Recarga la pagina o vuelve a la seccion principal del panel."
            onRetry={() => window.location.reload()}
          >
            <TicketProvider tenantSlugOverride={tenantSlugOverride}>
              <NewTicketsPanel />
            </TicketProvider>
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default TicketsPanelPage;
