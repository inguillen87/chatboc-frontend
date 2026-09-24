import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CalendarClock,RefreshCw,Search} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {ContactFollowUpDialog} from './ContactFollowUpDialog';
import {followUpApi} from './followUpApi';
import {browserTimeZone,followUpDateLabel,followUpState,FOLLOW_UP_LABELS,type FollowUpQueueView,type FollowUpRow} from './followUpModel';
import './followUp.css';
export default function SuperadminFollowUpQueue(){
  const [data,setData]=useState<Awaited<ReturnType<typeof followUpApi.list>>|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const [view,setView]=useState<FollowUpQueueView>('all'),[query,setQuery]=useState(''),[now,setNow]=useState(()=>new Date());
  const [selected,setSelected]=useState<FollowUpRow|null>(null);
  const alive=useRef(false),lock=useRef(false),revision=useRef(0),trigger=useRef<HTMLElement|null>(null),changed=useRef(false);
  const load=async()=>{if(lock.current)return;lock.current=true;const version=++revision.current;setLoading(true);setError('');setData(null);
    try{const rows=await followUpApi.list();if(alive.current&&version===revision.current){setData(rows);setNow(new Date());}}
    catch{if(alive.current&&version===revision.current){setSelected(null);setError('No se pudo verificar la agenda. No se conservan contactos anteriores.');}}
    finally{if(version===revision.current){lock.current=false;if(alive.current)setLoading(false);}}
  };
  useEffect(()=>{alive.current=true;lock.current=false;void load();return()=>{alive.current=false;revision.current+=1;};},[]);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),60_000);return()=>window.clearInterval(timer);},[]);
  const counts=useMemo(()=>{const result:Record<FollowUpQueueView,number>={all:data?.items.length||0,overdue:0,today:0,scheduled:0,unscheduled:0,unverified:0};data?.items.forEach(row=>result[followUpState(row.nextActionAt,now)]+=1);return result;},[data,now]);
  const visible=useMemo(()=>{
    const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
    const needle=normalize(query.trim());
    return (data?.items||[]).filter(row=>(view==='all'||followUpState(row.nextActionAt,now)===view)&&normalize(`${row.name} ${row.organization} ${row.tenantSlug}`).includes(needle))
      .sort((a,b)=>(Number.isFinite(Date.parse(a.nextActionAt||''))?Date.parse(a.nextActionAt!):Infinity)-(Number.isFinite(Date.parse(b.nextActionAt||''))?Date.parse(b.nextActionAt!):Infinity)||a.name.localeCompare(b.name,'es'));
  },[data,view,query,now]);
  const close=()=>{setSelected(null);if(changed.current){changed.current=false;void load();}};
  return <section className="followup-queue" aria-label="Agenda de próximos contactos">
    <header className="followup-heading"><div><div className="followup-eyebrow"><CalendarClock size={16} aria-hidden="true"/>CRM · Seguimiento</div><h2>Agenda de próximos contactos</h2><p>Priorizá contactos y verificá el próximo paso guardado, sin cambiar de organización.</p></div>
      <Button variant="outline" disabled={loading||Boolean(selected)} onClick={()=>void load()}><RefreshCw size={16} aria-hidden="true"/>Actualizar agenda</Button></header>
    <p className="followup-note">Consulta de hasta 100 contactos seleccionados por el servicio, no el universo completo. Los conteos y filtros corresponden sólo a los registros recibidos. Zona horaria: {browserTimeZone()}.</p>
    <div className="followup-queue-filters" aria-label="Prioridades de seguimiento">{(Object.keys(FOLLOW_UP_LABELS) as FollowUpQueueView[]).map(key=><button type="button" key={key} aria-pressed={view===key} disabled={loading||Boolean(error)} onClick={()=>setView(key)}><span>{FOLLOW_UP_LABELS[key]}</span><strong>{data?counts[key]:'—'}</strong></button>)}</div>
    <label className="followup-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Buscar contacto u organización</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Contacto u organización"/></label>
    {loading?<p role="status">Consultando agenda…</p>:error?<p role="alert" className="followup-warning">{error}</p>:<>
      <p role="status" className="followup-note">{visible.length} resultados · {data?.items.length||0} contactos con identidad verificada.{data?.excluded?` ${data.excluded} registros omitidos por identidad ausente o ambigua.`:''}</p>
      {!visible.length?<p className="followup-empty">No hay contactos que coincidan con estos filtros.</p>:<ul className="followup-rows">{visible.map(row=><li key={row.key}>
        <button type="button" aria-label={`Seguimiento de ${row.name} en ${row.organization}`} onClick={event=>{trigger.current=event.currentTarget;setSelected(row);}}>
          <span><strong>{row.name}</strong><span className="followup-note">{row.organization} · {row.tenantSlug}</span></span>
          <span><span className={`followup-state state-${followUpState(row.nextActionAt,now)}`}>{FOLLOW_UP_LABELS[followUpState(row.nextActionAt,now)]}</span><span className="followup-date">{followUpDateLabel(row.nextActionAt)}</span></span>
        </button></li>)}</ul>}
    </>}
    {selected&&<ContactFollowUpDialog identity={selected} returnFocus={trigger.current} onClose={close} onSaved={()=>{changed.current=true;}}/>}
  </section>;
}
