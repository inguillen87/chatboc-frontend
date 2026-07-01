import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Shield, Trash2, UserCircle } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { usePortalContent } from '@/hooks/usePortalContent';
import { useUser } from '@/hooks/useUser';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import IdentityAvatar from '@/components/identity/IdentityAvatar';
import { deleteProfileAvatar, uploadProfileAvatar } from '@/services/profileAvatarService';
import { resolveConsentedAvatar } from '@/utils/avatarConsent';

const readFieldError = (errors: Record<string, string | string[]> | null | undefined, field: string) => {
  const value = errors?.[field];
  if (Array.isArray(value)) return value.join(', ');
  return typeof value === 'string' ? value : null;
};

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_IMAGE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const UserAccountPage = () => {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const { user, setUser, refreshUser } = useUser();
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
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'uploading' | 'deleting' | 'saved'>('idle');
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
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
  const displayName = form.name || publicProfile.name || user?.name || user?.email || 'Usuario';
  const resolvedAvatar = useMemo(
    () => resolveConsentedAvatar(user as Record<string, unknown> | null | undefined),
    [user],
  );
  const hasConsentedAvatar = Boolean(resolvedAvatar.avatarUrl);

  const updateUserAvatar = async (avatarUrl: string, avatarSource: string, avatarConsent: boolean) => {
    if (user) {
      setUser({
        ...user,
        avatar_url: avatarUrl || undefined,
        avatar_source: avatarSource || undefined,
        avatar_consent: avatarConsent,
        picture: avatarUrl || undefined,
      });
    }
    await refreshUser().catch(() => null);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarMessage(null);
    setAvatarError(null);

    if (!user) {
      setAvatarError('Inicia sesion para guardar una foto de perfil.');
      return;
    }
    if (!PROFILE_IMAGE_ALLOWED_TYPES.has(file.type)) {
      setAvatarError('Usa una imagen JPG, PNG o WebP.');
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      setAvatarError('La imagen no puede superar 5 MB.');
      return;
    }

    setAvatarStatus('uploading');
    try {
      const result = await uploadProfileAvatar(file, { isWidgetRequest: true });
      await updateUserAvatar(result.avatarUrl, result.avatarSource, result.avatarConsent);
      setAvatarMessage('Foto de perfil actualizada.');
      setAvatarStatus('saved');
    } catch {
      setAvatarError('No se pudo subir la foto. Proba con otra imagen.');
      setAvatarStatus('idle');
    }
  };

  const handleAvatarDelete = async () => {
    if (!user || avatarStatus === 'deleting') return;

    setAvatarMessage(null);
    setAvatarError(null);
    setAvatarStatus('deleting');
    try {
      const result = await deleteProfileAvatar({ isWidgetRequest: true });
      await updateUserAvatar(result.avatarUrl, result.avatarSource, result.avatarConsent);
      setAvatarMessage('Foto eliminada. Se usa avatar generativo seguro.');
      setAvatarStatus('saved');
    } catch {
      setAvatarError('No se pudo eliminar la foto.');
      setAvatarStatus('idle');
    }
  };

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
            <Shield className="h-5 w-5 text-primary" />
            Identidad visual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <IdentityAvatar
                name={displayName}
                avatarUrl={resolvedAvatar.avatarUrl}
                source={resolvedAvatar.source || 'iniciales'}
                consented={resolvedAvatar.consented}
                size="lg"
                className="h-16 w-16 text-lg"
              />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{displayName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasConsentedAvatar
                    ? `Imagen consentida (${resolvedAvatar.source || 'perfil'}).`
                    : 'Avatar generativo estable hasta que subas una foto o uses login social con consentimiento.'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  No usamos scraping ni fotos de WhatsApp. La imagen real solo aparece con upload propio,
                  URL consentida o login social autorizado.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Input
                ref={avatarInputRef}
                id="profile-avatar-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={handleAvatarUpload}
                disabled={!user || avatarStatus === 'uploading' || avatarStatus === 'deleting'}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!user || avatarStatus === 'uploading' || avatarStatus === 'deleting'}
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatarStatus === 'uploading' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                Subir foto
              </Button>
              {hasConsentedAvatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAvatarDelete}
                  disabled={avatarStatus === 'uploading' || avatarStatus === 'deleting'}
                >
                  {avatarStatus === 'deleting' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Eliminar
                </Button>
              ) : null}
            </div>
          </div>
          {!user ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <span>Inicia sesion para guardar una foto propia o usar la imagen de tu login social.</span>
              <Button asChild size="sm" variant="outline">
                <a href={loginPath}>Iniciar sesion</a>
              </Button>
            </div>
          ) : null}
          {avatarError ? <p className="text-sm text-destructive">{avatarError}</p> : null}
          {avatarMessage ? (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {avatarMessage}
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex items-start gap-3 text-sm text-muted-foreground">
          <Shield className="mt-0.5 h-4 w-4 text-primary" />
          <span>
            La foto real aparece solo si proviene de upload propio, URL autorizada o login social con consentimiento.
            Si no, usamos un avatar generativo sobrio para reclamos, pedidos, encuestas y votaciones.
          </span>
        </CardFooter>
      </Card>

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
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Sesion vinculada y portal actualizado.
                  </div>
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
