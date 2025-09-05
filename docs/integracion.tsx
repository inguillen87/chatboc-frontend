import { useEffect, useRef } from 'react';

// Static token provided for your entity.
const ENTITY_TOKEN = 'REPLACE_WITH_STATIC_ENTITY_TOKEN';

/**
 * Opciones de personalización del widget.
 * Cualquier propiedad puede omitirse para usar su valor por defecto.
 */
const WIDGET_OPTIONS = {
  width: '460px',
  height: '680px',
  closedWidth: '112px',
  closedHeight: '112px',
  bottom: '20px',
  right: '20px',
  primaryColor: '#007aff',
  // logoUrl: 'https://example.com/logo.png',
  // logoAnimation: 'spin 2s linear infinite',
};

function decodeExpiration(jwt: string): number {
  const [, payload] = jwt.split('.');
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const { exp } = JSON.parse(atob(padded));
  return exp * 1000; // exp comes in seconds, convert to ms
}

let currentToken: string | null = null;
let currentScript: HTMLScriptElement | null = null;

function injectWidget(token: string, opts = WIDGET_OPTIONS) {
  if (currentScript) currentScript.remove();
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
  s.setAttribute('data-width', opts.width);
  s.setAttribute('data-height', opts.height);
  s.setAttribute('data-closed-width', opts.closedWidth);
  s.setAttribute('data-closed-height', opts.closedHeight);
  s.setAttribute('data-bottom', opts.bottom);
  s.setAttribute('data-right', opts.right);
  s.setAttribute('data-endpoint', 'municipio');
  if (opts.primaryColor) s.setAttribute('data-primary-color', opts.primaryColor);
  if (opts.logoUrl) s.setAttribute('data-logo-url', opts.logoUrl);
  if (opts.logoAnimation) s.setAttribute('data-logo-animation', opts.logoAnimation);

  s.onload = () => console.log('Chatboc Widget cargado y listo.');
  s.onerror = () => console.error('Error al cargar Chatboc Widget.');

  document.body.appendChild(s);
  currentScript = s;
}

export default function Integracion() {
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function refreshToken() {
    let token = ENTITY_TOKEN;
    try {
      const res = await fetch('https://chatboc.ar/auth/widget-token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: ENTITY_TOKEN }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) token = data.token as string;
      } else {
        console.error('Respuesta no válida al obtener token', res.status);
      }
    } catch (err) {
      console.error('No se pudo obtener un nuevo token', err);
    }

    injectWidget(token);
    const expires = decodeExpiration(token);
    const timeout = Math.max(expires - Date.now() - 60_000, 30_000);
    refreshRef.current = setTimeout(refreshToken, timeout);
  }

  useEffect(() => {
    refreshToken();
    return () => {
      if (refreshRef.current) clearTimeout(refreshRef.current);
      if (currentScript) currentScript.remove();
      if ((window as any).chatbocDestroyWidget && currentToken) {
        (window as any).chatbocDestroyWidget(currentToken);
      }
    };
  }, []);

  return null;
}
