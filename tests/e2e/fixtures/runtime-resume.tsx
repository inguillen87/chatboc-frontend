import {createRoot} from 'react-dom/client';
import {AppShellStatusBar} from '@/components/app-shell/AppShellStatusBar';
import {loadRuntimeRecoveryUI} from '@/services/runtimeRecoveryConfig';
import '@/index.css';

// The served JSON is mocked by the browser test from the exact backend file.
await loadRuntimeRecoveryUI();
document.body.style.overflow='hidden';
document.documentElement.style.overflow='hidden';
const root=document.getElementById('root')!;
root.style.height='100dvh'; root.style.overflow='hidden';
createRoot(root).render(<>
  <AppShellStatusBar />
  <main className="mx-auto flex h-dvh max-w-3xl flex-col gap-5 p-6 text-foreground">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entorno de prueba · datos sintéticos</p>
    <h1 className="text-2xl font-bold">Continuá con tu trabajo</h1>
    <p className="text-sm text-muted-foreground">La recuperación del servicio no reemplaza esta pantalla ni envía esta edición.</p>
    <label className="block space-y-2 text-sm font-medium">Borrador de prueba
      <textarea aria-label="Borrador de prueba" className="block min-h-40 w-full rounded-xl border border-border bg-background p-4" />
    </label>
    <footer data-testid="workspace-bottom" className="mt-auto shrink-0 border-t border-border pt-3">Fin del espacio de prueba</footer>
  </main>
</>);
