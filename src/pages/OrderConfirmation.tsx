import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, CheckCircle, Clock, RefreshCw, Hash, Loader2, Package, ShoppingBag, XCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiFetch } from '@/utils/api';
import { useVerifiedOrder } from '@/hooks/useVerifiedOrder';
import { getVerifiedPaymentStatus, shouldRefreshOrder } from '@/utils/verifiedPaymentStatus';
import { formatCurrency } from '@/utils/currency';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { buildTenantPath } from '@/utils/tenantPaths';
import { getCommercialStageLabel, getCommercialStageTone, getCommercialToneClassName, normalizeChannelLabel } from '@/utils/orderCommercial';

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
  market_order_id?: string | number | null;
  preference_id?: string | null;
  init_point?: string | null;
  customer_profile?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    contact_key?: string | null;
    channel_group?: string | null;
  } | null;
  commercial_state?: {
    stage?: string | null;
    channel?: string | null;
    supports_handoff?: boolean | null;
  } | null;
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
    items.reduce((acc, item) => acc + (item.subtotal_monetario ?? (item.precio_unitario ?? 0) * item.cantidad), 0);

  const totalPuntos =
    toNumber(payload.total_puntos) ??
    items.reduce((acc, item) => acc + (item.subtotal_puntos ?? (item.precio_puntos ?? 0) * item.cantidad), 0);

  return {
    id,
    estado: (typeof payload.estado === 'string' && payload.estado) || (typeof payload.status === 'string' && payload.status) || null,
    total_monetario: totalMonetario || 0,
    total_puntos: totalPuntos || 0,
    items,
    market_order_id: (typeof payload.market_order_id === 'string' || typeof payload.market_order_id === 'number') ? payload.market_order_id : null,
    preference_id: typeof payload.preference_id === 'string' ? payload.preference_id : null,
    init_point: typeof payload.init_point === 'string' ? payload.init_point : null,
    customer_profile: isRecord(payload.customer_profile) ? payload.customer_profile as any : null,
    commercial_state: isRecord(payload.commercial_state) ? payload.commercial_state as any : null,
  };
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

  const [failedImageKeys, setFailedImageKeys] = useState<Set<string>>(() => new Set());

  const catalogPath = buildTenantPath('/productos', currentSlug);
  const cartPath = buildTenantPath('/cart', currentSlug);
  const ordersPath = buildTenantPath('/pedidos', currentSlug);

  const sharedRequestOptions = useMemo(
    () => ({
      suppressPanel401Redirect: true,
      tenantSlug: currentSlug ?? undefined,
      sendAnonId: true,
    }) as const,
    [currentSlug],
  );

  const pedidoId =
    searchParams.get('pedido_id') ||
    searchParams.get('order_id') ||
    searchParams.get('id');

  const scope = pedidoId ? JSON.stringify([currentSlug ?? null, pedidoId]) : null;
  const loadOrder = useCallback(async (signal: AbortSignal) => {
    if (!pedidoId) throw new Error("Missing order");
    const response = await apiFetch<unknown>(`/api/pedidos/${encodeURIComponent(pedidoId)}`, {
      ...sharedRequestOptions, signal,
    });
    const normalized = normalizeOrder(response);
    if (normalized.id !== pedidoId) throw new Error("Order identity mismatch");
    return normalized;
  }, [pedidoId, sharedRequestOptions]);
  const { data: order, isLoading, error, lastCheckedAt, autoRefreshStopped, refresh } =
    useVerifiedOrder(scope, loadOrder, shouldRefreshOrder);
  const effectiveStatus = (order?.estado || "").toLowerCase();
  const statusMeta = getVerifiedPaymentStatus(order?.estado);
  const stageLabel = order?.commercial_state?.stage ? getCommercialStageLabel(order.commercial_state.stage) : null;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Resultado del pedido</h1>
          <p className="text-muted-foreground">Consultá el estado verificado del pedido y sus productos.</p>
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
            <Button onClick={() => navigate(catalogPath)}>Volver al catálogo</Button>
            <Button variant="outline" onClick={() => navigate(cartPath)}>Ir al carrito</Button>
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
            <div className="flex flex-wrap gap-2">
              <Badge className={cn('text-sm', toneToClasses[statusMeta.tone])}>
                {statusMeta.label}
              </Badge>
              {stageLabel ? (
                <Badge variant="outline" className={getCommercialToneClassName(getCommercialStageTone(order?.commercial_state?.stage || effectiveStatus || null))}>
                  {stageLabel}
                </Badge>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4" role="status" aria-live="polite" aria-atomic="true">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-medium">{isLoading ? 'Consultando el estado del pedido' : error ? 'La verificación no se completó' : autoRefreshStopped ? 'La acreditación aún no está confirmada' : 'Verificación del pedido'}</p>
                  <p className="text-sm text-muted-foreground">{lastCheckedAt ? `Última consulta: ${new Date(lastCheckedAt).toLocaleTimeString('es-AR')}.` : 'Esperando la confirmación del servidor.'}</p>
                  <p className="text-sm text-muted-foreground">Volver de la pasarela o enviar un comprobante no acredita el pago.</p>
                  {autoRefreshStopped && !error ? <p className="text-sm text-muted-foreground">La consulta automática finalizó. Podés volver a consultar sin repetir la compra.</p> : null}
                </div>
                <Button type="button" variant="outline" onClick={refresh} disabled={isLoading} className="shrink-0">
                  <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} aria-hidden="true" />
                  {isLoading ? 'Verificando…' : 'Volver a consultar'}
                </Button>
              </div>
            </div>

            {order ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {order.market_order_id ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Orden operativa</p>
                    <p className="mt-2 flex items-center gap-2 font-semibold text-foreground"><Hash className="h-4 w-4 text-primary" /> #{order.market_order_id}</p>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Canal</p>
                  <p className="mt-2 font-semibold text-foreground">{normalizeChannelLabel(order.commercial_state?.channel || order.customer_profile?.channel_group || null)}</p>
                </div>
                {(order.customer_profile?.name || order.customer_profile?.phone) ? (
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Perfil</p>
                    <p className="mt-2 font-semibold text-foreground">{order.customer_profile?.name || 'Cliente'}</p>
                    {order.customer_profile?.phone ? <p className="mt-1 text-sm text-muted-foreground">{order.customer_profile.phone}</p> : null}
                  </div>
                ) : null}
                {order.commercial_state?.supports_handoff ? (<div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Continuar tu atención</p>
                  <p className="mt-2 flex items-center gap-2 font-semibold text-foreground"><ArrowRightLeft className="h-4 w-4 text-primary" /> Podés retomar por otro canal</p>
                </div>) : null}
              </div>
            ) : null}

            {isLoading && (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p>Verificando el estado del pedido...</p>
              </div>
            )}

            {order && (
              <>
                <div className={cn("grid grid-cols-1 gap-4", order.total_puntos > 0 ? "md:grid-cols-3" : "md:grid-cols-2")}>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm text-muted-foreground">Total en dinero</p>
                    <p className="text-2xl font-semibold text-foreground">{formatCurrency(order.total_monetario)}</p>
                  </div>
                  {order.total_puntos > 0 ? (<div className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm text-muted-foreground">Total en puntos</p>
                    <p className="text-2xl font-semibold text-primary">{order.total_puntos} pts</p>
                  </div>) : null}
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
                      {order.items.map((item, index) => {
                        const modality = (item.modalidad ?? '').toLowerCase();
                        const badgeVariant = modality === 'donacion' ? 'success' : modality === 'puntos' ? 'outline' : 'secondary';
                        const badgeLabel = modality === 'donacion' ? 'Donacion' : modality === 'puntos' ? 'Canje con puntos' : 'Compra';
                        const imageKey = `${item.nombre}-${index}`;
                        const hasImage = Boolean(item.imagen_url && !failedImageKeys.has(imageKey));

                        return (
                          <div
                            key={imageKey}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-lg p-3 bg-card"
                          >
                            <div className="flex items-center gap-3">
                              {hasImage ? (
                                <img
                                  src={item.imagen_url}
                                  alt={item.nombre}
                                  className="h-14 w-14 rounded-md object-cover border"
                                  loading="lazy"
                                  onError={() => {
                                    setFailedImageKeys((prev) => {
                                      const next = new Set(prev);
                                      next.add(imageKey);
                                      return next;
                                    });
                                  }}
                                />
                              ) : (
                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                                  <Package className="h-5 w-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-foreground">{item.nombre}</p>
                                <p className="text-sm text-muted-foreground">Cantidad: {item.cantidad}</p>
                                {item.modalidad && (
                                  <Badge variant={badgeVariant} className="mt-1 capitalize">{badgeLabel}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              {item.modalidad === 'puntos' ? (
                                <p className="font-semibold text-primary">{item.subtotal_puntos ?? (item.precio_puntos ?? 0) * item.cantidad} pts</p>
                              ) : item.modalidad === 'donacion' ? (
                                <p className="font-semibold text-foreground">Donacion</p>
                              ) : (
                                <p className="font-semibold text-foreground">{formatCurrency(item.subtotal_monetario ?? (item.precio_unitario ?? 0) * item.cantidad)}</p>
                              )}
                              {item.subtotal_puntos && item.modalidad !== 'puntos' && (
                                <p className="text-xs text-primary">{item.subtotal_puntos} pts</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row gap-3 sm:justify-between">
            <div className="text-sm text-muted-foreground">
              El estado mostrado proviene del servidor. No vuelvas a pagar mientras se verifica la acreditación.
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => navigate(ordersPath)}>
                Ver mis pedidos
              </Button>
              <Button onClick={() => navigate(catalogPath)}>
                Seguir comprando
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}


    </div>
  );
};

export default OrderConfirmationPage;
