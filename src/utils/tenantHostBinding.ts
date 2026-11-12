import { TENANT_PLACEHOLDER_SLUGS, TENANT_ROUTE_PREFIXES } from '@/constants/tenant';
import { isDeploymentPlatformHostname } from './tenantHostname';
import { exactInstitutionSlug, readPublishedTenantIdentity } from './publishedTenantIdentity';
import { normalizeColorHsl } from './color';
import type { TenantHostBinding } from '@/types/tenantHost';

const PLATFORM_HOSTS = new Set(['chatboc.ar', 'www.chatboc.ar', 'app.chatboc.ar', 'panel.chatboc.ar', 'api.chatboc.ar', 'api-preview.chatboc.ar']);
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function normalizeTenantHostname(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase().replace(/\.$/, '');
  if (!raw || raw.length > 253 || /[\s\p{Cc}\p{Cf}/\\:@?#%]/u.test(raw)) return null;
  try {
    const host = new URL(`https://${raw}`).hostname;
    if (!host.includes('.') || /^\d+(?:\.\d+){3}$/.test(host)) return null;
    const labels = host.split('.');
    if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
    return host;
  } catch { return null; }
}

/** Custom subdomains also require an exact published binding, never first-label inference. */
export function requiresTenantHostBinding(hostname?: string | null): boolean {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '[::1]' || /^\d+(?:\.\d+){3}$/.test(host)) return false;
  return !PLATFORM_HOSTS.has(host) && !isDeploymentPlatformHostname(host);
}

export class TenantHostUnavailableError extends Error {
  constructor() { super('Este dominio no tiene un espacio activo y verificado.'); this.name = 'TenantHostUnavailableError'; }
}

export function readTenantHostBinding(payload: unknown, expectedHost: string, nowSeconds = Date.now() / 1000): TenantHostBinding {
  const source = record(payload), tenant = record(source.tenant), brand = record(source.brand), paths = record(source.paths), binding = record(source.binding);
  const host = normalizeTenantHostname(expectedHost);
  const suppliedHost = normalizeTenantHostname(source.host);
  if (!host || suppliedHost !== host || source.contract_version !== 'public.tenant_host.v1' || source.origin !== `https://${host}` || binding.status !== 'active' || binding.verified !== true || !Number.isSafeInteger(binding.valid_until) || Number(binding.valid_until) <= nowSeconds || paths.home !== '/' || paths.login !== '/login' || paths.workspace !== '/perfil') throw new TenantHostUnavailableError();
  let identity;
  try { identity = readPublishedTenantIdentity({ tenant }); } catch { throw new TenantHostUnavailableError(); }
  if (!identity || TENANT_PLACEHOLDER_SLUGS.has(identity.tenantSlug)) throw new TenantHostUnavailableError();
  const color = (value: unknown) => typeof value === 'string' && normalizeColorHsl(value) ? value : null;
  return {
    contract_version: 'public.tenant_host.v1', host, origin: `https://${host}`,
    tenant: { id: identity.tenantId, slug: identity.tenantSlug, nombre: identity.name, tipo: typeof tenant.tipo === 'string' ? tenant.tipo : null, logo_url: identity.logoUrl },
    identity, brand: { primary_color: color(brand.primary_color), accent_color: color(brand.accent_color) },
    paths: { home: '/', login: '/login', workspace: '/perfil' },
    binding: { status: 'active', verified: true, valid_until: Number(binding.valid_until) },
  };
}

/** Explicit routes and query parameters cannot select a different organization on a bound host. */
export function tenantHostRouteMatches(binding: TenantHostBinding, pathname: string, search: string): boolean {
  // Router/server decoding must not turn a hidden separator into a different
  // tenant namespace. Ordinary percent-encoded characters are decoded once.
  if (/[\\\p{Cc}\p{Cf}]/u.test(pathname) || /%(?:2f|5c|25|00)/i.test(pathname)) return false;
  let canonicalPath: string;
  try { canonicalPath = decodeURIComponent(pathname); } catch { return false; }
  const match = canonicalPath.match(new RegExp(`^/(?:${TENANT_ROUTE_PREFIXES.join('|')}|demo)/([^/]+)(?:/|$)`, 'i'));
  const candidates: unknown[] = [];
  if (match) {
    try { candidates.push(decodeURIComponent(match[1])); } catch { return false; }
  }
  const params = new URLSearchParams(search);
  for (const key of ['tenant', 'tenant_slug', 'tenantSlug', 'endpoint']) candidates.push(...params.getAll(key));
  const legacy = canonicalPath.match(/^\/([^/]+)\/(?:login|register|productos|catalogo|portal)(?:\/|$)/i);
  if (legacy && !TENANT_PLACEHOLDER_SLUGS.has(legacy[1].toLowerCase())) {
    try { candidates.push(decodeURIComponent(legacy[1])); } catch { return false; }
  }
  return candidates.every(value => exactInstitutionSlug(value) === binding.tenant.slug);
}

/** Outgoing API scopes are explicit; a namespace such as /api/ask is never a tenant. */
export function tenantHostRequestMatches(binding: TenantHostBinding, path: string): boolean {
  if (/[\\\p{Cc}\p{Cf}]/u.test(path)) return false;
  let url: URL;
  try { url = new URL(path.startsWith('/') || /^https?:\/\//i.test(path) ? path : `/${path}`, binding.origin); }
  catch { return false; }
  if (url.origin !== binding.origin || !tenantHostRouteMatches(binding, url.pathname, url.search)) return false;
  const canonicalPath = decodeURIComponent(url.pathname);
  const match = canonicalPath.match(/^\/(?:api\/)?(?:(?:public|admin|v[0-9]+)\/tenants|portal)\/([^/?#]+)/i);
  if (!match) return true;
  try { return exactInstitutionSlug(decodeURIComponent(match[1])) === binding.tenant.slug; }
  catch { return false; }
}

/** Preserve canonical public channel routes while keeping the bound home at '/'. */
export function tenantHostNavigationTarget(binding: TenantHostBinding | null | undefined, target: string | null): string | null {
  if (!binding || !target) return target;
  const base = `/t/${encodeURIComponent(binding.tenant.slug)}`;
  if (target === base || target === `${base}/`) return binding.paths.home;
  if (target.startsWith(`${base}?`) || target.startsWith(`${base}#`)) return `/${target.slice(base.length)}`;
  return target.startsWith(`${base}/`) ? target : null;
}

let runtimeBinding: TenantHostBinding | null = null;
export function publishTenantHostRuntime(binding: TenantHostBinding | null) { runtimeBinding = binding; }
export function readActiveTenantHostRuntime(hostname?: string | null): TenantHostBinding | null {
  return runtimeBinding && normalizeTenantHostname(hostname) === runtimeBinding.host && runtimeBinding.binding.valid_until > Date.now() / 1000 ? runtimeBinding : null;
}
