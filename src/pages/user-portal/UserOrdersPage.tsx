import React, { useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Order } from '@/types/unified';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Package } from 'lucide-react';

const UserOrdersPage = () => {
  const { currentSlug } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentSlug) {
      loadOrders();
    }
  }, [currentSlug]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      if (!currentSlug) return;
      const data = await apiClient.listOrders(currentSlug);
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      // Mock for empty state or error
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Mis Pedidos</h1>

      {loading ? (
        <div>Cargando...</div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg text-muted-foreground">
          <Package className="h-12 w-12 mb-4 opacity-20" />
          <p>No tenés pedidos registrados aún.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Card key={order.id}>
              <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">#{order.id}</span>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), "d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>

                <div className="flex flex-col items-end">
                  <span className="font-bold text-lg">${order.total}</span>
                  <span className="text-xs text-muted-foreground">{order.items.length} productos</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserOrdersPage;
