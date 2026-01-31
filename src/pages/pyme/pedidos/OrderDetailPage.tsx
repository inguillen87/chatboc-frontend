import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Order } from '@/types/unified';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, CheckCircle, XCircle, ArrowLeft, Mail, Phone, Calendar } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/currency';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: Package },
  confirmed: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentSlug } = useTenant();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatchInfo, setDispatchInfo] = useState<{ email?: string; phone?: string }>({});

  useEffect(() => {
    if (currentSlug && id) {
      loadOrder();
      loadDispatchInfo();
    }
  }, [currentSlug, id]);

  const loadDispatchInfo = async () => {
      try {
          if (!currentSlug) return;
          const settings = await apiClient.adminGetNotificationSettings(currentSlug);
          setDispatchInfo({
              email: settings?.dispatch_email || settings?.notification_settings?.dispatch_email,
              phone: settings?.dispatch_phone || settings?.notification_settings?.dispatch_phone
          });
      } catch (e) {
          console.warn("Could not load dispatch info", e);
      }
  };

  const loadOrder = async () => {
    setLoading(true);
    try {
      if (!currentSlug || !id) return;
      // Reusing list endpoint and filtering locally is safer if show endpoint doesn't exist,
      // but proper implementation should be a GET by ID.
      // Assuming generic structure or list fallback.
      // Let's try listing and finding first as fallback since backend might not have dedicated GET /id exposed yet for tenant admin.
      // Actually, adminUpdateOrder exists (`PUT .../orders/:id`), so `GET` likely exists too.
      // Let's try fetching list and filtering for safety in this "frontend polish" phase to avoid 404s if backend is lagging.
      const orders = await apiClient.adminListOrders(currentSlug);
      const found = orders.find(o => String(o.id) === id);
      setOrder(found || null);
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error("No se pudo cargar el pedido.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!currentSlug || !order) return;
    try {
      await apiClient.adminUpdateOrder(currentSlug, Number(order.id), { status: newStatus });
      setOrder({ ...order, status: newStatus as any });
      toast.success("Estado actualizado");
    } catch (error) {
      toast.error("Error al actualizar estado");
    }
  };

  if (loading) {
      return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;
  }

  if (!order) {
      return <div className="p-8 text-center">Pedido no encontrado. <Button variant="link" onClick={() => navigate(-1)}>Volver</Button></div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <h1 className="text-2xl font-bold">Pedido #{order.id}</h1>
          <Badge className={STATUS_MAP[order.status]?.color}>
              {STATUS_MAP[order.status]?.label || order.status}
          </Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
              <Card>
                  <CardHeader>
                      <CardTitle>Detalle de Productos</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-4">
                          {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                                  <div>
                                      <p className="font-medium">{item.name}</p>
                                      <p className="text-sm text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                                  </div>
                                  <p className="font-bold">{formatCurrency(item.price * item.quantity)}</p>
                              </div>
                          ))}
                          <div className="flex justify-between pt-4 text-lg font-bold">
                              <span>Total</span>
                              <span>{formatCurrency(order.total)}</span>
                          </div>
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Historial y Notas</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                          Creado el {new Date(order.created_at).toLocaleString()}
                      </p>
                      {/* Placeholder for future audit log */}
                      <div className="bg-muted/30 p-3 rounded text-sm">
                          {(order as any).notes || "Sin notas adicionales."}
                      </div>
                  </CardContent>
              </Card>
          </div>

          <div className="space-y-6">
              <Card>
                  <CardHeader>
                      <CardTitle>Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{(order as any).customerName || 'Cliente Final'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>{(order as any).customerEmail || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{(order as any).customerPhone || '-'}</span>
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Acciones</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                      {order.status === 'nuevo' && (
                          <Button className="w-full" onClick={() => handleStatusChange('confirmed')}>Confirmar Pedido</Button>
                      )}
                      {order.status === 'confirmed' && (
                          <Button className="w-full" onClick={() => handleStatusChange('shipped')}>Marcar Enviado</Button>
                      )}
                      {order.status !== 'cancelled' && (
                          <Button variant="outline" className="w-full text-destructive hover:text-destructive" onClick={() => handleStatusChange('cancelled')}>Cancelar Pedido</Button>
                      )}
                  </CardContent>
              </Card>

              {/* Dispatch Info Block */}
              {(dispatchInfo.email || dispatchInfo.phone) && (
                  <Card className="bg-blue-50 border-blue-200">
                      <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-blue-900 flex items-center gap-2">
                              <Truck className="h-4 w-4"/> Datos de Despacho
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-blue-800 space-y-1">
                          {dispatchInfo.email && <p>Email: {dispatchInfo.email}</p>}
                          {dispatchInfo.phone && <p>Tel: {dispatchInfo.phone}</p>}
                          <p className="text-xs text-blue-600 mt-2 italic">
                              * Las notificaciones se envían automáticamente a estos contactos.
                          </p>
                      </CardContent>
                  </Card>
              )}
          </div>
      </div>
    </div>
  );
}
