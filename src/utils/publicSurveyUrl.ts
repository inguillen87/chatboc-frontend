import { BASE_API_URL, PUBLIC_SURVEY_BASE_URL } from '@/config';

interface PublicSurveyUrlOptions {
  absolute?: boolean;
}

interface PublicSurveyAssetOptions extends PublicSurveyUrlOptions {
  size?: number;
}

const normalizeSlug = (value: string): string => {
  if (!value) return '';
  return value.trim().replace(/^\/+/, '');
};

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

export const getPublicSurveyPath = (slug: string): string => {
  const normalized = normalizeSlug(slug);
  return normalized ? `/e/${normalized}` : '';
};

export const getAbsolutePublicSurveyUrl = (slug: string): string => {
  const path = getPublicSurveyPath(slug);
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
    return getPublicSurveyPath(slug);
  }

  return getAbsolutePublicSurveyUrl(slug);
};

const getQrPath = (slug: string, size?: number): string => {
  const normalized = normalizeSlug(slug);
  if (!normalized) return '';
  const query = typeof size === 'number' && Number.isFinite(size) ? `?size=${Math.max(16, Math.round(size))}` : '';
  return `/public/encuestas/${normalized}/qr${query}`;
};

const getQrPagePath = (slug: string): string => {
  const normalized = normalizeSlug(slug);
  return normalized ? `/encuestas/${normalized}/qr` : '';
};

const buildQuickchartQrUrl = (slug: string, size?: number): string => {
  const targetUrl = getPublicSurveyUrl(slug);
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
  const path = getQrPath(slug, options.size);
  if (!path) return '';

  if (options.absolute === false) {
    return path;
  }

  const base = resolveBaseUrl();

  if (!shouldUseQuickchartQr(base)) {
    return `${base}${path}`;
  }

  return buildQuickchartQrUrl(slug, options.size);
};

export const getPublicSurveyQrPageUrl = (
  slug: string,
  options: PublicSurveyUrlOptions = {},
): string => {
  const path = getQrPagePath(slug);
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
