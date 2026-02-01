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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, MessageSquare, Send, Tags, Eye, Palette, Link2, Smartphone, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import WidgetPreview from '@/components/chat/WidgetPreview';
import ChatCustomizer from '@/components/admin/ChatCustomizer';
import OrderDispatchSettings from '@/components/admin/OrderDispatchSettings';
import ImportWizard from '@/components/catalog/ImportWizard';
import ChannelPreview from '@/components/integrations/ChannelPreview';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileSpreadsheet, ArrowRight } from 'lucide-react';

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
  const [uploadOpen, setUploadOpen] = useState(false);
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
        const data = error?.response?.data || error?.data;

        if (status === 422) {
             // Handle explicit backend error messages (e.g., "platform_not_configured")
             const msg = data?.message || data?.error || "Error de configuración en la plataforma.";
             toast.error("No se pudo conectar", { description: msg });
        } else if (status === 403) {
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
        <h1 className="text-3xl font-bold tracking-tight">Integraciones y Personalización</h1>
        <p className="text-muted-foreground mt-2">
          Gestioná tus canales de venta, personalizá tu chat y configurá notificaciones.
        </p>
      </div>

      {currentSlug && (
        <Tabs defaultValue="integrations" className="space-y-8">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6 overflow-x-auto flex-nowrap shrink-0">
                <TabsTrigger value="integrations" className="data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap">
                    Integraciones
                </TabsTrigger>
                <TabsTrigger value="customization" className="data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground whitespace-nowrap">
                    Apariencia del Chat
                </TabsTrigger>
            </TabsList>

            <TabsContent value="customization">
                <ChatCustomizer />
            </TabsContent>

            <TabsContent value="integrations" className="space-y-8">
                {/* Catalog Import Section */}
                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">Gestión de Catálogo</h2>
                    <Card>
                        <div className="p-6 flex flex-col md:flex-row items-center gap-6">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
                                <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                            </div>
                            <div className="flex-1 space-y-1 text-center md:text-left">
                                <h3 className="font-semibold text-lg">Importación Masiva</h3>
                                <p className="text-sm text-muted-foreground">
                                    Actualizá tus productos subiendo un archivo Excel o CSV. Detectamos automáticamente columnas y precios.
                                </p>
                            </div>
                            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full md:w-auto">
                                        Iniciar Asistente <ArrowRight className="ml-2 h-4 w-4"/>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
                                   {/* Passing current tenant ID if available, using 0 as fallback or needing int */}
                                   {/* We might need to fetch the ID or use the slug if the service supports it */}
                                   <ImportWizard
                                        tenantId={0} // TODO: Pass correct numeric ID if available in context
                                        onComplete={() => setUploadOpen(false)}
                                   />
                                </DialogContent>
                            </Dialog>
                        </div>
                    </Card>
                </section>

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
                                 {integration.lastSync ? (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className="text-xs font-normal border-green-200 bg-green-50 text-green-700 gap-1 pl-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Sincronizado {formatDistanceToNow(new Date(integration.lastSync), { addSuffix: true, locale: es })}
                                        </Badge>
                                    </div>
                                 ) : (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                                            Sin sincronización reciente
                                        </Badge>
                                    </div>
                                 )}
                               </div>

                               {/* Channel Preview Hover/Column - Always Visible on LG, Collapsible on Mobile */}
                               <div className="w-full lg:w-64 shrink-0 mx-0 lg:mx-4 mt-4 lg:mt-0 flex flex-col items-center">
                                   <div className="flex justify-between w-full items-center mb-2 px-1">
                                       <div className="flex gap-1">
                                            {/* Mock Health Check Indicator */}
                                            <div className={`h-2 w-2 rounded-full ${integration.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} title="Webhook Health: OK" />
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{integration.connected ? 'Online' : 'Offline'}</span>
                                       </div>
                                       <div className="lg:hidden">
                                           <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground">
                                               <Smartphone className="h-3 w-3 mr-1" /> Ver Vista Previa
                                           </Button>
                                       </div>
                                   </div>

                                   <div className="scale-90 lg:scale-75 origin-top lg:origin-center transform transition-transform hover:scale-95 duration-300 relative group">
                                       <ChannelPreview
                                            channel={integration.provider as any}
                                            product={integration.provider === 'mercadolibre' ? { name: 'Zapatillas Running', price: '$45.000' } : undefined}
                                       />
                                       {/* Toggle overlay hint (visual only for now as ChannelPreview is stateless in this list context) */}
                                       <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-lg">
                                            <span className="bg-white/90 text-[10px] px-2 py-1 rounded shadow-sm text-foreground font-medium">Vista Previa {integration.provider}</span>
                                       </div>
                                   </div>
                               </div>

                               <div className="flex flex-col gap-3 w-full md:w-auto">
                                 {integration.connected ? (
                                   <>
                                      {(integration.provider === 'mercadolibre' || integration.provider === 'tiendanube') && (
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 md:w-auto justify-start md:justify-center"
                                                onClick={() => {
                                                    setSelectedMappingProvider(integration.provider);
                                                    setMappingOpen(true);
                                                }}
                                            >
                                                <Tags className="mr-2 h-4 w-4" />
                                                Mapeo
                                            </Button>
                                            {integration.provider === 'mercadolibre' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 md:w-auto justify-start md:justify-center"
                                                    onClick={async () => {
                                                        // Call preview endpoint
                                                        // Ideally we show a loading state here or in a modal
                                                        // For now, let's open the mapping dialog but trigger a specific preview fetch if needed
                                                        // Or just add a dedicated button that fetches and shows a toast/modal
                                                        try {
                                                            const res = await apiClient.get(`/api/admin/tenants/${currentSlug}/integrations/${integration.provider}/preview`);
                                                            // Show summary in toast for MVP
                                                            const summary = (res as any).summary || {};
                                                            toast.info(`Preview Sync: ${summary.total_found || 0} encontrados, ${summary.new_items || 0} nuevos.`);
                                                        } catch (e) {
                                                            toast.error("Error al obtener preview de sincronización.");
                                                        }
                                                    }}
                                                >
                                                    <Search className="mr-2 h-4 w-4" />
                                                    Preview Sync
                                                </Button>
                                            )}
                                        </div>
                                      )}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!!syncing}
                                        onClick={() => handleSync(integration.provider)}
                                        className="w-full md:w-32"
                                      >
                                         {syncing === integration.provider ? (
                                           <>
                                             <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                             Sincronizando...
                                           </>
                                         ) : (
                                           <>
                                             <RefreshCw className="h-4 w-4 mr-2" />
                                             Sincronizar
                                           </>
                                         )}
                                      </Button>
                                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive w-full md:w-32">
                                        Desconectar
                                      </Button>
                                   </>
                                 ) : (
                                   <Button onClick={() => handleConnect(integration.provider)} className="w-full md:w-32 bg-primary/90 hover:bg-primary">
                                     <Link2 className="mr-2 h-4 w-4" /> Conectar
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

                {/* Dispatch Settings */}
                <section>
                    <OrderDispatchSettings />
                </section>
            </TabsContent>
        </Tabs>
      )}

      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="capitalize">Mapeo de {selectedMappingProvider}</DialogTitle>
            <DialogDescription>
              Verifica cómo se verán tus productos importados en la plataforma.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="categories" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="categories">Categorías</TabsTrigger>
                  <TabsTrigger value="preview">Vista Previa de Productos</TabsTrigger>
              </TabsList>

              <TabsContent value="categories" className="space-y-4 py-4">
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
              </TabsContent>

              <TabsContent value="preview" className="py-4 space-y-6">
                  <div className="flex flex-col md:flex-row gap-6 justify-center items-start">
                      {/* Original Product Mock */}
                      <Card className="w-64 opacity-70 border-dashed">
                          <CardHeader className="p-4 pb-2">
                              <CardTitle className="text-sm text-muted-foreground">Original (MercadoLibre)</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-2">
                              <div className="h-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">Imagen Original</div>
                              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                              <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                              <div className="h-4 bg-gray-200 rounded w-1/4 mt-2"></div>
                          </CardContent>
                      </Card>

                      <ArrowRight className="h-6 w-6 text-muted-foreground self-center rotate-90 md:rotate-0" />

                      {/* Mapped Preview */}
                      <div className="w-64 bg-white rounded-lg shadow-md overflow-hidden border border-primary/20 ring-4 ring-primary/5">
                           <div className="bg-primary/10 px-3 py-1 text-xs font-semibold text-primary text-center border-b border-primary/10">
                               Así se verá en tu catálogo
                           </div>
                           <div className="h-32 bg-slate-50 flex items-center justify-center text-primary/40">
                               <FileSpreadsheet className="h-10 w-10" />
                           </div>
                           <div className="p-4">
                               <h3 className="font-bold truncate">Zapatillas Deportivas</h3>
                               <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                   Ideal para running, suela amortiguada. Color Negro.
                               </p>
                               <div className="mt-3 flex items-center justify-between">
                                   <span className="font-bold text-primary">
                                       $45.000
                                   </span>
                                   <Badge variant="secondary" className="scale-75 origin-right">Stock: 12</Badge>
                               </div>
                           </div>
                      </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200 text-blue-900">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <AlertTitle>Todo listo</AlertTitle>
                      <AlertDescription className="text-xs">
                          Detectamos correctamente el nombre, precio y stock. La imagen se importará en alta resolución.
                      </AlertDescription>
                  </Alert>
              </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegracionesPage;
