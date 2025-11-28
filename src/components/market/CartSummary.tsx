import React, { useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MarketCartItem } from '@/types/market';
import { formatCurrency } from '@/utils/currency';
import { ShoppingCart } from 'lucide-react';

interface CartSummaryProps {
  items: MarketCartItem[];
  totalAmount?: number | null;
  totalPoints?: number | null;
  onCheckout: () => void;
  isSubmitting?: boolean;
}

export default function CartSummary({
  items,
  totalAmount,
  totalPoints,
  onCheckout,
  isSubmitting,
}: CartSummaryProps) {
  const derivedTotals = useMemo(() => {
    const amount =
      totalAmount ??
      items.reduce((acc, item) => acc + (item.price ?? 0) * item.quantity, 0);
    const points =
      totalPoints ??
      items.reduce((acc, item) => acc + (item.points ?? 0) * item.quantity, 0);

    return { amount, points };
  }, [items, totalAmount, totalPoints]);

  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <p className="text-sm text-muted-foreground">Resumen del carrito</p>
          <CardTitle className="text-2xl">{itemCount} ítem(s)</CardTitle>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShoppingCart className="h-5 w-5" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="text-lg font-semibold">{formatCurrency(derivedTotals.amount, 'ARS')}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Puntos</span>
          <span className="font-medium">{derivedTotals.points}</span>
        </div>
      </CardContent>

      <Separator />

      <CardFooter className="flex flex-col gap-3">
        <Button className="w-full" size="lg" onClick={onCheckout} disabled={!items.length || isSubmitting}>
          {isSubmitting ? 'Procesando...' : 'Ir a checkout'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Tu pedido se confirma en un paso. Te contactaremos con el detalle.
        </p>
      </CardFooter>
    </Card>
  );
}
