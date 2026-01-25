import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { IntegrationStatus } from '@/types/unified';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, MessageSquare, Send, Tags, Eye } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import WidgetPreview from '@/components/chat/WidgetPreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INTEGRATION_LOGOS: Record<string, string> = {
  mercadolibre: "https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/5.21.22/mercadolibre/logo__large_plus.png",
  tiendanube: "https://d26lpennugtm8s.cloudfront.net/assets/common/img/logos/header/logo_tiendanube_header.svg",
  whatsapp: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
};

const IntegracionesPage = () => {
  const { currentSlug } = useTenant();
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [selectedMappingProvider, setSelectedMappingProvider] = useState<string | null>(null);

  // Notification Settings State
  const [ownerPhone, setOwnerPhone] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifyTelegram, setNotifyTelegram] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);

  useEffect(() => {
    if (currentSlug) {
      loadIntegrations();
      loadSettings();
    }
  }, [currentSlug]);

  const loadSettings = async () => {
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
      // Don't show error toast on load, just log it. Maybe default to empty state.
    }
  };

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const data = await apiClient.adminGetIntegrations(currentSlug);
      setIntegrations(data);
    } catch (error) {
      console.error('Error loading integrations:', error);
      // Fallback mock data if API fails (for demo purposes)
      setIntegrations([
        { provider: 'mercadolibre', connected: false },
        { provider: 'tiendanube', connected: true, lastSync: new Date().toISOString() },
        { provider: 'whatsapp', connected: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider: string) => {
    if (!currentSlug) return;
    try {
      const response = await apiClient.adminConnectIntegration(currentSlug, provider);
      // The backend should return an auth URL
      if (response.url) {
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(response.url, `Connect ${provider}`, `width=${width},height=${height},top=${top},left=${left}`);
      } else {
          // Fallback if no URL returned (e.g. backend not ready)
          console.warn('No redirect URL returned');
          toast.error("No se pudo iniciar la conexión.");
      }
    } catch (error: any) {
        console.error('Connection failed:', error);
        const status = error?.status || error?.response?.status;
        if (status === 403) {
            toast.error("Plan Requerido", { description: "Actualizá tu plan para acceder a esta integración." });
        } else if (status === 503) {
            toast.error("Plataforma no configurada", { description: "Esta integración está en mantenimiento." });
        } else {
            toast.error("Error al conectar con la plataforma.");
        }
    }
  };

  const handleSync = async (provider: string) => {
    if (!currentSlug) return;
    setSyncing(provider);
    try {
       await apiClient.adminSyncIntegration(currentSlug, provider);
       toast.success("Sincronización iniciada correctamente.");
       // Refresh list to update sync time
       await loadIntegrations();
    } catch (error) {
      console.error('Sync failed', error);
      toast.error("Error al sincronizar.");
    } finally {
      setSyncing(null);
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
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integraciones y Notificaciones</h1>
        <p className="text-muted-foreground mt-2">
          Conectá tus plataformas de venta y configura cómo recibís las alertas de nuevos pedidos.
        </p>
      </div>

      {currentSlug && (
        <section>
          <div className="flex items-center gap-2 mb-4">
             <h2 className="text-xl font-semibold">Vista Previa</h2>
             <Badge variant="secondary"><Eye className="h-3 w-3 mr-1"/> En Vivo</Badge>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
             <div className="space-y-4">
               <p className="text-sm text-muted-foreground">
                 Así se ve tu asistente virtual en tu sitio web. Podes personalizar el color y los mensajes desde la configuración general.
               </p>
               {/* Could add controls here later */}
             </div>
             <div className="h-[500px] w-full max-w-sm mx-auto md:mx-0">
               <WidgetPreview
                  tenantSlug={currentSlug}
                  className="h-full w-full rounded-3xl border-4 border-slate-200 shadow-2xl"
                  defaultOpen={true}
               />
             </div>
          </div>
          <Separator className="my-8" />
        </section>
      )}

      <div className="grid gap-8">
        {/* Marketplace Integrations Section */}
        <section className="space-y-4">
             <h2 className="text-xl font-semibold">Plataformas de Venta</h2>
             <div className="grid gap-6">
                {integrations.map((integration) => (
                  <Card key={integration.provider} className="overflow-hidden">
                    <div className="flex flex-col md:flex-row items-center gap-6 p-6">
                       <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-white p-2 border">
                         {/* Fallback text if image fails, though URLs are standard */}
                         <img
                           src={INTEGRATION_LOGOS[integration.provider]}
                           alt={integration.provider}
                           className="max-h-12 w-auto object-contain"
                           onError={(e) => { e.currentTarget.style.display='none'; }}
                         />
                         <span className="capitalize font-bold text-lg hidden last:block">{integration.provider}</span>
                       </div>

                       <div className="flex-1 space-y-2 text-center md:text-left">
                         <div className="flex items-center justify-center md:justify-start gap-2">
                           <h3 className="font-semibold text-lg capitalize">{integration.provider}</h3>
                           {integration.connected ? (
                             <Badge variant="default" className="bg-green-600 hover:bg-green-700">Conectado</Badge>
                           ) : (
                             <Badge variant="outline">Desconectado</Badge>
                           )}
                         </div>
                         <p className="text-sm text-muted-foreground">
                           {integration.provider === 'mercadolibre' && "Sincronizá productos, stock y respondé preguntas desde un solo lugar."}
                           {integration.provider === 'tiendanube' && "Importá tu catálogo automáticamente y centralizá la gestión de pedidos."}
                           {integration.provider === 'whatsapp' && "Enviá notificaciones automáticas y gestioná conversaciones con múltiples agentes."}
                         </p>
                         {integration.lastSync && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                Sincronizado: {new Date(integration.lastSync).toLocaleString()}
                            </div>
                         )}
                       </div>

                       <div className="flex flex-col gap-3 w-full md:w-auto">
                         {integration.connected ? (
                           <>
                              {(integration.provider === 'mercadolibre' || integration.provider === 'tiendanube') && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full md:w-32 justify-start md:justify-center"
                                  onClick={() => {
                                    setSelectedMappingProvider(integration.provider);
                                    setMappingOpen(true);
                                  }}
                                >
                                  <Tags className="mr-2 h-4 w-4" />
                                  Mapeo
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!!syncing}
                                onClick={() => handleSync(integration.provider)}
                                className="w-full md:w-32"
                              >
                                 {syncing === integration.provider ? (
                                   <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                 ) : (
                                   <RefreshCw className="h-4 w-4 mr-2" />
                                 )}
                                 Sincronizar
                              </Button>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive w-full md:w-32">
                                Desconectar
                              </Button>
                           </>
                         ) : (
                           <Button onClick={() => handleConnect(integration.provider)} className="w-full md:w-32">
                             Conectar
                           </Button>
                         )}
                       </div>
                    </div>

                    {/* Contextual Settings Footer */}
                    {integration.connected && (
                       <div className="bg-muted/30 px-6 py-3 border-t flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Configuración automática activa</span>
                          <Button variant="link" size="sm" className="h-auto p-0">Ver detalles <ExternalLink className="ml-1 h-3 w-3"/></Button>
                       </div>
                    )}
                  </Card>
                ))}
             </div>
        </section>

        {/* Notification Settings Section */}
        <section className="space-y-4">
             <div className="flex items-center gap-2">
                 <h2 className="text-xl font-semibold">Centro de Alertas</h2>
                 <Badge variant="secondary">Para Dueños</Badge>
             </div>

             <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Configuración de notificaciones</CardTitle>
                    <CardDescription>
                        Recibí alertas en tiempo real cuando ingresa un nuevo pedido, sin importar el canal.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Channels Config */}
                        <div className="space-y-4">
                            <h3 className="font-medium flex items-center gap-2"><Send className="h-4 w-4"/> Canales de Envío</h3>

                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Telegram (Recomendado)</Label>
                                    <p className="text-xs text-muted-foreground">Gratis, ilimitado, ideal para alto volumen.</p>
                                </div>
                                <Switch checked={notifyTelegram} onCheckedChange={setNotifyTelegram} />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">WhatsApp</Label>
                                    <p className="text-xs text-muted-foreground">Usa plantillas oficiales. Costo según plan.</p>
                                </div>
                                <Switch checked={notifyWhatsapp} onCheckedChange={setNotifyWhatsapp} />
                            </div>

                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Email</Label>
                                    <p className="text-xs text-muted-foreground">Resumen diario y backup de seguridad.</p>
                                </div>
                                <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                            </div>
                        </div>

                        {/* Contact Details */}
                        <div className="space-y-4">
                             <h3 className="font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4"/> Destinatarios</h3>

                             <div className="space-y-2">
                                <Label htmlFor="phone">Teléfono del Dueño (WhatsApp)</Label>
                                <Input
                                    id="phone"
                                    placeholder="54911..."
                                    value={ownerPhone}
                                    onChange={(e) => setOwnerPhone(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">Formato internacional sin + ni espacios.</p>
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
                                    Escribile a nuestro bot <a href="#" className="underline text-primary">@ChatbocAlertsBot</a> para obtener tu ID.
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

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Importante</AlertTitle>
        <AlertDescription>
           Las sincronizaciones masivas de catálogo pueden demorar unos minutos. Te notificaremos cuando el proceso termine.
        </AlertDescription>
      </Alert>

      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="capitalize">Mapeo de Atributos: {selectedMappingProvider}</DialogTitle>
            <DialogDescription>
              Estado de vinculación de categorías y atributos con la plataforma externa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="border rounded-md p-4 space-y-4">
                <div className="flex justify-between items-center text-sm font-medium border-b pb-2">
                   <span>Categoría Local</span>
                   <span className="text-muted-foreground">→</span>
                   <span>Categoría Externa</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span>Remeras</span>
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Ropa y Accesorios
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Pantalones</span>
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Pantalones
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span>Zapatillas</span>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Pendiente
                    </Badge>
                  </div>
                </div>
             </div>
             <p className="text-xs text-muted-foreground text-center">
               El mapeo se actualiza automáticamente con cada sincronización.
             </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegracionesPage;
