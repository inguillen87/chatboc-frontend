const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const normalizeRequestedDemoTenantSlug = (value?: string | null): string | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || !TENANT_SLUG_PATTERN.test(normalized)) return null;
  return normalized;
};

export const resolveDemoTenantSlug = (
  requestedTenant: string | null | undefined,
  ...fallbacks: Array<string | null | undefined>
): string | null => {
  const requested = normalizeRequestedDemoTenantSlug(requestedTenant);
  if (requested) return requested;

  for (const fallback of fallbacks) {
    const normalized = normalizeRequestedDemoTenantSlug(fallback);
    if (normalized) return normalized;
  }
  return null;
};
