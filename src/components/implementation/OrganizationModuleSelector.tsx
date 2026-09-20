import React from 'react';
import {Layers3,RefreshCw} from 'lucide-react';
import {apiFetch} from '@/utils/api';
import {readOrganizationModules,type OrganizationModules} from '@/utils/organizationModules';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import styles from './OrganizationModuleSelector.module.css';
export default function OrganizationModuleSelector({tenantSlug,onSaved}:{tenantSlug:string;onSaved:()=>void}) {
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(tenantSlug))return null;
  return <Selector key={tenantSlug} slug={tenantSlug} onSaved={onSaved}/>;
}
function Selector({slug,onSaved}:{slug:string;onSaved:()=>void}) {
  const [base,setBase]=React.useState<OrganizationModules|null>(null);
  const [latest,setLatest]=React.useState<OrganizationModules|null>(null);
  const [draft,setDraft]=React.useState<string[]>([]);
  const [busy,setBusy]=React.useState(false),[uncertain,setUncertain]=React.useState(false);
  const [message,setMessage]=React.useState<'success'|'error'|'conflict'|null>(null);
  const [modal,setModal]=React.useState<'save'|'discard'|null>(null);
  const active=React.useRef(true),pending=React.useRef(false),generation=React.useRef(0);
  const request=async(method:'GET'|'PUT',body?:unknown)=>{
    let timer:ReturnType<typeof setTimeout>;
    try{return await Promise.race([apiFetch<any>(`/api/admin/tenants/${slug}/config`,{
      method,body:body?JSON.stringify(body):undefined,tenantSlug:slug,persistTenantSlug:false,cache:'no-store'}),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),15000);})]);}
    finally{clearTimeout(timer!);}
  };
  const clear=()=>{setBase(null);setLatest(null);setDraft([]);setModal(null);setMessage(null);};
  const dirty=!!base&&JSON.stringify(draft)!==JSON.stringify(base.selected);
  const invalid=!!base&&base.catalog.some(m=>draft.includes(m.id)&&m.requires.some(k=>!draft.includes(k)));
  const load=async(review=false)=>{
    if(pending.current)return;
    const run=++generation.current;pending.current=true;setBusy(true);
    try{
      const raw=await request('GET');const value=readOrganizationModules(raw?.organization_modules,slug);
      if(!active.current||run!==generation.current)return;
      if(!value||(base&&value.tenant.id!==base.tenant.id)){clear();return;}
      if(review&&value.can_edit){setLatest(value);setMessage(null);}
      else{setBase(value);setDraft(value.selected);setLatest(null);setUncertain(false);}
    }catch(error:any){
      if(!active.current||run!==generation.current)return;
      if([401,403].includes(Number(error?.status??error?.statusCode)))clear();
      else{setMessage('error');setUncertain(true);}
    }finally{if(active.current&&run===generation.current){pending.current=false;setBusy(false);}}
  };
  React.useEffect(()=>{active.current=true;void load();
    return()=>{active.current=false;++generation.current;pending.current=false;};},[slug]);
  React.useEffect(()=>{if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[dirty]);
  const save=async()=>{
    if(!base?.can_edit||pending.current||uncertain||invalid||!dirty)return;
    const original=base,selected=[...draft],run=++generation.current;
    pending.current=true;setBusy(true);setModal(null);setMessage(null);
    try{
      const response=await request('PUT',{expected_revision:original.revision,organization_modules:{selected}});
      if(!active.current||run!==generation.current)return;
      const result=readOrganizationModules(response?.modules,slug);
      if(response?.contract_version!=='organization.setup_modules_save.v1'||response.saved!==true
        ||response.provider_calls_performed!==false||response.tenant?.id!==original.tenant.id||response.tenant?.slug!==slug
        ||!result||result.tenant.id!==original.tenant.id||result.version!==original.version+1
        ||result.revision===original.revision||JSON.stringify(result.selected)!==JSON.stringify(selected))throw new Error('unverified-receipt');
      setBase(result);setDraft(result.selected);setLatest(null);setUncertain(false);setMessage('success');onSaved();
    }catch(error:any){
      if(!active.current||run!==generation.current)return;
      if([401,403].includes(Number(error?.status??error?.statusCode)))clear();
      else{setUncertain(true);setMessage(Number(error?.status??error?.statusCode)===412?'conflict':'error');}
    }finally{if(active.current&&run===generation.current){pending.current=false;setBusy(false);}}
  };
  if(!base)return null;
  const ui=base.ui;
  const choose=(id:string)=>{if(busy||!base.can_edit)return;
    const values=new Set(draft);if(values.has(id))values.delete(id);else values.add(id);
    setDraft(base.catalog.filter(m=>values.has(m.id)).map(m=>m.id));setMessage(null);setLatest(null);};
  const names=(ids:string[])=>ids.map(id=>base.catalog.find(m=>m.id===id)?.label||id).join(' · ')||'—';
  return <section className={styles.root} aria-label={ui.heading} data-testid="module-selector">
    <header><div><span className={styles.tag}><Layers3 size={16} aria-hidden="true"/>v{base.version}</span>
      <h2>{ui.heading}</h2><p>{ui.description}</p></div>
      <button type="button" className={styles.button} disabled={busy} onClick={()=>void load(dirty||uncertain)}>
        <RefreshCw size={15} aria-hidden="true"/>{ui.refresh}</button></header>
    {!base.can_edit?<p role="status" className={styles.notice}>{base.message}</p>:null}
    <fieldset className={styles.grid} disabled={busy||!base.can_edit}>
      {base.catalog.map(item=><label key={item.id} className={styles.option} data-selected={draft.includes(item.id)}>
        <input type="checkbox" aria-label={item.label} checked={draft.includes(item.id)} onChange={()=>choose(item.id)}/>
        <span><strong>{item.label}</strong><small>{item.description}</small>
          {item.requires.length>0?<small>{ui.dependency} {names(item.requires)}</small>:null}</span>
      </label>)}
    </fieldset>
    {message?<p role={message==='success'?'status':'alert'} className={styles.notice}>{ui[message]}</p>:null}
    {uncertain&&!message&&!latest?<p role="alert" className={styles.notice}>{ui.error}</p>:null}
    {latest?<div className={styles.compare}><div><strong>{ui.current}</strong><p>{names(latest.selected)}</p></div>
      <div><strong>{ui.draft}</strong><p>{names(draft)}</p></div>
      <button type="button" className={styles.button} disabled={busy} onClick={()=>{
        setBase(latest);setLatest(null);setUncertain(false);setMessage(null);
      }}>{ui.review}</button></div>:null}
    <footer><p aria-live="polite">{dirty?ui.dirty:base.message}</p><div>
      <button type="button" className={styles.button} disabled={!dirty||busy} onClick={()=>setModal('discard')}>{ui.reset}</button>
      <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!dirty||busy||uncertain||invalid||!base.can_edit}
        onClick={()=>setModal('save')}>{busy?ui.saving:ui.save}</button></div></footer>
    <AlertDialog open={modal!==null} onOpenChange={open=>{if(!open)setModal(null);}}>
      <AlertDialogContent className={styles.dialog}><AlertDialogHeader>
        <AlertDialogTitle>{modal==='discard'?ui.discard_title:ui.confirm}</AlertDialogTitle>
        <AlertDialogDescription>{modal==='discard'?ui.discard_detail:ui.confirm_detail} · {base.tenant.slug}</AlertDialogDescription>
      </AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{ui.cancel}</AlertDialogCancel>
        <AlertDialogAction onClick={()=>{
          if(modal==='save'){void save();return;}
          const target=latest||base;setBase(target);setDraft(target.selected);setLatest(null);setMessage(null);setModal(null);
        }}>{modal==='discard'?ui.reset:ui.save}</AlertDialogAction>
      </AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </section>;
}
