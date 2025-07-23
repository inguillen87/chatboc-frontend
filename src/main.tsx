import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
const container = document.getElementById('root')!;

createRoot(container).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
