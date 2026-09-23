/** Validated administrative declarations; never statistical certification. */
export interface MethodologyScope { surveyId:number; tenantId:number; tenantSlug:string }
export interface MethodologyField { key:string; label:string; kind:'text'|'textarea'|'select'|'date'; max_length:number; help:string; options?:Array<{value:string;label:string}> }
export interface MethodologyGroup { id:string; title:string; fields:MethodologyField[] }
export interface MethodologyProfile {
 survey_id:number;tenant_id:number;revision:number;instrument_revision:number|null;fields:Record<string,string>;
 change_reason:string|null;actor_user_id:number|null;created_at:string|null;previous_digest:string|null;digest:string|null;
}
export interface MethodologyHistory { revision:number;instrument_revision:number;created_at:string;actor_user_id:number;change_reason:string;digest:string }
export interface Methodology {
 contract_version:'surveys.methodology.v1';available:boolean;scope:{survey_id:number;tenant_id:number};
 current_instrument_revision:number;latest_revision:number;profile:MethodologyProfile;linked_instrument_changed:boolean;
 capabilities:{can_edit:boolean};coverage:{documented:number;total:number;missing:string[];assessment:'self_declared';inference_authorized:false};
 history:MethodologyHistory[];history_has_more:boolean;schema:MethodologyGroup[];ui:Record<string,string>;
 inference_authorized:false;result_changes_applied:false;replayed?:boolean;unchanged?:boolean;
}
export interface MethodologyWrite {
 contract_version:'surveys.methodology.write.v1';expected_revision:number;expected_instrument_revision:number;
 fields:Record<string,string>;change_reason:string;
}
const KEYS=['purpose','sponsor','research_team','population','design','sampling_frame','recruitment','incentives',
 'collection_modes','languages','fieldwork_start','fieldwork_end','quality_controls','weighting','limitations','instrument_notes'];
const DESIGNS=['unknown','probability','nonprobability','census','mixed','synthetic'];
const LABELS=['title','eyebrow','description','disclaimer','coverage','missing','documented','revision','instrument_revision','stale','edit','save','saving','saved',
 'unchanged','change_reason','change_help','author','history','history_more','view_revision','current','viewing_history','discard','discard_title','discard_description',
 'cancel','confirm_discard','refresh','refresh_failed','conflict','pending','archive','disabled','read_error','write_error'];
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<2147483647;
const text=(v:unknown,max=1800,empty=false):v is string=>typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0)&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const dateTime=(v:unknown):v is string=>typeof v==='string'&&v.length<50&&Number.isFinite(Date.parse(v));

export function readMethodology(value:unknown,scope:MethodologyScope):Methodology|null {
 if(!int(scope.surveyId,1)||!int(scope.tenantId,1)||!scope.tenantSlug.trim()||!obj(value)||value.contract_version!=='surveys.methodology.v1'||
   !obj(value.scope)||value.scope.survey_id!==scope.surveyId||value.scope.tenant_id!==scope.tenantId||typeof value.available!=='boolean'||
   !int(value.current_instrument_revision,1)||!int(value.latest_revision)||value.inference_authorized!==false||value.result_changes_applied!==false) return null;
 if(!Array.isArray(value.schema)||value.schema.length!==4||!obj(value.ui)||!LABELS.every(key=>text((value.ui as Record<string,unknown>)[key]))) return null;
 const groups:MethodologyGroup[]=[];const definitions=new Map<string,MethodologyField>();
 for(const group of value.schema) {
  if(!obj(group)||!text(group.id,40)||!text(group.title,160)||!Array.isArray(group.fields)||group.fields.length!==4)return null;
  const fields:MethodologyField[]=[];
  for(const field of group.fields) {
   if(!obj(field)||typeof field.key!=='string'||!KEYS.includes(field.key)||definitions.has(field.key)||!text(field.label,200)||!text(field.help)||
    !['text','textarea','select','date'].includes(String(field.kind))||!int(field.max_length,1)||field.max_length>1200)return null;
   let options:MethodologyField['options'];
   if(field.kind==='select') {
    if(field.key!=='design'||!Array.isArray(field.options)||field.options.length!==DESIGNS.length)return null;
    options=[];
    for(const [index,option] of field.options.entries()) {
     if(!obj(option)||option.value!==DESIGNS[index]||!text(option.label,180))return null;
     options.push({value:DESIGNS[index],label:option.label});
    }
   }
   const parsed={key:field.key,label:field.label,kind:field.kind,max_length:field.max_length,help:field.help,...(options?{options}:{})} as MethodologyField;
   fields.push(parsed);definitions.set(field.key,parsed);
  }
  groups.push({id:group.id,title:group.title,fields});
 }
 if(new Set(groups.map(g=>g.id)).size!==4||definitions.size!==KEYS.length)return null;
 const profile=value.profile;
 if(!obj(profile)||profile.survey_id!==scope.surveyId||profile.tenant_id!==scope.tenantId||!int(profile.revision)||profile.revision>value.latest_revision||!obj(profile.fields)||
   Object.keys(profile.fields).length!==KEYS.length||!KEYS.every(key=>text((profile.fields as Record<string,unknown>)[key],2400,true)))return null;
 const fields:Record<string,string>={};
 for(const key of KEYS) {
  const v=profile.fields[key];if(typeof v!=='string'||[...v].length>definitions.get(key)!.max_length)return null;
  fields[key]=v;
 }
 if(!DESIGNS.includes(fields.design))return null;
 for(const key of ['fieldwork_start','fieldwork_end'])if(fields[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(fields[key])||!Number.isFinite(Date.parse(fields[key]))||new Date(fields[key]).toISOString().slice(0,10)!==fields[key]||fields[key].startsWith('0000')))return null;
 if(fields.fieldwork_start&&fields.fieldwork_end&&fields.fieldwork_end<fields.fieldwork_start)return null;
 if(profile.revision===0) {
  if(value.latest_revision!==0||profile.instrument_revision!==null||profile.digest!==null||profile.created_at!==null||profile.actor_user_id!==null||profile.change_reason!==null||profile.previous_digest!==null)return null;
  if(KEYS.some(key=>fields[key]!== (key==='design'?'unknown':'')))return null;
 } else if(!int(profile.instrument_revision,1)||!digest(profile.digest)||!dateTime(profile.created_at)||!int(profile.actor_user_id,1)||!text(profile.change_reason,500)||
    (profile.revision===1?profile.previous_digest!==null:!digest(profile.previous_digest)))return null;
 if(value.linked_instrument_changed!==(profile.instrument_revision!==null&&profile.instrument_revision!==value.current_instrument_revision)||
  !obj(value.capabilities)||typeof value.capabilities.can_edit!=='boolean'||value.capabilities.can_edit&&(!value.available||profile.revision!==value.latest_revision))return null;
 const missing=KEYS.filter(key=>!fields[key]||key==='design'&&fields[key]==='unknown');
 if(!obj(value.coverage)||value.coverage.total!==KEYS.length||value.coverage.documented!==KEYS.length-missing.length||value.coverage.assessment!=='self_declared'||
  value.coverage.inference_authorized!==false||!Array.isArray(value.coverage.missing)||JSON.stringify([...value.coverage.missing].sort())!==JSON.stringify([...missing].sort()))return null;
 if(!Array.isArray(value.history)||value.history.length>10||typeof value.history_has_more!=='boolean')return null;
 const history:MethodologyHistory[]=[];
 for(const item of value.history) {
  if(!obj(item)||!int(item.revision,1)||item.revision>value.latest_revision||!int(item.instrument_revision,1)||!dateTime(item.created_at)||!int(item.actor_user_id,1)||
    !text(item.change_reason,500)||!digest(item.digest)||history.length>0&&history[history.length-1].revision!==item.revision+1)return null;
  history.push({revision:item.revision,instrument_revision:item.instrument_revision,created_at:item.created_at,actor_user_id:item.actor_user_id,change_reason:item.change_reason,digest:item.digest});
 }
 if(value.available&&(value.latest_revision===0?history.length!==0:history[0]?.revision!==value.latest_revision))return null;
 if(!value.available&&(value.latest_revision!==0||history.length||value.capabilities.can_edit||value.history_has_more))return null;
 if(value.history_has_more&&history.length!==10)return null;
 const output:Methodology={contract_version:'surveys.methodology.v1',available:value.available,scope:{survey_id:scope.surveyId,tenant_id:scope.tenantId},
  current_instrument_revision:value.current_instrument_revision,latest_revision:value.latest_revision,
  profile:{survey_id:scope.surveyId,tenant_id:scope.tenantId,revision:profile.revision,instrument_revision:profile.instrument_revision as number|null,fields,
   change_reason:profile.change_reason as string|null,actor_user_id:profile.actor_user_id as number|null,created_at:profile.created_at as string|null,
   previous_digest:profile.previous_digest as string|null,digest:profile.digest as string|null},
  linked_instrument_changed:value.linked_instrument_changed,capabilities:{can_edit:value.capabilities.can_edit},
  coverage:{documented:KEYS.length-missing.length,total:KEYS.length,missing,assessment:'self_declared',inference_authorized:false},
  history,history_has_more:value.history_has_more,schema:groups,ui:Object.fromEntries(LABELS.map(key=>[key,(value.ui as Record<string,string>)[key]])),
  inference_authorized:false,result_changes_applied:false};
 if(typeof value.replayed==='boolean')output.replayed=value.replayed;
 if(typeof value.unchanged==='boolean')output.unchanged=value.unchanged;
 return output;
}

export const sameMethodologyFields=(left:Record<string,string>,right:Record<string,string>)=>KEYS.every(key=>left[key]===right[key]);
