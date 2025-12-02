import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  availableAmount?: number | null;
  availablePoints?: number | null;
  onCheckout: () => void;
  isSubmitting?: boolean;
}

export default function CartSummary({
  items,
  totalAmount,
  totalPoints,
  availableAmount,
  availablePoints,
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
  const remainingAmount =
    typeof availableAmount === 'number' && Number.isFinite(availableAmount)
      ? Math.max(availableAmount - derivedTotals.amount, 0)
      : null;
  const remainingPoints =
    typeof availablePoints === 'number' && Number.isFinite(availablePoints)
      ? Math.max(availablePoints - derivedTotals.points, 0)
      : null;
  const hasMoneyBalance = availableAmount !== undefined && availableAmount !== null;
  const hasPointsBalance = availablePoints !== undefined && availablePoints !== null;

  const progressWidth = (current: number | null, total: number | null) => {
    if (current === null || total === null || total <= 0) return '0%';
    const pct = Math.max(0, Math.min(100, (current / Math.max(current, total)) * 100));
    return `${pct}%`;
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <p className="text-sm text-muted-foreground">Resumen del carrito</p>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={itemCount}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            >
              <CardTitle className="text-2xl">{itemCount} ítem(s)</CardTitle>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShoppingCart className="h-5 w-5" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={derivedTotals.amount}
              className="text-lg font-semibold"
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {formatCurrency(derivedTotals.amount, 'ARS')}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Puntos</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={derivedTotals.points}
              className="font-medium"
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {derivedTotals.points}
            </motion.span>
          </AnimatePresence>
        </div>

        {(hasMoneyBalance || hasPointsBalance) && (
          <div className="mt-4 space-y-3 rounded-md bg-muted/50 p-3 text-xs">
            {hasMoneyBalance ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Saldo en dinero</span>
                  <span className="font-medium text-foreground">
                    {formatCurrency(Math.max(availableAmount, 0), 'ARS')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span>Disponible luego del carrito</span>
                  <span className="font-semibold">{formatCurrency(remainingAmount ?? 0, 'ARS')}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <motion.div
                    className="h-2 rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: progressWidth(remainingAmount, availableAmount) }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ) : null}

            {hasPointsBalance ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Saldo en puntos</span>
                  <span className="font-medium text-foreground">{availablePoints}</span>
                </div>
                <div className="flex items-center justify-between text-foreground">
                  <span>Disponible luego del carrito</span>
                  <span className="font-semibold">{remainingPoints ?? availablePoints}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <motion.div
                    className="h-2 rounded-full bg-primary/70"
                    initial={{ width: 0 }}
                    animate={{ width: progressWidth(remainingPoints, availablePoints) }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
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
