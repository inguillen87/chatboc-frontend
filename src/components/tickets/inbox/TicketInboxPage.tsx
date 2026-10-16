import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { getOmnichannelInboxV2, type OmnichannelInboxItem } from '@/api/v2/saas';
import { ViewState } from '@/components/app-shell/ViewState';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useTenant } from '@/context/TenantContext';
import { getTickets } from '@/services/ticketService';
import { ApiError, getErrorMessage } from '@/utils/api';
import { TicketConversationPane, type InboxWorkState } from './TicketConversationPane';
import { TicketListPane } from './TicketListPane';
import { assertInboxTenantEnvelope, buildInboxCounters, filterInboxItems, inboxChannel, inboxChannelLabel, INITIAL_INBOX_FILTERS, validInboxTenant, verifiedInboxItems, type InboxFilters, type InboxQueue } from './inboxWorkspaceModel';
import './inboxWorkspace.css';
interface TicketInboxPageProps { presetCategory?: string; presetSensitivity?: string; expectedTenantSlug?: string | null }
const queues: Array<[InboxQueue, string]> = [['all','Conversaciones'],['unread','Con mensajes sin leer'],['unassigned','Sin asignar'],['queued','Chat en cola']];
const legacyItems = async (tenantSlug: string): Promise<OmnichannelInboxItem[]> => {
  const result = await getTickets(tenantSlug);
  return result.tickets.map(ticket => {
    const raw = ticket as unknown as Record<string, unknown>;
    return { id: String(raw.id ?? ''), title: String(raw.asunto || raw.title || raw.nro_ticket || raw.id || ''), status: String(raw.estado || 'unknown'), category: typeof raw.categoria === 'string' ? raw.categoria : undefined, sensitivity: typeof raw.priority === 'string' ? raw.priority : undefined, channel: typeof raw.canal === 'string' ? raw.canal : undefined, lastMessageAt: typeof raw.fecha === 'string' ? raw.fecha : '', unreadCount: raw.hasUnreadMessages ? 1 : 0, attachments: [], presence: [], timeline: [], actions: [], allowed_actions: [], next_steps: [], agent_copilot_suggestions: [], raw: ticket };
  });
};
export const TicketInboxPage: React.FC<TicketInboxPageProps> = props => {
  const { currentSlug } = useTenant();
  if (!validInboxTenant(currentSlug) || (props.expectedTenantSlug && props.expectedTenantSlug !== currentSlug)) return <div role="status" className="p-6">Seleccioná una organización confirmada para abrir la bandeja.</div>;
  return <InboxSession key={JSON.stringify([currentSlug,props.presetCategory,props.presetSensitivity])} tenantSlug={currentSlug} {...props} />;
};
function InboxSession({tenantSlug, presetCategory, presetSensitivity}: TicketInboxPageProps & {tenantSlug:string}) {
  const [selectedTicketId,setSelectedTicketId]=useState<string>();
  const [filters,setFilters]=useState<InboxFilters>({...INITIAL_INBOX_FILTERS});
  const [mobileOpen,setMobileOpen]=useState(false), [editorEpoch,setEditorEpoch]=useState(0);
  const [work,setWork]=useState<InboxWorkState>({dirty:false,busy:false});
  const workRef=useRef(work), pendingNavigation=useRef<null|(()=>void)>(null);
  const [discardOpen,setDiscardOpen]=useState(false);
  const conversationRef=useRef<HTMLDivElement>(null);
  React.useEffect(()=>{if(mobileOpen){const frame=requestAnimationFrame(()=>conversationRef.current?.focus());return()=>cancelAnimationFrame(frame);}},[mobileOpen,selectedTicketId]);
  const onWorkStateChange=useCallback((next:InboxWorkState)=>{workRef.current=next;setWork(previous=>previous.dirty===next.dirty&&previous.busy===next.busy?previous:next);},[]);
  const query=useQuery({queryKey:['inbox-omnichannel-v2',tenantSlug],queryFn:async()=>{
    try { const response=await getOmnichannelInboxV2(tenantSlug); assertInboxTenantEnvelope(response.raw,tenantSlug); response.items.forEach(item=>assertInboxTenantEnvelope(item,tenantSlug)); return {...response,legacy:false}; }
    catch(error) { if(!(error instanceof ApiError)||![404,405,501].includes(error.status)) throw error; const items=await legacyItems(tenantSlug); items.forEach(item=>assertInboxTenantEnvelope(item.raw,tenantSlug)); return {items,summary:{},raw:null,legacy:true}; }
  },retry:0,staleTime:30_000,refetchOnWindowFocus:false});
  const available=!query.isError?query.data:undefined;
  const source=useMemo(()=>verifiedInboxItems(available?.items||[],tenantSlug).filter(item=>(!presetCategory||item.category?.toLowerCase()===presetCategory.toLowerCase())&&(!presetSensitivity||item.sensitivity?.toLowerCase()===presetSensitivity.toLowerCase())),[available,tenantSlug,presetCategory,presetSensitivity]);
  const filtered=useMemo(()=>filterInboxItems(source,filters),[source,filters]);
  const counters=useMemo(()=>buildInboxCounters(source),[source]);
  const selectedTicket=filtered.find(item=>item.id===selectedTicketId);
  React.useEffect(()=>{ if(!filtered.some(item=>item.id===selectedTicketId)){setSelectedTicketId(filtered[0]?.id);setMobileOpen(false);} },[filtered,selectedTicketId]);
  const navigate=(action:()=>void)=>{ if(workRef.current.busy)return; if(workRef.current.dirty){pendingNavigation.current=action;setDiscardOpen(true);}else action(); };
  const updateFilters=(patch:Partial<InboxFilters>)=>navigate(()=>setFilters(current=>({...current,...patch})));
  const select=(id:string)=>{if(id===selectedTicketId){setMobileOpen(true);return;}navigate(()=>{setSelectedTicketId(id);setMobileOpen(true);});};
  const channels=Array.from(new Set<string>(source.map(inboxChannel).filter(Boolean))).sort();
  const statuses=Array.from(new Set<string>(source.map(item=>item.status).filter(Boolean))).sort();
  const hasFilters=filters.search||filters.channel||filters.status||filters.queue!=='all';
  const refresh=()=>{if(!workRef.current.dirty&&!workRef.current.busy)void query.refetch();};
  return <section className={`inbox-workspace ${mobileOpen?'is-conversation-open':''}`} aria-label="Bandeja omnicanal">
    <header className="inbox-workspace-header"><div><h1>Bandeja de atención</h1><p>{tenantSlug} · WhatsApp y los canales publicados por esta organización</p></div>
      <Button variant="outline" disabled={query.isFetching||work.dirty||work.busy} onClick={refresh}><RefreshCw size={16} aria-hidden="true"/>Actualizar bandeja</Button></header>
    <div className="inbox-workspace-counters" aria-label="Vistas de la bandeja">{queues.map(([key,label])=><button type="button" key={key} aria-pressed={filters.queue===key} disabled={!available||query.isFetching||work.busy} onClick={()=>updateFilters({queue:key})}><span>{label}</span><strong>{available?counters[key]:'—'}</strong></button>)}</div>
    <div className="inbox-workspace-filters">
      <label className="inbox-workspace-search"><span><Search size={14} aria-hidden="true"/>Buscar conversaciones</span><input type="search" value={filters.search} onChange={event=>updateFilters({search:event.target.value})} disabled={work.busy} placeholder="Contacto, asunto o referencia"/></label>
      <label>Canal<select value={filters.channel} onChange={event=>updateFilters({channel:event.target.value})} disabled={work.busy}><option value="">Todos los canales</option>{channels.map(channel=><option key={channel} value={channel}>{inboxChannelLabel(channel)}</option>)}</select></label>
      <label>Estado<select value={filters.status} onChange={event=>updateFilters({status:event.target.value})} disabled={work.busy}><option value="">Todos los estados</option>{statuses.map(status=><option key={status} value={status}>{status}</option>)}</select></label>
      <label>Orden<select value={filters.sort} onChange={event=>updateFilters({sort:event.target.value as InboxFilters['sort']})} disabled={work.busy}><option value="recent">Actividad reciente</option><option value="oldest">Actividad más antigua</option><option value="name">Nombre</option></select></label>
    </div>
    <div className="inbox-workspace-coverage"><p role="status">{query.isFetching?'Consultando la bandeja…':query.isError?'Bandeja no disponible':`${filtered.length} resultados de ${source.length} conversaciones cargadas.`}</p>{hasFilters&&<Button variant="ghost" disabled={work.busy} onClick={()=>updateFilters({...INITIAL_INBOX_FILTERS})}>Limpiar filtros</Button>}</div>
    {available&&<p className="inbox-workspace-note">{available.legacy?'Fuente compatible de tickets; las acciones requieren verificar el detalle. ':'Fuente omnicanal del servidor. '}Los indicadores y filtros se calculan sobre las conversaciones cargadas, no sobre el total histórico. {counters.unknownAssignment>0?`${counters.unknownAssignment} sin información suficiente de asignación. `:''}{query.dataUpdatedAt?`Última lectura: ${new Date(query.dataUpdatedAt).toLocaleString('es-AR')}.`:''}</p>}
    {work.dirty&&<p className="inbox-workspace-note">Tenés un borrador sin guardar. Guardalo o confirmá su descarte antes de cambiar de conversación.</p>}
    {query.isLoading?<ViewState status="loading" description="Cargando conversaciones de la organización."/>:query.isError?<ViewState status="error" description={getErrorMessage(query.error,'No se pudo verificar la bandeja.')} action={<Button variant="outline" onClick={refresh}>Reintentar</Button>}/>:!filtered.length?<ViewState status="empty" description="No hay conversaciones para estos filtros. No se enviaron mensajes ni se cambiaron casos."/>:
      <div className="inbox-workspace-body">
        <aside className="inbox-workspace-list"><TicketListPane tickets={filtered} selectedTicketId={selectedTicketId} onSelect={select} disabled={query.isFetching||work.busy}/></aside>
        <div ref={conversationRef} role="region" aria-label="Detalle de conversación" tabIndex={-1} className="inbox-workspace-conversation"><Button variant="outline" className="inbox-mobile-back" onClick={()=>{setMobileOpen(false);requestAnimationFrame(()=>document.getElementById(`inbox-case-${selectedTicketId}`)?.focus());}}><ArrowLeft size={16} aria-hidden="true"/>Volver a conversaciones</Button>
          <TicketConversationPane key={`${selectedTicketId}:${editorEpoch}`} ticket={selectedTicket} ticketId={selectedTicketId} tenantSlug={tenantSlug} onWorkStateChange={onWorkStateChange} onActionComplete={()=>void query.refetch()}/>
        </div>
      </div>}
    <AlertDialog open={discardOpen} onOpenChange={open=>{setDiscardOpen(open);if(!open)pendingNavigation.current=null;}}><AlertDialogContent className="inbox-discard-dialog"><AlertDialogHeader><AlertDialogTitle>Hay un borrador sin guardar</AlertDialogTitle><AlertDialogDescription>Seguí editando o descartá el texto antes de cambiar de conversación o filtro. Descartar no envía mensajes.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter>
      <Button variant="outline" onClick={()=>{pendingNavigation.current=null;setDiscardOpen(false);}}>Seguir editando</Button><Button onClick={()=>{const action=pendingNavigation.current;pendingNavigation.current=null;setDiscardOpen(false);setEditorEpoch(value=>value+1);onWorkStateChange({dirty:false,busy:false});action?.();}}>Descartar borrador</Button>
    </AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
