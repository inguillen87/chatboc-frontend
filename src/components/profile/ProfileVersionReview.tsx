import { useState } from 'react';
import { AlertTriangle, GitCompareArrows } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ORGANIZATION_FIELDS, profileChanges, type OrganizationField, type OrganizationValues } from '@/utils/organizationProfileSettings';
const LABELS={nombre_empresa:'Nombre de la organización',telefono:'Teléfono de contacto',direccion:'Dirección',
  ciudad:'Ciudad',provincia:'Provincia',pais:'País',latitud:'Latitud',longitud:'Longitud',link_web:'Sitio informativo',
  logo_url:'Logo',horario_json:'Horarios'};
const display=(value:unknown)=>Array.isArray(value)?value.map(d=>`${d.dia}: ${d.cerrado?'cerrado':`${d.abre}–${d.cierra}`}`).join('\n')
  :value===null||value===''?'Sin definir':String(value);
interface Props { baseline:OrganizationValues; draft:OrganizationValues; latest:OrganizationValues; onAccept:(values:OrganizationValues)=>void }
const differs=(a:unknown,b:unknown)=>JSON.stringify(a)!==JSON.stringify(b);
export default function ProfileVersionReview(props:Props) {
  // A new comparison invalidates choices made for old values, even at the same server revision.
  return <VersionChoices key={JSON.stringify([props.baseline,props.draft,props.latest])} {...props}/>;
}
function VersionChoices({baseline,draft,latest,onAccept}:Props) {
  const mine=profileChanges(draft,baseline), remote=profileChanges(latest,baseline);
  const differences=ORGANIZATION_FIELDS.filter(key=>differs(draft[key],latest[key]));
  const coordinates=['latitud','longitud'] as const;
  const coordinateConflict=coordinates.some(k=>k in mine)&&coordinates.some(k=>k in remote)
    &&coordinates.some(k=>differences.includes(k));
  const conflicts=differences.filter(key=>(key in mine&&key in remote)||
    (coordinateConflict&&coordinates.includes(key as 'latitud'|'longitud')));
  const [choice,setChoice]=useState<Partial<Record<OrganizationField,'mine'|'latest'>>>(()=>Object.fromEntries(
    differences.filter(key=>!conflicts.includes(key)).map(key=>[key,key in mine?'mine':'latest'])));
  const unresolved=conflicts.filter(key=>!choice[key]);
  const choose=(key:OrganizationField,source:'mine'|'latest')=>setChoice(current=>({...current,[key]:source,
    ...(coordinates.includes(key as 'latitud'|'longitud')?{latitud:source,longitud:source}:{})}));
  return <section className="mb-5 min-w-0 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4" aria-label="Revisar versiones del perfil">
    <div className="flex items-start gap-2"><GitCompareArrows className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true"/>
      <div><h4 className="font-semibold text-foreground">Revisá los cambios antes de continuar</h4>
        <p className="mt-1 text-sm text-muted-foreground">Tu edición sigue disponible. Elegí qué conservar; esta revisión todavía no guarda nada.</p></div></div>
    <div className="mt-3 flex items-center gap-2 text-sm text-foreground" role="status" aria-live="polite">
      {unresolved.length?<><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true"/>Hay cambios en los mismos datos. Elegí una versión para cada conflicto.</>
        :differences.length?'La selección está preparada para continuar editando.':'Tu edición coincide con la versión guardada.'}
    </div>
    <div className="mt-4 space-y-4">{differences.map(key=><fieldset key={key} className="min-w-0 rounded-lg border border-border bg-background/50 p-3">
      <legend className="px-1 text-sm font-semibold">{LABELS[key]}</legend>
      {conflicts.includes(key)?<p className="mb-2 text-xs text-muted-foreground">Ambas ediciones cambiaron este dato. No seleccionamos una por vos.</p>:null}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">{(['mine','latest'] as const).map(source=><label key={source}
        className="flex min-h-11 min-w-0 cursor-pointer items-start gap-2 rounded-md border border-border p-3 hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
        <input className="mt-1 shrink-0" type="radio" name={`review-${key}`} checked={choice[key]===source} onChange={()=>choose(key,source)}/>
        <span className="min-w-0 text-sm"><span className="block font-medium">{source==='mine'?'Tu edición':'Versión guardada'}</span>
          <span className="mt-1 block max-h-32 overflow-auto whitespace-pre-wrap break-words text-muted-foreground [overflow-wrap:anywhere]">{display((source==='mine'?draft:latest)[key])}</span></span>
      </label>)}</div>
    </fieldset>)}</div>
    <Button type="button" variant="outline" disabled={unresolved.length>0} className="mt-4 min-h-11 w-full border-primary/50 font-semibold text-foreground sm:w-auto" onClick={()=>{
      if(unresolved.length)return;
      const merged={...latest};
      for(const key of differences)if(choice[key]==='mine')Object.assign(merged,{[key]:draft[key]});
      onAccept(merged);
    }}>Usar selección y seguir editando</Button>
  </section>;
}
