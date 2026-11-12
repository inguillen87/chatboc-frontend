import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { tenantService } from '@/services/tenantService';
import type { TenantConfigBundle, TenantOrganizationProfile } from '@/types/TenantConfig';
import { normalizeProfileTenantSlug, readExplicitTenantRequest } from '@/utils/profileTenantAuthority';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { TenantDomainSettings } from '@/components/tenant/TenantDomainSettings';
import { usePanelSessionStore } from '@/stores/panelSessionStore';

const readAuthorizedProfile = (bundle: TenantConfigBundle, slug: string): TenantOrganizationProfile | null => {
  const profile = bundle?.organization_profile;
  if (bundle?.tenant?.slug !== slug || !Number.isSafeInteger(bundle.tenant.id) || bundle.tenant.id! < 1 ||
    profile?.contract_version !== 'organization.profile_settings.v1' || profile.tenant?.slug !== slug ||
    profile.tenant.id !== bundle.tenant.id || !/^[0-9a-f]{64}$/.test(profile.revision) ||
    !((profile.can_edit === true && profile.editability?.mode === 'editable') ||
      (profile.can_edit === false && profile.editability?.mode === 'read_only'))) return null;
  return profile;
};

const actorAuthority = (value: unknown) => {
  const actor = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return JSON.stringify([actor.id, actor.user_id, actor.clerk_user_id, actor.sub, actor.email,
    actor.role, actor.rol, actor.permissions, actor.capabilities, actor.scopes, actor.tenantSlug, actor.tenant_slug]);
};

type RequestContext = { scopeKey: string; slug: string; sessionRevision: number; panelGeneration: number };
type RetryFocus = { scopeKey: string; attempt: number; context: RequestContext | null;
  origin: HTMLElement; retiring: boolean; cleanup: () => void };
type ProfileRead = { context: RequestContext; status: 'ready'; name: string; profile: TenantOrganizationProfile } |
  { context: RequestContext; status: 'error' };

/** Read-only entry to the existing editor. This link grants no write authority. */
export default function InstitutionalProfileAccess({ includeDomainSettings = false }: { includeDomainSettings?: boolean }) {
  const { tenant: routeTenant } = useParams();
  const [searchParams] = useSearchParams();
  const { currentSlug, tenant: publicTenant, isLoadingTenant, tenantError } = useTenant();
  const { user, loading: userLoading, hasVerifiedSession, organizationProfileVerified } = useUser();
  const sessionRevision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const descriptionId = useId();
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<ProfileRead | null>(null);
  const panelGenerationRef = useRef(0), requestFocus = useRef<RetryFocus | null>(null);
  const loadingTarget = useRef<HTMLElement | null>(null), resultTarget = useRef<HTMLElement | null>(null);
  const retireFocus = useCallback(() => {
    const focus = requestFocus.current; requestFocus.current = null; focus?.cleanup();
  }, []);
  // Ref detachment identifies our own DOM replacement before Chromium blurs
  // the outgoing control. A voluntary blur of a retained target never owns BODY.
  const setLoadingTarget = useCallback((element: HTMLElement | null) => {
    if (!element && requestFocus.current?.origin === loadingTarget.current) requestFocus.current.retiring = true;
    loadingTarget.current = element;
  }, []);
  const setResultTarget = useCallback((element: HTMLElement | null) => {
    if (!element && requestFocus.current?.origin === resultTarget.current) requestFocus.current.retiring = true;
    resultTarget.current = element;
  }, []);
  const subscribePanelGeneration = useCallback((notify: () => void) => usePanelSessionStore.subscribe((next, previous) => {
    // Tokens stay in memory and are only compared, never included in a key.
    if (next.authToken !== previous.authToken || actorAuthority(next.user) !== actorAuthority(previous.user)) {
      panelGenerationRef.current += 1;
      retireFocus();
      notify();
    }
  }), [retireFocus]);
  const readPanelGeneration = useCallback(() => panelGenerationRef.current, []);
  // Read the same synchronous snapshot as the store-backed user, including ABA
  // whose final user object is unchanged. No intermediate state epoch is read.
  const panelGeneration = useSyncExternalStore(subscribePanelGeneration, readPanelGeneration, readPanelGeneration);
  useLayoutEffect(() => () => retireFocus(), [retireFocus]);
  const explicit = readExplicitTenantRequest(searchParams);
  const queryValues = ['tenant', 'tenant_slug'].flatMap(key => searchParams.getAll(key));
  const exactQueryValues = queryValues.map(normalizeProfileTenantSlug);
  const routeSlug = normalizeProfileTenantSlug(routeTenant);
  const current = normalizeProfileTenantSlug(currentSlug);
  const conflict = !explicit.valid || exactQueryValues.some(value => !value) ||
    new Set(exactQueryValues).size > 1 || Boolean(routeTenant && !routeSlug) ||
    Boolean(routeSlug && exactQueryValues[0] && routeSlug !== exactQueryValues[0]);
  const target = conflict ? null : routeSlug || exactQueryValues[0] || current;
  const coherent = target && currentSlug === target && publicTenant?.slug === target && !isLoadingTenant && !tenantError;
  const verified = !userLoading && organizationProfileVerified && coherent
    ? buildVerifiedSessionScopeKey({ hasVerifiedSession, tenantSlug: target, user }) : null;
  const scopeKey = verified ? JSON.stringify([verified, actorAuthority(user), organizationProfileVerified, sessionRevision, panelGeneration]) : null;
  const context = useMemo<RequestContext | null>(() => scopeKey && target
    ? { scopeKey, slug: target, sessionRevision, panelGeneration } : null, [scopeKey, target, sessionRevision, panelGeneration, attempt]);
  const activeContext = useRef<RequestContext | null>(null);

  useLayoutEffect(() => {
    activeContext.current = context;
    const focus = requestFocus.current;
    if (focus && context && focus.scopeKey === context.scopeKey && focus.attempt === attempt) focus.context = context;
    else retireFocus();
    return () => { activeContext.current = null; };
  }, [context, attempt, retireFocus]);
  const isCurrent = (candidate: RequestContext) => activeContext.current === candidate &&
    candidate.panelGeneration === panelGenerationRef.current && isChatbocSessionRevisionCurrent(candidate.sessionRevision);

  useEffect(() => {
    if (!context) return;
    let retired = false;
    const current = () => !retired && isCurrent(context);
    void tenantService.getTenantConfig(context.slug, { isCurrent: current }).then(bundle => {
      if (!current()) return;
      const profile = readAuthorizedProfile(bundle, context.slug);
      if (!profile) throw new Error('organization_profile_unverified');
      setRead({ context, status: 'ready', profile,
        name: typeof bundle.tenant.nombre === 'string' ? bundle.tenant.nombre : context.slug });
    }).catch(() => {
      if (current()) setRead({ context, status: 'error' });
    });
    return () => { retired = true; };
  }, [context]);

  const matching = context && read?.context === context ? read : null;
  useLayoutEffect(() => {
    const focus = requestFocus.current;
    if (!focus || !context || focus.context !== context || !isCurrent(context)) return;
    const active = document.activeElement;
    if (active !== focus.origin && !(active === document.body && focus.retiring)) { retireFocus(); return; }
    const target = matching ? resultTarget.current : loadingTarget.current;
    if (!target?.isConnected) { retireFocus(); return; }
    focus.origin = target; focus.retiring = false;
    target.focus({ preventScroll: true });
    if (matching || document.activeElement !== target) retireFocus();
  }, [context, matching, retireFocus]);
  const retry = (origin: HTMLButtonElement) => {
    if (!context || !isCurrent(context)) return;
    retireFocus();
    if (document.activeElement === origin) {
      const focus: RetryFocus = { scopeKey: context.scopeKey, attempt: attempt + 1,
        context: null, origin, retiring: false, cleanup: () => {} };
      requestFocus.current = focus;
      const trackFocus = (event: FocusEvent) => {
        if (requestFocus.current === focus && event.target !== focus.origin) retireFocus();
      };
      const trackBlur = (event: FocusEvent) => {
        if (requestFocus.current !== focus || event.target !== focus.origin) return;
        if (focus.retiring && (event.relatedTarget === null || event.relatedTarget === document.body)) return;
        retireFocus();
      };
      focus.cleanup = () => {
        document.removeEventListener('focusin', trackFocus);
        document.removeEventListener('focusout', trackBlur);
      };
      document.addEventListener('focusin', trackFocus);
      document.addEventListener('focusout', trackBlur);
    }
    setAttempt(value => value + 1);
  };

  if (!context) {
    const pending = userLoading || isLoadingTenant;
    return <p role={pending && !conflict && !tenantError ? 'status' : 'alert'} className="mt-4 text-sm text-muted-foreground">
      {conflict ? 'La organización de la dirección no coincide. Revisá la URL antes de abrir el perfil institucional.'
        : pending ? 'Verificando la organización y el acceso al perfil institucional.'
          : 'El perfil institucional necesita una organización y una sesión verificadas. Revisá tu acceso antes de continuar.'}
    </p>;
  }
  if (!matching) return <p ref={setLoadingTarget} tabIndex={-1} role="status"
    className="mt-4 rounded-sm text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 forced-colors:focus-visible:outline forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-2 forced-colors:focus-visible:outline-[Highlight]">Verificando el perfil institucional.</p>;
  if (matching.status === 'error') {
    return <div role="alert" className="mt-4 space-y-2 text-sm text-muted-foreground">
      <p>No pudimos verificar el acceso al perfil de esta organización.</p>
      <Button ref={setResultTarget} type="button" variant="outline" className="min-h-11" onClick={event => retry(event.currentTarget)}>Reintentar</Button>
    </div>;
  }
  const href = `/perfil?${new URLSearchParams({ section: 'general', tenant_slug: context.slug }).toString()}`;
  return <div className="mt-4 space-y-2">
    <p className="break-words text-sm font-medium text-foreground">{matching.name}</p>
    <Button asChild variant="outline" className="min-h-11 h-auto max-w-full whitespace-normal text-left">
      <a ref={setResultTarget} href={href} target="_blank" rel="noopener noreferrer" aria-describedby={descriptionId}
        onClick={event => {
          if (!isCurrent(context)) event.preventDefault();
        }}>
        Perfil institucional <ExternalLink className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
      </a>
    </Button>
    <p id={descriptionId} className="text-sm text-muted-foreground">
      Se abre en una nueva pestaña de Chatboc; tus borradores de integraciones se conservan.
    </p>
    {matching.profile.editability.message ? <p className="text-sm text-muted-foreground">{matching.profile.editability.message}</p> : null}
    {includeDomainSettings ? <TenantDomainSettings key={context.scopeKey} tenant={matching.profile.tenant} scopeKey={context.scopeKey} /> : null}
  </div>;
}
