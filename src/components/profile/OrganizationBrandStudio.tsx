import React from 'react';
import {Palette,Check,History,Monitor,Smartphone,RefreshCw} from 'lucide-react';
import {useBrandStudio} from '@/hooks/useBrandStudio';
import {brandColorPair,isBrandColor,type BrandSnapshot} from '@/utils/workspaceBranding';
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
  return <section className={styles.panel} aria-label="Estudio de marca" data-testid="brand-studio">
    <header><div><span className={styles.eyebrow}>Identidad · Personalización Full</span><h3><Palette size={20} aria-hidden="true"/>{snapshot.heading}</h3>
      <p>{snapshot.scope_note}</p></div><span className={styles.version}>Versión {snapshot.version}</span></header>
    <p className={styles.notice}>{snapshot.message}</p>
    {state.message?<div className={styles.success} role="status"><Check size={16} aria-hidden="true"/>{state.message}</div>:null}
    {error?<p role="alert" className={styles.notice}>{error}</p>:null}
    <p role="status" className={styles.draftStatus} data-dirty={state.dirty}>
      {state.dirty?'Borrador con cambios sin publicar':'La paleta coincide con la última versión consultada'}
    </p>
    <div className={styles.grid}><div className={styles.controls}>
      <label className={styles.toggle}><input type="checkbox" checked={draft.enabled} disabled={pending}
        onChange={e=>state.setDraft({...draft,enabled:e.target.checked})}/>Usar mi paleta en el espacio</label>
      <div className={styles.presets} aria-label="Paletas iniciales">{snapshot.presets.map(preset=><button key={preset.id} type="button" disabled={pending}
        onClick={()=>state.setDraft({...draft,primary_color:preset.primary_color,accent_color:preset.accent_color})}>
        <span aria-hidden="true" className={styles.swatch} style={{background:preset.primary_color}}/>{preset.label}</button>)}</div>
      {(['primary_color','accent_color'] as const).map((field,index)=><div className={styles.colorRow} key={field}>
        <label htmlFor={`brand-${field}`}>{index===0?'Color principal':'Color de acento'}</label><div>
          <input type="color" aria-label={`${index===0?'Principal':'Acento'}: selector de color`} value={isBrandColor(draft[field])?draft[field]:'#2563EB'} disabled={pending}
            onChange={e=>state.setDraft({...draft,[field]:e.target.value.toUpperCase()})}/>
          <input id={`brand-${field}`} value={draft[field]} maxLength={7} spellCheck={false} disabled={pending}
            aria-invalid={!isBrandColor(draft[field])} onChange={e=>state.setDraft({...draft,[field]:e.target.value.toUpperCase()})}/></div>
      </div>)}
      <p className={styles.hint}>El texto sobre cada color se ajusta automáticamente a blanco o negro. No se aceptan estilos ni scripts personalizados.</p>
      {valid?<div className={styles.ratios}><span>Principal: {primary.contrast.toFixed(2)}:1</span><span>Acento: {accent.contrast.toFixed(2)}:1</span></div>
        :<p role="alert" className={styles.notice}>Completá ambos colores con formato #RRGGBB para previsualizar o publicar.</p>}
      <p className={styles.hint}>La relación corresponde sólo al texto sobre estas muestras; no es una certificación de accesibilidad del sitio completo.</p>
      <div className={styles.actions}><button type="button" className={styles.primaryAction} disabled={actionDisabled||!state.dirty} onClick={()=>setConfirm('publish')}>
        {pending?'Verificando…':'Publicar paleta'}</button>
        <button type="button" disabled={pending} onClick={state.refresh}><RefreshCw size={16} aria-hidden="true"/>Revisar versión actual</button>
        {state.dirty?<button type="button" disabled={localActionDisabled} onClick={()=>setConfirm('discard')}>Descartar borrador</button>:null}</div>
      {state.dirty&&!state.latest?<BrandComparison saved={snapshot.values} proposed={draft}/>:null}
      {state.dirty?<p className={styles.hint}>El borrador permanece sólo en esta pantalla. No se guarda automáticamente al salir ni se recupera después de cerrar.</p>:null}
      {state.latest?<div className={styles.review} aria-label="Comparar paletas">
        <p>Versión guardada {state.latest.version}. Compará los tres valores antes de elegir. Elegir no publica.</p>
        <BrandComparison saved={state.latest.values} proposed={draft} label="Versión actual y tu borrador"/>
        <div className={styles.actions}><button type="button" onClick={()=>state.chooseLatest(true)}>Conservar mi borrador</button>
        <button type="button" onClick={()=>state.chooseLatest(false)}>Usar paleta guardada</button></div>
      </div>:null}
    </div><div className={styles.previewColumn}>
      <div className={styles.previewTools}><span>Vista previa · Sin publicar</span><div>
        <button type="button" onClick={()=>setMobile(true)} aria-pressed={mobile} aria-label="Vista móvil"><Smartphone size={17}/></button>
        <button type="button" onClick={()=>setMobile(false)} aria-pressed={!mobile} aria-label="Vista escritorio"><Monitor size={17}/></button>
        <button type="button" onClick={()=>setMode(mode==='dark'?'light':'dark')}>{mode==='dark'?'Ver claro':'Ver oscuro'}</button></div></div>
      <p className={styles.hint} role="status">{!valid?'Colores incompletos · muestra neutra':draft.enabled?'Paleta del borrador · aún sin publicar':'Paleta desactivada · muestra neutra'}</p>
      <div className={styles.preview} data-testid="brand-preview" data-theme={mode} data-mobile={mobile} data-brand-active={valid&&draft.enabled}
        style={valid&&draft.enabled?{'--sample-brand':primary.background,'--sample-on-brand':primary.foreground,
          '--sample-accent':accent.background,'--sample-on-accent':accent.foreground} as React.CSSProperties:undefined}>
        <div className={styles.previewHeader}>
          {safeLogo&&!logoFailed?<img src={safeLogo} alt="Logo institucional de vista previa" referrerPolicy="no-referrer" onError={()=>setLogoFailed(true)}/>:<span className={styles.initials} aria-hidden="true">{name.slice(0,2).toUpperCase()||'OR'}</span>}
          <strong>{name||'Organización'}</strong>
        </div><div className={styles.previewBody}><span className={styles.previewBadge}>Tu espacio de atención</span>
          <h4>Una identidad, todos tus equipos</h4><p>Vista de presentación. No contiene métricas, mensajes ni datos de clientes.</p>
          <div className={styles.sampleButton}>Acción principal</div><div className={styles.sampleAccent}>Identidad del espacio</div>
        </div>
      </div><p className={styles.hint}>Nombre y logo pertenecen al perfil institucional. Publicar la paleta no guarda cambios pendientes de esos campos.</p>
    </div></div>
    <details className={styles.history}><summary><History size={17} aria-hidden="true"/>Historial de paleta · {snapshot.history.length} versiones anteriores</summary>
      {snapshot.history.length?snapshot.history.map(entry=><div key={entry.version}><span>Versión {entry.version} · {entry.values.primary_color} · {entry.values.accent_color}{entry.values.enabled?' · Activada':' · Desactivada'}</span>
        <button type="button" disabled={actionDisabled} onClick={()=>setConfirm(entry.version)}>Restaurar versión {entry.version}</button></div>)
        :<p>Todavía no hay una versión anterior publicada.</p>}
      <p className={styles.hint}>Se conservan hasta diez versiones anteriores. Restaurar publica una nueva versión; no borra auditoría ni modifica otras integraciones.</p>
    </details>
    <AlertDialog open={confirm!==null} onOpenChange={open=>{if(!open)setConfirm(null);}}><AlertDialogContent className={styles.confirmDialog}>
      <AlertDialogHeader><AlertDialogTitle>{confirm==='discard'?'¿Descartar el borrador de paleta?':confirm==='publish'?'¿Publicar esta paleta?':`¿Restaurar la versión ${confirm}?`}</AlertDialogTitle>
        <AlertDialogDescription>{confirm==='discard'
          ?'Se recuperará la última paleta consultada. No se enviará ningún cambio al servidor ni se modificarán nombre o logo.'
          :`Organización: ${name||tenantSlug}. Cambiarán únicamente los colores de las superficies indicadas. No se envían mensajes ni se modifican planes o dominios.`}</AlertDialogDescription></AlertDialogHeader>
      {confirm!=='discard'&&target?<BrandComparison saved={snapshot.values} proposed={target} label="Resumen de publicación"/>:null}
      {typeof confirm==='number'&&state.dirty?<p className={styles.dialogNote}>Restaurar reemplazará también tu borrador de paleta si el servidor confirma la publicación.</p>:null}
      <AlertDialogFooter><AlertDialogCancel>Seguir revisando</AlertDialogCancel><AlertDialogAction
        disabled={confirm==='discard'?localActionDisabled:actionDisabled||!target||(confirm==='publish'&&!state.dirty)} onClick={()=>{
        const selected=confirm;setConfirm(null);
        if(selected==='discard'){state.discardDraft();return;}
        if(selected!==null)void state.publish(typeof selected==='number'?selected:undefined);
      }}>{confirm==='discard'?'Confirmar descarte':'Confirmar publicación'}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
  </section>;
}
