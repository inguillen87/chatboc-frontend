import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { IntegrationStatus } from '@/types/unified';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, RefreshCw, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  useEffect(() => {
    if (currentSlug) {
      loadIntegrations();
    }
  }, [currentSlug]);

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

  const handleConnect = (provider: string) => {
    // Mock OAuth flow
    const width = 600;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    // In real implementation, this calls backend to get redirect URL
    const mockUrl = `https://placeholder-oauth/${provider}?tenant=${currentSlug}`;
    window.open(mockUrl, 'Connect Integration', `width=${width},height=${height},top=${top},left=${left}`);

    // Simulate connection success after popup
    setTimeout(() => {
        setIntegrations(prev => prev.map(i => i.provider === provider ? { ...i, connected: true } : i));
    }, 2000);
  };

  const handleSync = async (provider: string) => {
    setSyncing(provider);
    try {
       // Simulate sync delay
       await new Promise(resolve => setTimeout(resolve, 2500));
       setIntegrations(prev => prev.map(i => i.provider === provider ? { ...i, lastSync: new Date().toISOString() } : i));
    } catch (error) {
      console.error('Sync failed', error);
    } finally {
      setSyncing(null);
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-muted-foreground mt-2">
          Conectá tus plataformas de venta y comunicación para centralizar tu operación en Chatboc.
        </p>
      </div>

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

            {/* Contextual Settings Footer (Mock) */}
            {integration.connected && (
               <div className="bg-muted/30 px-6 py-3 border-t flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Configuración automática activa</span>
                  <Button variant="link" size="sm" className="h-auto p-0">Ver detalles <ExternalLink className="ml-1 h-3 w-3"/></Button>
               </div>
            )}
          </Card>
        ))}
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Importante</AlertTitle>
        <AlertDescription>
           Las sincronizaciones masivas de catálogo pueden demorar unos minutos. Te notificaremos cuando el proceso termine.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default IntegracionesPage;
