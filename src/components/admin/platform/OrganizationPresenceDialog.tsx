import React, {useEffect, useRef, useState} from 'react';
import {Building2, Check, Copy, ExternalLink, Palette, RefreshCw, Settings2, Users} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from '@/components/ui/dialog';
import {readOrganizationPresence} from './organizationPresenceApi';
import {centralPresenceEntry, sharedPublicPresence, type OrganizationPresence, type PresenceBrand, type PresenceIdentity} from './organizationPresence';
import './organizationPresence.css';
interface Props { identity: PresenceIdentity; onClose: () => void; onEdit: () => void; onAccess: () => void; returnFocus?: HTMLElement | null }
export function OrganizationPresenceDialog(props: Props) {
  return <PresenceSession key={JSON.stringify([props.identity.id,props.identity.slug])} {...props}/>;
}
function PresenceSession({identity,onClose,onEdit,onAccess,returnFocus}: Props) {
  const [data,setData]=useState<OrganizationPresence|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const active=useRef(false),version=useRef(0),pending=useRef(false),navigating=useRef(false);
  const load=async()=>{
    if(pending.current)return;pending.current=true;const request=++version.current;
    setLoading(true);setData(null);setError('');
    try{const value=await readOrganizationPresence(identity,()=>active.current&&version.current===request);
      if(active.current&&version.current===request)setData(value);
    }catch{if(active.current&&version.current===request){setData(null);setError('No se pudieron verificar los datos de esta organización. No se muestran valores anteriores.');}}
    finally{if(version.current===request){pending.current=false;if(active.current)setLoading(false);}}
  };
  useEffect(()=>{active.current=true;pending.current=false;void load();return()=>{active.current=false;version.current+=1;};},[]);
  const go=(action:()=>void)=>{if(data&&!loading){navigating.current=true;onClose();action();}};
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent className="organization-presence-dialog" onCloseAutoFocus={event=>{event.preventDefault();if(!navigating.current&&returnFocus?.isConnected)returnFocus.focus();}}>
      <DialogHeader><DialogTitle>Marca y URLs de la organización</DialogTitle>
        <DialogDescription>Identificador {identity.id} · {identity.slug}. Comparación de configuración administrativa y publicación web.</DialogDescription></DialogHeader>
      <div className="presence-toolbar"><p className="presence-note">Consulta de lectura; no modifica dominios, cuentas ni permisos.</p>
        <Button type="button" variant="outline" disabled={loading} onClick={()=>void load()}><RefreshCw aria-hidden="true" size={16}/>Actualizar datos</Button></div>
      {loading&&<div role="status" className="presence-loading"><Building2 aria-hidden="true"/><p>Consultando identidad configurada y publicada…</p></div>}
      {error&&<div role="alert" className="presence-warning"><p>{error}</p><Button variant="outline" onClick={()=>void load()}>Reintentar consulta</Button></div>}
      {data&&<>
        <div className="presence-brands"><BrandView key={'configured:'+data.configured.logo} title="Configuración administrativa" brand={data.configured}/>
          <BrandView key={'published:'+data.published.logo} title="Identidad publicada" brand={data.published}/></div>
        <p className={data.differences.length?'presence-warning':'presence-observation'}>{data.differences.length
          ? `Hay diferencias en ${data.differences.map(key=>({name:'nombre',logo:'logo',color:'color'}[key])).join(', ')} entre ambas respuestas. Revisá la configuración antes de compartirla.`
          : 'No se detectaron diferencias entre los campos comparables de ambas respuestas. Esto no verifica DNS, certificados ni acceso de usuarios.'}</p>
        <section className="presence-links" aria-label="Entradas y dominio de la organización">
          <h3>Entradas y dominio</h3>
          <PresenceLink label="Ingreso central de ChatBoc" url={centralPresenceEntry()} detail="Entrada general. Esta consulta no prueba las credenciales de ningún usuario."/>
          <PresenceLink label="Espacio público en ChatBoc" url={sharedPublicPresence(identity)} detail="Ruta compartida para esta organización. No equivale a su panel administrativo ni otorga acceso."/>
          {data.domain?<PresenceLink label="Dominio declarado por la organización" url={data.domain} detail="Dirección recibida del servidor. No se certificaron aquí su DNS, HTTPS ni inicio de sesión."/>
            :<div className="presence-link-empty"><h4>Dominio propio</h4><p>{data.domainState==='rejected'?'La dirección recibida no cumple el formato seguro admitido; no se abre ni se copia.':'El servidor no publicó un dominio propio. No se inventa una URL a partir del nombre o del identificador.'}</p></div>}
        </section>
        <section className="presence-next" aria-label="Acciones de configuración"><h3>Gestionar la misma organización</h3>
          <p>La marca y las cuentas pertenecen al mismo espacio. La URL no agrega permisos y una demo aislada no sustituye el acceso institucional.</p>
          <div className="presence-toolbar"><Button type="button" variant="outline" onClick={()=>go(onEdit)}><Settings2 aria-hidden="true" size={16}/>Editar organización</Button>
            <Button type="button" variant="outline" onClick={()=>go(onAccess)}><Users aria-hidden="true" size={16}/>Administrar accesos</Button></div>
        </section>
        <details className="presence-evidence"><summary>Qué verifica esta vista</summary>
          <p>Identidad coincidente en las respuestas administrativa y pública; nombre, logo y color primario válido, cuando se informa en ambos contratos. Consulta realizada: {new Date(data.observedAt).toLocaleString('es-AR')}.</p>
          <p>No comprueba credenciales, sesión compartida entre dominios, propiedad del dominio ni entrega de WhatsApp. Esas verificaciones siguen siendo independientes.</p>
        </details>
      </>}
    </DialogContent>
  </Dialog>;
}
function BrandView({title,brand}:{title:string;brand:PresenceBrand}) {
  const [failed,setFailed]=useState(false);
  return <section className="presence-brand" aria-label={title}><h3>{title}</h3><div className="presence-brand-preview">
    {brand.logo&&!failed?<img src={brand.logo} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<Building2 size={32} aria-hidden="true"/>}
    <strong>{brand.name}</strong></div>
    <p className="presence-note">{brand.logoRejected?'Logo recibido no apto para publicación segura.':failed?'No se pudo cargar la imagen publicada.':brand.logo?'Logo informado por el servidor.':'No se informó un logo.'}</p>
    <p className="presence-color"><Palette size={16} aria-hidden="true"/>Color primario: {brand.primary?<><span style={{backgroundColor:brand.primary}} aria-hidden="true"/><code>{brand.primary}</code></>:'No informado'}</p>
  </section>;
}
function PresenceLink({label,url,detail}:{label:string;url:string;detail:string}) {
  const [message,setMessage]=useState(''),[copying,setCopying]=useState(false);
  const active=useRef(true),lock=useRef(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const copy=async()=>{
    if(lock.current)return;lock.current=true;setCopying(true);setMessage('');
    try{await navigator.clipboard.writeText(url);if(active.current)setMessage('Enlace copiado.');}
    catch{if(active.current)setMessage('No se pudo copiar. Podés seleccionar la dirección visible.');}
    finally{lock.current=false;if(active.current)setCopying(false);}
  };
  return <article className="presence-link"><h4>{label}</h4><code>{url}</code><p>{detail}</p>
    <div className="presence-toolbar"><Button type="button" variant="outline" disabled={copying} aria-label={`Copiar ${label}`} onClick={()=>void copy()}>
      {message==='Enlace copiado.'?<Check size={16} aria-hidden="true"/>:<Copy size={16} aria-hidden="true"/>}{copying?'Copiando…':'Copiar enlace'}</Button>
      <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Abrir ${label} en otra pestaña`}><ExternalLink size={16} aria-hidden="true"/>Abrir</a>
      {message&&<span role="status">{message}</span>}</div>
  </article>;
}
