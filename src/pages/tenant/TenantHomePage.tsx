import { useCallback, useId, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ClipboardList, FileText, Newspaper } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { getTenantPublicNavigation } from '@/api/tenant';
import InstitutionalAssistant, {
  type PublicKnowledgeLoadState,
} from '@/components/knowledge/InstitutionalAssistant';
import { TenantShell } from '@/components/tenant/TenantShell';
import { useTenant } from '@/context/TenantContext';
import { useTenantPublicServices } from '@/hooks/useTenantPublicServices';
import { cn } from '@/lib/utils';
import type { TenantPublicNavigationItem } from '@/types/tenant';
import { tenantHostNavigationTarget } from '@/utils/tenantHostBinding';
import { resolveTenantPublicNavigationTarget } from '@/utils/tenantPaths';

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d 'de' MMMM", { locale: es });
};

const navigationTarget = (
  item: TenantPublicNavigationItem | null,
  basePath: string | null,
  hostBinding: ReturnType<typeof useTenant>['hostBinding'],
) => {
  if (!item || !basePath) return null;
  return tenantHostNavigationTarget(
    hostBinding,
    resolveTenantPublicNavigationTarget(item, basePath),
  );
};

type DirectAccess = {
  label: string;
  to: string;
  icon: ElementType;
};

const DirectAccessList = ({ items }: { items: DirectAccess[] }) => {
  const headingId = useId();
  if (!items.length) return null;
  return (
    <section aria-labelledby={headingId} className="max-w-3xl">
      <h2 id={headingId} className="text-2xl font-semibold tracking-tight">Accesos directos</h2>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {items.map(({ label, to, icon: Icon }) => (
          <li key={`${label}:${to}`}>
            <Link
              to={to}
              className="group flex min-h-14 w-full items-center gap-3 px-1 py-3 font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Icon
                className="h-5 w-5 shrink-0 text-primary"
                style={{ color: 'var(--brand-accent-1, hsl(var(--primary)))' }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">{label}</span>
              <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const PublishedSection = ({
  title,
  target,
  children,
}: {
  title: string;
  target: string | null;
  children: ReactNode;
}) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="max-w-3xl border-t border-border pt-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-2xl font-semibold tracking-tight">{title}</h2>
        {target ? (
          <Link
            to={target}
            className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Ver todo <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
};

const TenantPublicLanding = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug, hostBinding } = useTenant();
  const [knowledgeLoad, setKnowledgeLoad] = useState<{
    tenantSlug: string;
    state: PublicKnowledgeLoadState;
  } | null>(null);

  const slug = useMemo(() => {
    const routeSlug = params.tenant?.trim();
    if (routeSlug) return routeSlug.toLowerCase() === 'default' ? '' : routeSlug;
    const contextSlug = tenant?.slug ?? currentSlug;
    if (!contextSlug?.trim() || contextSlug.trim().toLowerCase() === 'default') return '';
    return contextSlug.trim();
  }, [currentSlug, params.tenant, tenant?.slug]);

  const basePath = slug ? `/t/${encodeURIComponent(slug)}` : null;
  const knowledgeState = knowledgeLoad?.tenantSlug === slug ? knowledgeLoad.state : 'loading';
  const handleKnowledgeState = useCallback((state: PublicKnowledgeLoadState) => {
    setKnowledgeLoad({ tenantSlug: slug, state });
  }, [slug]);
  const navigationQuery = useQuery({
    queryKey: ['tenant-public-navigation', slug],
    enabled: Boolean(slug),
    queryFn: () => getTenantPublicNavigation(slug),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
  const services = useTenantPublicServices(slug, navigationQuery.data?.items);

  const ticketsTarget = navigationTarget(services.ticketsNavigation, basePath, hostBinding);
  const surveysTarget = services.availability.surveys
    ? navigationTarget(services.surveysNavigation, basePath, hostBinding)
    : null;
  const newsTarget = services.availability.news
    ? navigationTarget(services.newsNavigation, basePath, hostBinding)
    : null;
  const eventsTarget = services.availability.events
    ? navigationTarget(services.eventsNavigation, basePath, hostBinding)
    : null;

  const directAccesses = useMemo(
    () => [
      ticketsTarget
        ? { label: 'Hacer un reclamo o pedido', to: ticketsTarget, icon: FileText }
        : null,
      surveysTarget
        ? { label: 'Encuestas abiertas', to: surveysTarget, icon: ClipboardList }
        : null,
      newsTarget ? { label: 'Noticias', to: newsTarget, icon: Newspaper } : null,
      eventsTarget ? { label: 'Eventos', to: eventsTarget, icon: CalendarDays } : null,
    ].filter((item): item is DirectAccess => Boolean(item)),
    [eventsTarget, newsTarget, surveysTarget, ticketsTarget],
  );

  if (!slug) return <TenantShell compactHeader titleSection="Inicio">{null}</TenantShell>;

  return (
    <TenantShell compactHeader titleSection="Inicio">
      <div className="grid min-w-0 gap-10">
        {knowledgeState !== 'unavailable' ? (
          <InstitutionalAssistant
            tenantSlug={slug}
            mode="public"
            publicIdentity={tenant?.publishedIdentity}
            publicLayout={knowledgeState === 'published' ? 'services' : 'reader'}
            onPublicKnowledgeState={handleKnowledgeState}
          />
        ) : null}

        <DirectAccessList items={directAccesses} />

        {services.availability.news ? (
          <PublishedSection title={services.newsNavigation!.label} target={newsTarget}>
            <ul className="mt-4 divide-y divide-border">
              {services.newsItems.slice(0, 3).map((item) => (
                <li key={String(item.id)} className="py-4">
                  <article>
                    <h3 className="text-lg font-semibold leading-7">{item.titulo}</h3>
                    {item.resumen ? (
                      <p className="mt-1 max-w-2xl leading-7 text-muted-foreground">{item.resumen}</p>
                    ) : null}
                    {formatDate(item.publicado_at) ? (
                      <p className="mt-2 text-sm text-muted-foreground">{formatDate(item.publicado_at)}</p>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          </PublishedSection>
        ) : null}

        {services.availability.events ? (
          <PublishedSection title={services.eventsNavigation!.label} target={eventsTarget}>
            <ul className="mt-4 divide-y divide-border">
              {services.eventItems.slice(0, 3).map((event) => (
                <li key={String(event.id)} className="py-4">
                  <article>
                    <h3 className="text-lg font-semibold leading-7">{event.titulo}</h3>
                    {event.descripcion ? (
                      <p className="mt-1 max-w-2xl leading-7 text-muted-foreground">{event.descripcion}</p>
                    ) : null}
                    {formatDate(event.starts_at) || event.lugar ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {[formatDate(event.starts_at), event.lugar].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          </PublishedSection>
        ) : null}

        {services.availability.surveys ? (
          <PublishedSection title={services.surveysNavigation!.label} target={surveysTarget}>
            <ul className="mt-4 divide-y divide-border">
              {services.surveyItems.slice(0, 3).map((survey) => {
                const surveyTarget = basePath
                  ? tenantHostNavigationTarget(hostBinding, `${basePath}/encuestas/${encodeURIComponent(survey.slug)}`)
                  : null;
                return (
                  <li key={survey.slug} className="py-3">
                    {surveyTarget ? (
                      <Link
                        to={surveyTarget}
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-md px-1 font-semibold underline-offset-4',
                          'hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        )}
                      >
                        <span className="min-w-0 flex-1">{survey.titulo}</span>
                        <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="font-semibold">{survey.titulo}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </PublishedSection>
        ) : null}
      </div>
    </TenantShell>
  );
};

export default TenantPublicLanding;
