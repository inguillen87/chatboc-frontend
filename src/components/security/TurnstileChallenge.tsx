import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
      remove?: (widgetId: string) => void;
      reset?: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = 'chatboc-cloudflare-turnstile';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstileScriptPromise: Promise<void> | null = null;

const loadTurnstileScript = (forceReload = false) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }
  if (forceReload) {
    const staleScript = document.getElementById(TURNSTILE_SCRIPT_ID);
    staleScript?.remove();
    turnstileScriptPromise = null;
  }
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (turnstileScriptPromise) {
    return turnstileScriptPromise;
  }

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile_load_failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      turnstileScriptPromise = null;
      reject(new Error('turnstile_load_failed'));
    };
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
};

export const TurnstileChallenge = ({
  siteKey,
  onToken,
  disabled,
  resetSignal,
  testId = 'turnstile-challenge',
  title = 'Verificacion de seguridad',
  description = 'Protege esta accion publica sin pedirte registro previo.',
}: {
  siteKey: string;
  onToken: (token: string) => void;
  disabled?: boolean;
  resetSignal?: number;
  testId?: string;
  title?: string;
  description?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!siteKey || disabled) {
      onToken('');
      return undefined;
    }

    setState('loading');
    loadTurnstileScript(retryAttempt > 0)
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        containerRef.current.innerHTML = '';
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          callback: (token) => {
            onToken(token);
            setState('ready');
          },
          'expired-callback': () => {
            onToken('');
            setState('loading');
          },
          'error-callback': () => {
            onToken('');
            setState('error');
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        onToken('');
        setState('error');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [disabled, onToken, retryAttempt, siteKey]);

  useEffect(() => {
    if (!widgetIdRef.current || !window.turnstile?.reset) return;
    onToken('');
    setState('loading');
    window.turnstile.reset(widgetIdRef.current);
  }, [onToken, resetSignal]);

  if (!siteKey) return null;

  return (
    <div className="rounded-lg border border-border/70 bg-background p-3" data-testid={testId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        {state === 'error' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setRetryAttempt((attempt) => attempt + 1)}
          >
            Reintentar verificación
          </Button>
        ) : (
          <Badge variant={state === 'ready' ? 'secondary' : 'outline'} className="w-fit">
            {state === 'ready' ? 'Validado' : 'Pendiente'}
          </Badge>
        )}
      </div>
      {state === 'error' ? (
        <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
          No pudimos cargar la verificación. Revisá tu conexión o bloqueadores y volvé a intentar.
        </p>
      ) : null}
      <div ref={containerRef} className="mt-3 min-h-[65px]" />
    </div>
  );
};

export default TurnstileChallenge;
