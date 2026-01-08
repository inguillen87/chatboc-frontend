import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { apiClient } from '@/api/client';
import { Order } from '@/types/unified';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, CheckCircle, XCircle, Search, ShoppingBag, MessageCircle, Globe, ExternalLink, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-800', icon: Package },
  confirmed: { label: 'Confirmado', color: 'bg-indigo-100 text-indigo-800', icon: CheckCircle },
  paid: { label: 'Pagado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: 'Entregado', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const CHANNEL_ICONS: Record<string, any> = {
  mercadolibre: ShoppingBag, // Represents a bag/store
  whatsapp: MessageCircle,
  tiendanube: Globe, // Represents a web store
  web: Globe
};

const CHANNEL_LABELS: Record<string, string> = {
  mercadolibre: "Mercado Libre",
  whatsapp: "WhatsApp",
  tiendanube: "Tienda Nube",
  web: "Web Propia"
};

const normalizeOrders = (raw: unknown): Order[] => {
  if (Array.isArray(raw)) return raw;

  if (raw && typeof raw === 'object') {
    const candidate = (raw as any).orders ?? (raw as any).results;
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
};

const PedidosPage = () => {
  const { currentSlug } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Manual Order State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newItem, setNewItem] = useState({ contact_name: '', product_name: '', price: '', quantity: '1' });

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
      const normalized = normalizeOrders(data);

      // Ensure we have some data for demo if empty
      if (normalized.length === 0) {
        setOrders(MOCK_ORDERS);
      } else {
        setOrders(normalized);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      setOrders(MOCK_ORDERS); // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string | number, newStatus: string) => {
    if (!currentSlug) return;
    const currentOrders = Array.isArray(orders) ? orders : [];

    try {
      await apiClient.adminUpdateOrder(currentSlug, orderId, newStatus);
      // Optimistic update
      const updatedOrders = currentOrders.map(o =>
        o.id === orderId ? { ...o, status: newStatus as any } : o,
      );
      setOrders(updatedOrders);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus as any });
      }
    } catch (error) {
      console.error('Failed to update status', error);
      // Still update UI for demo purposes
      const updatedOrders = currentOrders.map(o =>
        o.id === orderId ? { ...o, status: newStatus as any } : o,
      );
      setOrders(updatedOrders);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus as any });
      }
    }
  };

  const handleCreateOrder = async () => {
    if (!currentSlug) return;
    if (!newItem.contact_name || !newItem.product_name || !newItem.price) {
      toast.error("Complete los campos obligatorios");
      return;
    }

    setCreateLoading(true);
    try {
      const payload = {
        contact_name: newItem.contact_name,
        items: [{
          name: newItem.product_name,
          price: parseFloat(newItem.price),
          quantity: parseInt(newItem.quantity) || 1,
        }],
      };

      await apiClient.adminCreateOrder(currentSlug, payload);
      toast.success("Pedido creado correctamente");
      setIsCreateOpen(false);
      setNewItem({ contact_name: '', product_name: '', price: '', quantity: '1' });
      loadOrders(); // Refresh list
    } catch (error) {
      console.error("Create order failed", error);
      toast.error("Error al crear el pedido");
    } finally {
      setCreateLoading(false);
    }
  };

  const safeOrders = Array.isArray(orders) ? orders : [];

  const filteredOrders = safeOrders.filter(o => {
    const matchesSearch =
      o.id.toString().includes(searchTerm) ||
      o.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesChannel = channelFilter === 'all' || (o as any).channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none ${selectedOrder ? 'hidden md:flex' : ''}`}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestión de Pedidos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Centraliza tus ventas de Mercado Libre, Tienda Nube y WhatsApp.</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto flex-wrap">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Crear Pedido
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Pedido Manual</DialogTitle>
                        <DialogDescription>Registra una venta realizada por fuera de la plataforma.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Nombre del Cliente</Label>
                            <Input
                                value={newItem.contact_name}
                                onChange={e => setNewItem({...newItem, contact_name: e.target.value})}
                                placeholder="Juan Pérez"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Producto</Label>
                            <Input
                                value={newItem.product_name}
                                onChange={e => setNewItem({...newItem, product_name: e.target.value})}
                                placeholder="Producto ejemplo"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Precio Unitario</Label>
                                <Input
                                    type="number"
                                    value={newItem.price}
                                    onChange={e => setNewItem({...newItem, price: e.target.value})}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Cantidad</Label>
                                <Input
                                    type="number"
                                    value={newItem.quantity}
                                    onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                                    placeholder="1"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateOrder} disabled={createLoading}>
                            {createLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Crear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar pedido..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los canales</SelectItem>
                    <SelectItem value="mercadolibre">Mercado Libre</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="tiendanube">Tienda Nube</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 relative">
        {/* Order List */}
        <div className={`md:col-span-1 overflow-y-auto pr-2 space-y-3 ${selectedOrder ? 'hidden md:block' : 'block'}`}>
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
          ) : (
            filteredOrders.map(order => {
              const ChannelIcon = CHANNEL_ICONS[(order as any).channel] || Globe;
              const isSelected = selectedOrder?.id === order.id;

              return (
                <Card
                  key={order.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'border-primary ring-1 ring-primary bg-accent/50' : ''}`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                          <Badge variant="outline" className="px-1.5 h-6 w-6 flex items-center justify-center rounded-full border-muted-foreground/30" title={CHANNEL_LABELS[(order as any).channel]}>
                              <ChannelIcon className="h-3 w-3" />
                          </Badge>
                          <span className="font-mono text-sm font-bold">#{order.id}</span>
                      </div>
                      <Badge variant="secondary" className={STATUS_MAP[order.status]?.color || 'bg-gray-100'}>
                         {STATUS_MAP[order.status]?.label || order.status}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-sm text-muted-foreground">
                                {format(new Date(order.created_at), "d MMM, HH:mm", { locale: es })}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {order.items.length} items • {(order as any).customerName || 'Cliente Final'}
                            </div>
                        </div>
                        <div className="font-bold text-lg">
                            ${order.total.toLocaleString()}
                        </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Order Detail */}
        <div className={`md:col-span-2 h-full min-h-0 flex flex-col ${!selectedOrder ? 'hidden md:flex' : 'flex'}`}>
           {selectedOrder ? (
             <Card className="h-full flex flex-col border-muted/60 shadow-md">
               <CardHeader className="border-b bg-muted/20 py-4 flex-none">
                 <div className="flex justify-between items-center">
                   <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1 md:hidden">
                            <Button variant="ghost" size="sm" className="h-8 px-2 -ml-2" onClick={() => setSelectedOrder(null)}>
                                ← Volver
                            </Button>
                        </div>
                        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                            Pedido #{selectedOrder.id}
                            {(selectedOrder as any).externalId && (
                                <Badge variant="outline" className="text-xs font-normal font-mono">
                                    Ref: {(selectedOrder as any).externalId}
                                </Badge>
                            )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                             Canal: {CHANNEL_LABELS[(selectedOrder as any).channel] || 'Web'}
                             {(selectedOrder as any).externalUrl && (
                                 <a href={(selectedOrder as any).externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5 ml-2">
                                     (Ver original <ExternalLink className="h-3 w-3"/>)
                                 </a>
                             )}
                        </p>
                   </div>
                   <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => window.print()}>Imprimir</Button>
                      <Button size="sm">Contactar Cliente</Button>
                   </div>
                 </div>
               </CardHeader>

               <CardContent className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Status Actions */}
                  <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg border">
                    <span className="text-sm font-medium">Estado actual:</span>
                    <Badge className={`text-sm px-3 py-1 ${STATUS_MAP[selectedOrder.status]?.color}`}>
                        {STATUS_MAP[selectedOrder.status]?.label || selectedOrder.status}
                    </Badge>
                    <div className="flex-1" />
                    <div className="flex gap-2">
                        {selectedOrder.status === 'nuevo' && (
                            <Button size="sm" onClick={() => handleStatusChange(selectedOrder.id, 'confirmed')}>Confirmar</Button>
                        )}
                        {selectedOrder.status === 'confirmed' && (
                            <Button size="sm" onClick={() => handleStatusChange(selectedOrder.id, 'shipped')}>Marcar Despachado</Button>
                        )}
                        {selectedOrder.status === 'shipped' && (
                            <Button size="sm" onClick={() => handleStatusChange(selectedOrder.id, 'delivered')}>Marcar Entregado</Button>
                        )}
                        {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'delivered' && (
                             <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleStatusChange(selectedOrder.id, 'cancelled')}>Cancelar</Button>
                        )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                      {/* Customer Info */}
                      <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cliente</h3>
                          <div className="p-3 border rounded-md bg-card">
                              <p className="font-medium">{(selectedOrder as any).customerName || 'Consumidor Final'}</p>
                              <p className="text-sm text-muted-foreground">{(selectedOrder as any).customerPhone || 'Sin teléfono'}</p>
                              <p className="text-sm text-muted-foreground">{(selectedOrder as any).customerEmail || 'Sin email'}</p>
                          </div>
                      </div>

                      {/* Shipping Info */}
                      <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Envío</h3>
                           <div className="p-3 border rounded-md bg-card">
                              <p className="font-medium">Retiro en sucursal</p>
                              <p className="text-sm text-muted-foreground">Av. Principal 1234, Local 5</p>
                          </div>
                      </div>
                  </div>

                  {/* Items Table */}
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="p-3 text-left font-medium">Producto</th>
                          <th className="p-3 text-right font-medium">Cant.</th>
                          <th className="p-3 text-right font-medium">Precio</th>
                          <th className="p-3 text-right font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item, idx) => (
                          <tr key={idx} className="border-t last:border-0">
                            <td className="p-3">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-muted-foreground">SKU: {(item as any).sku || 'N/A'}</div>
                            </td>
                            <td className="p-3 text-right">{item.quantity}</td>
                            <td className="p-3 text-right">${item.price.toLocaleString()}</td>
                            <td className="p-3 text-right font-medium">${(item.price * item.quantity).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/30 font-medium">
                        <tr>
                          <td colSpan={3} className="p-3 text-right">Total</td>
                          <td className="p-3 text-right text-lg">${selectedOrder.total.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Internal Notes */}
                  <div className="space-y-2">
                      <h3 className="text-sm font-medium">Notas internas</h3>
                      <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-md text-sm text-yellow-900">
                          {(selectedOrder as any).notes || "Sin notas adicionales."}
                      </div>
                  </div>

               </CardContent>
             </Card>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-muted rounded-xl p-10 bg-muted/5">
               <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 opacity-50" />
               </div>
               <p className="text-lg font-medium">Selecciona un pedido</p>
               <p className="text-sm">Verás los detalles completos y podrás gestionar su estado.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

// Mock Data for Demo
const MOCK_ORDERS: any[] = [
    {
        id: "2000149922",
        channel: "mercadolibre",
        status: "nuevo",
        total: 45900,
        created_at: new Date().toISOString(),
        customerName: "Juan Pérez",
        customerPhone: "+5491155556666",
        externalId: "ML-4829102",
        externalUrl: "https://mercadolibre.com.ar",
        items: [
            { name: "Taladro Percutor 700w", quantity: 1, price: 45900, sku: "TAL-001" }
        ],
        notes: "El cliente preguntó si viene con maletín."
    },
    {
        id: "1055",
        channel: "whatsapp",
        status: "confirmed",
        total: 12500,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        customerName: "Maria Rodriguez",
        customerPhone: "+5491144443333",
        items: [
            { name: "Set de Mechas x10", quantity: 1, price: 8500, sku: "MEC-10" },
            { name: "Cinta Métrica 5m", quantity: 1, price: 4000, sku: "CIN-05" }
        ],
        notes: "Pide factura A."
    },
    {
        id: "TN-9921",
        channel: "tiendanube",
        status: "shipped",
        total: 120000,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        customerName: "Empresa Constructora SA",
        externalId: "TN-9921",
        items: [
            { name: "Lijadora Orbital", quantity: 2, price: 60000, sku: "LIJ-PRO" }
        ]
    }
];

export default PedidosPage;
