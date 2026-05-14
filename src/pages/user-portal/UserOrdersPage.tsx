import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRightLeft, ExternalLink, Globe, MessageCircle, Package, ShoppingBag } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { usePortalContent } from '@/hooks/usePortalContent';
import { apiClient } from '@/api/client';
import { Order } from '@/types/unified';
import type { WidgetPortalOrder } from '@/utils/widgetPortal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildTenantPath } from '@/utils/tenantPaths';
import { getCommercialStageLabel, getCommercialStageTone, getCommercialToneClassName, normalizeChannelLabel } from '@/utils/orderCommercial';

const STATUS_MAP: Record<string, string> = {
  nuevo: 'Recibido',
  confirmed: 'Confirmado',
  paid: 'Pagado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const formatDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return format(parsed, "d 'de' MMMM yyyy", { locale: es });
};

const getChannelIcon = (channel: string) => {
  switch (channel) {
    case 'mercadolibre':
      return <ShoppingBag className="h-4 w-4" />;
    case 'whatsapp':
      return <MessageCircle className="h-4 w-4" />;
    default:
      return <Globe className="h-4 w-4" />;
  }
};

const PublicOrderCard = ({ order }: { order: WidgetPortalOrder }) => {
  const total = typeof order.amountTotal === 'number' ? order.amountTotal : null;
  const title = order.title || (order.nroPedido ? `#${order.nroPedido}` : null);
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {order.nroPedido ? <span className="font-bold text-lg">#{order.nroPedido}</span> : null}
              {order.status ? <Badge className="capitalize">{order.status}</Badge> : null}
            </div>
            {title ? <h3 className="text-lg font-semibold">{title}</h3> : null}
            {(order.customerName || order.customerPhone) ? (
              <div className="text-sm text-muted-foreground">
                {[order.customerName, order.customerPhone].filter(Boolean).join(' - ')}
              </div>
            ) : null}
          </div>
          <div className="text-right">
            {total !== null ? <span className="block text-lg font-bold">${total.toLocaleString()}</span> : null}
            {order.trackingUrl ? (
              <a href={order.trackingUrl} className="mt-1 flex items-center justify-end gap-1 text-xs text-primary hover:underline">
                Tracking <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 p-4">
          {order.items.length > 0 ? (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 text-sm">
                  <span>{[item.quantity ? `${item.quantity}x` : null, item.name].filter(Boolean).join(' ')}</span>
                  {typeof item.price === 'number' ? <span className="font-medium text-muted-foreground">${item.price.toLocaleString()}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
          {(order.detailEndpoint || order.trackingUrl) ? (
            <div className="flex justify-end gap-2 border-t pt-4">
              {order.detailEndpoint ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={order.detailEndpoint} target="_blank" rel="noreferrer">Ver detalle</a>
                </Button>
              ) : null}
              {order.trackingUrl ? (
                <Button size="sm" asChild>
                  <a href={order.trackingUrl}>Seguir pedido</a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const LegacyOrderCard = ({ order, currentSlug }: { order: Order; currentSlug: string | null }) => {
  const anyOrder = order as any;
  const trackingPath = buildTenantPath(`/pedido/confirmado?pedido_id=${encodeURIComponent(String(order.id))}`, currentSlug ?? undefined);
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-4 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg">#{order.id}</span>
              <Badge variant={anyOrder.status === 'cancelled' ? 'destructive' : 'default'} className="capitalize">
                {STATUS_MAP[anyOrder.status] || anyOrder.status}
              </Badge>
              {getCommercialStageLabel(anyOrder.commercial_stage || anyOrder.commercial_state?.stage) ? (
                <Badge variant="outline" className={getCommercialToneClassName(getCommercialStageTone(anyOrder.commercial_stage || anyOrder.commercial_state?.stage))}>
                  {getCommercialStageLabel(anyOrder.commercial_stage || anyOrder.commercial_state?.stage)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {formatDate(order.created_at)}
              <span className="flex items-center gap-1 text-xs uppercase tracking-wider">
                {getChannelIcon(anyOrder.channel || anyOrder.commercial_state?.channel || 'web')}
                {normalizeChannelLabel(anyOrder.channel || anyOrder.commercial_state?.channel || 'web')}
              </span>
            </p>
          </div>
          <div className="text-right">
            <span className="block text-lg font-bold">${order.total.toLocaleString()}</span>
            {anyOrder.externalUrl ? (
              <a href={anyOrder.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center justify-end gap-1 text-xs text-primary hover:underline">
                Ver en plataforma <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="p-4">
          <div className="space-y-2">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-medium text-muted-foreground">${item.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
          {(anyOrder.customer_profile?.name || anyOrder.customer_profile?.phone || anyOrder.market_order_id || anyOrder.commercial_state?.supports_handoff) ? (
            <div className="mt-4 grid gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {anyOrder.customer_profile?.name ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Perfil</p>
                  <p className="mt-1 font-medium text-foreground">{anyOrder.customer_profile.name}</p>
                </div>
              ) : null}
              {anyOrder.customer_profile?.phone ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Contacto</p>
                  <p className="mt-1 font-medium text-foreground">{anyOrder.customer_profile.phone}</p>
                </div>
              ) : null}
              {anyOrder.market_order_id ? (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Orden operativa</p>
                  <p className="mt-1 font-medium text-foreground">#{anyOrder.market_order_id}</p>
                </div>
              ) : null}
              {anyOrder.commercial_state?.supports_handoff ? (
                <div className="flex items-center gap-2 text-emerald-700">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span className="font-medium">Continuidad omnicanal disponible</span>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <Button variant="ghost" size="sm" asChild><a href={trackingPath}>Seguir pedido</a></Button>
            <Button size="sm" variant="outline" asChild><a href={trackingPath}>Ver detalle completo</a></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const UserOrdersPage = () => {
  const { currentSlug } = useTenant();
  const { user } = useUser();
  const { content, commerceSession, publicOrders, isLoading: portalLoading } = usePortalContent();
  const [orders, setOrders] = useState<Order[]>([]);
  const [legacyLoading, setLegacyLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!currentSlug || !user || publicOrders.length > 0) {
      setOrders([]);
      setLegacyLoading(false);
      return;
    }

    setLegacyLoading(true);
    apiClient
      .listOrders(currentSlug)
      .then((data) => {
        if (active) setOrders(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Error loading orders:', error);
        if (active) setOrders([]);
      })
      .finally(() => {
        if (active) setLegacyLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentSlug, publicOrders.length, user]);

  const catalogPath = useMemo(() => buildTenantPath('/productos', currentSlug ?? undefined), [currentSlug]);
  const catalogEnabled = commerceSession?.catalog?.enabled === true || content.catalog.length > 0;
  const loading = portalLoading || legacyLoading;
  const hasPublicOrders = publicOrders.length > 0;
  const hasLegacyOrders = orders.length > 0;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis pedidos</h1>
        {catalogEnabled ? (
          <Button variant="outline" size="sm" asChild>
            <a href={catalogPath}>{commerceSession?.catalog?.cta_label || commerceSession?.catalog?.label || 'Ir al catalogo'}</a>
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-lg bg-muted/20" />)}
        </div>
      ) : !hasPublicOrders && !hasLegacyOrders ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center text-muted-foreground">
          <Package className="mb-4 h-12 w-12 opacity-20" />
          <p>No tenes pedidos registrados aun.</p>
          {catalogEnabled ? (
            <Button variant="link" className="mt-2" asChild><a href={catalogPath}>Explorar catalogo</a></Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {hasPublicOrders
            ? publicOrders.map((order) => <PublicOrderCard key={order.id} order={order} />)
            : orders.map((order) => <LegacyOrderCard key={order.id} order={order} currentSlug={currentSlug} />)}
        </div>
      )}
    </div>
  );
};

export default UserOrdersPage;
