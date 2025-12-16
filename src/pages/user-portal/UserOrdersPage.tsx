import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, MapPin, ShoppingBag, User as UserIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { formatCurrency } from '@/utils/currency';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';

type DemoOrderItem = {
  nombre_producto?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio_puntos?: number;
  modalidad?: string;
};

type DemoOrderPayload = {
  contacto?: {
    nombre?: string;
    email?: string;
    telefono?: string;
    direccion?: string;
    referencias?: string;
  };
  items?: DemoOrderItem[];
  totales?: {
    dinero?: number;
    puntos?: number;
  };
  metodo_pago?: string;
  metodo_envio?: string;
  estado?: string;
};

type DemoOrderSnapshot = {
  createdAt: string;
  payload?: DemoOrderPayload;
};

const DEMO_ORDERS_KEY = 'chatboc_demo_orders';

const parseDemoOrders = (): DemoOrderSnapshot[] => {
  try {
    const raw = safeLocalStorage.getItem(DEMO_ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(entry => entry && typeof entry === 'object' && typeof entry.createdAt === 'string')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
};

const formatDateTime = (value: string) => {
  try {
    return format(new Date(value), 'dd/MM/yyyy HH:mm');
  } catch {
    return value;
  }
};

const UserOrdersPage = () => {
  const { currentSlug } = useTenant();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);
  const [demoOrders, setDemoOrders] = useState<DemoOrderSnapshot[] | null>(null);
  const loyaltySummary = useMemo(() => getDemoLoyaltySummary(), []);

  useEffect(() => {
    setDemoOrders(parseDemoOrders());
  }, []);

  const hasDemoOrders = (demoOrders?.length ?? 0) > 0;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mis pedidos y actividad</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Consulta el historial de tus pedidos de prueba y tus puntos generados en este dispositivo.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={loginPath}>Iniciar sesión</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de participación</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Puntos</p>
            <p className="text-2xl font-semibold">{loyaltySummary.points.toLocaleString()} pts</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Encuestas</p>
            <p className="text-2xl font-semibold">{loyaltySummary.surveysCompleted}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sugerencias</p>
            <p className="text-2xl font-semibold">{loyaltySummary.suggestionsShared}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Reclamos</p>
            <p className="text-2xl font-semibold">{loyaltySummary.claimsFiled}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Historial de pedidos (demo)</CardTitle>
            <span className="text-xs text-muted-foreground">Guardado localmente en este navegador</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {demoOrders === null && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando historial...
            </div>
          )}

          {demoOrders && !hasDemoOrders && (
            <div className="text-center py-8 bg-muted/20 rounded-lg">
                <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium text-foreground">Aún no hay pedidos</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
                    Cuando realices compras en modo demo, aparecerán aquí para que veas cómo funciona el seguimiento.
                </p>
                <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" asChild>
                        <a href="/demo">Ir a la Demo</a>
                    </Button>
                    {/* Add fallback demo data button for testing */}
                    <Button variant="ghost" size="sm" onClick={() => {
                        const dummyOrder: DemoOrderSnapshot = {
                            createdAt: new Date().toISOString(),
                            payload: {
                                estado: 'entregado',
                                metodo_envio: 'delivery',
                                contacto: { nombre: 'Usuario Demo', direccion: 'Calle Falsa 123' },
                                items: [{ nombre_producto: 'Producto Ejemplo', cantidad: 1, precio_unitario: 1500, modalidad: 'venta' }],
                                totales: { dinero: 1500, puntos: 150 }
                            }
                        };
                        const current = parseDemoOrders();
                        safeLocalStorage.setItem('chatboc_demo_orders', JSON.stringify([dummyOrder, ...current]));
                        setDemoOrders([dummyOrder, ...current]);
                    }}>
                        Generar Pedido de Prueba
                    </Button>
                </div>
            </div>
          )}

          {hasDemoOrders && (
            <div className="space-y-4">
              {demoOrders?.map((order, idx) => {
                const items = order.payload?.items ?? [];
                const totales = order.payload?.totales ?? {};
                const contacto = order.payload?.contacto;
                return (
                  <Card key={`${order.createdAt}-${idx}`} className="border border-muted">
                    <CardHeader className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ShoppingBag className="h-4 w-4" />
                          Pedido demo
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</span>
                      </div>
                      <div className="text-lg font-semibold text-foreground">
                        {order.payload?.estado ?? 'Pendiente'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.payload?.metodo_envio === 'pickup' ? 'Retiro en punto de entrega' : 'Envío a domicilio'}
                        {order.payload?.metodo_pago ? ` · Pago: ${order.payload.metodo_pago}` : ''}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {contacto && (
                        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4" />
                            <span>{contacto.nombre ?? 'Contacto'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{contacto.direccion ?? 'Dirección no especificada'}</span>
                          </div>
                          {contacto.referencias && <span className="ml-6">{contacto.referencias}</span>}
                          {contacto.telefono && <span className="ml-6">Tel: {contacto.telefono}</span>}
                        </div>
                      )}

                      <div className="space-y-2">
                        {items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex flex-wrap items-center justify-between text-sm">
                            <div className="font-medium text-foreground">
                              {item.nombre_producto ?? 'Producto sin nombre'}
                              {item.modalidad ? ` · ${item.modalidad}` : ''}
                            </div>
                            <div className="text-muted-foreground">
                              x{item.cantidad ?? 1}
                              {item.precio_unitario != null && (
                                <span className="ml-2">{formatCurrency(item.precio_unitario)}</span>
                              )}
                              {item.precio_puntos != null && <span className="ml-2">{item.precio_puntos} pts</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-muted-foreground">
                        Total dinerario: {totales.dinero != null ? formatCurrency(totales.dinero) : '-'}
                      </div>
                      {totales.puntos != null && (
                        <div className="text-sm text-muted-foreground">Total en puntos: {totales.puntos} pts</div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
        <Separator />
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Inicia sesión para sincronizar tus pedidos reales y reclamos asociados a tu cuenta.</span>
          <Button asChild size="sm">
            <a href={loginPath}>Ir a iniciar sesión</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default UserOrdersPage;
