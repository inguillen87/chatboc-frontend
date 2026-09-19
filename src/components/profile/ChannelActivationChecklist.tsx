import React from 'react';
import {
  Accessibility,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Headphones,
  Lock,
  MapPinned,
  MessageCircle,
  Palette,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TicketCheck,
  UserCog,
  Vote,
  Wifi,
} from 'lucide-react';

import {
  fetchTenantChannelActivation,
  parseTenantImplementationJourney,
  parseTenantChannelActivation,
  type ChannelActivationChannel,
  type ChannelActivationContract,
} from '@/api/v2/channelActivation';
import TenantLaunchJourney, { buildTenantJourneyHref } from '@/components/implementation/TenantLaunchJourney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {parseOrganizationSetupJourney} from '@/utils/organizationSetupJourney';
import OrganizationSetupWorkspace from '@/components/implementation/OrganizationSetupWorkspace';

const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  crm: TicketCheck,
  identity_auth: ShieldCheck,
  public_intake_security: ShieldCheck,
  whatsapp: MessageCircle,
  widget: Wifi,
  templates: FileCheck2,
  catalog_marketplace: ShoppingBag,
  payments_checkout: CreditCard,
  team_routing: UserCog,
  live_chat: Headphones,
  analytics_surveys: BarChart3,
  branding: Palette,
  institutional_branding: Palette,
  accessibility: Accessibility,
  territory: MapPinned,
  territorial_intelligence: MapPinned,
  surveys: Vote,
};

const statusLabels: Record<string, string> = {
  ready: 'Listo',
  action_required: 'Requiere accion',
  pending: 'En proceso',
  locked: 'Bloqueado',
  blocked: 'Bloqueado',
  needs_attention: 'Revisar',
};

const statusClasses: Record<string, string> = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  action_required: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-200',
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  locked: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200',
  needs_attention: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
};

const statusIcon = (channel: ChannelActivationChannel) => {
  if (channel.ready || channel.status === 'ready') return CheckCircle2;
  if (channel.locked || channel.status === 'locked' || channel.status === 'blocked') return Lock;
  return AlertTriangle;
};

const normalizeProgress = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const syncErrorMessage =
  'No pudimos sincronizar los canales ahora. El panel queda disponible y podes reintentar en unos segundos.';

const ChannelTechnicalGrid: React.FC<{
  channels: ChannelActivationChannel[];
  secureTenantSlug?: string;
  returnTo?: string;
  allowActions?: boolean;
}> = ({ channels, secureTenantSlug, returnTo, allowActions=true }) => {
  const hasChannels = channels.length > 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {!hasChannels ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-background/60 p-5 sm:col-span-2 xl:col-span-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground">Sincronizacion pendiente</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Cuando el backend tenga el contrato disponible, acá vas a ver identidad, accesibilidad, territorio,
                canales, operación y analítica con sus acciones concretas.
              </p>
            </div>
          </div>
        </div>
      ) : null}
      {channels.map((channel) => {
        const Icon = channelIcons[channel.id] || Sparkles;
        const StateIcon = statusIcon(channel);
        const status = String(channel.status || 'action_required');
        const primary = (channel.actions || []).find((item) => item.primary && item.href && item.kind !== 'api')
          || (channel.actions || []).find((item) => item.href && item.kind !== 'api');
        const primaryHref = allowActions && primary?.href && secureTenantSlug
          ? buildTenantJourneyHref(primary.href, secureTenantSlug, returnTo)
          : null;

        return (
          <article
            key={channel.id}
            className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="min-w-0 text-sm font-bold text-foreground">{channel.label}</h3>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      statusClasses[status] || statusClasses.action_required,
                    )}
                  >
                    <StateIcon className="h-3 w-3" />
                    {statusLabels[status] || status}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">{channel.description}</p>
              </div>
            </div>

            {channel.evidence?.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {channel.evidence.slice(0, 3).map((item) => (
                  <Badge key={item} variant="secondary" className="max-w-full truncate">
                    {item}
                  </Badge>
                ))}
              </div>
            ) : null}

            {channel.required_plan ? (
              <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-200">
                Requiere plan {channel.required_plan}.
              </p>
            ) : null}

            {channel.progress_hint ? (
              <p className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs leading-5 text-blue-800 dark:text-blue-100">
                {channel.progress_hint}
              </p>
            ) : null}

            {primaryHref ? (
              <Button asChild variant="outline" size="sm" className="mt-4 w-full justify-between">
                <a href={primaryHref}>
                  {primary.label || 'Abrir'}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
};

export interface ChannelActivationChecklistProps {
  tenantSlug?: string | null;
  initialData?: ChannelActivationContract | null;
  highlighted?: boolean;
  presentation?: 'overview' | 'launch-journey';
  onSetupType?: (kind:string) => void;
  returnTo?: string;
}

const ChannelActivationChecklist: React.FC<ChannelActivationChecklistProps> = (props) => {
  const scope=(props.tenantSlug ?? props.initialData?.tenant?.slug ?? '').trim().toLowerCase();
  if(!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(scope))return null;
  return <ScopedChannelActivationChecklist key={scope} {...props} tenantSlug={scope}/>;
};
const ScopedChannelActivationChecklist: React.FC<ChannelActivationChecklistProps & {tenantSlug:string}> = ({
  tenantSlug,
  initialData,
  highlighted = false,
  presentation = 'overview',
  returnTo,
  onSetupType,
}) => {
  const safeSnapshot = (value?:ChannelActivationContract|null) => {
    try { return value ? parseTenantChannelActivation(value, tenantSlug) : null; } catch { return null; }
  };
  const [data,setData]=React.useState<ChannelActivationContract|null>(()=>safeSnapshot(initialData));
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState<string|null>(null);
  const active=React.useRef(false);const sequence=React.useRef(0);const pending=React.useRef(false);const denied=React.useRef(false);
  const load=React.useCallback(async()=>{
    if(!active.current||pending.current)return;
    const current=++sequence.current;pending.current=true;setLoading(true);setError(null);
    let received=false;
    try {
      const raw=await fetchTenantChannelActivation(tenantSlug);received=true;
      const response=parseTenantChannelActivation(raw,tenantSlug);
      if(!active.current||sequence.current!==current)return;
      denied.current=false;setData(response);
    } catch(err:any) {
      if(!active.current||sequence.current!==current)return;
      const forbidden=[401,403].includes(Number(err?.status??err?.statusCode));
      const invalid=typeof err?.message==='string'&&err.message.startsWith('channel_activation_');
      if(forbidden||received||invalid){denied.current=forbidden;setData(null);}
      setError(forbidden?'No tenés acceso a la configuración de esta organización.':syncErrorMessage);
    } finally {
      if(active.current&&sequence.current===current){pending.current=false;setLoading(false);}
    }
  },[tenantSlug]);
  React.useEffect(()=>{
    active.current=true;if(!denied.current)setData(safeSnapshot(initialData));void load();
    return()=>{active.current=false;++sequence.current;pending.current=false;};
  },[load,initialData]);

  const channels = Array.isArray(data?.channels) ? data.channels : [];
  const progress = normalizeProgress(data?.summary?.progress);
  const ready = data?.summary?.ready ?? channels.filter((item) => item.ready).length;
  const total = data?.summary?.total ?? channels.length;
  const primaryAction = data?.summary?.primary_next_action;
  const locked = data?.summary?.locked ?? channels.filter((item) => item.locked).length;
  const hasChannels = channels.length > 0;
  const integrationStatus = String(data?.integration_access?.status || '').toLowerCase();
  const selfServiceActive = integrationStatus === 'partial';
  const hasModern=!!data && Object.prototype.hasOwnProperty.call(data,'organization_setup');
  const setup=parseOrganizationSetupJourney(data?.organization_setup,tenantSlug,data?.tenant?.id);
  const implementationJourney = hasModern ? null : parseTenantImplementationJourney(data?.implementation_journey);
  const actionsEnabled=!loading&&!error;
  React.useEffect(()=>{ if(setup)onSetupType?.(setup.organization_type); },[setup?.organization_type,onSetupType]);
  if(setup) return <OrganizationSetupWorkspace journey={setup} loading={loading} error={error}
    onRefresh={()=>void load()} returnTo={returnTo} technicalDetails={
      <ChannelTechnicalGrid channels={channels} secureTenantSlug={tenantSlug} returnTo={returnTo} allowActions={actionsEnabled}/>
    }/>;


  if (presentation === 'launch-journey' || hasModern) {
    return (
      <div data-testid="channel-activation-checklist" data-presentation="launch-journey">
        <TenantLaunchJourney
          tenantSlug={tenantSlug || data?.tenant?.slug || ''}
          journey={implementationJourney}
          loading={loading}
          error={error}
          onRefresh={() => void load()}
          returnTo={returnTo}
          technicalDetails={(
            <ChannelTechnicalGrid
              channels={channels}
              secureTenantSlug={tenantSlug || data?.tenant?.slug || ''}
              returnTo={returnTo}
              allowActions={actionsEnabled && !hasModern}
            />
          )}
        />
      </div>
    );
  }

  return (
    <section
      data-testid="channel-activation-checklist"
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur',
        highlighted && 'border-primary/70 shadow-lg shadow-primary/10',
      )}
    >
      <div className="grid gap-5 border-b border-border/60 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 text-white md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-blue-400/40 bg-blue-500/15 text-blue-100" variant="outline">
              Setup operativo
            </Badge>
            {loading ? (
              <Badge variant="secondary">Sincronizando estado</Badge>
            ) : data?.integration_access?.current_plan ? (
              <Badge variant="secondary" className="capitalize">
                Plan {data.integration_access.current_plan}
              </Badge>
            ) : null}
            {selfServiceActive ? (
              <Badge className="border-emerald-400/40 bg-emerald-500/15 text-emerald-100" variant="outline">
                Self-service activo
              </Badge>
            ) : null}
            {locked ? (
              <Badge className="border-amber-400/40 bg-amber-500/15 text-amber-100" variant="outline">
                {locked} bloqueos
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">Implementación operativa</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Estado real de identidad institucional, accesibilidad, territorio, WhatsApp, widget, plantillas, CRM,
            atención humana y analítica para saber qué falta antes de salir a producción.
          </p>
          {error ? (
            <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              {error}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.08] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-200">{data?.summary?.health_label || 'Activacion en progreso'}</span>
            <span className="text-2xl font-black text-white">{progress}%</span>
          </div>
          <Progress
            value={progress}
            className="mt-3 h-2 bg-slate-800"
            aria-label="Progreso de implementación"
          />
          <p className="mt-3 text-sm text-slate-300">
            {hasChannels ? `${ready} de ${total || channels.length} frentes listos.` : 'Esperando sincronizacion del backend.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {actionsEnabled && primaryAction?.href && primaryAction?.kind !== 'api' && buildTenantJourneyHref(primaryAction.href,tenantSlug,returnTo) ? (
              <Button asChild size="sm" className="h-9">
                <a href={buildTenantJourneyHref(primaryAction.href,tenantSlug,returnTo)!}>
                  {primaryAction.label || 'Continuar'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <ChannelTechnicalGrid channels={channels} secureTenantSlug={tenantSlug} returnTo={returnTo} allowActions={actionsEnabled} />
      </div>
    </section>
  );
};

export default ChannelActivationChecklist;
