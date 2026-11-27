import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { listPublicSurveys, type PublicSurveyListResult } from '@/api/encuestas';
import { listTenantEvents, listTenantNews } from '@/api/tenant';
import { queryKeys } from '@/lib/queryKeys';
import type {
  TenantEventItem,
  TenantNewsItem,
  TenantPublicNavigationItem,
} from '@/types/tenant';

export type TenantPublicServiceKind = 'news' | 'events' | 'surveys' | 'tickets' | 'other';

const SERVICE_WORDS: Record<Exclude<TenantPublicServiceKind, 'other'>, Set<string>> = {
  news: new Set(['noticia', 'noticias', 'news']),
  events: new Set(['evento', 'eventos', 'agenda', 'agendas', 'event', 'events']),
  surveys: new Set([
    'encuesta', 'encuestas', 'votacion', 'votaciones', 'sondeo', 'sondeos',
    'survey', 'surveys', 'poll', 'polls',
  ]),
  tickets: new Set(['reclamo', 'reclamos', 'solicitud', 'solicitudes', 'ticket', 'tickets']),
};

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const words = (value: unknown) => normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const normalizePathSegment = (value: string) => {
  try {
    return normalizeText(decodeURIComponent(value));
  } catch {
    return normalizeText(value);
  }
};

const navigationSearchWords = (item: TenantPublicNavigationItem, tenantSlug: string) => {
  const normalizedTenantSlug = normalizeText(tenantSlug);
  const pathWords = [item.route, item.href, item.endpoint].flatMap((value) => {
    if (typeof value !== 'string') return [];
    const [pathOnly] = value.split(/[?#]/, 1);
    return pathOnly
      .split(/[\\/]+/)
      .filter((segment) => segment && normalizePathSegment(segment) !== normalizedTenantSlug)
      .flatMap(words);
  });
  return [...words([item.id, item.label].filter(Boolean).join(' ')), ...pathWords];
};

export const isUsableTenantPublicNavigationItem = (item: TenantPublicNavigationItem) =>
  item.visible !== false && item.enabled !== false;

export const tenantPublicServiceKind = (
  item: TenantPublicNavigationItem,
  tenantSlug = '',
): TenantPublicServiceKind => {
  const searchWords = navigationSearchWords(item, tenantSlug);
  for (const kind of ['news', 'events', 'surveys', 'tickets'] as const) {
    if (searchWords.some((word) => SERVICE_WORDS[kind].has(word))) return kind;
  }
  return 'other';
};

export const findTenantPublicServiceItem = (
  items: TenantPublicNavigationItem[],
  kind: Exclude<TenantPublicServiceKind, 'other'>,
  tenantSlug = '',
) => items.find((item) => tenantPublicServiceKind(item, tenantSlug) === kind) ?? null;

export const tenantPublicNavigationHasEndpoint = (item?: TenantPublicNavigationItem | null) =>
  typeof item?.endpoint === 'string' && item.endpoint.trim().length > 0;

const isOpenPublicSurvey = (survey: PublicSurveyListResult[number], now: number) => {
  const startsAt = new Date(survey.inicio_at).getTime();
  const endsAt = survey.fin_at ? new Date(survey.fin_at).getTime() : null;
  return Number.isFinite(startsAt) && (endsAt === null || Number.isFinite(endsAt)) &&
    startsAt <= now && (endsAt === null || endsAt >= now);
};

/**
 * The shell and the home page consume this same hook and these same query keys.
 * React Query therefore performs one read per published collection while both
 * surfaces make the same truthful decision about empty navigation and content.
 */
export function useTenantPublicServices(
  tenantSlug: string,
  rawNavigationItems: TenantPublicNavigationItem[] | undefined,
) {
  const navigationItems = useMemo(
    () => (rawNavigationItems ?? []).filter(isUsableTenantPublicNavigationItem),
    [rawNavigationItems],
  );
  const newsNavigation = useMemo(
    () => findTenantPublicServiceItem(navigationItems, 'news', tenantSlug),
    [navigationItems, tenantSlug],
  );
  const eventsNavigation = useMemo(
    () => findTenantPublicServiceItem(navigationItems, 'events', tenantSlug),
    [navigationItems, tenantSlug],
  );
  const surveysNavigation = useMemo(
    () => findTenantPublicServiceItem(navigationItems, 'surveys', tenantSlug),
    [navigationItems, tenantSlug],
  );
  const ticketsNavigation = useMemo(
    () => findTenantPublicServiceItem(navigationItems, 'tickets', tenantSlug),
    [navigationItems, tenantSlug],
  );

  const newsQuery = useQuery<TenantNewsItem[]>({
    queryKey: queryKeys.tenant.news(tenantSlug, 'full'),
    enabled: Boolean(tenantSlug && newsNavigation),
    queryFn: () => listTenantNews(tenantSlug),
    staleTime: 1000 * 60 * 5,
  });
  const eventsQuery = useQuery<TenantEventItem[]>({
    queryKey: queryKeys.tenant.events(tenantSlug, 'full'),
    enabled: Boolean(tenantSlug && eventsNavigation),
    queryFn: () => listTenantEvents(tenantSlug),
    staleTime: 1000 * 60 * 5,
  });
  const surveysQuery = useQuery<PublicSurveyListResult>({
    queryKey: queryKeys.tenant.surveys(tenantSlug, 'full'),
    enabled: Boolean(
      tenantSlug && surveysNavigation && tenantPublicNavigationHasEndpoint(surveysNavigation),
    ),
    queryFn: () => listPublicSurveys(tenantSlug),
    staleTime: 1000 * 60 * 5,
  });

  const newsItems = useMemo(
    () => (Array.isArray(newsQuery.data) ? newsQuery.data : []),
    [newsQuery.data],
  );
  const eventItems = useMemo(
    () => (Array.isArray(eventsQuery.data) ? eventsQuery.data : []),
    [eventsQuery.data],
  );
  const surveyItems = useMemo(
    () => (Array.isArray(surveysQuery.data)
      ? surveysQuery.data.filter((survey) => isOpenPublicSurvey(survey, Date.now()))
      : []),
    [surveysQuery.data],
  );

  const availability = {
    news: newsQuery.isSuccess && newsItems.length > 0,
    events: eventsQuery.isSuccess && eventItems.length > 0,
    surveys:
      tenantPublicNavigationHasEndpoint(surveysNavigation) &&
      surveysQuery.isSuccess &&
      surveyItems.length > 0,
  };

  const visibleNavigationItems = useMemo(
    () => navigationItems.filter((item) => {
      const kind = tenantPublicServiceKind(item, tenantSlug);
      if (kind === 'news') return availability.news;
      if (kind === 'events') return availability.events;
      if (kind === 'surveys') return availability.surveys;
      return true;
    }),
    [availability.events, availability.news, availability.surveys, navigationItems, tenantSlug],
  );

  return {
    navigationItems,
    visibleNavigationItems,
    newsNavigation,
    eventsNavigation,
    surveysNavigation,
    ticketsNavigation,
    newsItems,
    eventItems,
    surveyItems,
    newsQuery,
    eventsQuery,
    surveysQuery,
    availability,
  };
}
