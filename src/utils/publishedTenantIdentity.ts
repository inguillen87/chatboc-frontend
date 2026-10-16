export interface PublishedTenantIdentity {
  tenantId: number; tenantSlug: string; name: string; logoUrl: string | null;
}
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const exactInstitutionSlug = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > 128) return null;
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug) ? slug : null;
};
export class TenantProfileScopeError extends Error {
  constructor() { super('La identidad pública recibida no corresponde a la organización solicitada.'); this.name='TenantProfileScopeError'; }
}
export function safeInstitutionLogo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw=value.trim();
  if (!raw || raw.length>2048 || /[\p{Cc}\p{Cf}\\]/u.test(raw) || raw.startsWith('//')) return null;
  if (!raw.startsWith('/') && !/^https:\/\//i.test(raw)) return null;
  try {
    const url=new URL(raw,'https://www.chatboc.ar');
    if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash) return null;
    if(!url.hostname.includes('.')||url.hostname.includes(':')||/^\d+(?:\.\d+){3}$/.test(url.hostname)||/(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname))return null;
    const allowed=new Set(['w','h','q','width','height','fit','format','auto','crop','dpr']);
    if([...url.searchParams.keys()].some(key=>!allowed.has(key.toLowerCase())))return null;
    return raw.startsWith('/')?url.pathname+url.search:url.href;
  } catch { return null; }
}
export function readPublishedTenantIdentity(payload: unknown, expectedSlug?: string | null): PublishedTenantIdentity | null {
  const envelope=object(payload),source=Object.keys(object(envelope.tenant)).length?object(envelope.tenant):envelope;
  const suppliedSlugs=[source.slug,source.tenant_slug,source.tenantSlug,envelope.slug,envelope.tenant_slug,envelope.tenantSlug].filter(value=>value!==undefined&&value!==null);
  const expected=expectedSlug?exactInstitutionSlug(expectedSlug):null;
  if(expectedSlug && !expected)throw new TenantProfileScopeError();
  const normalized=suppliedSlugs.map(exactInstitutionSlug);
  if(normalized.some(value=>!value)||new Set(normalized).size>1||(expected&&normalized.some(value=>value!==expected)))throw new TenantProfileScopeError();
  const slug=normalized[0];
  const ids=[source.id,source.tenant_id,envelope.id,envelope.tenant_id].filter(value=>value!==undefined&&value!==null);
  const parseId=(value:unknown)=>typeof value==='number'?value:typeof value==='string'&&/^[1-9][0-9]*$/.test(value)?Number(value):NaN;
  const normalizedIds=ids.map(parseId);
  if(normalizedIds.some(value=>!Number.isSafeInteger(value)||value<1)||new Set(normalizedIds).size>1)throw new TenantProfileScopeError();
  const name=typeof source.nombre==='string'?source.nombre.trim():'';
  if(!slug||!normalizedIds.length||!name||name.length>240||/[\p{Cc}\p{Cf}]/u.test(name))return null;
  return {tenantId:normalizedIds[0],tenantSlug:slug,name,logoUrl:safeInstitutionLogo(source.logo_url??source.logoUrl??source.logo)};
}
