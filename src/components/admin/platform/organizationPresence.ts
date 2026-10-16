export interface PresenceIdentity { id: number; slug: string }
export interface PresenceBrand { name: string; logo: string | null; logoRejected: boolean; primary: string | null }
export interface OrganizationPresence {
  identity: PresenceIdentity; configured: PresenceBrand; published: PresenceBrand;
  domain: string | null; domainState: 'reported' | 'missing' | 'rejected';
  differences: Array<'name' | 'logo' | 'color'>; observedAt: number;
}
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const invalid = () => { throw new Error('No se pudo verificar la identidad publicada de la organización.'); };
export function assertPresenceIdentity(identity: PresenceIdentity): void {
  if (!Number.isSafeInteger(identity.id) || identity.id < 1 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(identity.slug) || identity.slug.length > 128) invalid();
}
export function assertPresenceScope(value: unknown, identity: PresenceIdentity, required = false): void {
  assertPresenceIdentity(identity); const row = record(value);
  if (required && (text(row.slug) !== identity.slug || !text(row.nombre))) invalid();
  for (const slug of [row.slug, row.tenant_slug, row.tenantSlug]) {
    if (slug !== undefined && slug !== null && slug !== identity.slug) invalid();
  }
  for (const id of [row.id, row.tenant_id]) {
    if (id !== undefined && id !== null && String(id) !== String(identity.id)) invalid();
  }
}
const canonicalOrigin = 'https://www.chatboc.ar';
const publicHost = (hostname: string) => hostname.includes('.') && !/^\d+(?:\.\d+){3}$/.test(hostname)
  && !hostname.includes(':') && !/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(hostname);
export function safePresenceUrl(value: unknown, kind: 'logo' | 'domain'): string | null {
  const raw = text(value);
  if (!raw || raw.length > 2048 || /[\p{Cc}\p{Cf}\\]/u.test(raw) || raw.startsWith('//')) return null;
  let candidate = raw;
  if (kind === 'domain' && !candidate.includes('://')) candidate = 'https://' + candidate;
  if (kind === 'logo' && !raw.startsWith('/') && !/^https:\/\//i.test(raw)) return null;
  try {
    const url = new URL(candidate, canonicalOrigin);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !publicHost(url.hostname)) return null;
    if (kind === 'domain' && (url.pathname !== '/' || url.search)) return null;
    const allowedImageParams = new Set(['w','h','q','width','height','fit','format','auto','crop','dpr']);
    if (kind === 'logo' && [...url.searchParams.keys()].some(key => !allowedImageParams.has(key.toLowerCase()))) return null;
    return kind === 'domain' ? url.origin : url.href;
  } catch { return null; }
}
function name(value: unknown): string {
  const output = text(value);
  if (!output || output.length > 240 || /[\p{Cc}\p{Cf}]/u.test(output)) invalid();
  return output;
}
function primary(value: unknown): string | null {
  const theme = record(value), light = record(theme.light);
  const color = text(light.primary ?? theme.primary ?? theme.primary_color);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}
function brand(value: unknown, theme: unknown): PresenceBrand {
  const row = record(value), logo = safePresenceUrl(row.logo_url, 'logo');
  return {name: name(row.nombre), logo, logoRejected: Boolean(text(row.logo_url) && !logo), primary: primary(theme)};
}
export function parseOrganizationPresence(configValue: unknown, publicValue: unknown, identity: PresenceIdentity): OrganizationPresence {
  const config = record(configValue), publishedValue = record(publicValue);
  assertPresenceScope(config, identity); assertPresenceScope(publishedValue, identity);
  const configuredTenant = record(config.tenant), publicTenant = record(publishedValue.tenant);
  assertPresenceScope(configuredTenant, identity, true); assertPresenceScope(publicTenant, identity, true);
  // The published envelope supplies an explicit ID. No inferred identity or ambient tenant is accepted.
  if (String(publicTenant.id ?? '') !== String(identity.id)) invalid();
  const configured = brand(configuredTenant, configuredTenant.theme_json);
  const published = brand(publicTenant, publicTenant.theme_config ?? publicTenant.tema);
  const rawDomain = text(publicTenant.dominio), domain = safePresenceUrl(rawDomain, 'domain');
  const differences: OrganizationPresence['differences'] = [];
  if (configured.name.normalize('NFC') !== published.name.normalize('NFC')) differences.push('name');
  if (configured.logo !== published.logo) differences.push('logo');
  if (configured.primary && published.primary && configured.primary !== published.primary) differences.push('color');
  return {identity: {...identity}, configured, published, domain,
    domainState: domain ? 'reported' : rawDomain ? 'rejected' : 'missing', differences, observedAt: Date.now()};
}
export const centralPresenceEntry = () => `${canonicalOrigin}/login`;
export const sharedPublicPresence = (identity: PresenceIdentity) => {
  assertPresenceIdentity(identity); return `${canonicalOrigin}/t/${encodeURIComponent(identity.slug)}`;
};
