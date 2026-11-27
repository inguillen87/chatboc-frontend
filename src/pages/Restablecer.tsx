import React, { useId, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ApiError, apiFetch } from '@/utils/api';

const MIN_LENGTH = 8;

/** Reads the one-time token from the fragment, where it never reaches a server log. */
export const readResetToken = (hash: string): string | null => {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return value && value.includes('.') && value.length <= 400 ? value : null;
};

const validate = (password: string, confirmation: string): string | null => {
  if (password.length < MIN_LENGTH) return `La contraseña necesita al menos ${MIN_LENGTH} caracteres.`;
  if (/^\d+$/.test(password) || /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+$/.test(password)) return 'Tiene que combinar letras y números.';
  if (password !== confirmation) return 'Las dos contraseñas no coinciden.';
  return null;
};

const Restablecer = () => {
  const location = useLocation();
  const token = useMemo(() => readResetToken(location.hash), [location.hash]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'form' | 'sending' | 'done'>('form');
  const passwordId = useId();
  const confirmationId = useId();
  const errorId = useId();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || state === 'sending') return;
    const problem = validate(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setState('sending');
    try {
      await apiFetch('/auth/password/reset/confirm', {
        method: 'POST',
        singleAttempt: true,
        skipAuth: true,
        omitCredentials: true,
        omitEntityToken: true,
        omitChatSessionId: true,
        isWidgetRequest: false,
        omitTenant: true,
        persistTenantSlug: false,
        suppressPanel401Redirect: true,
        body: { token, new_password: password, confirm_password: confirmation },
      });
      setPassword('');
      setConfirmation('');
      setState('done');
    } catch (caught) {
      setState('form');
      setError(
        caught instanceof ApiError && caught.status === 400
          ? 'El enlace ya se usó o venció. Pedí uno nuevo a quien te lo envió.'
          : 'No se pudo guardar la contraseña. Probá de nuevo en un momento.',
      );
    }
  };

  return (
    <main id="main-content" className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="chatboc-display text-2xl font-bold tracking-tight text-foreground">Elegí tu contraseña nueva</h1>

      {state === 'done' ? (
        <div className="mt-6 space-y-4" role="status">
          <p className="text-base text-foreground">Listo. Tu contraseña quedó guardada.</p>
          <Button asChild className="min-h-11">
            <Link to="/login">Ir a iniciar sesión</Link>
          </Button>
        </div>
      ) : !token ? (
        <div className="mt-6 space-y-4">
          <p role="alert" className="text-base text-foreground">
            Este enlace no es válido o está incompleto. Pedí uno nuevo a quien te lo envió.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/login">Volver a iniciar sesión</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <p className="text-sm leading-6 text-muted-foreground">
            Al menos {MIN_LENGTH} caracteres, con letras y números. El enlace sirve una sola vez.
          </p>
          <div className="space-y-2">
            <label htmlFor={passwordId} className="text-sm font-medium text-foreground">Contraseña nueva</label>
            <input
              id={passwordId}
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="min-h-12 w-full rounded-md border border-input bg-background px-3 text-base"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor={confirmationId} className="text-sm font-medium text-foreground">Repetila</label>
            <input
              id={confirmationId}
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="min-h-12 w-full rounded-md border border-input bg-background px-3 text-base"
              required
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
            <input type="checkbox" className="h-5 w-5" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
            Mostrar lo que escribo
          </label>
          {error ? <p id={errorId} role="alert" className="text-sm font-medium text-foreground underline underline-offset-4">{error}</p> : null}
          <Button type="submit" className="min-h-12 w-full text-base" disabled={state === 'sending'}>
            {state === 'sending' ? 'Guardando…' : 'Guardar contraseña'}
          </Button>
        </form>
      )}
    </main>
  );
};

export default Restablecer;
