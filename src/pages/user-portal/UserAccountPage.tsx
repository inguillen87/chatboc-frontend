import React, { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Shield, UserCircle } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { usePortalContent } from '@/hooks/usePortalContent';
import { useUser } from '@/hooks/useUser';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const readFieldError = (errors: Record<string, string | string[]> | null | undefined, field: string) => {
  const value = errors?.[field];
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'string' ? value : null;
};

const UserAccountPage = () => {
  const { user } = useUser();
  const { currentSlug } = useTenant();
  const {
    publicProfile,
    registrationResult,
    registrationError,
    registerWidgetProfile,
  } = usePortalContent();
  const loginPath = useMemo(() => buildTenantPath('/user/login', currentSlug ?? undefined), [currentSlug]);
  const [form, setForm] = useState({
    name: publicProfile.name || user?.name || '',
    phone: publicProfile.phone || '',
    email: publicProfile.email || user?.email || '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'verification_required'>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  React.useEffect(() => {
    setForm((current) => {
      if (current.name || current.phone || current.email) return current;
      return {
        name: publicProfile.name || user?.name || '',
        phone: publicProfile.phone || '',
        email: publicProfile.email || user?.email || '',
      };
    });
  }, [publicProfile.email, publicProfile.name, publicProfile.phone, user?.email, user?.name]);

  const fieldErrors =
    registrationResult?.field_errors ??
    ((registrationError as any)?.body?.field_errors as Record<string, string | string[]> | undefined) ??
    null;
  const hasLinkedProfile = Boolean(user || publicProfile.userId || registrationResult?.profile?.user_id);
  const canRegister = publicProfile.canRegister || registrationResult?.reason_code === 'validation_failed';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    };

    if (!payload.name || (!payload.phone && !payload.email)) {
      setLocalError('Completa nombre y al menos un telefono o email.');
      return;
    }

    setStatus('saving');
    try {
      const result = await registerWidgetProfile(payload);
      setStatus(result?.status === 'verification_required' ? 'verification_required' : 'saved');
    } catch {
      setStatus('idle');
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Cuenta y seguimiento</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Vincula esta sesion para conservar historial, reclamos, pedidos y canjes cuando el backend lo permita.
          </p>
        </div>
        {!user ? (
          <Button asChild variant="outline">
            <a href={loginPath}>Iniciar sesion</a>
          </Button>
        ) : null}
      </div>

      <Card className="border border-muted/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" />
            Datos de contacto
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasLinkedProfile ? (
            <div className="grid gap-4 md:grid-cols-3">
              {(publicProfile.name || user?.name) ? (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="mt-1 font-medium">{publicProfile.name || user?.name}</p>
                </div>
              ) : null}
              {(publicProfile.phone) ? (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Telefono</p>
                  <p className="mt-1 font-medium">{publicProfile.phone}</p>
                </div>
              ) : null}
              {(publicProfile.email || user?.email) ? (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="mt-1 font-medium">{publicProfile.email || user?.email}</p>
                </div>
              ) : null}
            </div>
          ) : canRegister ? (
            <form className="grid gap-4 md:grid-cols-3" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="portal-name">Nombre</Label>
                <Input
                  id="portal-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  autoComplete="name"
                />
                {readFieldError(fieldErrors, 'name') ? (
                  <p className="text-xs text-destructive">{readFieldError(fieldErrors, 'name')}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-phone">Telefono</Label>
                <Input
                  id="portal-phone"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  autoComplete="tel"
                  type="tel"
                />
                {readFieldError(fieldErrors, 'phone') ? (
                  <p className="text-xs text-destructive">{readFieldError(fieldErrors, 'phone')}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-email">Email</Label>
                <Input
                  id="portal-email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  type="email"
                />
                {readFieldError(fieldErrors, 'email') || readFieldError(fieldErrors, 'email_or_phone') ? (
                  <p className="text-xs text-destructive">
                    {readFieldError(fieldErrors, 'email') || readFieldError(fieldErrors, 'email_or_phone')}
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-3 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={status === 'saving'}>
                  {status === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Vincular sesion
                </Button>
                {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
                {status === 'saved' ? (
                  <p className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Sesion vinculada y portal actualizado.
                  </p>
                ) : null}
                {status === 'verification_required' ? (
                  <p className="text-sm text-amber-700">Ese email requiere verificacion antes de quedar vinculado.</p>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              El backend todavia no publico registro progresivo para esta sesion.
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-start gap-3 text-sm text-muted-foreground">
          <Shield className="mt-0.5 h-4 w-4 text-primary" />
          <span>El portal solo conserva y muestra datos que devuelve el backend para esta sesion y tenant.</span>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UserAccountPage;
