import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import WhatsappTemplatePacksPanel from '../../src/components/admin/WhatsappTemplatePacksPanel';
// Development-only harness. Not a production build input or an authentication substitute.
function Harness() {
  const [scope, setScope] = React.useState('qa-government');
  return <main className="mx-auto min-h-screen w-full max-w-6xl bg-background px-3 py-6 text-foreground sm:px-6">
    <h1 className="mb-3 text-xl font-semibold">Plantillas de atención · datos sintéticos</h1>
    <button className="mb-4 min-h-11 rounded border px-3" onClick={() => setScope(scope === 'qa-government' ? 'qa-company' : 'qa-government')}>Cambiar organización de prueba</button>
    <WhatsappTemplatePacksPanel tenantSlug={scope}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
