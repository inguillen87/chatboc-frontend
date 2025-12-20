import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Order } from '@/types/unified';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, CheckCircle, XCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Package },
  paid: { label: 'Pagado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const PedidosPage = () => {
  const { currentSlug } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (currentSlug) {
      loadOrders();
    }
  }, [currentSlug]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const data = await apiClient.adminListOrders(currentSlug);
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string | number, newStatus: string) => {
    if (!currentSlug) return;
    try {
      await apiClient.adminUpdateOrder(currentSlug, orderId, newStatus);
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus as any });
      }
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  const filteredOrders = orders.filter(o =>
    o.id.toString().includes(searchTerm) ||
    o.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Gestión de Pedidos</h1>
        <div className="relative w-64">
           <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Buscar pedido..."
             className="pl-8"
             value={searchTerm}
             onChange={e => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Order List */}
        <div className="md:col-span-1 space-y-4">
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
          ) : (
            filteredOrders.map(order => (
              <Card
                key={order.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedOrder?.id === order.id ? 'border-primary ring-1 ring-primary' : ''}`}
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm font-bold">#{order.id}</span>
                    <Badge variant="secondary" className={STATUS_MAP[order.status]?.color}>
                       {STATUS_MAP[order.status]?.label || order.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                  </div>
                  <div className="mt-2 font-semibold">
                    ${order.total.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {order.items.length} items
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Order Detail */}
        <div className="md:col-span-2">
           {selectedOrder ? (
             <Card className="h-full">
               <CardHeader className="border-b bg-muted/20">
                 <div className="flex justify-between items-center">
                   <CardTitle>Detalle del Pedido #{selectedOrder.id}</CardTitle>
                   <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => window.print()}>Imprimir</Button>
                      <Button size="sm" onClick={() => alert('Notificación enviada al cliente')}>Notificar Cliente</Button>
                   </div>
                 </div>
               </CardHeader>
               <CardContent className="p-6 space-y-6">
                  {/* Status Actions */}
                  <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium mr-2 self-center">Cambiar estado:</span>
                    {Object.entries(STATUS_MAP).map(([key, config]) => (
                        <Button
                          key={key}
                          size="sm"
                          variant={selectedOrder.status === key ? "default" : "outline"}
                          className={selectedOrder.status === key ? config.color : ''}
                          onClick={() => handleStatusChange(selectedOrder.id, key)}
                        >
                          {config.label}
                        </Button>
                    ))}
                  </div>

                  {/* Items Table */}
                  <div className="border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left">Producto</th>
                          <th className="p-3 text-right">Cant.</th>
                          <th className="p-3 text-right">Precio</th>
                          <th className="p-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-3">{item.name}</td>
                            <td className="p-3 text-right">{item.quantity}</td>
                            <td className="p-3 text-right">${item.price}</td>
                            <td className="p-3 text-right font-medium">${item.price * item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/10 font-medium">
                        <tr>
                          <td colSpan={3} className="p-3 text-right">Total</td>
                          <td className="p-3 text-right text-lg">${selectedOrder.total}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
               </CardContent>
             </Card>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl p-10">
               <Package className="h-12 w-12 mb-4 opacity-20" />
               <p>Selecciona un pedido para ver los detalles</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default PedidosPage;
