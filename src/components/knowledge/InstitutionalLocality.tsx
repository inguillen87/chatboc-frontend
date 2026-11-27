import React,{useId} from 'react';
import {MapPin} from 'lucide-react';

export interface KnowledgeLocality {label:string;target:string}

const storageKey=(tenantSlug:string)=>`chatboc.institutional.locality:${tenantSlug}`;

/** The place stays on this device only: it is a reading aid, not an account datum. */
export function readInstitutionalLocality(tenantSlug:string,localities:KnowledgeLocality[]):string|null {
  try{
    const stored=window.localStorage.getItem(storageKey(tenantSlug));
    return localities.find(place=>place.label===stored)?.label??null;
  }catch{return null;}
}
export function rememberInstitutionalLocality(tenantSlug:string,label:string|null):void {
  try{
    if(label)window.localStorage.setItem(storageKey(tenantSlug),label);
    else window.localStorage.removeItem(storageKey(tenantSlug));
  }catch{/* Private browsing: the choice lasts for this visit. */}
}
export function mentionsLocality(text:string,locality:string|null):boolean {
  return Boolean(locality)&&text.toLocaleLowerCase('es').includes(locality!.toLocaleLowerCase('es'));
}

interface Props {localities:KnowledgeLocality[];value:string|null;disabled?:boolean;onChange:(label:string|null)=>void}

export function InstitutionalLocality({localities,value,disabled=false,onChange}:Props) {
  const headingId=useId();
  if(localities.length<2)return null;
  if(value)return <p className="institutional-locality institutional-locality--chosen">
    <MapPin size={18} aria-hidden="true"/><span>Consultás desde <strong>{value}</strong>.</span>
    <button type="button" disabled={disabled} onClick={()=>onChange(null)}>Cambiar ciudad</button>
  </p>;
  return <section className="institutional-locality" aria-labelledby={headingId}>
    <h4 id={headingId}>¿Desde qué ciudad consultás?</h4>
    <p>Elegila una vez y te mostramos primero lo de tu ciudad. Queda guardada solo en este dispositivo.</p>
    <div className="institutional-locality__options">
      {localities.map(place=><button type="button" key={place.label} disabled={disabled} onClick={()=>onChange(place.label)}>
        <MapPin size={22} aria-hidden="true"/><span>{place.label}</span>
      </button>)}
    </div>
  </section>;
}
