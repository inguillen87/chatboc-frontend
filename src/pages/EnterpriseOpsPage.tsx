import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, BellRing, CheckCircle2, FileText, HeartPulse, Inbox, MessagesSquare, ServerCog, Users } from 'lucide-react';

import { getApiV2Health } from '@/api/v2/foundation';
import {
  getEmployeeCoverageV2,
  getNotificationDeliveryStatusV2,
  getNotificationHooksV2,
  getOmnichannelInboxV2,
  getSuperadminExecutiveSummaryV2,
  getTenantHealthV2,
} from '@/api/v2/saas';
import { getCurrentTenantV2 } from '@/api/v2/tenants';
import EnterprisePageHeader from '@/components/enterprise/EnterprisePageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { TICKET_DESK_PATH } from '@/utils/backofficeRoutes';

const statusLabel = (query: { isLoading: boolean; isError: boolean; data?: { contract_version?: string; version?: string } }) => {
  if (query.isLoading) return 'Cargando';
  if (query.isError) return 'Revisar';
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

  const foundationQuery = useQuery({
    queryKey: ['api-v2-health'],
    queryFn: () => getApiV2Health(),
    retry: 0,
    staleTime: 30_000,
  });

  const currentTenantQuery = useQuery({
    queryKey: ['tenant-current-v2', currentSlug],
    queryFn: () => getCurrentTenantV2(currentSlug),
    retry: 0,
    staleTime: 30_000,
  });

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
      key: 'api-v2-foundation',
      title: 'Estado general',
      to: '/enterprise',
      icon: ServerCog,
      note: 'Base de la operacion, sesiones y datos listos para trabajar.',
      query: foundationQuery,
    },
    {
      key: 'tenant-health',
      title: 'Salud de la organizacion',
      to: '/enterprise',
      icon: HeartPulse,
      note: 'Integraciones, colas, alertas y acciones recomendadas.',
      query: healthQuery,
    },
    {
      key: 'employee-coverage',
      title: 'Equipo y cobertura',
      to: '/empleados',
      icon: Users,
      note: 'Categorias, zonas, canales y carga de trabajo por persona.',
      query: coverageQuery,
    },
    {
      key: 'executive-summary',
      title: 'Resumen ejecutivo',
      to: '/superadmin',
      icon: BarChart3,
      note: 'Indicadores, riesgos y decisiones para administrar mejor.',
      query: executiveQuery,
    },
    {
      key: 'inbox-omnichannel',
      title: 'Conversaciones',
      to: currentSlug ? `/t/${encodeURIComponent(currentSlug)}/inbox` : TICKET_DESK_PATH,
      icon: Inbox,
      note: 'Conversaciones, reclamos, ubicaciones y acciones en continuidad.',
      query: inboxQuery,
    },
    {
      key: 'notifications',
      title: 'Canales y avisos',
      to: '/notificaciones',
      icon: BellRing,
      note: 'Notificaciones, reglas de envio y estado de entrega.',
      query: hooksQuery,
    },
    {
      key: 'templates',
      title: 'Respuestas rapidas',
      to: '/perfil/plantillas-respuesta',
      icon: FileText,
      note: 'Mensajes reutilizables para responder mejor y mas rapido.',
      query: hooksQuery,
    },
    {
      key: 'live-chat',
      title: 'Atencion en vivo',
      to: '/chatcrm',
      icon: MessagesSquare,
      note: 'Continuidad entre conversaciones, derivacion humana y contexto.',
      query: inboxQuery,
    },
  ] as const;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 py-6">
      <EnterprisePageHeader
        badge="Centro operativo"
        title="Operacion omnicanal"
        description="Un tablero para ordenar conversaciones, reclamos, equipo, canales y decisiones del dia."
        meta={`${modules.length} secciones disponibles`}
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
              Preparado para operar
            </CardTitle>
            <CardDescription>Resumen de disponibilidad para este espacio de trabajo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <ReadinessStat label="Sistema" value={foundationQuery.data?.ok ? 'listo' : '--'} />
            <ReadinessStat label="Organizacion" value={String(currentTenantQuery.data?.tenant?.slug ?? currentSlug ?? '--')} />
            <ReadinessStat label="Salud" value={formatHealth(healthQuery.data?.health_score)} />
            <ReadinessStat label="Equipo" value={String(coverageQuery.data?.employees.length ?? 0)} />
            <ReadinessStat label="Conversaciones" value={String(inboxQuery.data?.items.length ?? 0)} />
            <ReadinessStat label="Canales" value={String(hooksQuery.data?.preferences.length ?? 0)} />
            <ReadinessStat label="Entregas" value={formatHealth(deliveryQuery.data?.success_rate)} />
            <ReadinessStat label="Decisiones" value={String(executiveQuery.data?.recommended_actions.length ?? (isSuperadmin ? 0 : '--'))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ServerCog className="h-5 w-5 text-muted-foreground" />
              Estado de secciones
            </CardTitle>
            <CardDescription>Senales para saber que se puede usar ahora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ContractLine label="Base operativa" value={foundationQuery.data?.ok ? 'activo' : undefined} />
            <ContractLine label="Perfil de la organizacion" value={currentTenantQuery.data?.tenant?.slug ? 'activo' : undefined} />
            <ContractLine label="Salud operativa" value={healthQuery.data ? 'activo' : undefined} />
            <ContractLine label="Equipo" value={coverageQuery.data ? 'activo' : undefined} />
            <ContractLine label="Canales" value={hooksQuery.data ? 'activo' : undefined} />
            <ContractLine label="Entregas" value={deliveryQuery.data ? 'activo' : undefined} />
            <ContractLine label="Reclamos" value={inboxQuery.data ? 'activo' : undefined} />
            <ContractLine label="Resumen ejecutivo" value={executiveQuery.data ? 'activo' : undefined} />
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
