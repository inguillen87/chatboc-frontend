import { PUBLIC_SURVEY_BASE_URL } from '@/config';

interface PublicSurveyUrlOptions {
  absolute?: boolean;
}

const normalizeSlug = (value: string): string => {
  if (!value) return '';
  return value.trim().replace(/^\/+/, '');
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
