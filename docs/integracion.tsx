import { useEffect, useRef } from 'react';

// Replace with the static token provided for your entity.
const ENTITY_TOKEN = 'REPLACE_WITH_STATIC_ENTITY_TOKEN';

function decodeExpiration(jwt: string): number {
  const [, payload] = jwt.split('.');
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const { exp } = JSON.parse(atob(padded));
  return exp * 1000; // exp comes in seconds, convert to ms
}

let currentToken: string | null = null;
let currentScript: HTMLScriptElement | null = null;

function injectWidget(token: string) {
  if (currentScript) {
    currentScript.remove();
  }
  if ((window as any).chatbocDestroyWidget && currentToken) {
    (window as any).chatbocDestroyWidget(currentToken);
  }
  currentToken = token;

  (window as any).APP_TARGET = 'municipio';

  const s = document.createElement('script');
  s.src = 'https://chatboc.ar/widget.js';
  s.async = true;
  s.setAttribute('data-entity-token', token);
  s.setAttribute('data-default-open', 'false');
  s.setAttribute('data-width', '460px');
  s.setAttribute('data-height', '680px');
  s.setAttribute('data-closed-width', '112px');
  s.setAttribute('data-closed-height', '112px');
  s.setAttribute('data-bottom', '20px');
  s.setAttribute('data-right', '20px');
  s.setAttribute('data-endpoint', 'municipio');
  s.setAttribute('data-primary-color', '#007aff');

  s.onload = () => console.log('Chatboc Widget cargado y listo.');
  s.onerror = () => console.error('Error al cargar Chatboc Widget.');

  document.body.appendChild(s);
  currentScript = s;
}

export default function Integracion() {
  const refreshRef = useRef<NodeJS.Timeout>();

  async function refreshToken() {
    try {
      const res = await fetch('https://chatboc.ar/auth/widget-token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ENTITY_TOKEN })
      });
      const data = await res.json();
      const token = data.token as string;
      injectWidget(token);

      const expires = decodeExpiration(token);
      const timeout = expires - Date.now() - 60_000; // refresh 1 min before expiry
      refreshRef.current = setTimeout(refreshToken, Math.max(timeout, 0));
    } catch (err) {
      console.error('No se pudo obtener un nuevo token', err);
      // Reintentar en 30s en caso de error
      refreshRef.current = setTimeout(refreshToken, 30_000);
    }
  }

  useEffect(() => {
    refreshToken();
    return () => {
      if (refreshRef.current) clearTimeout(refreshRef.current);
    };
  }, []);

  return null;
}
