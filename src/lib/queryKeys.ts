export const queryKeys = {
  surveys: {
    public: (slug: string, tenantSlug?: string) => ['surveys', 'public', slug, tenantSlug ?? 'global'] as const,
    publicList: (tenantSlug?: string) => ['surveys', 'public-list', tenantSlug ?? 'global'] as const,
    admin: (id: string | number) => ['surveys', 'admin', String(id)] as const,
    adminList: (serializedFilters = 'all') => ['surveys', 'admin-list', serializedFilters] as const,
    responses: (id: string | number, filters = 'all') => ['surveys', 'responses', String(id), filters] as const,
    snapshots: (id: string | number) => ['surveys', 'snapshots', String(id)] as const,
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
