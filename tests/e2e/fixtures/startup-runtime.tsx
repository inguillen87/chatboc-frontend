import {createRoot} from 'react-dom/client';
import {BackendStartupBoundary} from '@/components/app-shell/BackendStartupBoundary';
import '@/index.css';
createRoot(document.getElementById('root')!).render(<BackendStartupBoundary>
  <main><h1>Workspace fixture</h1><label>Borrador de prueba<input aria-label="Borrador de prueba"/></label></main>
</BackendStartupBoundary>);
