import { readModuleCatalog } from './moduleCatalog';
export type ModuleId = string;
export interface ModuleDefinition {id:ModuleId;label:string;description:string;requires:ModuleId[]}
export interface ModuleSelection {
  contract_version:'organization.setup_modules.v1';catalog_version:number;tenant:{id:number;slug:string};
  organization_type:string;revision:string;version:number;source:'saved'|'defaults';selected:ModuleId[];
  catalog:ModuleDefinition[];ui:Record<string,string>;can_edit:boolean;reason_code:string;message:string;
  save_endpoint:string;provider_calls_performed:false;changes_runtime_access:false;
}
const uiKeys=['heading','description','save','saving','refresh','reset','dirty','success','error','conflict',
  'loading','missing','current','draft','review','dependency','confirm','confirm_detail','cancel','discard_title',
  'discard_detail','ready','idle','requires','full','permission','maintenance','allowed','saved_version','defaults',
  'selected_count','compare','review_note','review_ready','no_changes','discard_confirm','continue','confirmed','scope_note','legacy_note','denied'];
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=1600&&!/\p{Cc}/u.test(value);
export const readModuleUI=(value:unknown):Record<string,string>|null=>object(value)&&uiKeys.every(k=>text(value[k]))?
  Object.fromEntries(uiKeys.map(k=>[k,value[k]])):null;
export const equalModules=(a:readonly ModuleId[],b:readonly ModuleId[])=>a.length===b.length&&a.every((id,i)=>b[i]===id);
export function validModules(selected:unknown,catalog:ModuleDefinition[]):selected is ModuleId[] {
  return Array.isArray(selected)&&selected.length<=catalog.length&&new Set(selected).size===selected.length
    &&selected.every(id=>catalog.some(m=>m.id===id))
    &&catalog.filter(m=>selected.includes(m.id)).every(m=>m.requires.every(id=>selected.includes(id)));
}
export function readModuleSelection(value:unknown,slug:string):ModuleSelection|null {
  if(!object(value)||value.contract_version!=='organization.setup_modules.v1'
    ||!Number.isSafeInteger(value.catalog_version)||value.catalog_version<1||value.catalog_version>=2147483647
    ||!object(value.tenant)||!Number.isSafeInteger(value.tenant.id)||value.tenant.id<1||value.tenant.slug!==slug
    ||!Number.isSafeInteger(value.version)||value.version<0||value.version>=2147483647
    ||!['municipio','gobierno','colegio','empresa','pyme','organizacion'].includes(value.organization_type)
    ||typeof value.revision!=='string'||!/^[a-f0-9]{64}$/.test(value.revision))return null;
  const catalog=readModuleCatalog(value.catalog);
  if(!catalog)return null;
  const ui=readModuleUI(value.ui);
  if(!ui||!validModules(value.selected,catalog)||!equalModules(value.selected,catalog.filter((m:ModuleDefinition)=>value.selected.includes(m.id)).map((m:ModuleDefinition)=>m.id))
    ||typeof value.can_edit!=='boolean'||!['maintenance','permission','full','allowed'].includes(value.reason_code)
    ||value.can_edit!==(value.reason_code==='allowed')||!text(value.message)||value.source!==(value.version===0?'defaults':'saved')
    ||value.save_endpoint!==`/api/admin/tenants/${slug}/config`
    ||value.provider_calls_performed!==false||value.changes_runtime_access!==false)return null;
  return {...value,catalog,ui} as ModuleSelection;
}
