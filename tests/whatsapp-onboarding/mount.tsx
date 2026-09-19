import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import Onboarding from '../../src/components/integrations/WhatsappTechProviderOnboarding';
// Dev-only page. No authentication bypass or production build entry.
function Harness() {
  const [slug, setSlug] = React.useState('qa-municipio');
  return <main className="mx-auto min-h-screen w-full max-w-6xl bg-background p-3 text-foreground sm:p-6">
    <h1 className="mb-3 text-xl font-semibold">Configuración por organización · datos sintéticos</h1>
    <button className="mb-4 min-h-11 rounded border px-3" onClick={() => setSlug(slug === 'qa-municipio' ? 'qa-empresa' : 'qa-municipio')}>Cambiar organización de prueba</button>
    <Onboarding tenantSlug={slug}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
