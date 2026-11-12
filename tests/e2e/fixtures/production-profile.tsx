import React from 'react';
import {createRoot} from 'react-dom/client';
import InstitutionProfileWorkspace,{type InstitutionProfileSection} from '@/components/profile/InstitutionProfileWorkspace';
import '@/index.css';
function Fixture(){
  const [section,setSection]=React.useState<InstitutionProfileSection>('general');
  const [value,setValue]=React.useState('Edición sintética que debe conservarse');
  const [submits,setSubmits]=React.useState(0);
  const readonly=new URLSearchParams(location.search).get('readonly')==='1';
  return <main className="min-h-0 min-w-0 p-2 sm:p-5" style={{height:'100dvh'}}>
    <InstitutionProfileWorkspace institutionName="Organización de evaluación multidispositivo" activeSection={section}
      isMunicipal isAdministrator={!readonly} plan="full" onSectionChange={setSection}
      onCancel={()=>{}} onSave={event=>{event.preventDefault();setSubmits(n=>n+1);}}>
      <label className="block text-foreground">Campo de prueba
        <input aria-label="Campo de prueba" className="mt-2 block w-full min-w-0 rounded-lg border border-border bg-background p-3"
          value={value} onChange={e=>setValue(e.target.value)}/>
      </label>
      <p className="mt-4 break-words text-muted-foreground">Contenido sintético para verificar navegación, desplazamiento y visibilidad. No usa datos ni API de clientes.</p>
      <div aria-hidden="true" style={{height:560}}/>
      <p data-testid="fixture-end">Fin del formulario</p>
      <output data-testid="fixture-submits">{submits}</output>
    </InstitutionProfileWorkspace>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
