import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Palette,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  fetchTenantProvisioningReadiness,
  type TenantProvisioningNextAction,
  type TenantProvisioningReadiness,
} from '@/api/v2/tenantProvisioningReadiness';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type ReadinessBlock = {
  id: 'brand' | 'team' | 'content' | 'channels' | 'certification';
  label: string;
  description: string;
  ready: boolean;
  pendingLabel: string;
  readyLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  evidence: string[];
  action?: {
    href: string;
    label: string;
  };
};

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const humanizeChannel = (channel: string) => {
  const labels: Record<string, string> = {
    widget: 'Widget web',
    whatsapp: 'WhatsApp',
    live_chat: 'Atención humana',
  };
  return labels[channel] || channel.replaceAll('_', ' ');
};

const formatList = (values: string[], empty: string) =>
  values.length ? values.map(humanizeChannel).join(' · ') : empty;

const buildProfileHref = (
  tenantSlug: string,
  tab: 'perfil' | 'empleados' | 'catalogo',
  section?: 'identity' | 'channels',
) => {
  const params = new URLSearchParams({
    tenant_slug: tenantSlug,
    tab,
  });
  if (section) params.set('section', section);
  if (section === 'channels') params.set('setup', 'channels');
  return `/perfil?${params.toString()}`;
};

const buildImplementationHref = (tenantSlug: string, hash: string) =>
  `/implementacion?tenant_slug=${encodeURIComponent(tenantSlug)}#${hash}`;

const nextActionPresentation = (
  nextAction: TenantProvisioningNextAction,
  tenantSlug: string,
): { label: string; href: string } | null => {
  const actions: Partial<Record<TenantProvisioningNextAction, { label: string; href: string }>> = {
    repair_base_configuration: {
      label: 'Revisar configuración base',
      href: buildImplementationHref(tenantSlug, 'configuracion-base'),
    },
    configure_branding: {
      label: 'Completar marca',
      href: buildProfileHref(tenantSlug, 'perfil', 'identity'),
    },
    configure_operator_team: {
      label: 'Configurar equipo',
      href: buildProfileHref(tenantSlug, 'empleados'),
    },
    publish_service_content: {
      label: 'Preparar contenido',
      href: buildProfileHref(tenantSlug, 'catalogo'),
    },
    verify_tenant_channel: {
      label: 'Verificar canales',
      href: buildProfileHref(tenantSlug, 'perfil', 'channels'),
    },
    review_activation: {
      label: 'Revisar controles de salida',
      href: buildImplementationHref(tenantSlug, 'controles-salida'),
    },
  };
  return actions[nextAction] || null;
};

const readinessBlocks = (
  snapshot: TenantProvisioningReadiness,
  tenantSlug: string,
): ReadinessBlock[] => {
  const { checks, evidence } = snapshot;
  const productionReady = snapshot.production_ready;
  return [
    {
      id: 'brand',
      label: 'Marca',
      description: 'Identidad institucional aplicada al espacio de atención.',
      ready: checks.branding_configuration_complete,
      readyLabel: 'Lista',
      pendingLabel: 'Pendiente',
      icon: Palette,
      evidence: [
        `Logo institucional: ${evidence.branding.logo_configured ? 'configurado' : 'pendiente'}`,
        `Paleta visual: ${evidence.branding.palette_configured ? 'configurada' : 'pendiente'}`,
      ],
      action: {
        label: 'Abrir identidad visual',
        href: buildProfileHref(tenantSlug, 'perfil', 'identity'),
      },
    },
    {
      id: 'team',
      label: 'Equipo y enrutamiento',
      description: 'Responsables y categorías preparados para derivar casos.',
      ready: checks.operator_configuration_complete,
      readyLabel: 'Listo',
      pendingLabel: 'Pendiente',
      icon: UsersRound,
      evidence: [
        `${evidence.operator_team.members} integrantes registrados`,
        `${evidence.operator_team.routed_members} integrantes con categorías asignadas`,
        `${evidence.operator_team.ticket_categories} categorías operativas`,
      ],
      action: {
        label: 'Abrir equipo y permisos',
        href: buildProfileHref(tenantSlug, 'empleados'),
      },
    },
    {
      id: 'content',
      label: 'Contenido',
      description: 'Servicios y respuestas publicados para orientar la atención.',
      ready: checks.service_content_configured,
      readyLabel: 'Listo',
      pendingLabel: 'Pendiente',
      icon: BookOpenCheck,
      evidence: [
        `${evidence.service_content.catalog_items} elementos de catálogo`,
        `${evidence.service_content.menu_items} opciones de atención`,
      ],
      action: {
        label: 'Abrir servicios y catálogo',
        href: buildProfileHref(tenantSlug, 'catalogo'),
      },
    },
    {
      id: 'channels',
      label: 'Canales',
      description: 'Canales elegidos contrastados con evidencia persistida.',
      ready: checks.channel_verification_complete,
      readyLabel: 'Verificados',
      pendingLabel: 'Por verificar',
      icon: RadioTower,
      evidence: [
        `Seleccionados: ${formatList(evidence.channels.selected, 'ninguno')}`,
        `Verificados: ${formatList(evidence.channels.verified, 'ninguno')}`,
        `Pendientes: ${formatList(evidence.channels.missing, 'ninguno')}`,
      ],
      action: {
        label: 'Abrir configuración de canales',
        href: buildProfileHref(tenantSlug, 'perfil', 'channels'),
      },
    },
    {
      id: 'certification',
      label: 'Certificación',
      description: productionReady
        ? 'La plataforma publicó la habilitación para la salida productiva.'
        : 'La configuración no equivale a una salida productiva certificada.',
      ready: productionReady,
      readyLabel: 'Certificada',
      pendingLabel: snapshot.ready ? 'Pendiente de salida' : 'Aún no disponible',
      icon: ShieldCheck,
      evidence: [
        `Configuración operativa: ${snapshot.ready ? 'lista' : 'incompleta'}`,
        `Evaluación de salida productiva: ${snapshot.safety.production_cutover_assessed ? 'realizada' : 'no publicada'}`,
        `Estado productivo: ${productionReady ? 'certificado' : 'no certificado'}`,
      ],
      action: {
        label: 'Ver controles de salida',
        href: buildImplementationHref(tenantSlug, 'controles-salida'),
      },
    },
  ];
};

const ReadinessStatus = ({ ready, readyLabel, pendingLabel }: Pick<ReadinessBlock, 'ready' | 'readyLabel' | 'pendingLabel'>) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold',
      ready
        ? 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-200'
        : 'border-border bg-muted/60 text-muted-foreground',
    )}
  >
    {ready
      ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      : <CircleDashed className="h-3 w-3" aria-hidden="true" />}
    {ready ? readyLabel : pendingLabel}
  </span>
);

const ReadinessBlockCard = ({ block }: { block: ReadinessBlock }) => {
  const Icon = block.icon;
  return (
    <details
      className="group min-w-0 overflow-hidden rounded-xl border border-border/70 bg-background/75 shadow-sm open:border-blue-500/25"
      data-readiness-block={block.id}
      data-state={block.ready ? 'ready' : 'pending'}
    >
      <summary className="flex min-h-[7.25rem] cursor-pointer list-none flex-col gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <span className="flex items-start justify-between gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/15 bg-blue-500/[0.08] text-blue-700 dark:text-blue-200">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <ReadinessStatus
            ready={block.ready}
            readyLabel={block.readyLabel}
            pendingLabel={block.pendingLabel}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2 text-sm font-bold text-foreground">
            {block.label}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{block.description}</span>
        </span>
      </summary>
      <div className="border-t border-border/60 bg-muted/[0.16] px-4 py-3">
        <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
          {block.evidence.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {block.action ? (
          <Button asChild variant="link" size="sm" className="mt-2 h-auto px-0 text-xs">
            <Link to={block.action.href}>
              {block.action.label}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </details>
  );
};

export interface TenantProvisioningReadinessPanelProps {
  tenantSlug: string;
}

const TenantProvisioningReadinessPanel = ({ tenantSlug }: TenantProvisioningReadinessPanelProps) => {
  const normalizedTenantSlug = React.useMemo(() => tenantSlug.trim().toLowerCase(), [tenantSlug]);
  const [snapshot, setSnapshot] = React.useState<TenantProvisioningReadiness | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshRevision, setRefreshRevision] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSnapshot((current) => (
      current?.tenant.slug.toLowerCase() === normalizedTenantSlug ? current : null
    ));

    void fetchTenantProvisioningReadiness(normalizedTenantSlug)
      .then((response) => {
        if (!active) return;
        setSnapshot(response);
      })
      .catch(() => {
        if (!active) return;
        setSnapshot(null);
        setError('No pudimos validar el estado de implementación. No se muestra ningún frente como listo hasta recuperar el contrato del servidor.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [normalizedTenantSlug, refreshRevision]);

  if (!snapshot) {
    return (
      <section
        aria-labelledby="tenant-readiness-title"
        aria-busy={loading}
        data-testid="tenant-provisioning-readiness"
        data-state={loading ? 'loading' : 'unavailable'}
        className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
      >
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-200">
              {loading
                ? <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
                : <AlertTriangle className="h-5 w-5" aria-hidden="true" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-blue-700 dark:text-blue-200">
                Implementación institucional
              </p>
              <h2 id="tenant-readiness-title" className="mt-1 text-xl font-bold tracking-tight text-foreground">
                {loading ? 'Validando la configuración' : 'Estado no disponible'}
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground" role={error ? 'alert' : undefined}>
                {error || 'Consultando marca, equipo, contenido, canales y certificación para esta organización.'}
              </p>
            </div>
          </div>
          {!loading ? (
            <Button type="button" variant="outline" onClick={() => setRefreshRevision((value) => value + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reintentar
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  const blocks = readinessBlocks(snapshot, normalizedTenantSlug);
  const configurationChecks = [
    snapshot.checks.base_configuration_valid,
    snapshot.checks.branding_configuration_complete,
    snapshot.checks.operator_configuration_complete,
    snapshot.checks.service_content_configured,
    snapshot.checks.channel_verification_complete,
  ];
  const readyChecks = configurationChecks.filter(Boolean).length;
  const progress = Math.round((readyChecks / configurationChecks.length) * 100);
  const primaryAction = nextActionPresentation(snapshot.next_action, normalizedTenantSlug);
  const generatedAt = dateFormatter.format(new Date(snapshot.generated_at));

  return (
    <section
      aria-labelledby="tenant-readiness-title"
      aria-busy={loading}
      data-testid="tenant-provisioning-readiness"
      data-state={snapshot.production_ready ? 'production-ready' : snapshot.ready ? 'configuration-ready' : 'configuration-required'}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
    >
      <div className="grid gap-5 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 text-white lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-blue-300/30 bg-blue-400/10 text-blue-100" variant="outline">
              Estado del servidor
            </Badge>
            <Badge className="border-white/15 bg-white/[0.08] text-slate-100" variant="outline">
              Base institucional: {snapshot.checks.base_configuration_valid ? 'lista' : 'pendiente'}
            </Badge>
          </div>
          <h2 id="tenant-readiness-title" className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
            Centro de implementación
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Una lectura vigente y reutilizable de la organización. Los estados provienen de configuración persistida; consultar este panel no activa proveedores ni modifica datos.
          </p>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Estado general de implementación">
            <Badge className={snapshot.ready
              ? 'border-blue-300/35 bg-blue-400/15 text-blue-50'
              : 'border-white/15 bg-white/[0.08] text-slate-100'} variant="outline">
              {snapshot.ready ? 'Configuración lista' : 'Configuración pendiente'}
            </Badge>
            <Badge className={snapshot.production_ready
              ? 'border-blue-300/35 bg-blue-400/15 text-blue-50'
              : 'border-white/15 bg-white/[0.08] text-slate-100'} variant="outline">
              {snapshot.production_ready ? 'Salida productiva certificada' : 'Producción no certificada'}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.07] p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Configuración comprobada</p>
              <p className="mt-1 text-sm text-slate-200">{readyChecks} de {configurationChecks.length} controles</p>
            </div>
            <span className="text-3xl font-black tracking-tight">{progress}%</span>
          </div>
          <Progress value={progress} className="mt-3 h-2 bg-slate-800" aria-label="Progreso de configuración comprobada" />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {primaryAction ? (
              <Button asChild size="sm" className="h-9">
                <Link to={primaryAction.href}>
                  {primaryAction.label}
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setRefreshRevision((value) => value + 1)}
              disabled={loading}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Frentes de implementación">
          {blocks.map((block) => <ReadinessBlockCard key={block.id} block={block} />)}
        </div>

        <details className="group mt-4 rounded-xl border border-border/70 bg-muted/[0.16]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            Fuente, vigencia y límites de esta lectura
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="grid gap-3 border-t border-border/60 px-4 py-4 text-xs leading-5 text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-semibold text-foreground">Actualizado</p>
              <p className="mt-1">{generatedAt}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Contrato</p>
              <p className="mt-1 break-all font-mono">{snapshot.contract_version}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Configuraciones registradas</p>
              <p className="mt-1">{snapshot.configured_keys.length}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Seguridad de la consulta</p>
              <p className="mt-1">Sin escrituras ni llamadas a proveedores.</p>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
};

export default TenantProvisioningReadinessPanel;
