import {readBrandWorkflowUI,type BrandWorkflowCopy} from './brandWorkflowUI';
export interface BrandValues {enabled:boolean; primary_color:string; accent_color:string}
export interface ColorPair {background:string;foreground:string;contrast:number}
export interface BrandAppearance {active:boolean;primary:ColorPair;accent:ColorPair}
export interface BrandSnapshot {
  workflow_ui:{contract_version:'organization.branding_workflow_ui.v1';texts:BrandWorkflowCopy};
  contract_version:'organization.branding.v1';tenant:{id:number;slug:string};revision:string;version:number;
  values:BrandValues;history:{version:number;values:BrandValues}[];can_edit:boolean;reason_code:string;
  appearance:BrandAppearance;message:string;save_endpoint:string;heading:string;scope_note:string;
  presets:{id:string;label:string;primary_color:string;accent_color:string}[];provider_calls_performed:false;
}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const isBrandColor=(v:unknown):v is string=>typeof v==='string'&&/^#[0-9A-F]{6}$/i.test(v);
export function brandColorPair(color:string):ColorPair {
  if(!isBrandColor(color))throw new Error('invalid_brand_color');
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
  const light=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
  const black=(light+.05)/.05,white=1.05/(light+.05);
  return {background:color.toUpperCase(),foreground:black>=white?'#000000':'#FFFFFF',contrast:Math.round(Math.max(black,white)*1000)/1000};
}
const values=(v:unknown):v is BrandValues=>object(v)&&Object.keys(v).sort().join(',')==='accent_color,enabled,primary_color'
  &&typeof v.enabled==='boolean'&&isBrandColor(v.primary_color)&&isBrandColor(v.accent_color);
const short=(v:unknown,max=800):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
export function readBrandAppearance(raw:unknown):BrandAppearance|null {
  if(!object(raw)||typeof raw.active!=='boolean')return null;
  for(const key of ['primary','accent']) {
    const pair=raw[key];if(!object(pair)||!isBrandColor(pair.background))return null;
    const expected=brandColorPair(pair.background);
    if(pair.foreground!==expected.foreground||pair.contrast!==expected.contrast)return null;
  }
  return raw as BrandAppearance;
}
export function readBrandSnapshot(raw:unknown,slug:string):BrandSnapshot|null {
  if(!object(raw)||raw.contract_version!=='organization.branding.v1'||!object(raw.tenant)
    ||!Number.isInteger(raw.tenant.id)||raw.tenant.id<1||raw.tenant.slug!==slug
    ||!/^([a-f0-9]{64})$/.test(raw.revision)||!Number.isInteger(raw.version)||raw.version<0
    ||!values(raw.values)||!readBrandAppearance(raw.appearance)||typeof raw.can_edit!=='boolean'
    ||!['ready','maintenance','tenant_admin_required','full_plan_required'].includes(raw.reason_code)
    ||raw.can_edit!==(raw.reason_code==='ready')||raw.provider_calls_performed!==false
    ||raw.save_endpoint!==`/api/admin/tenants/${encodeURIComponent(slug)}/config`
    ||!['message','heading','scope_note'].every(key=>short(raw[key]))
    ||!Array.isArray(raw.history)||raw.history.length>10||!Array.isArray(raw.presets)||raw.presets.length>8)return null;
  if(raw.history.some((h:any)=>!object(h)||!Number.isInteger(h.version)||h.version<0||h.version>=raw.version||!values(h.values))
    ||new Set(raw.history.map((h:any)=>h.version)).size!==raw.history.length)return null;
  if(raw.presets.some((p:any)=>!object(p)||!short(p.id,80)||!short(p.label,120)||!isBrandColor(p.primary_color)||!isBrandColor(p.accent_color)))return null;
  if(raw.appearance.primary.background!==raw.values.primary_color||raw.appearance.accent.background!==raw.values.accent_color
    ||(!raw.values.enabled&&raw.appearance.active))return null;
  const ui=readBrandWorkflowUI(raw.workflow_ui);
  if(!ui)return null;
  return {...raw,workflow_ui:{contract_version:'organization.branding_workflow_ui.v1',texts:ui}} as BrandSnapshot;
}
export function readWorkspaceAppearance(raw:unknown,slug:string):BrandAppearance|null {
  return object(raw)&&raw.contract_version==='organization.workspace_appearance.v1'&&object(raw.tenant)
    &&raw.tenant.slug===slug&&Number.isInteger(raw.tenant.id)&&raw.tenant.id>0?readBrandAppearance(raw.appearance):null;
}
export function brandCss(appearance:BrandAppearance|null):Record<string,string>|undefined {
  return appearance?.active?{'--org-brand':appearance.primary.background,'--org-on-brand':appearance.primary.foreground,
    '--org-accent':appearance.accent.background,'--org-on-accent':appearance.accent.foreground}:undefined;
}

/** HEX casing is presentation, not an additional saved change. */
export function sameBrandValues(left:BrandValues,right:BrandValues):boolean {
  return left.enabled===right.enabled
    &&left.primary_color.toUpperCase()===right.primary_color.toUpperCase()
    &&left.accent_color.toUpperCase()===right.accent_color.toUpperCase();
}
