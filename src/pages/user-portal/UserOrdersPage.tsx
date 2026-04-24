import React, { useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Order } from '@/types/unified';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRightLeft, Package, ExternalLink, ShoppingBag, MessageCircle, Globe } from 'lucide-react';
import { buildTenantPath } from '@/utils/tenantPaths';
import { getCommercialStageLabel, getCommercialStageTone, getCommercialToneClassName, normalizeChannelLabel } from '@/utils/orderCommercial';

const STATUS_MAP: Record<string, string> = {
  nuevo: "Recibido",
  confirmed: "Confirmado",
  paid: "Pagado",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado"
};

const UserOrdersPage = () => {
  const { currentSlug } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, [currentSlug]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      if (!currentSlug) {
        setOrders([]);
        return;
      }
      const data = await apiClient.listOrders(currentSlug);
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const catalogPath = useMemo(() => buildTenantPath('/productos', currentSlug ?? undefined), [currentSlug]);

  const getChannelIcon = (channel: string) => {
      switch(channel) {
          case 'mercadolibre': return <ShoppingBag className="h-4 w-4" />;
          case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
          default: return <Globe className="h-4 w-4" />;
      }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
         <h1 className="text-2xl font-bold">Mis Pedidos</h1>
         <Button variant="outline" size="sm" asChild>
            <a href={catalogPath}>Ir a la tienda</a>
         </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
             {[1,2].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-lg"/>)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
          <Package className="h-12 w-12 mb-4 opacity-20" />
          <p>No tenés pedidos registrados aún.</p>
          <Button variant="link" className="mt-2" asChild><a href={catalogPath}>Explorar catálogo</a></Button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => {
             const anyOrder = order as any;
             const trackingPath = buildTenantPath(`/pedido/confirmado?pedido_id=${encodeURIComponent(String(order.id))}`, currentSlug ?? undefined);
             return (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-0">
                   <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 border-b">
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
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          {format(new Date(order.created_at), "d 'de' MMMM yyyy", { locale: es })}
                          <span>•</span>
                          <span className="flex items-center gap-1 text-xs uppercase tracking-wider">
                             {getChannelIcon(anyOrder.channel || anyOrder.commercial_state?.channel || 'web')} {normalizeChannelLabel(anyOrder.channel || anyOrder.commercial_state?.channel || 'web')}
                          </span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="block font-bold text-lg">${order.total.toLocaleString()}</span>
                        {anyOrder.externalUrl && (
                             <a href={anyOrder.externalUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center justify-end gap-1 mt-1">
                                 Ver en plataforma <ExternalLink className="h-3 w-3"/>
                             </a>
                        )}
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
                      <div className="mt-4 pt-4 border-t flex justify-between items-center">
                          <Button variant="ghost" size="sm" asChild><a href={trackingPath}>Seguir pedido</a></Button>
                          <Button size="sm" variant="outline" asChild><a href={trackingPath}>Ver detalle completo</a></Button>
                      </div>
                   </div>
                </CardContent>
              </Card>
             );
          })}
        </div>
      )}
    </div>
  );
};

export default UserOrdersPage;
