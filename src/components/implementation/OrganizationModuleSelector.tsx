import React,{useState} from 'react';
import {Layers3,Link2,RefreshCw,ShieldCheck} from 'lucide-react';
import {useModuleSelection} from '@/hooks/useModuleSelection';
import {validModules,type ModuleId,type ModuleDefinition} from '@/utils/organizationModules';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import styles from './OrganizationModuleSelector.module.css';
interface Props {slug:string;copy:Record<string,string>;onSaved:()=>void}
export default function OrganizationModuleSelector(props:Props) {
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(props.slug))return null;
  return <Selector key={props.slug} {...props}/>;
}
function Selector({slug,copy,onSaved}:Props) {
  const state=useModuleSelection(slug,copy,onSaved);
  const [dialog,setDialog]=useState<'save'|'discard'|null>(null);
  const {snapshot,draft,latest,pending,dirty,error,message,review}=state;
  const ui=snapshot?.ui||copy;
  const disabled=pending||!snapshot?.can_edit;
  const canSave=!!snapshot?.can_edit&&!pending&&!error&&!review&&!latest&&(dirty||snapshot.source==='defaults');
  const labels=(ids:ModuleId[],catalog:ModuleDefinition[]=snapshot?.catalog||[])=>ids.map(id=>catalog.find(m=>m.id===id)?.label||id).join(' · ')||'-';
  return <section className={styles.panel} aria-label={ui.heading} data-testid="organization-module-selector">
    <div className={styles.intro}><Layers3 size={21} aria-hidden="true"/><div><h3>{ui.heading}</h3><p>{ui.description}</p></div></div>
    {!snapshot?<div className={styles.notice} role="status">{pending?ui.loading:error||ui.missing}
      {!pending?<button type="button" onClick={state.retry}>{ui.refresh}</button>:null}</div>:<>
      <div className={styles.version}><ShieldCheck size={16} aria-hidden="true"/>{snapshot.source==='defaults'?ui.defaults:`${ui.saved_version} ${snapshot.version}`} · {ui.selected_count}: {draft.length}</div>
      {!snapshot.can_edit?<p className={styles.notice}>{snapshot.message}</p>:null}
      {error?<p role="alert" className={styles.notice}>{error}</p>:null}
      {message?<p role="status" className={styles.success}>{message}</p>:null}
      <div className={styles.grid}>{snapshot.catalog.map(module=>{
        const chosen=draft.includes(module.id);
        const missing=module.requires.filter(id=>!draft.includes(id));
        const neededBy=snapshot.catalog.filter(m=>draft.includes(m.id)&&m.requires.includes(module.id));
        return <label key={module.id} className={styles.card} data-selected={chosen}>
          <input type="checkbox" checked={chosen} disabled={disabled||missing.length>0||(chosen&&neededBy.length>0)}
            onChange={()=>state.edit(chosen?draft.filter(id=>id!==module.id):[...draft,module.id])}/>
          <span><strong>{module.label}</strong><span className={styles.description}>{module.description}</span>
            {module.requires.length?<small><Link2 size={13} aria-hidden="true"/>{ui.requires}: {labels(module.requires)}</small>:null}
            {chosen&&neededBy.length?<small>{ui.dependency} {neededBy.map(m=>m.label).join(' · ')}</small>:null}
          </span>
        </label>;
      })}</div>
      <p className={styles.note}>{ui.scope_note}</p>
      {latest?<section className={styles.compare} aria-label={ui.compare}>
        <h4>{ui.compare}</h4><div className={styles.columns}><p><strong>{ui.current}</strong>{labels(latest.selected,latest.catalog)}</p><p><strong>{ui.draft}</strong>{labels(draft)}</p></div>
        <p>{ui.review_note}</p><div className={styles.actions}>
          <button type="button" disabled={pending||!validModules(draft,latest.catalog)} onClick={()=>state.choose(true)}>{ui.review}</button>
          <button type="button" disabled={pending} onClick={()=>state.choose(false)}>{ui.current}</button>
        </div>
      </section>:null}
      {dirty?<p role="status" className={styles.note}>{ui.dirty}</p>:null}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={!canSave} onClick={()=>setDialog('save')}>{pending?ui.saving:ui.save}</button>
        <button type="button" disabled={pending} onClick={state.refresh}><RefreshCw size={15} aria-hidden="true"/>{ui.refresh}</button>
        <button type="button" disabled={!dirty||disabled||review||!!latest||!!error} onClick={()=>setDialog('discard')}>{ui.reset}</button>
      </div>
    </>}
    <AlertDialog open={dialog!==null&&!!snapshot?.can_edit} onOpenChange={open=>{if(!open)setDialog(null);}}>
      <AlertDialogContent className={styles.modal}>
        <AlertDialogHeader><AlertDialogTitle>{dialog==='save'?ui.confirm:ui.discard_title}</AlertDialogTitle>
          <AlertDialogDescription>{dialog==='save'?ui.confirm_detail:ui.discard_detail}</AlertDialogDescription>
        </AlertDialogHeader>
        {dialog==='save'?<div className={styles.columns}><p><strong>{ui.current}</strong>{labels(snapshot?.selected||[])}</p><p><strong>{ui.draft}</strong>{labels(draft)}</p></div>:null}
        <AlertDialogFooter><AlertDialogCancel>{ui.cancel}</AlertDialogCancel>
          <AlertDialogAction disabled={pending||(dialog==='save'&&!canSave)} onClick={()=>{
            const action=dialog;setDialog(null);if(action==='save')void state.save();else state.discard();
          }}>{dialog==='save'?ui.confirmed:ui.discard_confirm}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
