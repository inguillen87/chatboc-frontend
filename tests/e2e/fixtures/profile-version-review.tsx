import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '@/index.css';
import ProfileVersionReview from '@/components/profile/ProfileVersionReview';
import source from '../../fixtures/organization-profile-settings.json';
import {readOrganizationProfile,type OrganizationValues} from '@/utils/organizationProfileSettings';
const baseline=readOrganizationProfile(source,'tenant-a')!.values;
function Harness(){
  const [accepted,setAccepted]=useState<OrganizationValues|null>(null);
  return <main className="mx-auto min-h-screen max-w-5xl bg-background p-3 text-foreground sm:p-6">
    <header className="mb-5"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Configuración de la organización</p>
      <h1 className="mt-2 text-2xl font-bold">Tus cambios, sin sobrescrituras</h1>
      <p className="mt-2 text-sm text-muted-foreground">Escenario de prueba con información sintética. No guarda datos reales.</p></header>
    <ProfileVersionReview baseline={baseline} draft={{...baseline,nombre_empresa:'Mi organización',link_web:'https://example.test/'+('detalle-'.repeat(16))}}
      latest={{...baseline,nombre_empresa:'Nombre guardado por otra persona',ciudad:'Ciudad actualizada'}} onAccept={setAccepted}/>
    {accepted?<section role="status" aria-label="Resultado de revisión" className="rounded-xl border border-border p-4"><h2 className="font-semibold">Selección preparada, todavía sin guardar</h2>
      <p>{accepted.nombre_empresa}</p><p>{accepted.ciudad}</p></section>:null}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
