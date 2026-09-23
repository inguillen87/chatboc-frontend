import React from 'react';
import {Palette,Check,History,Monitor,Smartphone,RefreshCw} from 'lucide-react';
import {useBrandStudio} from '@/hooks/useBrandStudio';
import {brandColorPair,isBrandColor,type BrandSnapshot} from '@/utils/workspaceBranding';
import {formatBrandText as fmt} from '@/utils/brandWorkflowUI';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
import {BrandComparison} from './BrandComparison';
import styles from './OrganizationBrandStudio.module.css';
interface Props {tenantSlug:string;name:string;logoUrl?:string;onPublished?:(brand:BrandSnapshot)=>void}
export default function OrganizationBrandStudio(props:Props){
  if(!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(props.tenantSlug))return null;
  return <BrandEditor key={props.tenantSlug} {...props}/>;
}
function BrandEditor({tenantSlug,name,logoUrl,onPublished}:Props){
  const state=useBrandStudio(tenantSlug,onPublished);
  const [mode,setMode]=React.useState<'light'|'dark'>('light');const [mobile,setMobile]=React.useState(true);
  const [confirm,setConfirm]=React.useState<number|'publish'|'discard'|null>(null);
  const [logoFailed,setLogoFailed]=React.useState(false);React.useEffect(()=>setLogoFailed(false),[logoUrl]);
  const {snapshot,draft,pending,error}=state;
  const valid=!!draft&&isBrandColor(draft.primary_color)&&isBrandColor(draft.accent_color);
  const primary=brandColorPair(valid?draft!.primary_color:'#2563EB');
  const accent=brandColorPair(valid?draft!.accent_color:'#0F766E');
  const actionDisabled=pending||!snapshot?.can_edit||!valid||!!error||state.needsReview||!!state.latest;
  const localActionDisabled=pending||state.needsReview||!!state.latest||!!error;
  const target=typeof confirm==='number'?snapshot?.history.find(entry=>entry.version===confirm)?.values:draft;
  let safeLogo:string|undefined;
  try{const url=new URL(logoUrl||'');if(url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.includes('.')&&!/\.(local|internal|localhost)$/.test(url.hostname))safeLogo=url.href;}catch{/* initials instead */}
  if(!snapshot||!draft)return <section className={styles.panel} aria-label="Paleta del espacio">
    <h3><Palette size={18} aria-hidden="true"/>Paleta del espacio</h3><p role="status">{error||'Consultando la configuración de marca…'}</p>
    {error?<button type="button" onClick={state.retryInitial} disabled={pending}>Volver a consultar</button>:null}
  </section>;
  const ui=snapshot.workflow_ui.texts;
  return <section className={styles.panel} aria-label={ui.studio_label} data-testid="brand-studio">
    <header><div><span className={styles.eyebrow}>{ui.eyebrow}</span><h3><Palette size={20} aria-hidden="true"/>{snapshot.heading}</h3>
      <p>{snapshot.scope_note}</p></div><span className={styles.version}>{fmt(ui.version_label,{version:snapshot.version})}</span></header>
    <p className={styles.notice}>{snapshot.message}</p>
    {state.message?<div className={styles.success} role="status"><Check size={16} aria-hidden="true"/>{state.message}</div>:null}
    {error?<p role="alert" className={styles.notice}>{error}</p>:null}
    <p role="status" className={styles.draftStatus} data-dirty={state.dirty}>{state.dirty?ui.draft_pending:ui.draft_pristine}</p>
    <div className={styles.grid}><div className={styles.controls}>
      <label className={styles.toggle}><input type="checkbox" checked={draft.enabled} disabled={pending}
        onChange={e=>state.setDraft({...draft,enabled:e.target.checked})}/>{ui.toggle_label}</label>
      <div className={styles.presets} aria-label={ui.presets_label}>{snapshot.presets.map(preset=><button key={preset.id} type="button" disabled={pending}
        onClick={()=>state.setDraft({...draft,primary_color:preset.primary_color,accent_color:preset.accent_color})}>
        <span aria-hidden="true" className={styles.swatch} style={{background:preset.primary_color}}/>{preset.label}</button>)}</div>
      {(['primary_color','accent_color'] as const).map((field,index)=><div className={styles.colorRow} key={field}>
        <label htmlFor={`brand-${field}`}>{index===0?ui.primary_label:ui.accent_label}</label><div>
          <input type="color" aria-label={index===0?ui.primary_picker:ui.accent_picker} value={isBrandColor(draft[field])?draft[field]:'#2563EB'} disabled={pending}
            onChange={e=>state.setDraft({...draft,[field]:e.target.value.toUpperCase()})}/>
          <input id={`brand-${field}`} value={draft[field]} maxLength={7} spellCheck={false} disabled={pending}
            aria-invalid={!isBrandColor(draft[field])} onChange={e=>state.setDraft({...draft,[field]:e.target.value.toUpperCase()})}/></div>
      </div>)}
      <p className={styles.hint}>{ui.input_hint}</p>
      {valid?<div className={styles.ratios}><span>{fmt(ui.primary_contrast,{contrast:primary.contrast.toFixed(2)})}</span><span>{fmt(ui.accent_contrast,{contrast:accent.contrast.toFixed(2)})}</span></div>
        :<p role="alert" className={styles.notice}>{ui.invalid_colors}</p>}
      <p className={styles.hint}>{ui.contrast_scope}</p>
      <div className={styles.actions}><button type="button" className={styles.primaryAction} disabled={actionDisabled||!state.dirty} onClick={()=>setConfirm('publish')}>
        {pending?ui.verifying:ui.publish_action}</button>
        <button type="button" disabled={pending} onClick={state.refresh}><RefreshCw size={16} aria-hidden="true"/>{ui.refresh_action}</button>
        {state.dirty?<button type="button" disabled={localActionDisabled} onClick={()=>setConfirm('discard')}>{ui.discard_action}</button>:null}</div>
      {state.dirty&&!state.latest?<BrandComparison copy={ui} saved={snapshot.values} proposed={draft}/>:null}
      {state.dirty?<p className={styles.hint}>{ui.draft_hint}</p>:null}
      {state.latest?<div className={styles.review} aria-label={ui.review_label}>
        <p>{fmt(ui.review_note,{version:state.latest.version})}</p>
        <BrandComparison copy={ui} saved={state.latest.values} proposed={draft} label={ui.comparison_review}/>
        <div className={styles.actions}><button type="button" onClick={()=>state.chooseLatest(true)}>{ui.keep_draft_action}</button>
        <button type="button" onClick={()=>state.chooseLatest(false)}>{ui.use_saved_action}</button></div>
      </div>:null}
    </div><div className={styles.previewColumn}>
      <div className={styles.previewTools}><span>{ui.preview_title}</span><div>
        <button type="button" onClick={()=>setMobile(true)} aria-pressed={mobile} aria-label={ui.preview_mobile}><Smartphone size={17}/></button>
        <button type="button" onClick={()=>setMobile(false)} aria-pressed={!mobile} aria-label={ui.preview_desktop}><Monitor size={17}/></button>
        <button type="button" onClick={()=>setMode(mode==='dark'?'light':'dark')}>{mode==='dark'?ui.preview_light:ui.preview_dark}</button></div></div>
      <p className={styles.hint} role="status">{!valid?ui.preview_invalid:draft.enabled?ui.preview_enabled:ui.preview_disabled}</p>
      <div className={styles.preview} data-testid="brand-preview" data-theme={mode} data-mobile={mobile} data-brand-active={valid&&draft.enabled}
        style={valid&&draft.enabled?{'--sample-brand':primary.background,'--sample-on-brand':primary.foreground,
          '--sample-accent':accent.background,'--sample-on-accent':accent.foreground} as React.CSSProperties:undefined}>
        <div className={styles.previewHeader}>
          {safeLogo&&!logoFailed?<img src={safeLogo} alt={ui.preview_logo_alt} referrerPolicy="no-referrer" onError={()=>setLogoFailed(true)}/>:<span className={styles.initials} aria-hidden="true">{name.slice(0,2).toUpperCase()||ui.initials_fallback}</span>}
          <strong>{name||ui.organization_fallback}</strong>
        </div><div className={styles.previewBody}><span className={styles.previewBadge}>{ui.preview_badge}</span>
          <h4>{ui.preview_heading}</h4><p>{ui.preview_body}</p>
          <div className={styles.sampleButton}>{ui.preview_main_action}</div><div className={styles.sampleAccent}>{ui.preview_accent}</div>
        </div>
      </div><p className={styles.hint}>{ui.preview_profile_hint}</p>
    </div></div>
    <details className={styles.history}><summary><History size={17} aria-hidden="true"/>{fmt(ui.history_heading,{count:snapshot.history.length})}</summary>
      {snapshot.history.length?snapshot.history.map(entry=><div key={entry.version}><span>{fmt(ui.history_row,{version:entry.version,primary:entry.values.primary_color,accent:entry.values.accent_color,state:entry.values.enabled?ui.enabled_label:ui.disabled_label})}</span>
        <button type="button" disabled={actionDisabled} onClick={()=>setConfirm(entry.version)}>{fmt(ui.restore_action,{version:entry.version})}</button></div>)
        :<p>{ui.history_empty}</p>}
      <p className={styles.hint}>{ui.history_hint}</p>
    </details>
    <AlertDialog open={confirm!==null} onOpenChange={open=>{if(!open)setConfirm(null);}}><AlertDialogContent className={styles.confirmDialog}>
      <AlertDialogHeader><AlertDialogTitle>{confirm==='discard'?ui.discard_title:confirm==='publish'?ui.publish_title:fmt(ui.restore_title,{version:confirm??''})}</AlertDialogTitle>
        <AlertDialogDescription>{confirm==='discard'?ui.discard_description:fmt(ui.publish_description,{organization:name||tenantSlug})}</AlertDialogDescription></AlertDialogHeader>
      {confirm!=='discard'&&target?<BrandComparison copy={ui} saved={snapshot.values} proposed={target} label={ui.comparison_publish}/>:null}
      {typeof confirm==='number'&&state.dirty?<p className={styles.dialogNote}>{ui.restore_draft_warning}</p>:null}
      <AlertDialogFooter><AlertDialogCancel>{ui.cancel_action}</AlertDialogCancel><AlertDialogAction
        disabled={confirm==='discard'?localActionDisabled:actionDisabled||!target||(confirm==='publish'&&!state.dirty)} onClick={()=>{
        const selected=confirm;setConfirm(null);
        if(selected==='discard'){state.discardDraft();return;}
        if(selected!==null)void state.publish(typeof selected==='number'?selected:undefined);
      }}>{confirm==='discard'?ui.confirm_discard:ui.confirm_publish}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </section>;
}
