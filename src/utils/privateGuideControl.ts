import {sanitizePublicInternalNavigationPath} from '@/utils/tenantPaths';
import type {GuideTenant} from './privateConversationGuide';
const uiKeys=['heading','description','open','loading','enabled_label','disabled_label','source_label','pending','enable','disable','confirm','cancel','refresh','confirmation','acknowledgement','success','error'] as const;
export type ControlCopy=Record<typeof uiKeys[number],string>;
export type ControlAccess={tenant:GuideTenant;endpoint:string;ui:ControlCopy};
export type GuideControl=ControlAccess&{revision:string;state:{enabled:boolean;guide_id:string;version:number};can_enable:boolean;can_disable:boolean;writes_blocked:boolean;installed_guide:{guide_id:string;guide_sha256:string;source:{sha256:string;label:string;approval_status:string};node_count:number}|null};
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const token=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(v);
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=4000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const identity=(v:unknown,t:GuideTenant)=>object(v)&&v.id===t.id&&v.slug===t.slug;
const copy=(v:unknown):ControlCopy|null=>object(v)&&uiKeys.every(k=>text(v[k]))?Object.fromEntries(uiKeys.map(k=>[k,v[k]])) as ControlCopy:null;
export function readControlAccess(value:unknown,tenant:GuideTenant):ControlAccess|null{
 if(!Number.isSafeInteger(tenant.id)||tenant.id<1||!tenant.slug||tenant.slug!==tenant.slug.trim())return null;
 try{if(!sanitizePublicInternalNavigationPath(`/t/${encodeURIComponent(tenant.slug)}/guide`))return null;}catch{return null;}
 if(!object(value)||value.contract_version!=='tenant.conversation_guide_control_access.v1'||!identity(value.tenant,tenant)||value.evaluation_only!==true||value.endpoint!==`/api/admin/tenants/${encodeURIComponent(tenant.slug)}/conversation-guide-control`)return null;
 const ui=copy(value.ui);return ui?{tenant:{...tenant},endpoint:value.endpoint,ui}:null;
}
export function readActivationControl(value:unknown,slug:string):ControlAccess|null{
 if(!object(value)||value.contract_version!=='tenant.channel_activation.v1'||!object(value.tenant)||value.tenant.slug!==slug)return null;
 return readControlAccess(value.conversation_guide_control,{id:value.tenant.id,slug});
}
export function readGuideControl(value:unknown,access:ControlAccess):GuideControl|null{
 if(!object(value)||value.contract_version!=='tenant.conversation_guide_control.v1'||!identity(value.tenant,access.tenant)||value.endpoint!==access.endpoint||value.evaluation_only!==true||value.provider_calls_performed!==false||value.operational_content_approved!==false||!hash(value.revision))return null;
 if(value.command_contract_version!=='tenant.conversation_guide_control_command.v1'||value.required_headers?.['X-Chatboc-Guide-Control']!=='1')return null;
 const state=value.state,ui=copy(value.ui);
 if(!ui||!object(state)||typeof state.enabled!=='boolean'||!token(state.guide_id)||!Number.isSafeInteger(state.version)||state.version<0||state.version>=2147483647)return null;
 if(['can_enable','can_disable','writes_blocked'].some(k=>typeof value[k]!=='boolean')||(value.writes_blocked&&(value.can_enable||value.can_disable)))return null;
 let installed:GuideControl['installed_guide']=null;
 if(value.installed_guide!==null){
  const guide=value.installed_guide;
  if(!object(guide)||guide.guide_id!==state.guide_id||guide.evaluation_only!==true||!hash(guide.guide_sha256)||!object(guide.source)||!hash(guide.source.sha256)||!text(guide.source.label)||!text(guide.source.approval_status)||!Number.isSafeInteger(guide.node_count)||guide.node_count<1)return null;
  installed={guide_id:guide.guide_id,guide_sha256:guide.guide_sha256,node_count:guide.node_count,source:{sha256:guide.source.sha256,label:guide.source.label,approval_status:guide.source.approval_status}};
 }
 if(value.can_enable&&!installed)return null;
 return {...access,ui,revision:value.revision,state:{enabled:state.enabled,guide_id:state.guide_id,version:state.version},can_enable:value.can_enable,can_disable:value.can_disable,writes_blocked:value.writes_blocked,installed_guide:installed};
}
export function controlCommand(control:GuideControl,enabled:boolean){
 if(control.writes_blocked||!(enabled?control.can_enable:control.can_disable)||enabled===control.state.enabled)throw new Error('guide_control_not_allowed');
 const base={contract_version:'tenant.conversation_guide_control_command.v1',tenant:control.tenant,expected_revision:control.revision,enabled,guide_id:control.state.guide_id,acknowledge_evaluation_only:true};
 if(!enabled)return base;
 if(!control.installed_guide)throw new Error('guide_control_not_installed');
 return {...base,expected_guide_sha256:control.installed_guide.guide_sha256,expected_source_sha256:control.installed_guide.source.sha256};
}
export function readControlReceipt(value:unknown,access:ControlAccess,before:GuideControl,desired:boolean){
 if(!object(value)||value.contract_version!=='tenant.conversation_guide_control_save.v1'||!identity(value.tenant,access.tenant)||value.saved!==true||value.provider_calls_performed!==false||value.operational_content_approved!==false)return null;
 const control=readGuideControl(value.control,access);
 return control&&control.state.guide_id===before.state.guide_id&&control.state.enabled===desired&&control.state.version===before.state.version+1&&control.revision!==before.revision&&(!desired||JSON.stringify(control.installed_guide)===JSON.stringify(before.installed_guide))?control:null;
}
