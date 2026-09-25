import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SurveyCard} from '@/components/surveys/SurveyCard';
import type {SurveyAdmin} from '@/types/encuestas';
import '@/index.css';
import '@/components/surveys/surveyWorkspace.css';
const instrument = (id:number,title:string,state:SurveyAdmin['estado'],metrics?:SurveyAdmin['metricas']):SurveyAdmin => ({
  id,slug:`qa-${id}`,titulo:title,tipo:'opinion',estado:state,politica_unicidad:'libre',preguntas:[],metricas:metrics,
  url_publica:`https://example.test/e/qa-${id}`,inicio_at:null,fin_at:null,
});
const items=[instrument(41,'Consulta de servicios municipales y experiencia de atención en distintos barrios','publicada'),
  instrument(42,'Encuesta de prueba con cobertura pendiente de conciliación','borrador',{total_respuestas:10,respuestas_con_coordenadas:12,participantes_unicos:8,respuestas_ultimas_24h:0}),
  instrument(43,'Consulta sin respuestas registradas','borrador',{total_respuestas:0,respuestas_con_coordenadas:0,participantes_unicos:0,respuestas_ultimas_24h:0})];
function Fixture(){
  const [seeding,setSeeding]=useState(false),[closed,setClosed]=useState(false),[calls,setCalls]=useState({close:0,remove:0,edit:0});
  const close=async()=>{setCalls(v=>({...v,close:v.close+1}));await new Promise(resolve=>setTimeout(resolve,150));setClosed(true);};
  const remove=async()=>{setCalls(v=>({...v,remove:v.remove+1}));throw new Error('Synthetic rejected deletion');};
  return <main className="survey-admin-workspace" style={{maxWidth:1260,margin:'0 auto',padding:16}}>
    <h1 className="text-xl font-semibold mb-4">Encuestas · prueba de interfaz con datos sintéticos</h1>
    <label className="flex items-center gap-2 mb-4"><input type="checkbox" checked={seeding} onChange={event=>setSeeding(event.target.checked)}/>Generación de prueba en curso</label>
    <div className="grid gap-4 lg:grid-cols-3">{items.map(item=><SurveyCard key={item.id} survey={item.id===41&&closed?{...item,estado:'cerrada'}:item} tenantSlug="qa-org" seeding={seeding} onEdit={()=>setCalls(v=>({...v,edit:v.edit+1}))} onAnalytics={()=>{}} onClose={close} onDelete={remove} onCopyLink={()=>{}} onPublish={()=>{}}/>)}</div>
    <output data-testid="calls">{JSON.stringify(calls)}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
