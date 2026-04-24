import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MessageSquare, Send, Mail } from 'lucide-react';
import { toast } from 'sonner';

const MunicipalNotificationSettings = () => {
  const { currentSlug } = useTenant();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Notification Settings State
  const [ownerPhone, setOwnerPhone] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);

  useEffect(() => {
    if (currentSlug) {
      loadSettings();
    }
  }, [currentSlug]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const settings = await apiClient.adminGetNotificationSettings(currentSlug);
      if (settings) {
        setOwnerPhone(settings.owner_phone || '');
        setTelegramChatId(settings.telegram_chat_id || '');
        setNotifyWhatsapp(settings.notification_settings?.whatsapp ?? false);
        setNotifyTelegram(settings.notification_settings?.telegram ?? false);
        setNotifyEmail(settings.notification_settings?.email ?? true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
        setLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
      if (!currentSlug) return;
      setSavingSettings(true);
      try {
        await apiClient.adminUpdateNotificationSettings(currentSlug, {
            owner_phone: ownerPhone,
            telegram_chat_id: telegramChatId,
            notification_settings: {
                whatsapp: notifyWhatsapp,
                telegram: notifyTelegram,
                email: notifyEmail
            }
        });
        toast.success('Configuración guardada correctamente.');
      } catch (error) {
          console.error('Failed to save settings', error);
          toast.error('No se pudo guardar la configuración.');
      } finally {
          setSavingSettings(false);
      }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

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
                                    <Label className="text-base">Telegram</Label>
                                    <p className="text-xs text-muted-foreground">Alertas inmediatas sin costo.</p>
                                </div>
                                <Switch checked={notifyTelegram} onCheckedChange={setNotifyTelegram} />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">WhatsApp</Label>
                                    <p className="text-xs text-muted-foreground">Usa plantillas oficiales de gobierno.</p>
                                </div>
                                <Switch checked={notifyWhatsapp} onCheckedChange={setNotifyWhatsapp} />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Email</Label>
                                    <p className="text-xs text-muted-foreground">Resumen diario y reportes.</p>
                                </div>
                                <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                            </div>
                        </div>

                        {/* Contact Details */}
                        <div className="space-y-4">
                             <h3 className="font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4"/> Destinatarios</h3>

                             <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono de Guardia (WhatsApp)</Label>
                                <Input
                                    id="phone"
                                    placeholder="54911..."
                                    value={ownerPhone}
                                    onChange={(e) => setOwnerPhone(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Número para recibir alertas críticas.</p>
                             </div>

                             <div className="space-y-2">
                                <Label htmlFor="telegram">Telegram Chat ID</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="telegram"
                                        placeholder="Ej: 123456789"
                                        value={telegramChatId}
                                        onChange={(e) => setTelegramChatId(e.target.value)}
                                    />
                                    <Button variant="outline" size="icon" title="Probar"><Send className="h-4 w-4"/></Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Chat ID del grupo de monitoreo o funcionario responsable.
                                </p>
                             </div>
                        </div>
                    </div>
                </CardContent>
                <div className="p-6 pt-0 flex justify-end">
                    <Button onClick={handleSaveNotifications} disabled={savingSettings}>
                        {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                        Guardar Cambios
                    </Button>
                </div>
             </Card>
        </section>
      </div>
    </div>
  );
};

export default MunicipalNotificationSettings;
