import { BASE_API_URL, PUBLIC_SURVEY_BASE_URL } from '@/config';

interface PublicSurveyUrlOptions {
  absolute?: boolean;
  tenantSlug?: string | null;
}

interface PublicSurveyAssetOptions extends PublicSurveyUrlOptions {
  size?: number;
}

interface PublicSurveyLike {
  slug?: unknown;
  slug_publico?: unknown;
  canonical_slug?: unknown;
  public_slug?: unknown;
  url_publica?: unknown;
  share_url?: unknown;
  public_url?: unknown;
  tenant_slug?: unknown;
}

const normalizeSlug = (value: string): string => {
  if (!value) return '';
  return value.trim().replace(/^\/+/, '');
};

const readNonEmptyString = (value: unknown): string => {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
};

export const getPublicSurveyCanonicalSlug = (survey?: PublicSurveyLike | null): string => {
  if (!survey) return '';

  return (
    readNonEmptyString(survey.slug_publico) ||
    readNonEmptyString(survey.canonical_slug) ||
    readNonEmptyString(survey.public_slug) ||
    readNonEmptyString(survey.slug)
  );
};

export const getPublicSurveyUrlFromRecord = (survey?: PublicSurveyLike | null): string => {
  if (!survey) return '';

  const providedUrl =
    readNonEmptyString(survey.url_publica) ||
    readNonEmptyString(survey.share_url) ||
    readNonEmptyString(survey.public_url);

  if (providedUrl) return providedUrl;

  return getAbsolutePublicSurveyUrl(getPublicSurveyCanonicalSlug(survey), {
    tenantSlug: readNonEmptyString(survey.tenant_slug) || undefined,
  });
};

export const getPublicSurveyQrUrlFromRecord = (
  survey?: PublicSurveyLike | null,
  options: PublicSurveyAssetOptions = {},
): string =>
  getPublicSurveyQrUrl(getPublicSurveyCanonicalSlug(survey), {
    ...options,
    tenantSlug:
      options.tenantSlug ?? (readNonEmptyString(survey?.tenant_slug) || undefined),
  });

const extractOrigin = (value?: string): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    return url.origin.replace(/\/$/, '');
  } catch (error) {
    return '';
  }
};

const normalizePublicOrigin = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.hostname === 'api.chatboc.ar') {
      url.hostname = 'www.chatboc.ar';
      url.port = '';
      return url.origin;
    }
    return url.origin.replace(/\/$/, '');
  } catch (error) {
    return value.replace(/\/$/, '');
  }
};

const resolveBaseUrl = (): string => {
  if (PUBLIC_SURVEY_BASE_URL) {
    return PUBLIC_SURVEY_BASE_URL.replace(/\/$/, '');
  }

  const baseApiOrigin = extractOrigin(BASE_API_URL);
  if (baseApiOrigin) {
    return normalizePublicOrigin(baseApiOrigin);
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return '';
};

const appendTenantSlug = (path: string, tenantSlug?: string | null): string => {
  const normalizedTenant = readNonEmptyString(tenantSlug);
  if (!path || !normalizedTenant) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}tenant_slug=${encodeURIComponent(normalizedTenant)}`;
};

export const getPublicSurveyPath = (
  slug: string,
  options: PublicSurveyUrlOptions = {},
): string => {
  const normalized = normalizeSlug(slug);
  return normalized
    ? appendTenantSlug(`/e/${normalized}`, options.tenantSlug)
    : '';
};

export const getAbsolutePublicSurveyUrl = (
  slug: string,
  options: PublicSurveyUrlOptions = {},
): string => {
  const path = getPublicSurveyPath(slug, options);
  if (!path) return '';

  const envBase = PUBLIC_SURVEY_BASE_URL;
  if (envBase) {
    return `${envBase}${path}`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}${path}`;
  }

  return path;
};

export const getPublicSurveyUrl = (
  slug: string,
  options: PublicSurveyUrlOptions = {},
): string => {
  if (options.absolute === false) {
    return getPublicSurveyPath(slug, options);
  }

  return getAbsolutePublicSurveyUrl(slug, options);
};

const getQrPath = (
  slug: string,
  size?: number,
  tenantSlug?: string | null,
): string => {
  const normalized = normalizeSlug(slug);
  if (!normalized) return '';
  const search = new URLSearchParams();
  if (typeof size === 'number' && Number.isFinite(size)) {
    search.set('size', String(Math.max(16, Math.round(size))));
  }
  const normalizedTenant = readNonEmptyString(tenantSlug);
  if (normalizedTenant) search.set('tenant_slug', normalizedTenant);
  const query = search.toString();
  return `/public/encuestas/${normalized}/qr${query ? `?${query}` : ''}`;
};

const getQrPagePath = (
  slug: string,
  tenantSlug?: string | null,
): string => {
  const normalized = normalizeSlug(slug);
  return normalized
    ? appendTenantSlug(`/encuestas/${normalized}/qr`, tenantSlug)
    : '';
};

const buildQuickchartQrUrl = (
  slug: string,
  size?: number,
  tenantSlug?: string | null,
): string => {
  const targetUrl = getPublicSurveyUrl(slug, { tenantSlug });
  if (!targetUrl) return '';

  const normalizedSize = Math.max(16, Math.min(2048, Math.round(typeof size === 'number' ? size : 512)));
  return `https://quickchart.io/qr?size=${normalizedSize}&margin=12&text=${encodeURIComponent(targetUrl)}`;
};

export const isQuickchartQrUrl = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.hostname === 'quickchart.io';
  } catch (error) {
    return value.startsWith('https://quickchart.io/qr');
  }
};

const shouldUseQuickchartQr = (base?: string | null): boolean => {
  if (!base) {
    return true;
  }

  try {
    const normalizedBase = base.replace(/\/$/, '');
    if (!normalizedBase) {
      return true;
    }

    const parsedBase = new URL(normalizedBase);

    if (parsedBase.hostname === 'www.chatboc.ar') {
      return true;
    }

    if (typeof window !== 'undefined' && window.location?.origin) {
      const currentOrigin = window.location.origin.replace(/\/$/, '');
      if (currentOrigin && currentOrigin === normalizedBase) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return true;
  }
};

export const getPublicSurveyQrUrl = (
  slug: string,
  options: PublicSurveyAssetOptions = {},
): string => {
  const path = getQrPath(slug, options.size, options.tenantSlug);
  if (!path) return '';

  if (options.absolute === false) {
    return path;
  }

  const base = resolveBaseUrl();

  if (!shouldUseQuickchartQr(base)) {
    return `${base}${path}`;
  }

  return buildQuickchartQrUrl(slug, options.size, options.tenantSlug);
};

export const getPublicSurveyQrPageUrl = (
  slug: string,
  options: PublicSurveyUrlOptions = {},
): string => {
  const path = getQrPagePath(slug, options.tenantSlug);
  if (!path) return '';

  if (options.absolute === false) {
    return path;
  }

  const base = PUBLIC_SURVEY_BASE_URL;
  if (base) {
    return `${base}${path}`;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}${path}`;
  }

  return path;
};
