import { sanitizePublicInternalNavigationPath } from '@/utils/tenantPaths';
export type GuideTenant = { id: number; slug: string };
const copyKeys = ['heading','description','open','start','back_to_menu','source_label','loading','error'] as const;
export type GuideCopy = Record<typeof copyKeys[number], string>;
export interface GuideAccess {
  tenant: GuideTenant; guide_id: string; endpoint: string; ui: GuideCopy;
}
export interface PrivateGuide {
  guide_id: string; guide_sha256: string;
  source: {sha256:string; page_count:number; label:string; approval_status:string};
  menu: {id:string; title:string; text:string; kind:string; source_pages:number[];
    actions:{code:string; label:string; target:string}[]};
  ui: GuideCopy;
}
const record = (value:unknown): value is Record<string,unknown> => !!value && typeof value==='object' && !Array.isArray(value);
const text = (value:unknown,max=2000): value is string => typeof value==='string' && !!value.trim() && value.length<=max && !/[\u0000\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const token = (value:unknown): value is string => typeof value==='string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
const hash = (value:unknown): value is string => typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const identity = (value:unknown,tenant:GuideTenant) => record(value) && value.id===tenant.id && value.slug===tenant.slug;
const copy = (value:unknown): GuideCopy|null => {
  if(!record(value)||!copyKeys.every(key=>text(value[key])))return null;
  return Object.fromEntries(copyKeys.map(key=>[key,value[key]])) as GuideCopy;
};
export function readGuideAccess(value:unknown,tenant:GuideTenant):GuideAccess|null {
  if(!Number.isSafeInteger(tenant.id)||tenant.id<1||!tenant.slug||tenant.slug!==tenant.slug.trim())return null;
  try {if(!sanitizePublicInternalNavigationPath(`/t/${encodeURIComponent(tenant.slug)}/guide`))return null;} catch{return null;}
  if(!record(value)||value.contract_version!=='tenant.conversation_guide_access.v1'||!identity(value.tenant,tenant)
    ||value.evaluation_only!==true||!token(value.guide_id)
    ||value.endpoint!==`/api/admin/tenants/${encodeURIComponent(tenant.slug)}/conversation-guide`)return null;
  const ui=copy(value.ui);if(!ui)return null;
  return {tenant:{...tenant},guide_id:value.guide_id,endpoint:value.endpoint,ui};
}
export function readActivationGuide(value:unknown,slug:string):GuideAccess|null {
  if(!record(value)||value.contract_version!=='tenant.channel_activation.v1'||!record(value.tenant)
    ||value.tenant.slug!==slug||!record(value.organization_setup))return null;
  const id=value.tenant.id;
  if(typeof id!=='number'||!Number.isSafeInteger(id)||id<1)return null;
  if(value.organization_setup.tenant!==undefined&&!identity(value.organization_setup.tenant,{id,slug}))return null;
  return readGuideAccess(value.organization_setup.conversation_guide,{id,slug});
}
export function readPrivateGuide(value:unknown,access:GuideAccess,expectedNode:string):PrivateGuide|null {
  if(!record(value)||value.contract_version!=='tenant.conversation_guide.v1'||!identity(value.tenant,access.tenant)
    ||value.guide_id!==access.guide_id||value.evaluation_only!==true||!hash(value.guide_sha256)
    ||value.writes_performed!==false||value.provider_calls_performed!==false||!record(value.policy)
    ||!['accepts_personal_data','creates_real_cases','queries_official_records','sends_notifications','stores_feedback'].every(key=>(value.policy as Record<string,unknown>)[key]===false)
    ||!record(value.source)||!hash(value.source.sha256)||!Number.isSafeInteger(value.source.page_count)
    ||Number(value.source.page_count)<1||Number(value.source.page_count)>10000
    ||!text(value.source.label)||!text(value.source.approval_status,100))return null;
  const ui=copy(value.ui), menu=value.menu;if(!ui||!record(menu))return null;
  if(!token(menu.id)||menu.id!==expectedNode||!text(menu.title,400)||!text(menu.text,20000)||!text(menu.kind,80)
    ||!Array.isArray(menu.source_pages)||!menu.source_pages.length||menu.source_pages.length>Number(value.source.page_count)
    ||menu.source_pages.some(page=>!Number.isSafeInteger(page)||page<1||page>Number((value.source as Record<string,unknown>).page_count))
    ||new Set(menu.source_pages).size!==menu.source_pages.length||!Array.isArray(menu.actions)||menu.actions.length>30
    ||menu.actions.some(action=>!record(action)||!text(action.code,16)||!text(action.label,400)||!token(action.target))
    ||new Set(menu.actions.map(action=>action.code)).size!==menu.actions.length)return null;
  return {guide_id:access.guide_id,guide_sha256:value.guide_sha256,
    source:{sha256:value.source.sha256,page_count:Number(value.source.page_count),label:value.source.label,approval_status:value.source.approval_status},ui,
    menu:{id:menu.id,title:menu.title,text:menu.text,kind:menu.kind,source_pages:[...menu.source_pages],
      actions:menu.actions.map(action=>({code:action.code,label:action.label,target:action.target}))}};
}
