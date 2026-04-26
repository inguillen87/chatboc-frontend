import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import { TicketInboxPage } from '@/components/tickets/inbox/TicketInboxPage'; // Cambiado a la nueva UI
import { TicketProvider } from '@/context/TicketContext';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import EnterpriseTopNav from '@/components/enterprise/EnterpriseTopNav';
import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import { useTenant } from '@/context/TenantContext';
import { apiClient, type IdentityCoverageResponse } from '@/api/client';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';

const TicketsPanelPage = () => {
  useRequireRole(['admin', 'empleado', 'super_admin'] as Role[]);
  const { currentSlug } = useTenant();
  const [identityCoverage, setIdentityCoverage] = React.useState<IdentityCoverageResponse | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const loadIdentityCoverage = async () => {
      if (!currentSlug) return;
      try {
        const coverage = await apiClient.getIdentityCoverage(currentSlug, { emit_alert_events: 1 });
        if (!cancelled) {
          setIdentityCoverage(coverage);
        }
      } catch {
        if (!cancelled) {
          setIdentityCoverage(null);
        }
      }
    };
    loadIdentityCoverage();
    return () => {
      cancelled = true;
    };
  }, [currentSlug]);

  const coverageAlerts = React.useMemo(
    () =>
      (identityCoverage?.alerts ?? []).filter(
        (alert) => typeof alert.message === 'string' && alert.message.trim().length > 0,
      ),
    [identityCoverage?.alerts],
  );

  const shouldShowCoverageAlert =
    (identityCoverage?.alert_count ?? 0) > 0 ||
    coverageAlerts.length > 0 ||
    Boolean(identityCoverage?.summary_message?.trim());

  React.useEffect(() => {
    if (!shouldShowCoverageAlert) return;
    trackFrontendEvent('coverage_alert_banner_seen', {
      tenant_slug: currentSlug ?? null,
      alert_count: identityCoverage?.alert_count ?? coverageAlerts.length,
      slo_status: identityCoverage?.slo_status ?? null,
    });
  }, [coverageAlerts.length, currentSlug, identityCoverage?.alert_count, identityCoverage?.slo_status, shouldShowCoverageAlert]);

  const copyCoverageRequestId = React.useCallback(async () => {
    const requestId = identityCoverage?.request_id?.trim();
    if (!requestId) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(requestId);
      trackFrontendEvent('support_request_id_copied', {
        source: 'tickets_identity_coverage',
        request_id: requestId,
        tenant_slug: currentSlug ?? null,
      });
    } catch {
      // no-op: avoid blocking UI if clipboard is unavailable.
    }
  }, [currentSlug, identityCoverage?.request_id]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background dark:bg-gradient-to-tr dark:from-slate-950 dark:to-slate-900 text-foreground pt-16 pb-4 sm:pt-6 sm:pb-6 px-2 sm:px-4 md:px-5 lg:px-6 2xl:px-5">
      <div className="relative mx-auto flex w-full flex-1 min-h-0 max-w-[min(2400px,calc(100vw-2rem))] flex-col">
        <EnterprisePageHeader
          badge="Inbox enterprise"
          title="Bandeja de Entrada y Tickets"
          description="Gestión unificada de conversaciones, tickets operativos, seguimiento de SLA y herramientas de asistencia por IA."
        />
        {shouldShowCoverageAlert ? (
          <div className="mb-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            {identityCoverage?.summary_message ? <p className="font-semibold">{identityCoverage.summary_message}</p> : null}
            <p>
              {identityCoverage?.contract_version ?? ''}
              {identityCoverage?.contract_version && identityCoverage?.slo_status ? ' · ' : ''}
              {identityCoverage?.slo_status ?? ''}
              {(identityCoverage?.contract_version || identityCoverage?.slo_status) ? ' · ' : ''}
              {identityCoverage?.alert_count ?? 0}
            </p>
            {identityCoverage?.request_id ? (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="font-mono">request_id: {identityCoverage.request_id}</span>
                <button
                  type="button"
                  className="rounded border border-amber-300/70 px-2 py-1 hover:bg-amber-100/60 dark:border-amber-400/40 dark:hover:bg-amber-400/10"
                  onClick={() => {
                    void copyCoverageRequestId();
                  }}
                >
                  Copiar request_id
                </button>
              </div>
            ) : null}
            {coverageAlerts.length > 0 ? (
              <ul className="mt-1 list-disc pl-4">
                {coverageAlerts.map((alert, index) => (
                  <li key={`${alert.channel ?? 'identity-coverage'}-${index}`}>{alert.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <EnterpriseTopNav />
        <div className="relative flex w-full flex-1 min-h-0 mt-4 rounded-xl overflow-hidden border border-border shadow-sm">
        <SectionErrorBoundary
          title="Ocurrió un problema al cargar Tickets"
          description="Recargá la página o volvé a la sección principal del panel."
          onRetry={() => window.location.reload()}
        >
          <TicketProvider>
            <TicketInboxPage />
          </TicketProvider>
        </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default TicketsPanelPage;
