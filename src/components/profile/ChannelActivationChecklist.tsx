import PrivateGuideControl from '@/components/implementation/PrivateGuideControl';
import {readActivationControl} from '@/utils/privateGuideControl';
import PrivateConversationGuide from '@/components/implementation/PrivateConversationGuide';
import {readActivationGuide} from '@/utils/privateConversationGuide';
import React from 'react';
import {
  Accessibility,
  AlertTriangle,
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
  parseTenantChannelActivation,
  parseTenantImplementationJourney,
  type ChannelActivationChannel,
  type ChannelActivationContract,
} from '@/api/v2/channelActivation';
import TenantLaunchJourney, { buildTenantJourneyHref } from '@/components/implementation/TenantLaunchJourney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { usePanelSessionStore } from '@/stores/panelSessionStore';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { readActiveClerkSessionId } from '@/utils/sessionRetirement';
import { useUser } from '@/hooks/useUser';
import { useSessionAuthority } from '@/components/access/SessionAuthorityContext';
import { normalizeProfileTenantSlug } from '@/utils/profileTenantAuthority';

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
  action_required: 'Requiere acción',
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

const clearPanelLanguage = (value?: string | null) => (value ?? '')
  .replace(/\breclamos\s*(?:\/|y)\s*tickets\b/gi, 'casos')
  .replace(/\bCRM operativo\b/gi, 'Personas y casos')
  .replace(/\blogin social\b/gi, 'inicio de sesión')
  .replace(/\bcobros y checkout\b/gi, 'Cobros y pago en línea')
  .replace(/\bself-service\b/gi, 'configuración guiada')
  .replace(/\bmatriz técnica de ruteo\b/gi, 'quién atiende cada tema')
  .replace(/\btemas? de ruteo\b/gi, 'temas sin responsable definido')
  .replace(/\bruteo\b/gi, 'asignación de responsables')
  .replace(/\btickets\b/gi, 'casos')
  .replace(/\bticket\b/gi, 'caso')
  .replace(/\bSLA\b/g, 'plazo')
  .replace(/\bsentimiento neutral\b/gi, 'el mensaje no muestra una emoción marcada');

const CATALOG_CHANNEL_PATTERN = /\b(catalog|catalogo|catálogo|marketplace|inventory|inventario)\b/i;
const ORDER_CHANNEL_PATTERN = /\b(orders?|pedidos?|payments?|pagos?|cobros?|checkout|cart|carrito)\b/i;

const searchableChannelText = (channel: ChannelActivationChannel) => [
  channel.id,
  channel.label,
  channel.description,
  channel.reason_code,
  channel.progress_hint,
  ...(channel.evidence || []),
  ...(channel.actions || []).flatMap((action) => [action.id, action.label, action.href]),
]
  .filter((value): value is string => typeof value === 'string')
  .join(' ')
  .replace(/[_.:/?=&-]+/g, ' ');

const searchableActionText = (action: { id?: string; label?: string; href?: string }) => [
  action.id,
  action.label,
  action.href,
]
  .filter((value): value is string => typeof value === 'string')
  .join(' ')
  .replace(/[_.:/?=&-]+/g, ' ');

const syncErrorMessage =
  'No pudimos actualizar los pasos de preparación. El panel sigue disponible y podés volver a intentarlo.';

// Only compare authority locally; credentials never become link parameters.
const readPanelAuthority = () => {
  const panel = usePanelSessionStore.getState();
  let storedActor: unknown = null;
  try { storedActor = JSON.parse(safeLocalStorage.getItem('user') || 'null')?.id ?? null; } catch {}
  return JSON.stringify([
    panel.authToken, panel.user?.id == null ? null : String(panel.user.id),
    panel.user?.rol, panel.user?.tenant_slug,
    storedActor == null ? null : String(storedActor), readActiveClerkSessionId(),
    ...['authToken', 'authProvider', 'clerkUserId', 'clerkSessionTransport'].map(key => safeLocalStorage.getItem(key)),
  ]);
};

const readInitialActivation = (data: ChannelActivationContract | null | undefined, slug: string | null) => {
  if (!data || !slug) return null;
  try { return parseTenantChannelActivation(data, slug); } catch { return null; }
};

const ChannelTechnicalGrid: React.FC<{
  channels: ChannelActivationChannel[];
  secureTenantSlug?: string;
  returnTo?: string;
  onNavigate?: React.MouseEventHandler<HTMLAnchorElement>;
}> = ({ channels, secureTenantSlug, returnTo, onNavigate }) => {
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
              <h3 className="text-sm font-bold text-foreground">Todavía no hay pasos para mostrar</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Falta que el sistema informe qué canales y configuraciones hay que preparar. Usá «Actualizar» para volver a consultar.
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
        const primaryHref = primary?.href && secureTenantSlug
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
                  <h3 className="min-w-0 text-sm font-bold text-foreground">{clearPanelLanguage(channel.label)}</h3>
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
                <p className="mt-2 text-sm leading-5 text-muted-foreground">{clearPanelLanguage(channel.description)}</p>
              </div>
            </div>

            {channel.required_plan ? (
              <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-700 dark:text-amber-200">
                Requiere plan {channel.required_plan}.
              </p>
            ) : null}

            {primaryHref ? (
              <Button asChild variant="outline" size="sm" className="mt-4 min-h-11 w-full justify-center">
                <a href={primaryHref} onClick={onNavigate}>
                  {clearPanelLanguage(primary.label || 'Abrir')}
                </a>
              </Button>
            ) : null}

            {channel.evidence?.length || channel.progress_hint ? (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="min-h-11 cursor-pointer py-3 font-medium text-foreground">Datos para soporte</summary>
                <ul className="space-y-1 border-t border-border/60 pt-3">
                  {channel.progress_hint ? <li className="break-words">{channel.progress_hint}</li> : null}
                  {(channel.evidence || []).slice(0, 3).map((item) => <li key={item} className="break-words">{item}</li>)}
                </ul>
              </details>
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
  catalogEnabled?: boolean;
  ordersEnabled?: boolean;
  presentation?: 'overview' | 'launch-journey';
  privateGuideSessionKey?: string;
  returnTo?: string;
}

const ChannelActivationChecklist: React.FC<ChannelActivationChecklistProps> = ({
  tenantSlug,
  initialData,
  highlighted = false,
  catalogEnabled = true,
  ordersEnabled = true,
  presentation = 'overview',
  returnTo,
  privateGuideSessionKey,
}) => {
  const selectedTenant = normalizeProfileTenantSlug(tenantSlug);
  const { user, hasVerifiedSession, organizationProfileVerified, loading: profileLoading } = useUser();
  const { clerkStatus } = useSessionAuthority();
  const profileReady = hasVerifiedSession && organizationProfileVerified && !profileLoading
    && clerkStatus !== 'loading' && clerkStatus !== 'syncing';
  const [authorityEpoch, setAuthorityEpoch] = React.useState(0);
  const contextIdentity = JSON.stringify([user?.id, user?.rol, user?.role, user?.tenant_slug, user?.tenantSlug,
    user?.capabilities, user?.permissions, hasVerifiedSession, organizationProfileVerified, profileLoading, clerkStatus]);
  const guideScope = JSON.stringify([selectedTenant, privateGuideSessionKey, contextIdentity,
    readPanelAuthority(), captureChatbocSessionRevision(), authorityEpoch]);
  const [dataEntry, setDataEntry] = React.useState(() => ({
    data: readInitialActivation(initialData, selectedTenant), scope: guideScope,
  }));
  const data = dataEntry.scope === guideScope ? dataEntry.data : null;
  const [loading, setLoading] = React.useState(Boolean(selectedTenant));
  const [error, setError] = React.useState<string | null>(null);
  const activeScope = React.useRef(guideScope); activeScope.current = guideScope;
  const requestRevision = React.useRef(0);
  const mounted = React.useRef(false);
  const [verifiedActivation, setVerifiedActivation] = React.useState<{
    data: ChannelActivationContract; scope: string; request: number; session: number; authority: string;
  } | null>(null);

  React.useLayoutEffect(() => {
    mounted.current = true;
    let authority = readPanelAuthority();
    const retire = () => {
      ++requestRevision.current;
      setVerifiedActivation(null);
      setAuthorityEpoch(epoch => epoch + 1);
    };
    const changed = () => {
      const next = readPanelAuthority();
      if (next !== authority) retire();
      authority = next;
    };
    const unsubscribePanel = usePanelSessionStore.subscribe(changed);
    const unsubscribeRevision = subscribeChatbocSessionRevision(retire);
    const onStorage = (event: StorageEvent) => { if (event.storageArea === window.localStorage) changed(); };
    window.addEventListener('storage', onStorage);
    return () => {
      mounted.current = false;
      ++requestRevision.current;
      unsubscribePanel(); unsubscribeRevision(); window.removeEventListener('storage', onStorage);
    };
  }, []);
  React.useLayoutEffect(() => { ++requestRevision.current; }, [guideScope]);

  React.useEffect(() => {
    // `/me` may finish after the workspace mounts. Keep the visible contract
    // aligned with that verified tenant snapshot instead of retaining a stale
    // session payload (for example, an obsolete Free plan badge).
    setDataEntry({ data: readInitialActivation(initialData, selectedTenant), scope: guideScope });
    // Profile metadata can update presentation, but never grants navigation.
    // An authority-only change must not rebind an old initial descriptor.
  }, [initialData, selectedTenant]);

  const load = React.useCallback(async () => {
    if (!selectedTenant || !profileReady) return;
    const revision = ++requestRevision.current;
    const sessionRevision = captureChatbocSessionRevision();
    const authority = readPanelAuthority();
    const isCurrent = () => mounted.current && revision === requestRevision.current
      && activeScope.current === guideScope
      && isChatbocSessionRevisionCurrent(sessionRevision) && readPanelAuthority() === authority;
    setVerifiedActivation(null);
    setLoading(true);
    setError(null);
    try {
      const response = parseTenantChannelActivation(await fetchTenantChannelActivation(selectedTenant, { isCurrent }), selectedTenant);
      if (!isCurrent()) return;
      setDataEntry({ data: response, scope: guideScope });
      setVerifiedActivation({ data: response, scope: guideScope, request: revision, session: sessionRevision, authority });
    } catch (err) {
      if (isCurrent()) setError(syncErrorMessage);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [initialData, selectedTenant, guideScope, profileReady]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!selectedTenant) return null;

  const navigationIsCurrent = () => Boolean(profileReady && !loading && !error && verifiedActivation
    && verifiedActivation.data === data && verifiedActivation.scope === activeScope.current
    && verifiedActivation.request === requestRevision.current && mounted.current
    && isChatbocSessionRevisionCurrent(verifiedActivation.session)
    && readPanelAuthority() === verifiedActivation.authority);
  const secureTenant = navigationIsCurrent() ? selectedTenant : undefined;
  const onNavigate: React.MouseEventHandler<HTMLAnchorElement> = event => {
    if (!navigationIsCurrent()) event.preventDefault();
  };

  const publishedChannels = Array.isArray(data?.channels) ? data.channels : [];
  const channels = publishedChannels.filter((channel) => {
    const searchableText = searchableChannelText(channel);
    if (!catalogEnabled && CATALOG_CHANNEL_PATTERN.test(searchableText)) return false;
    if (!ordersEnabled && ORDER_CHANNEL_PATTERN.test(searchableText)) return false;
    return true;
  });
  const commerceChannelsWereHidden = channels.length !== publishedChannels.length;
  const ready = commerceChannelsWereHidden
    ? channels.filter((item) => item.ready || item.status === 'ready').length
    : data?.summary?.ready ?? channels.filter((item) => item.ready).length;
  const total = commerceChannelsWereHidden ? channels.length : data?.summary?.total ?? channels.length;
  const progress = commerceChannelsWereHidden
    ? normalizeProgress(total ? (ready / total) * 100 : 0)
    : normalizeProgress(data?.summary?.progress);
  const hiddenActionKeys = new Set(
    publishedChannels
      .filter((channel) => !channels.includes(channel))
      .flatMap((channel) => (channel.actions || []).flatMap((action) => [action.id, action.href].filter(Boolean))),
  );
  const publishedPrimaryAction = data?.summary?.primary_next_action;
  const primaryAction = publishedPrimaryAction
    && !hiddenActionKeys.has(publishedPrimaryAction.id)
    && !hiddenActionKeys.has(publishedPrimaryAction.href)
    && (catalogEnabled || !CATALOG_CHANNEL_PATTERN.test(searchableActionText(publishedPrimaryAction)))
    && (ordersEnabled || !ORDER_CHANNEL_PATTERN.test(searchableActionText(publishedPrimaryAction)))
    ? publishedPrimaryAction
    : undefined;
  const locked = commerceChannelsWereHidden
    ? channels.filter((item) => item.locked || item.status === 'locked' || item.status === 'blocked').length
    : data?.summary?.locked ?? channels.filter((item) => item.locked).length;
  const hasChannels = channels.length > 0;
  const integrationStatus = String(data?.integration_access?.status || '').toLowerCase();
  const selfServiceActive = integrationStatus === 'partial';
  const implementationJourney = secureTenant ? parseTenantImplementationJourney(data?.implementation_journey) : null;
  const primaryHref = secureTenant && primaryAction?.href && primaryAction.kind !== 'api'
    ? buildTenantJourneyHref(primaryAction.href, secureTenant, returnTo) : null;

  if (presentation === 'launch-journey') {
    return (
      <div data-testid="channel-activation-checklist" data-presentation="launch-journey" onClickCapture={event => {
        if ((event.target as Element).closest('a') && !navigationIsCurrent()) event.preventDefault();
      }}>
        <TenantLaunchJourney
          tenantSlug={selectedTenant}
          journey={implementationJourney}
          loading={loading || !profileReady}
          error={error}
          onRefresh={() => void load()}
          returnTo={returnTo}
          technicalDetails={(
            <ChannelTechnicalGrid
              channels={channels}
              secureTenantSlug={secureTenant}
              returnTo={returnTo}
              onNavigate={onNavigate}
            />
          )}
        />
        <PrivateGuideControl sessionKey={privateGuideSessionKey||''} onSaved={()=>void load()}
          access={secureTenant&&privateGuideSessionKey ?readActivationControl(data,secureTenant):null}/>
        <PrivateConversationGuide sessionKey={privateGuideSessionKey||''}
          access={secureTenant&&privateGuideSessionKey ?readActivationGuide(data,secureTenant):null}/>
      </div>
    );
  }

  return (
    <section
      data-testid="channel-activation-checklist"
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-card',
        highlighted && 'border-primary/70',
      )}
    >
      <div className="grid gap-5 border-b border-border/60 bg-muted/20 p-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {loading ? (
              <Badge variant="secondary">Actualizando información</Badge>
            ) : data?.integration_access?.current_plan ? (
              <Badge variant="secondary" className="capitalize">
                Plan {data.integration_access.current_plan}
              </Badge>
            ) : null}
            {selfServiceActive ? (
              <Badge variant="outline">
                Configuración guiada disponible
              </Badge>
            ) : null}
            {locked ? (
              <Badge variant="outline">
                {locked} {locked === 1 ? 'paso bloqueado' : 'pasos bloqueados'}
              </Badge>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-bold sm:text-2xl">Preparación para empezar</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Revisá qué ya está listo y qué paso falta para habilitar la atención, los canales y los indicadores de la organización.
          </p>
          {error ? (
            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/70 bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{clearPanelLanguage(data?.summary?.health_label || 'Preparación en curso')}</span>
            <span className="text-2xl font-bold">{progress}%</span>
          </div>
          <Progress
            value={progress}
            className="mt-3 h-2"
            aria-label="Progreso de la preparación"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {hasChannels ? `${ready} de ${total || channels.length} pasos listos.` : 'Falta recibir la lista de pasos.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {primaryHref ? (
              <Button asChild size="sm" className="min-h-11">
                <a href={primaryHref} onClick={onNavigate}>
                  {clearPanelLanguage(primaryAction.label || 'Continuar')}
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => void load()}
              disabled={loading || !profileReady}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <ChannelTechnicalGrid channels={channels} secureTenantSlug={secureTenant} returnTo={returnTo} onNavigate={onNavigate} />
      </div>
    </section>
  );
};

export default ChannelActivationChecklist;
