import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShoppingBag, Clock, Star, Gift } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { formatCurrency } from '@/utils/currency';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CustomerHistoryProps {
  customerId?: string; // Could be phone, email, or internal ID
  tenantSlug: string;
}

interface CustomerContext {
  summary: {
    total_spent: number;
    total_orders: number;
    loyalty_points: number;
    avg_ticket: number;
    last_order_date: string | null;
  };
  recent_orders: Array<{
    id: string;
    date: string;
    total: number;
    status: string;
    items_summary: string;
  }>;
  preferences: {
    top_categories: string[];
    favorite_products: string[];
  };
}

const CustomerHistoryPanel: React.FC<CustomerHistoryProps> = ({ customerId, tenantSlug }) => {
  const [data, setData] = useState<CustomerContext | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      if (!customerId) return;
      setLoading(true);
      try {
        // Mocking the endpoint for now as backend implementation is parallel
        // Ideally: await apiFetch(`/api/tenants/${tenantSlug}/crm/customers/${customerId}/context`);

        // Simulating API delay and response
        await new Promise(r => setTimeout(r, 800));
        setData({
            summary: {
                total_spent: 154000,
                total_orders: 5,
                loyalty_points: 1200,
                avg_ticket: 30800,
                last_order_date: new Date().toISOString()
            },
            recent_orders: [
                { id: '1024', date: new Date().toISOString(), total: 45000, status: 'delivered', items_summary: '2x Malbec Reserva, 1x Aceite Oliva' },
                { id: '998', date: new Date(Date.now() - 86400000 * 10).toISOString(), total: 22000, status: 'delivered', items_summary: '1x Caja Mix Varietales' }
            ],
            preferences: {
                top_categories: ['Vinos Tintos', 'Gourmet'],
                favorite_products: ['Malbec Reserva', 'Queso Brie']
            }
        });

      } catch (error) {
        console.error("Failed to load customer history", error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [customerId, tenantSlug]);

  if (!customerId) {
    return (
      <Card className="h-full border-dashed bg-muted/20 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Selecciona un cliente para ver su historial.</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="h-full flex flex-col overflow-hidden border-none shadow-none bg-transparent">
      <CardHeader className="px-4 py-3 border-b bg-muted/10">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ShoppingBag className="h-4 w-4" /> Contexto del Cliente
        </CardTitle>
      </CardHeader>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
            {/* KPI Summary */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/10">
                    <p className="text-xs text-muted-foreground">Total Gastado</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(data.summary.total_spent)}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Puntos <Gift className="h-3 w-3" />
                    </p>
                    <p className="text-lg font-bold text-yellow-700 dark:text-yellow-500">{data.summary.loyalty_points}</p>
                </div>
            </div>

            {/* Preferences / Tags */}
            <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3" /> Preferencias
                </h4>
                <div className="flex flex-wrap gap-2">
                    {data.preferences.top_categories.map(cat => (
                        <Badge key={cat} variant="secondary" className="text-xs font-normal">{cat}</Badge>
                    ))}
                    {data.preferences.favorite_products.map(prod => (
                        <Badge key={prod} variant="outline" className="text-xs font-normal border-primary/20 bg-primary/5">{prod}</Badge>
                    ))}
                </div>
            </div>

            {/* Recent Orders */}
            <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Últimos Pedidos
                </h4>
                {data.recent_orders.map(order => (
                    <div key={order.id} className="text-sm border rounded-md p-3 bg-card hover:bg-accent/5 transition-colors cursor-pointer">
                        <div className="flex justify-between items-center mb-1">
                            <span className="font-mono font-bold">#{order.id}</span>
                            <span className="text-xs text-muted-foreground">{format(new Date(order.date), "d MMM yyyy", { locale: es })}</span>
                        </div>
                        <p className="text-muted-foreground text-xs line-clamp-1 mb-2">{order.items_summary}</p>
                        <div className="flex justify-between items-center">
                            <Badge variant="outline" className="text-[10px] px-1.5 h-5">{order.status}</Badge>
                            <span className="font-semibold">{formatCurrency(order.total)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </ScrollArea>
    </Card>
  );
};

export default CustomerHistoryPanel;
