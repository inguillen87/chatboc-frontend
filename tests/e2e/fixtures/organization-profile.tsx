import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../../../src/index.css';
import InstitutionProfileWorkspace, {type InstitutionProfileSection} from '../../../src/components/profile/InstitutionProfileWorkspace';
import {readOrganizationWorkspace} from '../../../src/utils/organizationWorkspace';
import fixtures from '../../fixtures/organization-workspaces.json';
if (!import.meta.env.DEV) throw new Error('development_fixture_only');
function Harness(){
  const [kind,setKind]=useState<keyof typeof fixtures>('colegio');
  const [section,setSection]=useState<InstitutionProfileSection>('general');
  const [allowed,setAllowed]=useState(true); const [saved,setSaved]=useState(0);
  const source=fixtures[kind]; const workspace=readOrganizationWorkspace(source,source.tenant.slug);
  return <main className="flex h-[100dvh] min-h-0 flex-col gap-2 bg-background p-2 text-foreground">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label>Tipo de prueba <select aria-label="Tipo de prueba" value={kind} className="bg-background"
        onChange={e=>setKind(e.target.value as keyof typeof fixtures)}>{Object.keys(fixtures).map(k=><option key={k}>{k}</option>)}</select></label>
      <button onClick={()=>setAllowed(!allowed)} className="min-h-11 rounded border px-2">Cambiar permiso</button>
      <span data-testid="saved">{saved}</span>
    </div>
    <div className="min-h-0 flex-1"><InstitutionProfileWorkspace workspace={workspace}
      institutionName="Organización de prueba" activeSection={section} isMunicipal={kind==='municipio'}
      isAdministrator={allowed} onSectionChange={setSection} onCancel={()=>setSaved(0)}
      onSave={e=>{e.preventDefault();setSaved(n=>n+1)}}>
      <label className="block space-y-2">Nombre de referencia<input aria-label="Nombre de referencia"
        className="block w-full rounded border bg-background p-3" defaultValue="Ejemplo sintético" /></label>
    </InstitutionProfileWorkspace></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
