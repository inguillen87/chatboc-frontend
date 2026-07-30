export const tenantQueryScope = (tenantSlug?: string | null) =>
  tenantSlug?.trim().toLowerCase() || 'unscoped';

export const queryKeys = {
  surveys: {
    public: (slug: string, tenantSlug?: string) => ['surveys', 'public', slug, tenantSlug ?? 'global'] as const,
    publicList: (tenantSlug?: string) => ['surveys', 'public-list', tenantSlug ?? 'global'] as const,
    admin: (id: string | number, tenantSlug?: string | null) =>
      ['surveys', 'admin', tenantQueryScope(tenantSlug), String(id)] as const,
    adminList: (serializedFilters = 'all', tenantSlug?: string | null) =>
      ['surveys', 'admin-list', tenantQueryScope(tenantSlug), serializedFilters] as const,
    adminLists: (tenantSlug?: string | null) =>
      ['surveys', 'admin-list', tenantQueryScope(tenantSlug)] as const,
    responses: (id: string | number, filters = 'all', tenantSlug?: string | null) =>
      ['surveys', 'responses', tenantQueryScope(tenantSlug), String(id), filters] as const,
    responsesForSurvey: (id: string | number, tenantSlug?: string | null) =>
      ['surveys', 'responses', tenantQueryScope(tenantSlug), String(id)] as const,
    snapshots: (id: string | number, tenantSlug?: string | null) =>
      ['surveys', 'snapshots', tenantQueryScope(tenantSlug), String(id)] as const,
    analytics: (
      module: string,
      id: string | number,
      tenantSlug?: string | null,
      filters: unknown = 'all',
    ) => ['survey-analytics', module, tenantQueryScope(tenantSlug), String(id), filters] as const,
    analyticsModule: (module: string, id: string | number, tenantSlug?: string | null) =>
      ['survey-analytics', module, tenantQueryScope(tenantSlug), String(id)] as const,
    submitPublic: (slug: string, tenantSlug?: string) => ['surveys', 'public-submit', slug, tenantSlug ?? 'global'] as const,
  },
  tenant: {
    news: (slug: string, mode: 'summary' | 'full' = 'summary') => ['tenant', slug, 'news', mode] as const,
    events: (slug: string, mode: 'summary' | 'full' = 'summary') => ['tenant', slug, 'events', mode] as const,
    surveys: (slug: string, mode: 'summary' | 'full' = 'summary') => ['tenant', slug, 'surveys', mode] as const,
  },
  market: {
    catalog: (tenantSlug: string) => ['market', tenantSlug, 'catalog'] as const,
    cart: (tenantSlug: string) => ['market', tenantSlug, 'cart'] as const,
  },
  portal: {
    content: (tenantSlug: string) => ['portal', tenantSlug, 'content'] as const,
  },
} as const;

export type QueryKeyFactory = typeof queryKeys;
