import type { TenantImplementationJourneyStage, TenantImplementationJourneyContract } from '@/api/v2/channelActivation';
export interface OrganizationSetupJourney {
  contract_version:'tenant.implementation_journey.v2';
  tenant:{id:number;slug:string}; organization_type:string; organization_label:string;
  heading:string; description:string; continuity_note:string; readiness_note:string;
  workspace_appearance?:unknown;
  module_selector_ui?:unknown;
  government_setup:boolean; stages:TenantImplementationJourneyStage[];
  summary:TenantImplementationJourneyContract['summary'];
  writes_performed:false; provider_calls_performed:false;
}
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=2000):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max;
const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.length<=40&&value.every(v=>text(v));
const kinds=['municipio','gobierno','colegio','empresa','pyme','organizacion'];
const ids=['institutional_identity','channels','knowledge','team','validation_release'];
const allowedSources=[['institutional_branding'],['whatsapp','widget','templates','live_chat'],
  ['knowledge_content','catalog_marketplace','payments_checkout'],['team_routing'],
  ['crm','identity_auth','accessibility','territorial_intelligence','public_intake_security','analytics_surveys']];
const statuses=['ready','action_required','pending','blocked','not_published'];
const action=(value:unknown)=>value===null||(object(value)&&text(value.id,120)&&text(value.label,200)
  &&text(value.href,1800)&&value.kind==='link'&&typeof value.primary==='boolean');
const equalActions=(left:any,right:any)=>left===null||right===null?left===right:
  ['id','label','href','kind','primary'].every(key=>left[key]===right[key]);

/** Validate the optional server policy without inferring missing stages from counts. */
export function parseOrganizationSetupJourney(value:unknown, slug:string, tenantId?:unknown):OrganizationSetupJourney|null {
  if(!object(value)||value.contract_version!=='tenant.implementation_journey.v2'||!object(value.tenant)
    ||!Number.isInteger(value.tenant.id)||value.tenant.id<1||typeof slug!=='string'||!slug.trim()
    ||!text(value.tenant.slug,120)||value.tenant.slug.toLowerCase()!==slug.trim().toLowerCase()
    ||(tenantId!=null&&String(tenantId)!==String(value.tenant.id)))return null;
  if(!kinds.includes(value.organization_type)||value.government_setup!==['municipio','gobierno'].includes(value.organization_type)
    ||!['heading','description','continuity_note','readiness_note','organization_label'].every(k=>text(value[k]))
    ||value.writes_performed!==false||value.provider_calls_performed!==false
    ||!Array.isArray(value.stages)||value.stages.length!==5||!object(value.summary))return null;
  for(const [index,stage] of value.stages.entries()) {
    if(!object(stage)||stage.id!==ids[index]||!text(stage.label,200)||!text(stage.description)
      ||!statuses.includes(stage.status)||stage.ready!==(stage.status==='ready')
      ||stage.published!==(stage.status!=='not_published')||!strings(stage.source_ids)||!stage.source_ids.length
      ||new Set(stage.source_ids).size!==stage.source_ids.length||stage.source_ids.some(id=>!allowedSources[index].includes(id))
      ||!strings(stage.evidence)||!strings(stage.reason_codes)||!action(stage.primary_action)
      ||(['ready','not_published'].includes(stage.status)&&stage.primary_action!==null))return null;
  }
  const stages=value.stages as TenantImplementationJourneyStage[];
  const summary=value.summary;
  const ready=stages.filter(s=>s.ready).length;
  const current=stages.find(s=>!s.ready)||null;
  if(summary.total!==5||summary.ready!==ready||summary.progress!==Math.round(ready/5*100)
    ||summary.blocked!==stages.filter(s=>s.status==='blocked').length
    ||summary.published!==stages.filter(s=>s.published).length
    ||summary.current_stage_id!==(current?.id||null)||!action(summary.next_action)
    ||!equalActions(current?.primary_action||null,summary.next_action))return null;
  return value as unknown as OrganizationSetupJourney;
}
