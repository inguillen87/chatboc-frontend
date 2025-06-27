import React, { useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Product {
  nombre: string;
  presentacion?: string;
  precio_str?: string;
  imagen_url?: string;
}

interface CartMap { [nombre: string]: number }

const formatPrice = (price: number) =>
  price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

export default function CartPage() {
  const [items, setItems] = useState<CartMap>({});
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [cart, prods] = await Promise.all([
        apiFetch<CartMap>('/carrito'),
        apiFetch<Product[]>('/productos'),
      ]);
      const map: Record<string, Product> = {};
      prods.forEach((p) => { map[p.nombre] = p; });
      setProducts(map);
      setItems(cart);
    } catch (err) {
      setError(getErrorMessage(err, 'Error al cargar'));
    }
  };

  useEffect(() => { loadData(); }, []);

  const updateQty = async (name: string, qty: number) => {
    if (qty <= 0) {
      await apiFetch('/carrito', { method: 'DELETE', body: { nombre: name } });
    } else {
      await apiFetch('/carrito', { method: 'PUT', body: { nombre: name, cantidad: qty } });
    }
    loadData();
  };

  const cartItems = Object.entries(items);
  const parsePrice = (val: string) => {
    const num = parseFloat(val.replace(/[^0-9.,-]+/g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  const total = cartItems.reduce((sum, [nombre, qty]) => {
    const prod = products[nombre];
    const price = prod?.precio_str ? parsePrice(prod.precio_str) : 0;
    return sum + price * qty;
  }, 0);

  if (error) {
    return <p className="p-4 text-destructive">{error}</p>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Carrito</h1>
      {cartItems.length === 0 ? (
        <p>El carrito está vacío.</p>
      ) : (
        <>
          {cartItems.map(([name, qty]) => {
            const prod = products[name];
            const price = prod?.precio_str ? parsePrice(prod.precio_str) : undefined;
            return (
              <Card key={name} className="border border-border">
                <CardContent className="p-4 flex items-center gap-4">
                  {prod?.imagen_url && (
                    <img src={prod.imagen_url} alt={name} className="w-16 h-16 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{name}</p>
                    {prod?.presentacion && (
                      <p className="text-xs text-muted-foreground">{prod.presentacion}</p>
                    )}
                    {price !== undefined && (
                      <p className="text-sm font-semibold mt-1">{formatPrice(price)}</p>
                    )}
                  </div>
                  <Input
                    type="number"
                    className="w-20"
                    value={qty}
                    onChange={(e) => updateQty(name, Number(e.target.value))}
                  />
                  <Button variant="ghost" onClick={() => updateQty(name, 0)}>
                    Quitar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          <p className="text-right font-bold">Total: {formatPrice(total)}</p>
        </>
      )}
    </div>
  );
}
