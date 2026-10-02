import {exactInstitutionSlug, safeInstitutionLogo} from './publishedTenantIdentity';
import {isBackofficeRole, normalizeRole} from './roles';
import {TENANT_PLACEHOLDER_SLUGS,TENANT_ROUTE_PREFIXES} from '@/constants/tenant';
export interface PrivateWorkspaceIdentity { tenantSlug: string; name: string; logoUrl: string | null }
export interface PrivateWorkspacePresentation { active: boolean; identity: PrivateWorkspaceIdentity | null }
interface Input { pathname: string; search: string; user: unknown; hasVerifiedSession: boolean; profileVerified: boolean; loading: boolean; currentSlug?: string | null }
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const PRIVATE_ROOTS=new Set(['perfil','dashboard','enterprise','implementacion','pedidos','usuarios','tickets','estadisticas','analytics','integracion','surveys','logs','crm','municipal']);
const control=/[\p{Cc}\p{Cf}\\]/u;
/** A verified profile's coherent aliases; never ambient public tenant state. */
export function readAuthenticatedPrivateTenantSlug(value:unknown):string|null {
  const user=record(value),tenant=record(user.tenant),profileTenant=record(record(user.organization_profile).tenant);
  const aliases=[user.tenant_slug,user.tenantSlug,tenant.slug,tenant.tenant_slug,profileTenant.slug].filter(alias=>alias!==undefined&&alias!==null);
  const normalized=aliases.map(exactInstitutionSlug);
  if(!normalized.length||normalized.some(slug=>!slug||TENANT_PLACEHOLDER_SLUGS.has(slug))||new Set(normalized).size!==1)return null;
  return normalized[0]!;
}
/** Presentation only: does not modify session, URL, capabilities or authorization. */
export function privateWorkspacePresentation(input:Input):PrivateWorkspacePresentation {
  const none={active:false,identity:null};
  const user=record(input.user),role=typeof user.rol==='string'?user.rol:typeof user.role==='string'?user.role:'';
  if(!input.hasVerifiedSession||!isBackofficeRole(role)||normalizeRole(role)==='superadmin')return none;
  let segments:string[];
  try { segments=input.pathname.split('/').filter(Boolean).map(part=>decodeURIComponent(part)); } catch {return none;}
  if(segments.some(part=>control.test(part)||part.includes('/')))return none;
  let pathTenant:string|null=null;
  if(TENANT_ROUTE_PREFIXES.includes(segments[0]?.toLowerCase() as typeof TENANT_ROUTE_PREFIXES[number])) {
    pathTenant=exactInstitutionSlug(segments[1]);if(!pathTenant)return none;segments=segments.slice(2);
  }
  const root=segments[0]?.toLowerCase();
  if(!PRIVATE_ROOTS.has(root)&&!(root==='admin'&&segments[1]?.toLowerCase()==='encuestas'))return none;
  const pending:PrivateWorkspacePresentation={active:true,identity:null};
  if(input.loading||!input.profileVerified)return pending;
  const profile=record(user.organization_profile),slug=readAuthenticatedPrivateTenantSlug(user);
  if(!slug)return pending;
  if(pathTenant&&pathTenant!==slug)return pending;
  const query=new URLSearchParams(input.search);
  for(const key of ['tenant','tenant_slug','tenantSlug','endpoint']) {
    if(query.getAll(key).some(value=>exactInstitutionSlug(value)!==slug))return pending;
  }
  const name=typeof user.nombre_empresa==='string'?user.nombre_empresa.trim():'';
  if(!name||name.length>240||control.test(name))return pending;
  const values=record(profile.values);
  if(typeof values.nombre_empresa==='string'&&values.nombre_empresa.trim()!==name)return pending;
  return {active:true,identity:{tenantSlug:slug,name,logoUrl:safeInstitutionLogo(user.logo_url)}};
}
