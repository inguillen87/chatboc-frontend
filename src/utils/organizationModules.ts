export type ModuleOption = {id:string;label:string;description:string;requires:string[]};
export type OrganizationModules = {
  contract_version:'organization.setup_modules.v1';tenant:{id:number;slug:string};
  version:number;revision:string;catalog_version:1;selected:string[];defaults:string[];
  catalog:ModuleOption[];can_edit:boolean;reason_code:string;message:string;
  ui:Record<string,string>;save_endpoint:string;provider_calls_performed:false;changes_permissions:false;
};
const keys=['heading','description','save','saving','refresh','reset','dirty','success','error','conflict','loading',
 'missing','current','draft','review','dependency','confirm','confirm_detail','cancel','discard_title','discard_detail'];
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=2000&&!/\p{Cc}/u.test(v);
const allowed=['whatsapp','catalog','payments','surveys','territory'];
const selection=(v:unknown,ids:string[]):v is string[]=>Array.isArray(v)&&v.length<=ids.length
 &&v.every(k=>typeof k==='string'&&ids.includes(k))&&new Set(v).size===v.length;
export function readOrganizationModules(v:unknown,slug:string):OrganizationModules|null {
  if(!object(v)||v.contract_version!=='organization.setup_modules.v1'||!object(v.tenant)
   ||!Number.isSafeInteger(v.tenant.id)||v.tenant.id<1||v.tenant.slug!==slug
   ||!Number.isSafeInteger(v.version)||v.version<0||typeof v.revision!=='string'||!/^[0-9a-f]{64}$/.test(v.revision)
   ||v.catalog_version!==1||typeof v.can_edit!=='boolean'||!text(v.message)||!text(v.reason_code)
   ||v.can_edit!==(v.reason_code==='ready')||v.provider_calls_performed!==false||v.changes_permissions!==false
   ||v.save_endpoint!==`/api/admin/tenants/${slug}/config`||!Array.isArray(v.catalog)||v.catalog.length>5
   ||!object(v.ui)||!keys.every(k=>text(v.ui[k])))return null;
  if(v.catalog.some(m=>!object(m)||!allowed.includes(m.id)||!text(m.label)||!text(m.description)))return null;
  const ids=v.catalog.map(m=>m.id);
  if(new Set(ids).size!==ids.length||!selection(v.selected,ids)||!selection(v.defaults,ids))return null;
  if(v.catalog.some(m=>!selection(m.requires,ids)||m.requires.includes(m.id)
   ||(v.selected.includes(m.id)&&m.requires.some(k=>!v.selected.includes(k)))))return null;
  return v as OrganizationModules;
}
