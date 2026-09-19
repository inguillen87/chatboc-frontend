import {createRoot} from 'react-dom/client';
import {AppShellStatusBar} from '@/components/app-shell/AppShellStatusBar';
import '@/index.css';

createRoot(document.getElementById('root')!).render(<>
  <AppShellStatusBar />
  <main className="mx-auto max-w-3xl space-y-5 p-6 text-foreground">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entorno de prueba · datos sintéticos</p>
    <h1 className="text-2xl font-bold">Continuá con tu trabajo</h1>
    <p className="text-sm text-muted-foreground">La recuperación del servicio no reemplaza esta pantalla ni envía esta edición.</p>
    <label className="block space-y-2 text-sm font-medium">Borrador de prueba
      <textarea aria-label="Borrador de prueba" className="block min-h-40 w-full rounded-xl border border-border bg-background p-4" />
    </label>
  </main>
</>);
