import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import Iframe from './pages/Iframe';
const container = document.getElementById('root')!;
const isIframe = window.location.pathname.startsWith('/iframe');

createRoot(container).render(
  <ErrorBoundary>
    {isIframe ? <Iframe /> : <App />}
  </ErrorBoundary>
);
