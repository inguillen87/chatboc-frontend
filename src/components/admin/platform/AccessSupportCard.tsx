import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/utils/api';

export interface AccessSupportUser {
  id: number;
  name: string;
  email: string;
  role: string | null;
  is_owner: boolean;
  sign_in_disabled: boolean;
  link_block_reason: string | null;
}

interface IssuedLink {
  userId: number;
  url: string;
  minutes: number;
}

const BLOCK_REASONS: Record<string, string> = {
  platform_account: 'Es una cuenta de la plataforma.',
  external_sign_in: 'Ingresa con un proveedor externo, no con contraseña.',
  demo_account: 'Es una cuenta de demostración.',
};

const roleLabel = (user: AccessSupportUser) =>
  user.is_owner ? 'Responsable' : user.role === 'empleado' ? 'Equipo' : 'Administración';

/** The token travels in the fragment so it never reaches a server log. */
export const buildAccessResetUrl = (origin: string, token: string) =>
  `${origin.replace(/\/+$/, '')}/restablecer#token=${encodeURIComponent(token)}`;

/**
 * Platform support: see who signs in to an organization and hand a locked-out
 * person a one-time link to choose a new password. Support never types or
 * learns the password.
 */
export function AccessSupportCard({ tenantSlug }: { tenantSlug: string }) {
  const [users, setUsers] = useState<AccessSupportUser[] | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [message, setMessage] = useState('');
  const sequence = useRef(0);
  const linkFieldId = useId();
  const base = `/api/admin/tenants/${encodeURIComponent(tenantSlug)}/access-support`;

  const load = useCallback(async () => {
    const current = ++sequence.current;
    setStatus('loading');
    setIssued(null);
    setMessage('');
    try {
      const data = await apiFetch<{ users?: unknown }>(`${base}/users`, { method: 'GET', cache: 'no-store' });
      if (current !== sequence.current) return;
      setUsers(Array.isArray(data?.users) ? (data.users as AccessSupportUser[]) : []);
      setStatus('ready');
    } catch {
      if (current !== sequence.current) return;
      setUsers(null);
      setStatus('error');
    }
  }, [base]);

  useEffect(() => {
    void load();
    return () => {
      sequence.current += 1;
    };
  }, [load]);

  const issue = async (user: AccessSupportUser) => {
    const current = sequence.current;
    setBusyId(user.id);
    setIssued(null);
    setMessage('');
    try {
      const data = await apiFetch<{ token?: unknown; expires_in_minutes?: unknown }>(
        `${base}/users/${user.id}/reset-link`,
        { method: 'POST', cache: 'no-store' },
      );
      if (current !== sequence.current) return;
      if (typeof data?.token !== 'string' || !data.token) throw new Error('access_link_invalid');
      setIssued({
        userId: user.id,
        url: buildAccessResetUrl(window.location.origin, data.token),
        minutes: typeof data.expires_in_minutes === 'number' ? data.expires_in_minutes : 60,
      });
    } catch {
      if (current === sequence.current) setMessage('No se pudo generar el enlace. Volvé a intentarlo.');
    } finally {
      if (current === sequence.current) setBusyId(null);
    }
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.url);
      setMessage('Enlace copiado.');
    } catch {
      setMessage('No se pudo copiar. Seleccioná el enlace y copialo a mano.');
    }
  };

  return (
    <section className="space-y-4 rounded-md border bg-muted/20 p-4" aria-labelledby={`${linkFieldId}-title`}>
      <div>
        <h3 id={`${linkFieldId}-title`} className="text-sm font-medium">Ayudar a alguien a ingresar</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Generá un enlace de un solo uso y enviáselo a la persona. Ella elige su contraseña nueva; vos nunca la ves.
        </p>
      </div>

      {status === 'loading' ? <p role="status" className="text-sm text-muted-foreground">Buscando las cuentas…</p> : null}
      {status === 'error' ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm">No se pudieron consultar las cuentas de esta organización.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Volver a consultar</Button>
        </div>
      ) : null}
      {status === 'ready' && users && users.length === 0 ? (
        <p className="text-sm text-muted-foreground">Esta organización todavía no tiene cuentas con acceso al panel.</p>
      ) : null}

      {status === 'ready' && users && users.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border bg-background">
          {users.map((user) => {
            const blocked = user.link_block_reason ? BLOCK_REASONS[user.link_block_reason] ?? 'No admite enlace de acceso.' : null;
            return (
              <li key={user.id} className="space-y-3 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name || user.email}</p>
                    <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel(user)}
                      {user.sign_in_disabled ? ' · Ingreso deshabilitado' : ''}
                    </p>
                  </div>
                  {blocked ? (
                    <p className="text-xs text-muted-foreground">{blocked}</p>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="min-h-11"
                      disabled={busyId !== null}
                      onClick={() => void issue(user)}
                    >
                      {busyId === user.id ? 'Generando…' : 'Generar enlace de acceso'}
                    </Button>
                  )}
                </div>
                {issued?.userId === user.id ? (
                  <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                    <label htmlFor={linkFieldId} className="text-sm font-medium">
                      Enlace para {user.name || user.email}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        id={linkFieldId}
                        readOnly
                        value={issued.url}
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                      />
                      <Button type="button" size="sm" className="min-h-11" onClick={() => void copy()}>Copiar</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sirve una sola vez y vence en {issued.minutes} minutos. Enviáselo solo a esa persona. Si generás otro, este deja de servir.
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p role="status" aria-live="polite" className="min-h-5 text-sm">{message}</p>
    </section>
  );
}

export default AccessSupportCard;
