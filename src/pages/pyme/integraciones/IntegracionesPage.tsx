import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { IntegrationStatus } from '@/types/unified';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertCircle,
  MessageSquare, Send, Tags, Eye, Palette, Link2, Smartphone, Search,
  ShoppingBag, MessageCircle, Mail, Settings, ArrowRight, FileSpreadsheet
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
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

const INTEGRATION_LOGOS: Record<string, string> = {
  mercadolibre: "https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/5.21.22/mercadolibre/logo__large_plus.png",
  tiendanube: "https://d26lpennugtm8s.cloudfront.net/assets/common/img/logos/header/logo_tiendanube_header.svg",
  whatsapp: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg",
  telegram: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg",
  email: "https://cdn-icons-png.flaticon.com/512/281/281769.png"
};

const CHANNELS = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'telegram', label: 'Telegram', icon: Send },
    { id: 'mercadolibre', label: 'MercadoLibre', icon: ShoppingBag },
    { id: 'tiendanube', label: 'Tiendanube', icon: ShoppingBag },
    { id: 'email', label: 'Email', icon: Mail },
];

const IntegracionesPage = () => {
  const { currentSlug } = useTenant();
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedMappingProvider, setSelectedMappingProvider] = useState<string | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState("integrations");
  const [selectedChannel, setSelectedChannel] = useState("whatsapp");

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
      // Fallback mock data
      setIntegrations([
        { provider: 'mercadolibre', connected: false },
        { provider: 'tiendanube', connected: true, lastSync: new Date().toISOString() },
        { provider: 'whatsapp', connected: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getIntegrationStatus = (provider: string) => {
      return integrations.find(i => i.provider === provider) || { provider, connected: false };
  };

  const handleConnect = async (provider: string) => {
    if (!currentSlug) return;
    try {
      const response = await apiClient.adminConnectIntegration(currentSlug, provider);
      if (response.url) {
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(response.url, `Connect ${provider}`, `width=${width},height=${height},top=${top},left=${left}`);
      } else {
          toast.error("No se pudo iniciar la conexión.");
      }
    } catch (error: any) {
        console.error('Connection failed:', error);
        toast.error("Error al conectar con la plataforma.");
    }
  };

  const handleSync = async (provider: string) => {
    if (!currentSlug) return;
    setSyncing(provider);
    try {
       await apiClient.adminSyncIntegration(currentSlug, provider);
       toast.success("Sincronización iniciada correctamente.");
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
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integraciones y Canales</h1>
        <p className="text-muted-foreground mt-2">
          Gestioná tus canales de venta, personalizá tu chat y configurá notificaciones.
        </p>
      </div>

      {currentSlug && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                <TabsTrigger value="integrations" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground">
                    Integraciones
                </TabsTrigger>
                <TabsTrigger value="customization" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground">
                    Apariencia del Chat
                </TabsTrigger>
                <TabsTrigger value="catalog" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 py-3 font-semibold text-muted-foreground data-[state=active]:text-foreground">
                    Gestión de Catálogo
                </TabsTrigger>
            </TabsList>

            <TabsContent value="customization">
                <ChatCustomizer />
            </TabsContent>

             <TabsContent value="catalog" className="space-y-6">
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
                        <Button onClick={() => setUploadOpen(true)} className="w-full md:w-auto">
                            Iniciar Asistente <ArrowRight className="ml-2 h-4 w-4"/>
                        </Button>
                    </div>
                </Card>

                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
                        <ImportWizard tenantId={0} onComplete={() => setUploadOpen(false)} />
                    </DialogContent>
                </Dialog>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-8">
                {/* Main 2-Column Layout for Integrations */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left: Channel List */}
                    <div className="lg:col-span-3 space-y-2">
                        <h3 className="mb-4 text-lg font-semibold tracking-tight">Canales Disponibles</h3>
                        <div className="flex flex-col space-y-1">
                            {CHANNELS.map((channel) => {
                                const status = getIntegrationStatus(channel.id);
                                const Icon = channel.icon;
                                return (
                                    <button
                                        key={channel.id}
                                        onClick={() => setSelectedChannel(channel.id)}
                                        className={`flex items-center justify-between w-full p-3 rounded-lg text-sm font-medium transition-colors ${
                                            selectedChannel === channel.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className="h-4 w-4" />
                                            {channel.label}
                                        </div>
                                        {status.connected && (
                                            <span className="flex h-2 w-2 rounded-full bg-green-500 ring-2 ring-background" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        <Separator className="my-6" />

                        <div className="rounded-lg border bg-muted/40 p-4">
                            <h4 className="font-medium flex items-center gap-2 mb-2">
                                <Settings className="h-4 w-4"/> Configuración Global
                            </h4>
                            <p className="text-xs text-muted-foreground mb-4">
                                Ajustes de notificaciones y despacho aplicables a todos los canales.
                            </p>
                            <OrderDispatchSettings />
                        </div>
                    </div>

                    {/* Middle: Configuration Area */}
                    <div className="lg:col-span-5 space-y-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <img
                                            src={INTEGRATION_LOGOS[selectedChannel]}
                                            alt={selectedChannel}
                                            className="h-10 w-10 object-contain"
                                            onError={(e) => { e.currentTarget.style.display='none'; }}
                                        />
                                        <div>
                                            <CardTitle className="capitalize">{CHANNELS.find(c => c.id === selectedChannel)?.label}</CardTitle>
                                            <CardDescription>
                                                {getIntegrationStatus(selectedChannel).connected ? 'Conectado y operativo' : 'No conectado'}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    {getIntegrationStatus(selectedChannel).connected ? (
                                        <Badge className="bg-green-600">Activo</Badge>
                                    ) : (
                                        <Badge variant="secondary">Inactivo</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {selectedChannel === 'email' ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">Configurá las notificaciones por correo electrónico.</p>
                                        <div className="flex items-center justify-between p-3 border rounded-lg">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Notificaciones por Email</Label>
                                                <p className="text-xs text-muted-foreground">Resumen diario y backup de seguridad.</p>
                                            </div>
                                            <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
                                        </div>
                                        <Button onClick={handleSaveNotifications} disabled={savingSettings}>
                                            Guardar Preferencias
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {getIntegrationStatus(selectedChannel).connected ? (
                                            <div className="space-y-4">
                                                <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                                    <div className="flex items-center gap-2 font-medium mb-1">
                                                        <CheckCircle2 className="h-4 w-4" /> Conexión Establecida
                                                    </div>
                                                    <p>Tu cuenta está vinculada correctamente. Los mensajes y pedidos se sincronizarán automáticamente.</p>
                                                </div>

                                                {(selectedChannel === 'mercadolibre' || selectedChannel === 'tiendanube') && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <Button variant="outline" onClick={() => {
                                                            setSelectedMappingProvider(selectedChannel);
                                                            setMappingOpen(true);
                                                        }}>
                                                            <Tags className="mr-2 h-4 w-4" /> Ver Mapeo
                                                        </Button>
                                                        <Button variant="outline" onClick={() => handleSync(selectedChannel)} disabled={!!syncing}>
                                                            {syncing === selectedChannel ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <RefreshCw className="mr-2 h-4 w-4"/>}
                                                            Sincronizar
                                                        </Button>
                                                    </div>
                                                )}

                                                <Separator />

                                                <div className="space-y-2">
                                                    <Label>Acciones de Zona de Peligro</Label>
                                                    <Button variant="outline" className="w-full justify-start text-destructive hover:bg-destructive/10">
                                                        Desconectar Cuenta
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-6">
                                                <p className="text-sm text-muted-foreground">
                                                    Conectá tu cuenta de {CHANNELS.find(c => c.id === selectedChannel)?.label} para centralizar la gestión.
                                                </p>
                                                <div className="grid gap-4">
                                                    {selectedChannel === 'whatsapp' && (
                                                        <div className="space-y-2">
                                                            <Label>Número de Teléfono</Label>
                                                            <Input placeholder="+549..." />
                                                        </div>
                                                    )}
                                                    <Button onClick={() => handleConnect(selectedChannel)} className="w-full">
                                                        <Link2 className="mr-2 h-4 w-4" /> Conectar Ahora
                                                    </Button>
                                                    <Button variant="ghost" className="w-full">
                                                        Leer documentación
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Additional Config Blocks based on Channel */}
                        {(selectedChannel === 'whatsapp' || selectedChannel === 'telegram') && (
                             <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Alertas y Notificaciones</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label>Notificar nuevos pedidos</Label>
                                        <Switch
                                            checked={selectedChannel === 'whatsapp' ? notifyWhatsapp : notifyTelegram}
                                            onCheckedChange={selectedChannel === 'whatsapp' ? setNotifyWhatsapp : setNotifyTelegram}
                                        />
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={handleSaveNotifications}>Actualizar Alertas</Button>
                                </CardContent>
                             </Card>
                        )}
                    </div>

                    {/* Right: Persistent Preview */}
                    <div className="lg:col-span-4">
                        <div className="sticky top-6 space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Eye className="h-5 w-5 text-muted-foreground" />
                                Vista Previa
                            </h3>
                            <Card className="border-0 shadow-none bg-transparent">
                                <div className="origin-top transform transition-all duration-300">
                                    <ChannelPreview
                                        channel={selectedChannel as any}
                                        product={selectedChannel === 'mercadolibre' ? { name: 'Producto Demo', price: '$15.000' } : undefined}
                                    />
                                </div>
                                <p className="text-center text-xs text-muted-foreground mt-4">
                                    Así verán los mensajes tus clientes en {CHANNELS.find(c => c.id === selectedChannel)?.label}.
                                </p>
                            </Card>
                        </div>
                    </div>

                </div>
            </TabsContent>
        </Tabs>
      )}

      {/* Mapping Dialog (Reused) */}
      <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle className="capitalize">Mapeo de {selectedMappingProvider}</DialogTitle>
            <DialogDescription>
              Verifica cómo se verán tus productos importados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
             Funcionalidad de mapeo detallado en construcción.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IntegracionesPage;
