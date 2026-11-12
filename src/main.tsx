import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { AccessibleMotionProvider } from './components/app-shell/AccessibleMotionProvider';
import { setupPWA } from './pwa';
import { registerExtensionNoiseFilters } from '@/utils/registerExtensionNoiseFilters';
import { runBootstrapPrivacyMigrations } from '@/utils/bootstrapPrivacy';
const container = document.getElementById('root')!;

registerExtensionNoiseFilters();
runBootstrapPrivacyMigrations();
setupPWA();

createRoot(container).render(
  <ErrorBoundary>
    <AccessibleMotionProvider>
      <App />
    </AccessibleMotionProvider>
  </ErrorBoundary>
);
