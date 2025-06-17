import './index.css';

(async () => {
  const { createRoot } = await import('react-dom/client');
  const { default: App } = await import('./App.tsx');
  createRoot(document.getElementById('root')!).render(<App />);
})();
