// Test-only entry. Synthetic tenant; never imported by production routes.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OrganizationCommercialWorkspace } from '@/components/admin/platform/OrganizationCommercialWorkspace';
import '@/index.css';
function Fixture() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <main style={{ padding: '2rem' }}><h1>CRM · prueba sintética sin datos de clientes</h1>
    <button ref={trigger} onClick={() => setOpen(true)}>Abrir CRM de prueba</button>
    {open && <OrganizationCommercialWorkspace tenant={{ slug: 'qa-sprint', nombre: 'Organización de prueba' }} returnFocus={trigger.current} onClose={() => setOpen(false)} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
