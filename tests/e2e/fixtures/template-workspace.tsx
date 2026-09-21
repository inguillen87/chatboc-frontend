import {createRoot} from 'react-dom/client';
import WhatsappTemplatePacksPanel from '@/components/admin/WhatsappTemplatePacksPanel';
import '@/index.css';
const slug = new URL(window.location.href).searchParams.get('tenant_slug');
createRoot(document.getElementById('root')!).render(<main className="mx-auto min-h-dvh max-w-6xl p-4 md:p-6">
  <WhatsappTemplatePacksPanel tenantSlug={slug}/>
</main>);
