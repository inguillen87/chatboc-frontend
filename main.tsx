import './index.css';
import { createRoot, Root } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import Iframe from './pages/Iframe';
import { registerExtensionNoiseFilters } from './utils/registerExtensionNoiseFilters';

registerExtensionNoiseFilters();
const container = document.getElementById('root')!;
const isIframe = window.location.pathname.startsWith('/iframe');
const root: Root = (container as any)._root || ((container as any)._root = createRoot(container));

root.render(
  <ErrorBoundary>
    {isIframe ? <Iframe /> : <App />}
  </ErrorBoundary>
);
