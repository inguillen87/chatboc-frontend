import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicOrder } from '@/api/market';
import { PublicOrderTrackingResponse } from '@/types/tracking';
import { Loader2, Package, CheckCircle2, Clock, Truck, MapPin, XCircle, Copy, ArrowRight, MessageCircle, Phone, HelpCircle, ChevronRight, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/currency';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from '@/components/ui/textarea';
import Confetti from '@/components/ui/Confetti';
import { hexToHsl, getContrastColorHsl } from '@/utils/color';

const TrackingMap = React.lazy(() => import('@/components/ui/TrackingMap'));

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, step: 1, description: 'Tu pedido ha sido recibido y está pendiente de confirmación.' },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2, step: 2, description: '¡Tu pedido fue aceptado! Estamos preparando todo.' },
  en_proceso: { label: 'En Preparación', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: Package, step: 3, description: 'Estamos armando tu pedido con cuidado.' },
  enviado: { label: 'En Camino', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck, step: 4, description: '¡Ya sale! Tu pedido está en camino a tu dirección.' },
  entregado: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, step: 5, description: 'Disfruta tu compra. ¡Gracias por elegirnos!' },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, step: 0, description: 'El pedido fue cancelado.' },
};

const ORDER_STEPS = [
  { id: 'pendiente', label: 'Recibido' },
  { id: 'confirmado', label: 'Confirmado' },
  { id: 'en_proceso', label: 'Preparación' },
  { id: 'enviado', label: 'En Camino' },
  { id: 'entregado', label: 'Entregado' },
];

type OrderMapPoint = { lat: number; lng: number; name?: string };

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const readPointFromRecord = (value: unknown, fallbackName?: string | null): OrderMapPoint | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const lat = readNumber(record.latitud ?? record.lat ?? record.latitude);
  const lng = readNumber(record.longitud ?? record.lng ?? record.lon ?? record.longitude);
  if (lat === null || lng === null) return null;
  return {
    lat,
    lng,
    name: readString(record.name) ?? readString(record.label) ?? fallbackName ?? undefined,
  };
};

const readOrderPoint = (
  order: PublicOrderTrackingResponse,
  nestedKeys: Array<keyof PublicOrderTrackingResponse>,
  fallbackName?: string | null,
  includeTopLevel = true,
) => {
  for (const key of nestedKeys) {
    const point = readPointFromRecord(order[key], fallbackName);
    if (point) return point;
  }
  return includeTopLevel ? readPointFromRecord(order, fallbackName) : null;
};

export default function OrderTrackingPage() {
  const { nro_pedido } = useParams<{ nro_pedido: string }>();
  const [order, setOrder] = useState<PublicOrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [tenantBranding, setTenantBranding] = useState<{
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  }>({
    logoUrl: null,
    primaryColor: null,
    secondaryColor: null,
  });

  useEffect(() => {
    const loadOrder = async () => {
      if (!nro_pedido) return;
      try {
        setLoading(true);
        const data = await fetchPublicOrder(nro_pedido);

        // Defensive check for 'detalles' field
        if (typeof data.detalles === 'string') {
          try {
            data.detalles = JSON.parse(data.detalles);
          } catch (e) {
            console.error('Failed to parse order details string:', e);
            data.detalles = [];
          }
        } else if (!Array.isArray(data.detalles)) {
          data.detalles = [];
        }

        setOrder(data);
        const rawBranding =
          (data as any)?.tenant_branding ||
          (data as any)?.branding ||
          (data as any)?.tenantTheme ||
          data.tenant_theme ||
          null;

        let parsedBranding: Record<string, unknown> | null = null;
        if (typeof rawBranding === 'string') {
          try {
            parsedBranding = JSON.parse(rawBranding);
          } catch (e) {
            console.warn('Failed to parse tenant branding payload', e);
          }
        } else if (rawBranding && typeof rawBranding === 'object') {
          parsedBranding = rawBranding as Record<string, unknown>;
        }

        const logoFromBranding =
          typeof parsedBranding?.logo_url === 'string'
            ? parsedBranding.logo_url
            : typeof parsedBranding?.logoUrl === 'string'
              ? parsedBranding.logoUrl
              : null;
        const primaryFromBranding =
          typeof parsedBranding?.primary_color === 'string'
            ? parsedBranding.primary_color
            : typeof parsedBranding?.primaryColor === 'string'
              ? parsedBranding.primaryColor
              : null;
        const secondaryFromBranding =
          typeof parsedBranding?.secondary_color === 'string'
            ? parsedBranding.secondary_color
            : typeof parsedBranding?.secondaryColor === 'string'
              ? parsedBranding.secondaryColor
              : null;

        setTenantBranding({
          logoUrl: logoFromBranding || data.tenant_logo || null,
          primaryColor: primaryFromBranding || null,
          secondaryColor: secondaryFromBranding || null,
        });
      } catch (err) {
        console.error('Failed to load order', err);
        setError('No se pudo encontrar el pedido. Verifique el número e intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();

  }, [nro_pedido]);

  const handleOpenChat = () => {
      // Trigger global chat widget with context
      window.postMessage({
          type: 'OPEN_CHAT_WITH_CONTEXT',
          tenantSlug: order?.tenant_slug,
          tipoChat: 'pyme',
          context: {
              orderId: order?.id,
              orderNumber: order?.nro_pedido,
              action: 'consultar_pedido'
          }
      }, '*');
      setIsSupportOpen(false);
  };

  const handleSendMessage = () => {
      if (!message.trim()) return;

      // Since we don't have a direct "add note" public API confirmed,
      // we'll use the chat widget as the carrier.
      // We set the pending action/message and open the chat.
      try {
          localStorage.setItem('pending_widget_action', JSON.stringify({
              action: 'send_message',
              text: `[Consulta Pedido #${order?.nro_pedido}] ${message}`
          }));
          handleOpenChat();
          toast.success("Abriendo chat de soporte...");
          setIsSupportOpen(false);
          setMessage('');
      } catch (e) {
          console.error("Failed to trigger chat", e);
          toast.error("No se pudo conectar con el soporte.");
      }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <div className="h-12 w-12 rounded-full border-4 border-primary/20 animate-spin border-t-primary"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary/60" />
                </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Buscando tu pedido...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center shadow-lg border-red-100">
          <CardHeader>
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-2">
                <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl text-gray-900">Pedido no encontrado</CardTitle>
            <CardDescription className="text-gray-600 pt-2">{error || 'Verificá el número de seguimiento.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Intentar nuevamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = STATUS_CONFIG[order.estado]?.icon || Clock;
  const statusInfo = STATUS_CONFIG[order.estado] || STATUS_CONFIG.pendiente;
  const currentStep = STATUS_CONFIG[order.estado]?.step || 0;
  const deliveryPoint = readOrderPoint(order, ['delivery_location', 'customer_location'], order.direccion || 'Destino');
  const storePoint = readOrderPoint(order, ['store_location'], order.pyme_nombre || 'Origen', false);
  const driverPoint = readPointFromRecord(order.driver_location, 'Ubicacion actual');
  const canRenderTrackingMap = Boolean(deliveryPoint || storePoint || driverPoint);
  const brandingStyle: React.CSSProperties = {
    ...(tenantBranding.primaryColor
      ? {
          ['--primary' as any]: tenantBranding.primaryColor.startsWith('#')
            ? hexToHsl(tenantBranding.primaryColor)
            : tenantBranding.primaryColor,
          ['--primary-foreground' as any]: tenantBranding.primaryColor.startsWith('#')
            ? getContrastColorHsl(tenantBranding.primaryColor)
            : undefined,
        }
      : {}),
    ...(tenantBranding.secondaryColor
      ? {
          ['--secondary' as any]: tenantBranding.secondaryColor.startsWith('#')
            ? hexToHsl(tenantBranding.secondaryColor)
            : tenantBranding.secondaryColor,
        }
      : {}),
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(order.nro_pedido);
    toast.success("Número de pedido copiado");
  };

  return (
    <div
      className="min-h-screen bg-slate-50/50 pb-20 font-sans selection:bg-primary/10 relative"
      style={brandingStyle}
    >
      {order.estado === 'entregado' && <Confetti />}

      {/* Navbar-like Header */}
      <div className="bg-white border-b sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/90">
          <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {tenantBranding.logoUrl ? (
                    <img src={tenantBranding.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                ) : (
                    <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold">
                        {order.pyme_nombre.charAt(0)}
                    </div>
                )}
                <span className="font-semibold text-gray-900 truncate max-w-[150px] sm:max-w-none">{order.pyme_nombre}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsSupportOpen(true)} className="text-primary hover:bg-primary/5">
                  <MessageCircle className="h-5 w-5" />
              </Button>
          </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-3xl px-4 py-6 space-y-6"
      >
        {/* Status Card */}
        <Card className="border-0 shadow-lg ring-1 ring-black/5 overflow-hidden">
            <div className={`h-1.5 w-full ${statusInfo.color.replace('text-', 'bg-').split(' ')[0]}`} />
            <CardContent className="pt-6 pb-8 px-6 text-center">
                <div className="mb-6 inline-flex p-3 rounded-full bg-slate-50 ring-1 ring-slate-100 shadow-sm">
                    <StatusIcon className={`h-8 w-8 ${statusInfo.color.split(' ')[1]}`} />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{statusInfo.label}</h1>
                <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">{statusInfo.description}</p>

                {/* Visual Timeline */}
                {order.estado !== 'cancelado' && (
                  <div className="mt-10 px-2 relative">
                    {/* Progress Bar Background */}
                    <div className="absolute top-[15px] left-6 right-6 h-1 bg-gray-100 rounded-full -z-10" />

                    {/* Active Progress */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(0, ((currentStep - 1) / (ORDER_STEPS.length - 1)) * 100)}%` }}
                        className="absolute top-[15px] left-6 h-1 bg-primary rounded-full -z-10 transition-all duration-1000 ease-out"
                        style={{ maxWidth: 'calc(100% - 3rem)' }}
                    />

                    <div className="flex justify-between">
                      {ORDER_STEPS.map((step, index) => {
                        const isCompleted = index + 1 <= currentStep;
                        const isCurrent = index + 1 === currentStep;
                        const indicatorClasses = [
                          'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 bg-white',
                          isCompleted ? 'border-primary text-primary shadow-sm' : 'border-gray-200 text-gray-300',
                          isCurrent ? 'ring-4 ring-primary/10 scale-110' : '',
                        ].join(' ');
                        const labelClasses = [
                          'text-[8px] sm:text-xs font-semibold uppercase tracking-wide text-center max-w-[50px] sm:max-w-[70px] leading-tight',
                          isCompleted ? 'text-gray-900' : 'text-gray-400',
                        ].join(' ');

                        return (
                          <div key={step.id} className="flex flex-col items-center gap-3">
                            <div className={indicatorClasses}>
                                {isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    <div className="h-2 w-2 rounded-full bg-current" />
                                )}
                            </div>
                            <span className={labelClasses}>
                                {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </CardContent>
        </Card>

        {/* Order Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Items & Total */}
            <div className="md:col-span-2 space-y-6">
                <Card className="border-0 shadow-md ring-1 ring-black/5">
                    <CardHeader className="pb-4 border-b border-gray-50">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5 text-gray-400" />
                                Tu Compra
                            </CardTitle>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors" onClick={copyToClipboard}>
                                #{order.nro_pedido}
                                <Copy className="h-3 w-3" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-6">
                            {order.detalles.map((item, i) => (
                                <div key={i} className="flex gap-4 group">
                                    <div className="h-16 w-16 flex-none rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300 group-hover:border-primary/20 transition-colors">
                                        <Package className="h-8 w-8 opacity-50" />
                                    </div>
                                    <div className="flex-1 min-w-0 py-1">
                                        <div className="flex justify-between items-start gap-4">
                                            <h3 className="text-base font-semibold text-gray-900 truncate pr-2">{item.nombre_producto}</h3>
                                            <span className="font-semibold text-gray-900 whitespace-nowrap">
                                                {formatCurrency(item.subtotal_con_descuento, item.moneda)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            {item.cantidad} x {formatCurrency(item.precio_unitario_original, item.moneda)}
                                            {item.sku && <span className="text-xs text-gray-400 ml-2 font-mono">{item.sku}</span>}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Separator className="my-6" />
                        <div className="flex justify-between items-baseline">
                            <span className="text-base font-medium text-gray-500">Total</span>
                            <span className="text-3xl font-extrabold text-gray-900 tracking-tight">
                                {formatCurrency(order.monto_total, 'ARS')}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Info & Actions */}
            <div className="space-y-6">
                <Card className="border-0 shadow-md ring-1 ring-black/5 h-fit overflow-hidden">
                    {canRenderTrackingMap ? (
                      <div className="h-48 w-full bg-slate-100 relative">
                          <React.Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500">Cargando mapa...</div>}>
                            <TrackingMap
                              status={order.estado}
                              customerLocation={deliveryPoint}
                              storeLocation={storePoint}
                              driverLocation={driverPoint ?? undefined}
                              showDriverMarker={Boolean(driverPoint)}
                            />
                          </React.Suspense>
                      </div>
                    ) : null}
                    <CardHeader className="pb-4 border-b border-gray-50">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-gray-400" />
                            Entrega
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Dirección de envío</p>
                            <p className="font-medium text-gray-900">{order.direccion}</p>
                        </div>
                        <Separator className="bg-gray-100" />
                        <div>
                             <p className="text-sm text-gray-500 mb-1">Destinatario</p>
                             <p className="font-medium text-gray-900">{order.nombre_cliente}</p>
                             <p className="text-sm text-gray-600">{order.telefono_cliente}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-md ring-1 ring-black/5 bg-gradient-to-br from-primary/5 to-primary/10 overflow-hidden relative">
                    <div className="absolute -top-6 -right-6 h-24 w-24 bg-primary/10 rounded-full blur-2xl" />
                    <CardContent className="p-6">
                        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-primary" />
                            ¿Necesitás ayuda?
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Si tenés dudas sobre tu pedido o querés hacer un cambio, contactanos.
                        </p>
                        <Button className="w-full shadow-lg shadow-primary/20" onClick={() => setIsSupportOpen(true)}>
                            Contactar Soporte
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
      </motion.div>

      {/* Support Dialog */}
      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Soporte al Cliente</DialogTitle>
                <DialogDescription>
                    ¿Cómo podemos ayudarte con el pedido <b>#{order.nro_pedido}</b>?
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <Button variant="outline" className="h-auto py-4 justify-start px-4 gap-4 hover:bg-slate-50 hover:border-primary/30 transition-all group" onClick={handleOpenChat}>
                    <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                        <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                        <div className="font-semibold text-gray-900">Chat en Vivo</div>
                        <div className="text-xs text-gray-500">Habla con un representante ahora</div>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
                </Button>

                {/* Only show WhatsApp if configured (simulated check) */}
                <Button variant="outline" className="h-auto py-4 justify-start px-4 gap-4 hover:bg-slate-50 hover:border-green-500/30 transition-all group" onClick={() => {
                    // Fallback to chat if no phone, but simulating whatsapp intent
                    window.open(`https://wa.me/?text=Consulta sobre pedido ${order.nro_pedido}`, '_blank');
                }}>
                     <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors">
                        <Phone className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                        <div className="font-semibold text-gray-900">WhatsApp</div>
                        <div className="text-xs text-gray-500">Envíanos un mensaje directo</div>
                    </div>
                    <ChevronRight className="ml-auto h-4 w-4 text-gray-400" />
                </Button>

                <Separator className="my-2 label-separator" />

                <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Dejar un mensaje / Observación</label>
                    <Textarea
                        placeholder="Escribe tu consulta o aclaración aquí..."
                        className="resize-none min-h-[100px]"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <Button className="w-full" onClick={handleSendMessage} disabled={!message.trim()}>
                        Enviar Mensaje
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
