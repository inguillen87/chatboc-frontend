import React,{useId,useState} from 'react';
import {LocateFixed,MapPin} from 'lucide-react';

export interface KnowledgeLocality {label:string;target:string;lat?:number;lng?:number}

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

/** Farther than this from every published place, the device location decides nothing. */
export const LOCALITY_MAX_DISTANCE_KM=60;
const kilometres=(aLat:number,aLng:number,bLat:number,bLng:number)=>{
  const rad=Math.PI/180,dLat=(bLat-aLat)*rad,dLng=(bLng-aLng)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(aLat*rad)*Math.cos(bLat*rad)*Math.sin(dLng/2)**2;
  return 12742*Math.asin(Math.sqrt(h));
};
/** The published place closest to a position, when one is close enough. */
export function nearestInstitutionalLocality(localities:KnowledgeLocality[],lat:number,lng:number):string|null {
  let best:{label:string;km:number}|null=null;
  for(const place of localities){
    if(typeof place.lat!=='number'||typeof place.lng!=='number')continue;
    const km=kilometres(lat,lng,place.lat,place.lng);
    if(!best||km<best.km)best={label:place.label,km};
  }
  return best&&best.km<=LOCALITY_MAX_DISTANCE_KM?best.label:null;
}

interface Props {localities:KnowledgeLocality[];value:string|null;disabled?:boolean;onChange:(label:string|null)=>void}

export function InstitutionalLocality({localities,value,disabled=false,onChange}:Props) {
  const headingId=useId();
  const [locating,setLocating]=useState(false);
  const [note,setNote]=useState('');
  const canLocate=typeof navigator!=='undefined'&&'geolocation' in navigator&&
    localities.length>=2&&localities.every(place=>typeof place.lat==='number'&&typeof place.lng==='number');
  // The position is compared on this device and discarded: it is never sent or stored.
  const locate=()=>{
    setLocating(true);setNote('');
    navigator.geolocation.getCurrentPosition(position=>{
      setLocating(false);
      const label=nearestInstitutionalLocality(localities,position.coords.latitude,position.coords.longitude);
      if(label)onChange(label);
      else setNote('Tu ubicación queda lejos de estas ciudades. Elegí una de la lista.');
    },()=>{setLocating(false);setNote('No pudimos usar tu ubicación. Elegí tu ciudad de la lista.');},
    {enableHighAccuracy:false,timeout:10000,maximumAge:600000});
  };
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
    {canLocate?<button type="button" className="institutional-locality__locate" disabled={disabled||locating} onClick={locate}>
      <LocateFixed size={18} aria-hidden="true"/><span>{locating?'Buscando tu ubicación…':'Usar mi ubicación'}</span>
    </button>:null}
    <p role="status" className="institutional-locality__note">{note}</p>
  </section>;
}
