import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { setupPWA } from './pwa';
import { registerExtensionNoiseFilters } from '@/utils/registerExtensionNoiseFilters';
const container = document.getElementById('root')!;

registerExtensionNoiseFilters();
setupPWA();

createRoot(container).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
