import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import TicketsPanelPage from '@/pages/TicketsPanel';
import SectionErrorBoundary from '@/components/errors/SectionErrorBoundary';
import TicketContent,{IdentityContext,scenario} from './section-recovery.providers';
import '@/index.css';
function Fixture(){
  const [view,setView]=useState('tickets'),[scope,setScope]=useState('org-a'),[notes,setNotes]=useState(''),[attempts,setAttempts]=useState(0);
  const retry=async()=>{
    setAttempts(value=>value+1);await new Promise(resolve=>setTimeout(resolve,400));
    if(scenario.mode==='reject')throw new Error('synthetic-read-rejected');scenario.broken=false;
  };
  return <IdentityContext.Provider value={scope}><main style={{maxWidth:1200,margin:'0 auto',padding:16}}>
    <h1 className="text-xl font-semibold mb-3">Recuperación de secciones · prueba aislada</h1>
    <label className="grid gap-2 mb-4">Borrador externo al bloque<textarea value={notes} onChange={event=>setNotes(event.target.value)} className="border rounded p-3 bg-background"/></label>
    <div className="flex flex-wrap gap-3 mb-4">
      <button onClick={()=>{scenario.broken=false;scenario.mode='success';}}>Preparar recuperación</button>
      <button onClick={()=>{scenario.broken=true;scenario.mode='reject';setView('async');}}>Consulta asíncrona con error</button>
      <button onClick={()=>{scenario.broken=false;setScope('org-b');}}>Cambiar organización de prueba</button>
    </div>
    <output data-testid="attempts">{attempts}</output>
    {view==='tickets'?<div style={{height:580}}><TicketsPanelPage embedded identityCoverageDelayMs={60000}/></div>
      :<SectionErrorBoundary title="No pudimos cargar la consulta" resetKeys={[scope]} onRetry={retry}><TicketContent/></SectionErrorBoundary>}
  </main></IdentityContext.Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
