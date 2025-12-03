import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import { apiClient } from '@/api/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/currency';

function CheckoutContent({ tenantSlug }: { tenantSlug: string }) {
  const { items, totalAmount, totalPoints, isLoading, error, refreshCart } = useMarketCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckout = async () => {
    setCheckoutMessage(null);
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(`/public/market/${tenantSlug}/checkout`, { name, phone });
      setCheckoutMessage(response?.message ?? 'Checkout iniciado. Revisá tu correo o WhatsApp.');
      await refreshCart();
    } catch (err) {
      setCheckoutMessage(err instanceof Error ? err.message : 'No se pudo iniciar el checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Checkout</h1>
          <p className="text-muted-foreground">Revisá tu carrito y completá tus datos de contacto.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/tenant/${tenantSlug}/market`}>Volver al catálogo</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 && !isLoading ? (
        <Alert>
          <AlertTitle>Carrito vacío</AlertTitle>
          <AlertDescription>Agregá productos para continuar con la compra.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? <p className="text-sm text-muted-foreground">Cargando carrito…</p> : null}
            {items.map((item) => (
              <div key={`${item.id}-${item.name}`} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                </div>
                <div className="text-right text-sm font-semibold">
                  {typeof item.price === 'number' ? formatCurrency(item.price * item.quantity, 'ARS') : '—'}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkout-name">Nombre</Label>
              <Input
                id="checkout-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-phone">Teléfono</Label>
              <Input
                id="checkout-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="WhatsApp o teléfono"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <div className="flex w-full items-center justify-between text-sm">
              <span>Total</span>
              <strong>{typeof totalAmount === 'number' ? formatCurrency(totalAmount, 'ARS') : '—'}</strong>
            </div>
            {totalPoints ? (
              <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
                <span>Puntos acumulados</span>
                <span>{totalPoints}</span>
              </div>
            ) : null}
            <Button className="w-full" onClick={handleCheckout} disabled={isSubmitting || items.length === 0}>
              {isSubmitting ? 'Iniciando pago…' : 'Pagar con Mercado Pago'}
            </Button>
            {checkoutMessage ? <p className="text-sm text-muted-foreground">{checkoutMessage}</p> : null}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function MarketCheckoutPage() {
  const params = useParams();
  const tenantSlug = useMemo(() => params.tenant ?? params.tenantSlug ?? null, [params.tenant, params.tenantSlug]);

  useEffect(() => {
    if (typeof window !== 'undefined' && tenantSlug) {
      (window as any).currentTenantSlug = tenantSlug;
    }
  }, [tenantSlug]);

  if (!tenantSlug) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Falta el tenant</AlertTitle>
          <AlertDescription>Necesitamos el identificador del espacio para continuar.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <MarketCartProvider tenantSlug={tenantSlug}>
      <CheckoutContent tenantSlug={tenantSlug} />
    </MarketCartProvider>
  );
}
