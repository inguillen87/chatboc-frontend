import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, BellRing, CheckCircle2, FileText, HeartPulse, Inbox, MessagesSquare, ServerCog, Users } from 'lucide-react';

import {
  getEmployeeCoverageV2,
  getNotificationDeliveryStatusV2,
  getNotificationHooksV2,
  getOmnichannelInboxV2,
  getSuperadminExecutiveSummaryV2,
  getTenantHealthV2,
} from '@/api/v2/saas';
import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';

const statusLabel = (query: { isLoading: boolean; isError: boolean; data?: { contract_version?: string } }) => {
  if (query.isLoading) return 'Cargando';
  if (query.isError) return 'Revisar';
  if (query.data?.contract_version) return query.data.contract_version;
  return query.data ? 'Activo' : 'Pendiente';
};

const statusVariant = (query: { isLoading: boolean; isError: boolean; data?: unknown }) => {
  if (query.isError) return 'destructive' as const;
  if (query.data) return 'secondary' as const;
  return 'outline' as const;
};

const EnterpriseOpsPage = () => {
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const isSuperadmin = String(user?.rol ?? '').toLowerCase().includes('super');

  const healthQuery = useQuery({
    queryKey: ['tenant-health-v2', currentSlug],
    queryFn: () => getTenantHealthV2(currentSlug),
    retry: 0,
    staleTime: 30_000,
  });

  const coverageQuery = useQuery({
    queryKey: ['employee-coverage-v2', currentSlug],
    queryFn: () => getEmployeeCoverageV2(currentSlug),
    retry: 0,
    staleTime: 30_000,
  });

  const hooksQuery = useQuery({
    queryKey: ['notifications-hooks-v2-summary', currentSlug],
    queryFn: () => getNotificationHooksV2(currentSlug),
    retry: 0,
    staleTime: 30_000,
  });

  const deliveryQuery = useQuery({
    queryKey: ['notifications-delivery-v2-summary', currentSlug],
    queryFn: () => getNotificationDeliveryStatusV2(currentSlug),
    retry: 0,
    staleTime: 30_000,
  });

  const inboxQuery = useQuery({
    queryKey: ['inbox-omnichannel-v2-summary', currentSlug],
    queryFn: () => getOmnichannelInboxV2(currentSlug),
    retry: 0,
    staleTime: 30_000,
  });

  const executiveQuery = useQuery({
    queryKey: ['superadmin-executive-summary-v2'],
    queryFn: () => getSuperadminExecutiveSummaryV2(),
    retry: 0,
    staleTime: 30_000,
    enabled: isSuperadmin,
  });

  const modules = [
    {
      key: 'tenant-health',
      title: 'Tenant health',
      to: '/enterprise',
      icon: HeartPulse,
      note: 'Score, checks, integraciones, colas, errores y acciones recomendadas.',
      query: healthQuery,
    },
    {
      key: 'employee-coverage',
      title: 'Employee coverage',
      to: '/empleados',
      icon: Users,
      note: 'Cobertura por empleados, categorias, zonas, canales, workload y alertas.',
      query: coverageQuery,
    },
    {
      key: 'executive-summary',
      title: 'Executive summary',
      to: '/superadmin',
      icon: BarChart3,
      note: 'KPIs multi-tenant, risky tenants, health ranking y recommended actions.',
      query: executiveQuery,
    },
    {
      key: 'inbox-omnichannel',
      title: 'Inbox omnicanal',
      to: currentSlug ? `/t/${encodeURIComponent(currentSlug)}/inbox` : '/tickets',
      icon: Inbox,
      note: 'Lista omnicanal, timeline, contact, location, presence y actions.',
      query: inboxQuery,
    },
    {
      key: 'notifications',
      title: 'Notifications hooks',
      to: '/notificaciones',
      icon: BellRing,
      note: 'Preferences, triggers, delivery config, templates y delivery status.',
      query: hooksQuery,
    },
    {
      key: 'templates',
      title: 'Templates',
      to: '/perfil/plantillas-respuesta',
      icon: FileText,
      note: 'Plantillas por canal listas para permisos, variables y versionado.',
      query: hooksQuery,
    },
    {
      key: 'live-chat',
      title: 'Live chat / admin bridge',
      to: '/chatcrm',
      icon: MessagesSquare,
      note: 'Continuidad operativa entre conversaciones, handoff y contexto.',
      query: inboxQuery,
    },
  ] as const;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 py-6">
      <EnterprisePageHeader
        badge="Enterprise workspace"
        title="Operacion omnicanal"
        description="Modulos operativos conectados a contratos SaaS P1 canonicos, con datos backend-driven y acciones renderizadas desde payload."
        meta={`${modules.length} modulos disponibles`}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <Card key={module.key} className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant={statusVariant(module.query)}>{statusLabel(module.query)}</Badge>
                </div>
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">{module.title}</CardTitle>
                  <CardDescription>{module.note}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" variant={module.query.isError ? 'outline' : 'default'}>
                  <Link to={module.to}>
                    Abrir modulo
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              SaaS P1 live
            </CardTitle>
            <CardDescription>Resumen directo de las respuestas canonicas disponibles para este contexto.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <ReadinessStat label="Health" value={formatHealth(healthQuery.data?.health_score)} />
            <ReadinessStat label="Coverage" value={String(coverageQuery.data?.employees.length ?? 0)} />
            <ReadinessStat label="Inbox" value={String(inboxQuery.data?.items.length ?? 0)} />
            <ReadinessStat label="Hooks" value={String(hooksQuery.data?.preferences.length ?? 0)} />
            <ReadinessStat label="Delivery" value={formatHealth(deliveryQuery.data?.success_rate)} />
            <ReadinessStat label="Executive" value={String(executiveQuery.data?.recommended_actions.length ?? (isSuperadmin ? 0 : 'solo superadmin'))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ServerCog className="h-5 w-5 text-muted-foreground" />
              Contratos P1
            </CardTitle>
            <CardDescription>Versiones detectadas en runtime.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ContractLine label="Tenant health" value={healthQuery.data?.contract_version} />
            <ContractLine label="Employee coverage" value={coverageQuery.data?.contract_version} />
            <ContractLine label="Notifications hooks" value={hooksQuery.data?.contract_version} />
            <ContractLine label="Delivery status" value={deliveryQuery.data?.contract_version} />
            <ContractLine label="Inbox" value={inboxQuery.data?.contract_version} />
            <ContractLine label="Executive" value={executiveQuery.data?.contract_version} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

function formatHealth(value?: number) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '--';
}

function ReadinessStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ContractLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      <span className="min-w-0 truncate">{label}</span>
      <Badge variant={value ? 'secondary' : 'outline'}>{value || 'pendiente'}</Badge>
    </div>
  );
}

export default EnterpriseOpsPage;
