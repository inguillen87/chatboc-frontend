const LEGACY_DEMO_CATALOG_PREFIX = '/media/demo_catalogs/';
const DEMO_CATALOG_ASSET_PREFIX = '/api/v2/demo/catalog-assets/';

export const normalizeDemoResourceUrl = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://chatboc.ar';
    const parsed = new URL(trimmed, base);

    if (!parsed.pathname.startsWith(LEGACY_DEMO_CATALOG_PREFIX)) {
      return trimmed;
    }

    const suffix = parsed.pathname.slice(LEGACY_DEMO_CATALOG_PREFIX.length);
    const normalizedPath = `${DEMO_CATALOG_ASSET_PREFIX}${suffix}`;
    const normalizedRelative = `${normalizedPath}${parsed.search}${parsed.hash}`;
    return /^https?:\/\//i.test(trimmed)
      ? `${parsed.origin}${normalizedRelative}`
      : normalizedRelative;
  } catch {
    if (!trimmed.startsWith(LEGACY_DEMO_CATALOG_PREFIX)) return trimmed;
    return `${DEMO_CATALOG_ASSET_PREFIX}${trimmed.slice(LEGACY_DEMO_CATALOG_PREFIX.length)}`;
  }
};

export const isDemoCatalogResourceUrl = (value?: string | null): boolean => {
  const normalized = normalizeDemoResourceUrl(value);
  if (!normalized) return false;

  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://chatboc.ar';
    return new URL(normalized, base).pathname.startsWith(DEMO_CATALOG_ASSET_PREFIX);
  } catch {
    return normalized.startsWith(DEMO_CATALOG_ASSET_PREFIX);
  }
};

export const normalizeDemoResourceUrlsDeep = <T>(value: T): T => {
  if (typeof value === 'string') {
    return normalizeDemoResourceUrl(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDemoResourceUrlsDeep(item)) as T;
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      normalizeDemoResourceUrlsDeep(entry),
    ]),
  ) as T;
};

