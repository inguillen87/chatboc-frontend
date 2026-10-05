import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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

const readAuthorizedProfile = (bundle: TenantConfigBundle, slug: string): TenantOrganizationProfile | null => {
  const profile = bundle?.organization_profile;
  if (bundle?.tenant?.slug !== slug || !Number.isSafeInteger(bundle.tenant.id) || bundle.tenant.id! < 1 ||
    profile?.contract_version !== 'organization.profile_settings.v1' || profile.tenant?.slug !== slug ||
    profile.tenant.id !== bundle.tenant.id || !/^[0-9a-f]{64}$/.test(profile.revision) ||
    !((profile.can_edit === true && profile.editability?.mode === 'editable') ||
      (profile.can_edit === false && profile.editability?.mode === 'read_only'))) return null;
  return profile;
};

type RequestContext = { scopeKey: string; slug: string; sessionRevision: number };
type ProfileRead = { context: RequestContext; status: 'ready'; name: string; profile: TenantOrganizationProfile } |
  { context: RequestContext; status: 'error' };

/** Read-only entry to the existing editor. This link grants no write authority. */
export default function InstitutionalProfileAccess() {
  const { tenant: routeTenant } = useParams();
  const [searchParams] = useSearchParams();
  const { currentSlug, tenant: publicTenant, isLoadingTenant, tenantError } = useTenant();
  const { user, loading: userLoading, hasVerifiedSession, organizationProfileVerified } = useUser();
  const sessionRevision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const descriptionId = useId();
  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<ProfileRead | null>(null);
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
  const scopeKey = verified ? JSON.stringify([verified, sessionRevision]) : null;
  const context = useMemo<RequestContext | null>(() => scopeKey && target
    ? { scopeKey, slug: target, sessionRevision } : null, [scopeKey, target, sessionRevision, attempt]);
  const activeContext = useRef<RequestContext | null>(null);

  useLayoutEffect(() => {
    activeContext.current = context;
    return () => { activeContext.current = null; };
  }, [context]);

  useEffect(() => {
    if (!context) return;
    let retired = false;
    const isCurrent = () => !retired && activeContext.current === context &&
      isChatbocSessionRevisionCurrent(context.sessionRevision);
    void tenantService.getTenantConfig(context.slug, { isCurrent }).then(bundle => {
      if (!isCurrent()) return;
      const profile = readAuthorizedProfile(bundle, context.slug);
      if (!profile) throw new Error('organization_profile_unverified');
      setRead({ context, status: 'ready', profile,
        name: typeof bundle.tenant.nombre === 'string' ? bundle.tenant.nombre : context.slug });
    }).catch(() => {
      if (isCurrent()) setRead({ context, status: 'error' });
    });
    return () => { retired = true; };
  }, [context]);

  if (!context) {
    const pending = userLoading || isLoadingTenant;
    return <p role={pending && !conflict && !tenantError ? 'status' : 'alert'} className="mt-4 text-sm text-muted-foreground">
      {conflict ? 'La organización de la dirección no coincide. Revisá la URL antes de abrir el perfil institucional.'
        : pending ? 'Verificando la organización y el acceso al perfil institucional.'
          : 'El perfil institucional necesita una organización y una sesión verificadas. Revisá tu acceso antes de continuar.'}
    </p>;
  }
  const matching = read?.context === context ? read : null;
  if (!matching) return <p role="status" className="mt-4 text-sm text-muted-foreground">Verificando el perfil institucional.</p>;
  if (matching.status === 'error') {
    return <div role="alert" className="mt-4 space-y-2 text-sm text-muted-foreground">
      <p>No pudimos verificar el acceso al perfil de esta organización.</p>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setAttempt(value => value + 1)}>Reintentar</Button>
    </div>;
  }
  const href = `/perfil?${new URLSearchParams({ section: 'general', tenant_slug: context.slug }).toString()}`;
  return <div className="mt-4 max-w-xl space-y-2">
    <p className="break-words text-sm font-medium text-foreground">{matching.name}</p>
    <Button asChild variant="outline" className="min-h-11 h-auto max-w-full whitespace-normal text-left">
      <a href={href} target="_blank" rel="noopener noreferrer" aria-describedby={descriptionId}
        onClick={event => {
          if (activeContext.current !== context || !isChatbocSessionRevisionCurrent(context.sessionRevision)) event.preventDefault();
        }}>
        Perfil institucional <ExternalLink className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
      </a>
    </Button>
    <p id={descriptionId} className="text-sm text-muted-foreground">
      Se abre en una nueva pestaña de Chatboc; tus borradores de integraciones se conservan.
    </p>
    {matching.profile.editability.message ? <p className="text-sm text-muted-foreground">{matching.profile.editability.message}</p> : null}
  </div>;
}
