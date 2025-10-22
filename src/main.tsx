import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { setupPWA } from './pwa';
const container = document.getElementById('root')!;

setupPWA();

createRoot(container).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
