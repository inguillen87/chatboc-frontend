import React, { useEffect, useState, useMemo } from 'react';
import { useUser } from '@/hooks/useUser';
import { useTenant } from '@/context/TenantContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Loader2, Package, AlertTriangle, FileText, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/utils/currency';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';

// Tipos para los pedidos demo
interface DemoOrderSnapshot {
  createdAt: string;
  payload: {
    cliente: { nombre: string; email: string; telefono: string; direccion_envio: string; };
    items: Array<{
      nombre_producto: string;
      cantidad: number;
      precio_unitario: number;
      modalidad: string;
      precio_puntos?: number;
    }>;
    totales: { dinero: number; puntos: number; };
    estado: string;
    modo?: string;
  };
}

export default function UserOrdersPage() {
  const { user, isLoading: isLoadingUser } = useUser();
  const { currentSlug } = useTenant();
  const navigate = useNavigate();
  const [demoOrders, setDemoOrders] = useState<DemoOrderSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loyaltySummary] = useState(() => getDemoLoyaltySummary());

  const effectiveTenantSlug = useMemo(
    () => currentSlug ?? user?.tenantSlug ?? safeLocalStorage.getItem('tenantSlug') ?? null,
    [currentSlug, user?.tenantSlug],
  );

  const loginPath = buildTenantPath('/login', effectiveTenantSlug);
  const registerPath = buildTenantPath('/register', effectiveTenantSlug);
  const catalogPath = buildTenantPath('/productos', effectiveTenantSlug);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-AR'), []);

  useEffect(() => {
    // Cargar pedidos demo del localStorage
    try {
      const raw = safeLocalStorage.getItem('chatboc_demo_orders');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setDemoOrders(parsed);
        }
      }
    } catch (err) {
      console.warn('Error loading demo orders', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (isLoadingUser || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Cargando información...</p>
      </div>
    );
  }

  // Si el usuario está logueado, deberíamos mostrar sus pedidos reales.
  // Por ahora, si no hay backend integrado para "mis pedidos", mostramos un placeholder
  // o los pedidos demo si existen (para facilitar la demo).
  // El requerimiento principal es que funcione el botón "Ver Mis Pedidos" tras el checkout demo.

  const showDemoContent = !user || demoOrders.length > 0;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Mis Pedidos y Actividad</h1>

      {/* Resumen de Actividad (Puntos, Encuestas) - Visible en Demo */}
      <div className="mb-8 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
           <FileText className="h-5 w-5" /> Resumen de Participación
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Saldo disponible</p>
            <p className="text-2xl font-bold text-primary">{numberFormatter.format(loyaltySummary.points)} pts</p>
            {!user && <Badge variant="outline" className="mt-1 text-xs">Modo Demo</Badge>}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Encuestas respondidas</p>
            <p className="text-xl font-semibold">{loyaltySummary.surveysCompleted}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ideas y reclamos</p>
            <p className="text-xl font-semibold">{loyaltySummary.suggestionsShared + loyaltySummary.claimsFiled}</p>
          </div>
        </div>
      </div>

      {!user && demoOrders.length === 0 && (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No has iniciado sesión</h2>
          <p className="text-muted-foreground mb-6">Inicia sesión para ver tu historial de pedidos y reclamos.</p>
          <div className="flex justify-center gap-4">
            <Button asChild>
              <Link to={loginPath}>Iniciar Sesión</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={registerPath}>Registrarme</Link>
            </Button>
          </div>
        </div>
      )}

      {showDemoContent && demoOrders.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Historial de Pedidos (Demo)</h2>
            {!user && (
              <Badge variant="secondary">Guardado localmente</Badge>
            )}
          </div>

          {demoOrders.map((order, index) => (
            <Card key={index} className="overflow-hidden border-border shadow-sm">
              <CardHeader className="bg-muted/30 py-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Pedido #{demoOrders.length - index}</CardTitle>
                  <Badge variant="outline" className="ml-2 font-normal text-xs">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </Badge>
                </div>
                <Badge className={order.payload.estado === 'confirmado' ? 'bg-green-500' : 'bg-yellow-500'}>
                  {order.payload.estado === 'pendiente_confirmacion' ? 'Pendiente' : order.payload.estado}
                </Badge>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {order.payload.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-border/50 last:border-0 pb-2 last:pb-0">
                      <div>
                        <span className="font-medium">{item.nombre_producto}</span>
                        <span className="text-muted-foreground ml-2">x{item.cantidad}</span>
                        <div className="flex gap-2 mt-1">
                           <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{item.modalidad}</Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        {item.modalidad === 'puntos' ? (
                          <span className="font-medium text-primary">{(item.precio_puntos || 0) * item.cantidad} pts</span>
                        ) : item.modalidad === 'donacion' ? (
                          <span className="font-medium text-green-600">Donación</span>
                        ) : (
                          <span className="font-medium">{formatCurrency(item.precio_unitario * item.cantidad)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 py-3 flex justify-between items-center border-t border-border">
                 <div className="text-sm text-muted-foreground">
                    Total
                 </div>
                 <div className="text-right">
                    {order.payload.totales.dinero > 0 && (
                      <div className="font-bold">{formatCurrency(order.payload.totales.dinero)}</div>
                    )}
                    {order.payload.totales.puntos > 0 && (
                      <div className="font-bold text-primary">{numberFormatter.format(order.payload.totales.puntos)} pts</div>
                    )}
                    {order.payload.totales.dinero === 0 && order.payload.totales.puntos === 0 && (
                      <div className="font-bold text-green-600">Gratuito / Donación</div>
                    )}
                 </div>
              </CardFooter>
            </Card>
          ))}

          {!user && (
            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
               <div>
                  <h3 className="font-semibold text-blue-800">Guarda tu historial</h3>
                  <p className="text-sm text-blue-700">Inicia sesión para conservar tus pedidos, sumar puntos reales y hacer seguimiento.</p>
               </div>
               <Button asChild>
                  <Link to={loginPath}>Iniciar Sesión</Link>
               </Button>
            </div>
          )}
        </div>
      )}

      {demoOrders.length === 0 && user && (
         <div className="text-center py-12">
            <Package className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Aún no tienes pedidos</h3>
            <p className="text-muted-foreground mb-6">Explora nuestro catálogo y realiza tu primera compra o canje.</p>
            <Button asChild>
               <Link to={catalogPath}>Ir al Catálogo</Link>
            </Button>
         </div>
      )}
    </div>
  );
}
