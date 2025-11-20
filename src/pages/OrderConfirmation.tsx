import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, ExternalLink, Loader2, ShoppingBag, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiFetch, ApiError, NetworkError, getErrorMessage } from '@/utils/api';
import { formatCurrency } from '@/utils/currency';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { cn } from '@/lib/utils';

interface OrderItem {
  nombre: string;
  cantidad: number;
  modalidad?: string | null;
  precio_unitario?: number | null;
  precio_puntos?: number | null;
  subtotal_monetario?: number | null;
  subtotal_puntos?: number | null;
  imagen_url?: string | null;
}

interface OrderSummary {
  id: string;
  estado?: string | null;
  total_monetario: number;
  total_puntos: number;
  items: OrderItem[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeItem = (input: unknown): OrderItem | null => {
  if (!isRecord(input)) return null;

  const producto = isRecord(input.producto) ? input.producto : null;
  const nombre =
    (typeof input.nombre === 'string' && input.nombre.trim()) ||
    (producto?.nombre as string | undefined) ||
    (typeof input.nombre_producto === 'string' && input.nombre_producto.trim());

  if (!nombre) return null;

  const modalidad =
    (typeof input.modalidad === 'string' && input.modalidad) ||
    (typeof input.tipo === 'string' && input.tipo) ||
    (producto?.modalidad as string | undefined) ||
    null;

  const cantidad = toNumber(input.cantidad) ?? 1;
  const precioUnitario = toNumber(input.precio_unitario) ?? toNumber(producto?.precio_unitario) ?? null;
  const precioPuntos = toNumber(input.precio_puntos) ?? toNumber(producto?.precio_puntos) ?? null;
  const subtotalMonetario = toNumber(input.subtotal) ?? toNumber(input.subtotal_monetario) ?? null;
  const subtotalPuntos = toNumber(input.subtotal_puntos) ?? null;
  const imagenUrl =
    (typeof input.imagen_url === 'string' && input.imagen_url) ||
    (producto?.imagen_url as string | undefined) ||
    (producto?.imagen as string | undefined) ||
    null;

  return {
    nombre,
    cantidad,
    modalidad,
    precio_unitario: precioUnitario,
    precio_puntos: precioPuntos,
    subtotal_monetario: subtotalMonetario,
    subtotal_puntos: subtotalPuntos,
    imagen_url: imagenUrl,
  };
};

const normalizeOrder = (payload: unknown): OrderSummary => {
  if (!isRecord(payload)) {
    throw new Error('No se pudo interpretar el pedido devuelto por el backend.');
  }

  const id =
    (typeof payload.id === 'string' && payload.id) ||
    (typeof payload.id === 'number' && String(payload.id)) ||
    (typeof payload.pedido_id === 'string' && payload.pedido_id) ||
    (typeof payload.order_id === 'string' && payload.order_id) ||
    null;

  if (!id) {
    throw new Error('No se pudo identificar el pedido solicitado.');
  }

  const itemsSource =
    Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.detalles)
        ? payload.detalles
        : [];

  const items = itemsSource
    .map((item) => normalizeItem(item))
    .filter((item): item is OrderItem => Boolean(item));

  const totalMonetario =
    toNumber(payload.total_monetario) ??
    toNumber(payload.total) ??
    items.reduce((acc, item) => acc + (item.subtotal_monetario ?? item.precio_unitario ?? 0) * item.cantidad, 0);

  const totalPuntos =
    toNumber(payload.total_puntos) ??
    items.reduce((acc, item) => acc + (item.subtotal_puntos ?? item.precio_puntos ?? 0) * item.cantidad, 0);

  return {
    id,
    estado: (typeof payload.estado === 'string' && payload.estado) || (typeof payload.status === 'string' && payload.status) || null,
    total_monetario: totalMonetario || 0,
    total_puntos: totalPuntos || 0,
    items,
  };
};

const statusCopy: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'info' }> = {
  approved: { label: 'Pago aprobado', tone: 'success' },
  pagado: { label: 'Pago aprobado', tone: 'success' },
  paid: { label: 'Pago aprobado', tone: 'success' },
  pendiente: { label: 'Pago pendiente', tone: 'warning' },
  pending: { label: 'Pago pendiente', tone: 'warning' },
  failure: { label: 'Pago rechazado', tone: 'error' },
  rejected: { label: 'Pago rechazado', tone: 'error' },
};

const toneToClasses: Record<'success' | 'warning' | 'error' | 'info', string> = {
  success: 'text-green-600 border-green-200 bg-green-50',
  warning: 'text-amber-600 border-amber-200 bg-amber-50',
  error: 'text-destructive border-destructive/20 bg-destructive/10',
  info: 'text-primary border-primary/20 bg-primary/5',
};

const OrderConfirmationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentSlug } = useTenant();

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantQuerySuffix = currentSlug ? `?tenant=${encodeURIComponent(currentSlug)}` : '';

  const sharedRequestOptions = useMemo(() => {
    const hasPanelSession = Boolean(
      safeLocalStorage.getItem('authToken') || safeLocalStorage.getItem('chatAuthToken'),
    );

    return {
      suppressPanel401Redirect: true,
      tenantSlug: currentSlug ?? undefined,
      sendAnonId: true,
      isWidgetRequest: !hasPanelSession,
    } as const;
  }, [currentSlug]);

  const statusFromGateway = searchParams.get('status')?.toLowerCase() ?? null;
  const pedidoId =
    searchParams.get('pedido_id') ||
    searchParams.get('order_id') ||
    searchParams.get('id');

  useEffect(() => {
    if (!pedidoId) {
      setError('No encontramos el identificador del pedido.');
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    apiFetch<unknown>(`/api/pedidos/${encodeURIComponent(pedidoId)}`, {
      ...sharedRequestOptions,
      signal: controller.signal,
    })
      .then((response) => {
        setOrder(normalizeOrder(response));
      })
      .catch((err) => {
        if (err instanceof ApiError || err instanceof NetworkError) {
          setError(getErrorMessage(err, 'No pudimos recuperar el estado del pedido.'));
        } else if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        } else {
          setError('No pudimos recuperar el estado del pedido.');
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [pedidoId, sharedRequestOptions]);

  const effectiveStatus = (order?.estado || statusFromGateway || '').toLowerCase();
  const statusMeta = statusCopy[effectiveStatus] ?? { label: 'Estado en revisión', tone: 'info' };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Resultado del pedido</h1>
          <p className="text-muted-foreground">Confirmamos el estado del pago y los ítems incluidos.</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Algo salió mal</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!pedidoId && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Identificador faltante</CardTitle>
            <CardDescription>Revisa el enlace de confirmación o vuelve al catálogo para generar un nuevo pedido.</CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => navigate(`/productos${tenantQuerySuffix}`)}>Volver al catálogo</Button>
            <Button variant="outline" onClick={() => navigate(`/cart${tenantQuerySuffix}`)}>Ir al carrito</Button>
          </CardFooter>
        </Card>
      )}

      {pedidoId && (
        <Card className="shadow-lg border-border">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Pedido #{pedidoId}</CardTitle>
              <CardDescription>
                Consulta el detalle real del pedido después de volver de la pasarela de pago.
              </CardDescription>
            </div>
            <Badge className={cn('text-sm capitalize', toneToClasses[statusMeta.tone])}>
              {statusMeta.label}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p>Verificando el estado del pedido...</p>
              </div>
            )}

            {!isLoading && order && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm text-muted-foreground">Total en dinero</p>
                    <p className="text-2xl font-semibold text-foreground">{formatCurrency(order.total_monetario)}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm text-muted-foreground">Total en puntos</p>
                    <p className="text-2xl font-semibold text-primary">{order.total_puntos} pts</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm text-muted-foreground">Estado del pago</p>
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      {statusMeta.tone === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
                      {statusMeta.tone === 'warning' && <Clock className="h-5 w-5 text-amber-600" />}
                      {statusMeta.tone === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
                      <span>{statusMeta.label}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h2 className="text-xl font-semibold">Productos</h2>
                  {order.items.length === 0 ? (
                    <p className="text-muted-foreground">No encontramos ítems asociados al pedido.</p>
                  ) : (
                    <div className="space-y-3">
                      {order.items.map((item, index) => (
                        <div
                          key={`${item.nombre}-${index}`}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-lg p-3 bg-card"
                        >
                          <div className="flex items-center gap-3">
                            {item.imagen_url ? (
                              <img
                                src={item.imagen_url}
                                alt={item.nombre}
                                className="h-14 w-14 rounded-md object-cover border"
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.style.visibility = 'hidden';
                                }}
                              />
                            ) : null}
                            <div>
                              <p className="font-medium text-foreground">{item.nombre}</p>
                              <p className="text-sm text-muted-foreground">Cantidad: {item.cantidad}</p>
                              {item.modalidad && (
                                <Badge variant="outline" className="mt-1 capitalize">{item.modalidad}</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            {item.modalidad === 'puntos' ? (
                              <p className="font-semibold text-primary">{(item.precio_puntos ?? 0) * item.cantidad} pts</p>
                            ) : item.modalidad === 'donacion' ? (
                              <p className="font-semibold text-foreground">Donación</p>
                            ) : (
                              <p className="font-semibold text-foreground">{formatCurrency((item.precio_unitario ?? 0) * item.cantidad)}</p>
                            )}
                            {item.subtotal_puntos && item.modalidad !== 'puntos' && (
                              <p className="text-xs text-primary">{item.subtotal_puntos} pts</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Si el estado no coincide con el de la pasarela, revisamos la última notificación del backend.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => navigate(`/pedidos${tenantQuerySuffix}`)}>
                Ver mis pedidos
              </Button>
              <Button onClick={() => navigate(`/productos${tenantQuerySuffix}`)}>
                Seguir comprando
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {statusFromGateway && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ExternalLink className="h-4 w-4" />
          <span>Estado reportado por la pasarela: {statusFromGateway}</span>
        </div>
      )}
    </div>
  );
};

export default OrderConfirmationPage;
