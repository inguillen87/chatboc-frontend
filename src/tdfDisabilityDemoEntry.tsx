import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import './tdfDisabilityDemo.css';

const DisabilityAIAgentDemoPage = lazy(
  () => import('./pages/public/DisabilityAIAgentDemoPage'),
);

const GLOBAL_APP_SW_PATH = '/sw.js';
const RELOAD_GUARD = 'institutional-demo-sw-detached';

const detachGlobalAppServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return false;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const globalRegistrations = registrations.filter((registration) => {
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    if (!worker) return false;

    try {
      return new URL(worker.scriptURL).pathname === GLOBAL_APP_SW_PATH;
    } catch {
      return false;
    }
  });

  if (globalRegistrations.length === 0) return false;

  const controlledByGlobalApp = (() => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return false;
    try {
      return new URL(controller.scriptURL).pathname === GLOBAL_APP_SW_PATH;
    } catch {
      return false;
    }
  })();

  await Promise.all(globalRegistrations.map((registration) => registration.unregister()));
  return controlledByGlobalApp;
};

const mountInstitutionalDemo = () => {
  const container = document.getElementById('root');
  if (!container) throw new Error('No se encontro el contenedor de la demostracion institucional.');

  createRoot(container).render(
    <Suspense
      fallback={(
        <main
          aria-busy="true"
          aria-label="Cargando la demostración de Faro TDF"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: '#f4f7f5',
            color: '#173a38',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 700,
          }}
        >
          Preparando la experiencia accesible…
        </main>
      )}
    >
      <DisabilityAIAgentDemoPage />
    </Suspense>,
  );
};

void detachGlobalAppServiceWorker()
  .then((wasControlled) => {
    if (wasControlled && sessionStorage.getItem(RELOAD_GUARD) !== '1') {
      sessionStorage.setItem(RELOAD_GUARD, '1');
      window.location.reload();
      return;
    }
    sessionStorage.removeItem(RELOAD_GUARD);
    mountInstitutionalDemo();
  })
  .catch(() => mountInstitutionalDemo());
