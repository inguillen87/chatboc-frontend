import {TENANT_ROUTE_PREFIXES} from '@/constants/tenant';
import {getSafeAuthNextPath} from './authRedirect';
import {normalizeRole} from './roles';
import {normalizedLoginTenant} from './panelLoginResponse';

/** Navigation only. Authorization always belongs to the API and route guards. */
export function panelLoginDestination(search: string, tenantSlug: string | null, role: string): string {
  const canonicalRole=normalizeRole(role), platform=canonicalRole==='superadmin';
  const fallback=platform?'/superadmin':'/perfil';
  const candidate=getSafeAuthNextPath(search);
  if (!candidate || candidate.length>2048) return fallback;
  let decoded:string;
  try { decoded=decodeURIComponent(candidate); } catch { return fallback; }
  if (/[\p{Cc}\p{Cf}\\]/u.test(decoded) || decoded.startsWith('//')) return fallback;
  const url=new URL(candidate,'https://navigation.invalid');
  if(url.origin!=='https://navigation.invalid')return fallback;
  const segments=url.pathname.split('/').filter(Boolean).map(part=>decodeURIComponent(part).toLowerCase());
  if(segments.includes('login')||segments.includes('register'))return fallback;
  if(!platform && segments[0]==='superadmin')return fallback;
  if(TENANT_ROUTE_PREFIXES.includes(segments[0] as typeof TENANT_ROUTE_PREFIXES[number])){
    const target=normalizedLoginTenant(segments[1]);
    if(!target || (!platform&&target!==tenantSlug))return fallback;
  }
  for(const name of ['tenant','tenant_slug','tenantSlug']){
    if(url.searchParams.getAll(name).some(value=>!platform&&normalizedLoginTenant(value)!==tenantSlug))return fallback;
  }
  return candidate;
}
