import './index.css';
import { createRoot } from 'react-dom/client';

import ErrorBoundary from './components/ErrorBoundary';
import PortalApp from './PortalApp';
import { setupPWA } from './pwa';
import { registerExtensionNoiseFilters } from '@/utils/registerExtensionNoiseFilters';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Portal root container not found');
}

registerExtensionNoiseFilters();
setupPWA();

createRoot(container).render(
  <ErrorBoundary>
    <PortalApp />
  </ErrorBoundary>,
);
