import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicOrder } from '@/api/market';
import { PublicOrderTrackingResponse } from '@/types/tracking';
import { Loader2, Package, CheckCircle2, Clock, Truck, MapPin, XCircle, Copy, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/currency';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock, step: 1 },
  confirmado: { label: 'Confirmado', color: 'bg-blue-500', icon: CheckCircle2, step: 2 },
  en_proceso: { label: 'En Proceso', color: 'bg-indigo-500', icon: Package, step: 3 },
  enviado: { label: 'Enviado', color: 'bg-purple-500', icon: Truck, step: 4 },
  entregado: { label: 'Entregado', color: 'bg-green-500', icon: CheckCircle2, step: 5 },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle, step: 0 },
};

const ORDER_STEPS = [
  { id: 'pendiente', label: 'Recibido' },
  { id: 'confirmado', label: 'Confirmado' },
  { id: 'en_proceso', label: 'Preparación' },
  { id: 'enviado', label: 'En Camino' },
  { id: 'entregado', label: 'Entregado' },
];

export default function OrderTrackingPage() {
  const { nro_pedido } = useParams<{ nro_pedido: string }>();
  const [order, setOrder] = useState<PublicOrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            data.detalles = []; // Fallback to an empty array on parse error
          }
        } else if (!Array.isArray(data.detalles)) {
          data.detalles = []; // Ensure it's always an array
        }

        setOrder(data);

        // Apply theme if available (Defensive handling for JSON string or object)
        let theme = data.tenant_theme;
        if (typeof theme === 'string') {
             try { theme = JSON.parse(theme); } catch (e) { console.warn('Failed to parse tenant_theme', e); }
        }

        if (theme && typeof theme === 'object' && theme.primaryColor) {
          const root = document.documentElement;
          root.style.setProperty('--primary', theme.primaryColor);
        }
      } catch (err) {
        console.error('Failed to load order', err);
        setError('No se pudo encontrar el pedido. Verifique el número e intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();

    // Cleanup theme on unmount
    return () => {
      const root = document.documentElement;
      root.style.removeProperty('--primary');
    };
  }, [nro_pedido]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <CardDescription>{error || 'Pedido no encontrado'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Intentar nuevamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const StatusIcon = STATUS_CONFIG[order.estado]?.icon || Clock;
  const statusLabel = STATUS_CONFIG[order.estado]?.label || order.estado;
  const statusColor = STATUS_CONFIG[order.estado]?.color || 'bg-gray-500';
  const currentStep = STATUS_CONFIG[order.estado]?.step || 0;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(order.nro_pedido);
    toast.success("Número de pedido copiado");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl space-y-8"
      >

        {/* Header / Branding */}
        <div className="text-center space-y-2">
          {order.tenant_logo ? (
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={order.tenant_logo}
              alt={order.pyme_nombre}
              className="mx-auto h-20 w-auto object-contain mb-4"
            />
          ) : (
            <div className="h-16" /> // Spacer
          )}
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">{order.pyme_nombre}</h1>
          <p className="text-base text-gray-500 font-medium">Seguimiento de tu compra</p>
        </div>

        {/* Main Card */}
        <Card className="overflow-hidden shadow-2xl border-0 ring-1 ring-black/5 rounded-2xl bg-white/80 backdrop-blur-sm">
          <div className="h-2 bg-gradient-to-r from-primary/80 to-primary w-full" />
          <CardHeader className="pb-8 pt-8 px-8">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Número de Pedido</p>
                <div className="flex items-center gap-2 group cursor-pointer" onClick={copyToClipboard}>
                  <h2 className="text-3xl font-mono font-bold tracking-tighter text-gray-900">{order.nro_pedido}</h2>
                  <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Realizado el {new Date(order.fecha_creacion).toLocaleDateString()}
                </p>
              </div>
              <div className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-white shadow-sm ${statusColor} w-fit self-start`}>
                <StatusIcon className="h-5 w-5" />
                <span className="font-bold text-sm tracking-wide">{statusLabel.toUpperCase()}</span>
              </div>
            </div>

            {/* Timeline */}
            {order.estado !== 'cancelado' && (
              <div className="mt-10 mb-2 relative">
                <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full" />
                <div
                  className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.max(5, (currentStep - 1) / (ORDER_STEPS.length - 1) * 100)}%` }}
                />
                <div className="relative flex justify-between w-full">
                  {ORDER_STEPS.map((step, index) => {
                    const isActive = index + 1 <= currentStep;
                    const isCurrent = index + 1 === currentStep;

                    return (
                      <div key={step.id} className="flex flex-col items-center gap-2 group">
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: isActive ? 1 : 0.8 }}
                          className={`
                            w-4 h-4 rounded-full border-4 z-10 transition-colors duration-300
                            ${isActive ? 'bg-white border-primary shadow-md' : 'bg-gray-200 border-white'}
                            ${isCurrent ? 'ring-4 ring-primary/20 scale-125' : ''}
                          `}
                        />
                        <span className={`
                          text-[10px] sm:text-xs font-semibold uppercase tracking-wide absolute -bottom-6 text-center w-24
                          ${isActive ? 'text-primary' : 'text-gray-400'}
                        `}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {order.asunto && (
              <div className="mt-10 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                <p className="text-lg font-medium text-gray-800 text-center italic">
                  "{order.asunto}"
                </p>
              </div>
            )}
          </CardHeader>

          <Separator className="opacity-50" />

          <CardContent className="space-y-10 pt-8 px-8 pb-10">
            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Dirección de Envío
                </h3>
                <div className="pl-6 text-sm text-gray-600 space-y-1">
                  <p className="font-semibold text-gray-900 text-base">{order.nombre_cliente}</p>
                  <p className="leading-relaxed">{order.direccion}</p>
                  <p className="text-muted-foreground">{order.telefono_cliente}</p>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                   Resumen de Pago
                </h3>
                 <div className="pl-6 text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between max-w-[200px]">
                    <span>Estado:</span>
                    <span className={`font-medium ${order.estado === 'pendiente' ? 'text-yellow-600' : 'text-green-600'}`}>
                      {order.estado === 'pendiente' ? 'Pendiente' : 'Pagado'}
                    </span>
                  </div>
                  <div className="flex justify-between max-w-[200px] pt-1">
                    <span className="font-semibold text-gray-900">Total:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(order.monto_total, 'ARS')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-6">Detalles del Pedido</h3>
              <div className="space-y-4">
                {order.detalles.map((item, index) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    key={index}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-100">
                        <Package className="h-6 w-6 text-primary/80" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-base">{item.nombre_producto}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Badge variant="outline" className="text-xs bg-white font-normal">
                            {item.cantidad} u.
                          </Badge>
                          <span>x</span>
                          <span>{formatCurrency(item.precio_unitario_original, item.moneda)}</span>
                        </div>
                        {item.sku && <p className="text-[10px] text-gray-400 mt-0.5 font-mono">SKU: {item.sku}</p>}
                      </div>
                    </div>
                    <p className="font-bold text-gray-900 text-lg">
                      {formatCurrency(item.subtotal_con_descuento, item.moneda)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center pt-2">
              <span className="text-xl font-bold text-gray-800">Total a Pagar</span>
              <span className="text-3xl font-extrabold text-primary tracking-tight">
                {formatCurrency(order.monto_total, 'ARS')}
              </span>
            </div>

          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 space-y-2 pb-8">
          <p>¿Necesitas ayuda con tu pedido?</p>
          <Button variant="link" className="text-primary hover:text-primary/80 p-0 h-auto font-medium">
            Contactar a Soporte <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>

      </motion.div>
    </div>
  );
}
