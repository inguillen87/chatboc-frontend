export const buildTenantPath = (basePath: string, tenantSlug?: string | null) => {
  if (tenantSlug && !basePath.startsWith('/t/')) {
    const normalized = basePath.startsWith('/') ? basePath.slice(1) : basePath;
    return `/t/${encodeURIComponent(tenantSlug)}/${normalized}`;
  }
  return basePath;
};

export const buildTenantAwareNavigatePath = (
  basePath: string,
  tenantSlug?: string | null,
  fallbackQueryParam = 'tenant_slug',
) => {
  if (tenantSlug) {
    return buildTenantPath(basePath, tenantSlug);
  }
  if (fallbackQueryParam) {
    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}${fallbackQueryParam}=`;
  }
  return basePath;
};
