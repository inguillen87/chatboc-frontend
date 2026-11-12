import React, {useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {OrganizationPresenceDialog} from '@/components/admin/platform/OrganizationPresenceDialog';
import '@/index.css';
function Fixture() {
  const [open,setOpen]=useState(false),[action,setAction]=useState('');
  const trigger=useRef<HTMLButtonElement>(null);
  return <main style={{padding:20}}><h1>Marca y URLs · datos sintéticos</h1>
    <button ref={trigger} type="button" onClick={()=>setOpen(true)}>Revisar organización de prueba</button>
    <output data-testid="destination">{action}</output>
    {open&&<OrganizationPresenceDialog identity={{id:7,slug:'qa-presence'}} returnFocus={trigger.current}
      onClose={()=>setOpen(false)} onEdit={()=>setAction('organization-settings')} onAccess={()=>setAction('existing-access-management')}/>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
