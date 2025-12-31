import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicOrder } from '@/api/market';
import { PublicOrderTrackingResponse } from '@/types/tracking';
import { Loader2, Package, CheckCircle2, Clock, Truck, MapPin, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/currency';

const STATUS_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock },
  confirmado: { label: 'Confirmado', color: 'bg-blue-500', icon: CheckCircle2 },
  en_proceso: { label: 'En Proceso', color: 'bg-indigo-500', icon: Package },
  enviado: { label: 'Enviado', color: 'bg-purple-500', icon: Truck },
  entregado: { label: 'Entregado', color: 'bg-green-500', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
};

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
        setOrder(data);

        // Apply theme if available
        if (data.tenant_theme) {
          const root = document.documentElement;
          root.style.setProperty('--primary', data.tenant_theme.primaryColor);
          // Assuming secondaryColor might be used for backgrounds or accents,
          // but relying on primary for main branding is safer.
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header / Branding */}
        <div className="text-center">
          {order.tenant_logo && (
            <img
              src={order.tenant_logo}
              alt={order.pyme_nombre}
              className="mx-auto h-16 w-auto object-contain mb-4"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{order.pyme_nombre}</h1>
          <p className="text-sm text-gray-500">Seguimiento de Pedido</p>
        </div>

        {/* Main Card */}
        <Card className="overflow-hidden shadow-lg border-t-4 border-t-primary">
          <CardHeader className="bg-white pb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Número de Pedido</p>
                <h2 className="text-2xl font-bold tracking-tight">{order.nro_pedido}</h2>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-white ${statusColor} w-fit`}>
                <StatusIcon className="h-5 w-5" />
                <span className="font-semibold">{statusLabel}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Fecha: {new Date(order.fecha_creacion).toLocaleDateString()}
            </p>
            {order.asunto && (
              <p className="text-lg font-medium text-gray-800 mt-4">
                {order.asunto}
              </p>
            )}
          </CardHeader>

          <Separator />

          <CardContent className="space-y-8 pt-6">
            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Dirección de Envío
                </h3>
                <div className="pl-6 text-sm text-gray-600">
                  <p className="font-medium">{order.nombre_cliente}</p>
                  <p>{order.direccion}</p>
                  <p>{order.telefono_cliente}</p>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                   Resumen de Pago
                </h3>
                 <div className="pl-6 text-sm text-gray-600">
                  <p>Estado: {order.estado === 'pendiente' ? 'Pendiente de pago/aprobación' : 'Aprobado'}</p>
                  <p>Total: {formatCurrency(order.monto_total, 'ARS')}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Detalles del Pedido</h3>
              <div className="space-y-3">
                {order.detalles.map((item, index) => (
                  <div key={index} className="flex items-start justify-between text-sm">
                    <div className="flex items-start gap-3">
                      <div className="bg-gray-100 rounded-md p-2">
                        <Package className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.nombre_producto}</p>
                        <p className="text-gray-500">
                          {item.cantidad} x {formatCurrency(item.precio_unitario_original, item.moneda)}
                        </p>
                        {item.sku && <p className="text-xs text-gray-400">SKU: {item.sku}</p>}
                      </div>
                    </div>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(item.subtotal_con_descuento, item.moneda)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-center pt-2">
              <span className="text-lg font-bold">Total</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(order.monto_total, 'ARS')}
              </span>
            </div>

          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>¿Necesitas ayuda con tu pedido?</p>
          <p>Contactá a {order.pyme_nombre} indicando tu número de pedido.</p>
        </div>

      </div>
    </div>
  );
}
