import './index.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initializeConfig } from './services/configService';

const container = document.getElementById('root')!;
const root = createRoot(container);

initializeConfig().then(() => {
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}).catch(error => {
  console.error("Failed to start the application:", error);
  root.render(
    <div style={{ color: 'red', padding: '20px' }}>
      <h1>Error de Configuración</h1>
      <p>La aplicación no pudo iniciarse. Por favor, contacte a soporte.</p>
      <pre>{error.message}</pre>
    </div>
  );
});
