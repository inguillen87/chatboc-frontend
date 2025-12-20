import { APP_TARGET } from '@/config';

export const TENANT_ROUTE_PREFIXES = ['m', 'market', 't', 'tenant', 'municipio', 'pyme'] as const;

export const TENANT_PLACEHOLDER_SLUGS = new Set([
  'iframe',
  'embed',
  'widget',
  'cart',
  'productos',
  'checkout',
  'checkout-productos',
  'perfil',
  'user',
  'login',
  'register',
  'portal',
  'pedidos',
  'reclamos',
  'encuestas',
  'tickets',
  'opinar',
  'integracion',
  'documentacion',
  'faqs',
  'legal',
  'chat',
  'chatpos',
  'chatcrm',
  'admin',
  'dashboard',
  'analytics',
  'settings',
  'config',
  'api',
  'estadisticas',
  'empleados',
  'municipal',
  'pyme',
  'logs',
  'consultas',
  'presupuestos',
  'recordatorios',
  'historial',
  'usuarios',
  'soluciones',
  'demo',
  'home',
  'landing',
  'incidents',
  'stats',
  'market',
  'whatsapp',
  'telegram',
  'instagram',
  'facebook',
  'mapas',
  'ticket',
  'tickets',
  'admin'
]);

const isPlaceholderSlug = (slug?: string | null) => {
  if (!slug) return false;
  return TENANT_PLACEHOLDER_SLUGS.has(slug.trim().toLowerCase());
};

const hasTenantPrefix = (path: string) =>
  TENANT_ROUTE_PREFIXES.some((prefix) => path.startsWith(`/${prefix}/`));

/**
 * Builds a path that includes the tenant slug as the first segment.
 * e.g. buildTenantPath('/cart', 'municipio') -> '/municipio/cart'
 *
 * It avoids double-prefixing. If the path already has a prefix, it might replace it or leave it
 * depending on logic, but here we prioritize a clean /:slug/:path structure.
 */
export const buildTenantPath = (basePath: string, tenantSlug?: string | null) => {
  const normalizedSlug = tenantSlug?.trim();
  const safeSlug = normalizedSlug?.toLowerCase();

  const normalizedPath = basePath.startsWith('/') ? basePath.slice(1) : basePath;

  if (normalizedSlug && safeSlug && !isPlaceholderSlug(safeSlug)) {
    // If the path already starts with the slug, don't prepend it again.
    // e.g. basePath='municipio/cart', slug='municipio' -> '/municipio/cart'
    if (normalizedPath.startsWith(`${safeSlug}/`)) {
       return `/${normalizedPath}`;
    }

    // If the path has a legacy prefix (e.g. /pyme/cart), strip it if we are adding a slug?
    // Actually, let's just prepend the slug to the clean path.
    // We assume 'basePath' is relative to the tenant root.

    // Check if basePath contains a known prefix that should be removed
    // e.g. if we pass '/pyme/cart' but want '/municipio/cart'
    // This is risky if we don't know for sure.
    // But for this specific task, we want to AVOID /pyme/municipio/

    // Let's rely on the input being a relative path like '/perfil/pedidos'
    return `/${encodeURIComponent(normalizedSlug)}/${normalizedPath}`;
  }

  // Fallback: if no slug, return original path (maybe root path)
  return `/${normalizedPath}`;
};

export const buildTenantApiPath = (basePath: string, tenantSlug?: string | null) => {
  const normalized = basePath.startsWith('/') ? basePath.slice(1) : basePath;
  const safeSlug = tenantSlug?.trim();

  if (safeSlug && !isPlaceholderSlug(safeSlug)) {
    // Return /api/:slug/:path
    return `/api/${encodeURIComponent(safeSlug)}/${normalized}`;
  }

  return `/api/${normalized}`;
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

const applySlugPlaceholder = (template: string, tenantSlug?: string | null) => {
  const trimmed = template.trim();
  const hasPlaceholder = trimmed.includes(':slug');

  if (hasPlaceholder) {
    if (!tenantSlug) return null;
    const encodedSlug = encodeURIComponent(tenantSlug);
    return trimmed.replace(/:slug/gi, encodedSlug);
  }

  return trimmed;
};

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const toAbsoluteUrl = (raw: string, baseUrl?: string | null) => {
  const candidateBase = baseUrl?.trim();
  try {
    if (isAbsoluteUrl(raw)) {
      return new URL(raw).toString();
    }
    if (candidateBase) {
      return new URL(raw, candidateBase.endsWith('/') ? candidateBase : `${candidateBase}/`).toString();
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL(raw, window.location.origin).toString();
    }
    return new URL(raw, 'http://localhost').toString();
  } catch (error) {
    console.warn('[tenantPaths] No se pudo construir URL absoluta', { raw, baseUrl, error });
    return null;
  }
};

interface BuildTenantNavigationUrlOptions {
  basePath: string;
  tenantSlug?: string | null;
  tenant?: { public_base_url?: string | null } | null;
  preferredUrl?: string | null;
  fallbackQueryParam?: string | null;
}

export const buildTenantNavigationUrl = ({
  basePath,
  tenantSlug,
  tenant,
  preferredUrl,
  fallbackQueryParam = 'tenant_slug',
}: BuildTenantNavigationUrlOptions) => {
  const normalizedPath = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const safeSlug = tenantSlug?.trim() || null;
  const publicBase = tenant?.public_base_url ?? null;

  const preferredWithSlug = preferredUrl ? applySlugPlaceholder(preferredUrl, safeSlug) : null;
  const preferredAbsolute = preferredWithSlug ? toAbsoluteUrl(preferredWithSlug, publicBase) : null;
  if (preferredAbsolute) {
    return preferredAbsolute;
  }

  if (publicBase) {
    const tenantPath = buildTenantPath(normalizedPath, safeSlug);
    const absolutePublicPath = toAbsoluteUrl(tenantPath, publicBase);
    if (absolutePublicPath) {
      return absolutePublicPath;
    }
  }

  const fallback = buildTenantAwareNavigatePath(normalizedPath, safeSlug, fallbackQueryParam || undefined);
  return toAbsoluteUrl(fallback, typeof window !== 'undefined' ? window.location?.origin : undefined) ?? fallback;
};
