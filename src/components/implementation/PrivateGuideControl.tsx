import React from 'react';
import {apiFetch} from '@/utils/api';
import {controlCommand,readGuideControl,readControlReceipt,type ControlAccess,type GuideControl} from '@/utils/privateGuideControl';
import './privateConversationGuide.css';
export default function PrivateGuideControl({access,sessionKey,onSaved}:{access:ControlAccess|null;sessionKey:string;onSaved:()=>void}){
 return access&&sessionKey?<Controller key={JSON.stringify([sessionKey,access])} access={access} onSaved={onSaved}/>:null;
}
function Controller({access:initial,onSaved}:{access:ControlAccess;onSaved:()=>void}){
 const [access]=React.useState(initial);
 const [control,setControl]=React.useState<GuideControl|null>(null);
 const [phase,setPhase]=React.useState<'idle'|'loading'|'ready'|'review'|'saving'|'error'|'success'>('idle');
 const [acknowledged,setAcknowledged]=React.useState(false);
 const alive=React.useRef(true),locked=React.useRef(false),generation=React.useRef(0);
 const heading=React.useRef<HTMLHeadingElement>(null);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;++generation.current;};},[]);
 React.useEffect(()=>{if(phase==='review'||phase==='success')heading.current?.focus();},[phase]);
 const current=(id:number)=>alive.current&&generation.current===id;
 const request=async(body?:unknown)=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([apiFetch<unknown>(access.endpoint,{tenantSlug:access.tenant.slug,persistTenantSlug:false,cache:'no-store',singleAttempt:true,...(body===undefined?{}:{method:'PUT',headers:{'X-Chatboc-Guide-Control':'1'},body})}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('guide_control_timeout')),15000);})]);}
  finally{clearTimeout(timer);}
 };
 const refresh=async()=>{
  if(locked.current)return;locked.current=true;const id=++generation.current;setPhase('loading');setControl(null);setAcknowledged(false);
  try{const raw=await request();if(!current(id))return;const next=readGuideControl(raw,access);if(!next)throw new Error('guide_control_invalid');setControl(next);setPhase('ready');}
  catch{if(current(id))setPhase('error');}finally{if(current(id))locked.current=false;}
 };
 const confirm=async()=>{
  if(locked.current||phase!=='review'||!acknowledged||!control)return;
  locked.current=true;const id=++generation.current,before=control,desired=!before.state.enabled;setPhase('saving');
  try{
   const check=readGuideControl(await request(),access);if(!current(id))return;
   if(!check||check.revision!==before.revision||check.state.guide_id!==before.state.guide_id||check.state.enabled!==before.state.enabled||check.state.version!==before.state.version
     ||(desired&&JSON.stringify(check.installed_guide)!==JSON.stringify(before.installed_guide)))throw new Error('guide_control_changed');
   const body=controlCommand(check,desired);
   const receipt=readControlReceipt(await request(body),access,check,desired);if(!current(id))return;
   if(!receipt)throw new Error('guide_control_unconfirmed');
   const after=readGuideControl(await request(),access);if(!current(id))return;
   if(!after||after.revision!==receipt.revision||after.state.enabled!==desired||after.state.guide_id!==receipt.state.guide_id||after.state.version!==receipt.state.version
     ||(desired&&JSON.stringify(after.installed_guide)!==JSON.stringify(before.installed_guide)))throw new Error('guide_control_unconfirmed');
   setControl(after);setPhase('success');setAcknowledged(false);onSaved();
  }catch{if(current(id)){setControl(null);setPhase('error');setAcknowledged(false);}}
  finally{if(current(id))locked.current=false;}
 };
 const ui=control?.ui??access.ui,busy=phase==='loading'||phase==='saving';
 const allowed=control&&!control.writes_blocked&&(control.state.enabled?control.can_disable:control.can_enable);
 return <section className="private-guide" aria-label={access.ui.heading} data-testid="private-guide-control">
  <div className="private-guide-reader">
   <h3 ref={heading} tabIndex={-1}>{ui.heading}</h3><p>{ui.description}</p>
   {phase==='idle'?<button type="button" onClick={()=>void refresh()}>{ui.open}</button>:null}
   {busy?<p role="status">{phase==='loading'?ui.loading:ui.pending}</p>:null}
   {phase==='error'?<p role="alert">{ui.error}</p>:null}
   {phase==='success'?<p role="status">{ui.success}</p>:null}
   {control?<><p data-testid="guide-control-state">{control.state.enabled?ui.enabled_label:ui.disabled_label}</p>
    {control.installed_guide?<div className="private-guide-source"><strong>{ui.source_label}</strong><p>{control.installed_guide.source.label}</p><p>{control.installed_guide.source.approval_status}</p></div>:null}</>:null}
   {phase==='review'&&control?<fieldset className="private-guide-confirmation">
    <legend>{ui.confirmation}</legend>
    <label><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/>{ui.acknowledgement}</label>
    <div className="private-guide-toolbar"><button type="button" onClick={()=>{setPhase('ready');setAcknowledged(false);}}>{ui.cancel}</button><button type="button" disabled={!acknowledged} onClick={()=>void confirm()}>{ui.confirm}</button></div>
   </fieldset>:null}
   {phase!=='idle'&&phase!=='review'?<div className="private-guide-toolbar">
    <button type="button" disabled={busy} onClick={()=>void refresh()}>{ui.refresh}</button>
    {allowed&&!busy?<button type="button" onClick={()=>{setPhase('review');setAcknowledged(false);}}>{control.state.enabled?ui.disable:ui.enable}</button>:null}
   </div>:null}
  </div>
 </section>;
}
