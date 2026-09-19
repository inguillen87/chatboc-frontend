import { normalizeProfileTenantSlug } from './profileTenantAuthority';

export const ORGANIZATION_FIELDS = ['nombre_empresa','telefono','direccion','ciudad','provincia','pais',
  'latitud','longitud','link_web','logo_url','horario_json'] as const;
export type OrganizationField = typeof ORGANIZATION_FIELDS[number];
export interface OfficeDay { dia: string; abre: string; cierra: string; cerrado: boolean }
export type OrganizationValues = Record<Exclude<OrganizationField,'latitud'|'longitud'|'horario_json'>,string>
  & {latitud:number|null;longitud:number|null;horario_json:OfficeDay[]};
export interface OrganizationProfileSettings {
  contract_version:'organization.profile_settings.v1'; tenant:{id:number;slug:string};
  revision:string; values:OrganizationValues; can_edit:boolean; save_endpoint:string;
  concurrency:'expected_revision'; provider_calls_performed:false;
  editability?: {mode:'editable'|'read_only'; reason_code:'ready'|'maintenance'|'tenant_admin_required'; message:string};
}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function readOrganizationProfile(value:unknown, slug:string|null|undefined):OrganizationProfileSettings|null {
  const scope=normalizeProfileTenantSlug(slug);
  if (!scope||!object(value)||value.contract_version!=='organization.profile_settings.v1'
      ||!object(value.tenant)||value.tenant.slug!==scope||!Number.isSafeInteger(value.tenant.id)||value.tenant.id<1
      ||typeof value.revision!=='string'||!/^[0-9a-f]{64}$/.test(value.revision)
      ||typeof value.can_edit!=='boolean'||value.provider_calls_performed!==false
      ||value.concurrency!=='expected_revision'||value.save_endpoint!==`/api/admin/tenants/${scope}/config`
      ||!object(value.values)) return null;
  const access=value.editability;
  if(access!==undefined && (!object(access)||typeof access.message!=='string'
      ||!access.message.trim()||access.message.length>500
      ||(value.can_edit ? access.mode!=='editable'||access.reason_code!=='ready'
        : access.mode!=='read_only'||!['maintenance','tenant_admin_required'].includes(access.reason_code)))) return null;
  const values=value.values;
  for (const field of ORGANIZATION_FIELDS.slice(0,6).concat(['link_web','logo_url']))
    if(typeof values[field]!=='string'||values[field].length>2048) return null;
  for (const field of ['latitud','longitud'] as const)
    if(values[field]!==null&&(typeof values[field]!=='number'||!Number.isFinite(values[field])
      ||Math.abs(values[field])>(field==='latitud'?90:180))) return null;
  if(!Array.isArray(values.horario_json)||![0,7].includes(values.horario_json.length)
    ||values.horario_json.some((d:unknown)=>!object(d)||typeof d.dia!=='string'||typeof d.abre!=='string'
      ||typeof d.cierra!=='string'||typeof d.cerrado!=='boolean')) return null;
  return {contract_version:value.contract_version,tenant:{id:value.tenant.id,slug:scope},revision:value.revision,
    values:Object.fromEntries(ORGANIZATION_FIELDS.map(key=>[key,JSON.parse(JSON.stringify(values[key]))])) as OrganizationValues,
    ...(access?{editability:{mode:access.mode,reason_code:access.reason_code,message:access.message}}:{}),
    can_edit:value.can_edit,save_endpoint:value.save_endpoint,concurrency:'expected_revision',provider_calls_performed:false};
}
export function profileChanges(draft:OrganizationValues, baseline:OrganizationValues):Partial<OrganizationValues> {
  return Object.fromEntries(ORGANIZATION_FIELDS.filter(key=>JSON.stringify(draft[key])!==JSON.stringify(baseline[key]))
    .map(key=>[key,draft[key]]));
}
export function readProfileSaveReceipt(value:unknown, expected:OrganizationProfileSettings, changes:Partial<OrganizationValues>={}):OrganizationProfileSettings|null {
  if(!object(value)||value.contract_version!=='organization.profile_save.v1'||value.ok!==true
    ||typeof value.saved!=='boolean'||value.provider_calls_performed!==false||!object(value.tenant)
    ||value.tenant.id!==expected.tenant.id||value.tenant.slug!==expected.tenant.slug) return null;
  const profile=readOrganizationProfile(value.profile,expected.tenant.slug);
  if(!profile||profile.tenant.id!==expected.tenant.id||!profile.can_edit)return null;
  if(Object.entries(changes).some(([key,value])=>JSON.stringify(profile.values[key as OrganizationField])!==JSON.stringify(value)))return null;
  return profile;
}
