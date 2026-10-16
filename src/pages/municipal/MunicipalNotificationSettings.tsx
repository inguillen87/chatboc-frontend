import React, { useId, useSyncExternalStore } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { useParams, useSearchParams } from 'react-router-dom';
import { buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { normalizeProfileTenantSlug, readExplicitTenantRequest } from '@/utils/profileTenantAuthority';
import { captureChatbocSessionRevision, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { useMunicipalNotificationSettings } from './useMunicipalNotificationSettings';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MessageSquare, Send } from 'lucide-react';

const MunicipalNotificationSettings = () => {
  const { currentSlug, tenant, isLoadingTenant, tenantError } = useTenant();
  const { tenant: routeTenant } = useParams();
  const [searchParams] = useSearchParams();
  const { user, loading: userLoading, hasVerifiedSession, organizationProfileVerified } = useUser();
  const revision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const explicit = readExplicitTenantRequest(searchParams);
  const published = tenant?.publishedIdentity;
  const coherent = currentSlug && tenant?.slug === currentSlug && published?.tenantSlug === currentSlug
    && Number.isSafeInteger(published?.tenantId) && Number(published?.tenantId) > 0
    && (!routeTenant || (normalizeProfileTenantSlug(routeTenant) && routeTenant === currentSlug))
    && explicit.valid && (!explicit.present || explicit.slug === currentSlug) && !isLoadingTenant && !tenantError;
  const authenticated = coherent && !userLoading && organizationProfileVerified
    ? buildVerifiedSessionScopeKey({ hasVerifiedSession, tenantSlug: currentSlug, user }) : null;
  const scopeKey = authenticated ? JSON.stringify([authenticated, revision, published?.tenantId]) : null;
  const notifications = useMunicipalNotificationSettings(currentSlug, scopeKey, published?.tenantId);
  const id = useId();
  const phoneId = `${id}-phone`, telegramId = `${id}-telegram`, statusId = `${id}-status`;

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notificaciones Ciudadanas</h1>
        <p className="text-muted-foreground mt-2">
          Configurá cómo se reciben las alertas de nuevos reclamos y trámites.
        </p>
      </div>

      <div className="grid gap-8">
        <section className="space-y-4">
             <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Configuración de Alertas</CardTitle>
                    <CardDescription>
                        Recibí notificaciones cuando un vecino genera un nuevo reclamo o ticket de soporte.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Channels Config */}
                        <div className="space-y-4">
                            <h3 className="font-medium flex items-center gap-2"><Send className="h-4 w-4"/> Canales de Envío</h3>

                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label htmlFor={`${id}-telegram-enabled`} className="text-base">Telegram</Label>
                                    <p className="text-xs text-muted-foreground">Alertas para el equipo por Telegram.</p>
                                </div>
                                <Switch id={`${id}-telegram-enabled`} aria-describedby={statusId} disabled={!notifications.canEdit}
                                  checked={notifications.draft.notification_settings.telegram ?? false}
                                  onCheckedChange={value => notifications.setPreference('telegram', value)} />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label htmlFor={`${id}-whatsapp-enabled`} className="text-base">WhatsApp</Label>
                                    <p className="text-xs text-muted-foreground">Requiere una cuenta y una plantilla aprobadas para enviar alertas.</p>
                                </div>
                                <Switch id={`${id}-whatsapp-enabled`} aria-describedby={statusId} disabled={!notifications.canEdit}
                                  checked={notifications.draft.notification_settings.whatsapp ?? false}
                                  onCheckedChange={value => notifications.setPreference('whatsapp', value)} />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label htmlFor={`${id}-email-enabled`} className="text-base">Email</Label>
                                    <p className="text-xs text-muted-foreground">Resumen diario y reportes.</p>
                                </div>
                                <Switch id={`${id}-email-enabled`} aria-describedby={statusId} disabled={!notifications.canEdit}
                                  checked={notifications.draft.notification_settings.email ?? true}
                                  onCheckedChange={value => notifications.setPreference('email', value)} />
                            </div>
                        </div>

                        {/* Contact Details */}
                        <div className="space-y-4">
                             <h3 className="font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4"/> Destinatarios</h3>

                             <div className="space-y-2">
                                <Label htmlFor={phoneId}>Teléfono de Guardia (WhatsApp)</Label>
                                <Input
                                    id={phoneId}
                                    placeholder="54911..."
                                    aria-describedby={statusId}
                                    disabled={!notifications.canEdit}
                                    value={notifications.draft.owner_phone ?? ''}
                                    onChange={(e) => notifications.setDestination('owner_phone', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Número para recibir alertas críticas.</p>
                             </div>

                             <div className="space-y-2">
                                <Label htmlFor={telegramId}>Telegram Chat ID</Label>
                                <div>
                                    <Input
                                        id={telegramId}
                                        placeholder="Ej: 123456789"
                                        aria-describedby={statusId}
                                        disabled={!notifications.canEdit}
                                        value={notifications.draft.telegram_chat_id ?? ''}
                                        onChange={(e) => notifications.setDestination('telegram_chat_id', e.target.value)}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Chat ID del grupo de monitoreo o funcionario responsable. No hay una prueba de envío disponible desde esta pantalla.
                                </p>
                             </div>
                        </div>
                    </div>
                </CardContent>
                <div className="p-6 pt-0 flex justify-end">
                    <Button onClick={() => void notifications.save()} disabled={!notifications.canSave} aria-describedby={statusId}>
                        {notifications.saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true"/> : null}
                        Guardar Cambios
                    </Button>
                </div>
                <div id={statusId} className="px-6 pb-6 space-y-3 text-sm" aria-live="polite">
                    {!notifications.verified ? <p role="status">Verificá tu sesión y seleccioná una organización para configurar las alertas.</p>
                      : notifications.loading ? <p role="status">Leyendo las preferencias de esta organización.</p>
                      : notifications.saving ? <p role="status">Guardando las preferencias de esta organización.</p> : null}
                    {notifications.error ? <p role="alert" className="text-destructive">{notifications.error}</p> : null}
                    {notifications.canRetry ? <Button variant="outline" onClick={() => void notifications.reload()}>Reintentar preferencias</Button> : null}
                    {notifications.saved ? <p role="status">Configuración guardada correctamente.</p> : null}
                </div>
             </Card>
        </section>
      </div>
    </div>
  );
};

export default MunicipalNotificationSettings;
