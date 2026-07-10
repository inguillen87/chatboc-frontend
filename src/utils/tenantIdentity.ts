import { TENANT_PLACEHOLDER_SLUGS } from '@/utils/tenantPaths';

type RecordLike = Record<string, any> | null | undefined;

export const normalizeOperationalTenantSlug = (value?: string | number | null): string | null => {
  if (!value) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const normalized = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized || TENANT_PLACEHOLDER_SLUGS.has(normalized)) return null;
  return normalized;
};

export const resolveOperationalTenantSlug = ({
  user,
  perfil,
  storedTenantSlug,
}: {
  user?: RecordLike;
  perfil?: RecordLike;
  storedTenantSlug?: string | number | null;
}): string | null => {
  const candidates = [
    user?.tenantSlug,
    user?.tenant_slug,
    perfil?.tenant_slug,
    perfil?.slug,
    user?.tenant?.slug,
    user?.tenant?.tenant_slug,
    storedTenantSlug,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOperationalTenantSlug(candidate);
    if (normalized) return normalized;
  }

  return null;
};
