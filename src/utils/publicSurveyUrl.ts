import { PUBLIC_SURVEY_BASE_URL } from '@/config';

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

const resolveBaseUrl = (): string => {
  if (PUBLIC_SURVEY_BASE_URL) {
    return PUBLIC_SURVEY_BASE_URL;
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
  return `/api/public/encuestas/${normalized}/qr${query}`;
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
  return base ? `${base}${path}` : path;
};
