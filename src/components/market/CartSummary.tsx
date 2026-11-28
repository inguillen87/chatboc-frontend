import React, { useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MarketCartItem, MarketCartPromotions, MarketCheckoutOptions, MarketCheckoutPreview, MarketCommercialState, MarketContinuity, MarketCustomerProfile, MarketRecommendation, MarketRewardsProfile, MarketSuggestedAction } from '@/types/market';
import { displayMarketPrice, formatCurrency } from '@/utils/currency';
import { Gift, ShoppingCart } from 'lucide-react';

interface CartSummaryProps {
  items: MarketCartItem[];
  totalAmount?: number | null;
  totalPoints?: number | null;
  onCheckout: () => void;
  isSubmitting?: boolean;
  onRemoveItem?: (productId: string) => void;
  onClearCart?: () => void;
  isUpdating?: boolean;
  customerProfile?: MarketCustomerProfile | null;
  commercialState?: MarketCommercialState | null;
  continuity?: MarketContinuity | null;
  suggestedActions?: MarketSuggestedAction[] | null;
  recommendations?: MarketRecommendation[] | null;
  promotions?: MarketCartPromotions | null;
  checkoutPreview?: MarketCheckoutPreview | null;
  checkoutOptions?: MarketCheckoutOptions | null;
  checkoutBlockedReason?: string | null;
  rewardsProfile?: MarketRewardsProfile | null;
  rewardsLoading?: boolean;
  redeemingRewardId?: string | null;
  onRedeemReward?: (rewardId: string) => void;
}

export default function CartSummary({
  items,
  totalAmount,
  totalPoints,
  onCheckout,
  isSubmitting,
  onRemoveItem,
  onClearCart,
  isUpdating,
  customerProfile,
  commercialState,
  continuity,
  suggestedActions,
  recommendations,
  promotions,
  checkoutPreview,
  checkoutOptions,
  checkoutBlockedReason,
  rewardsProfile,
  rewardsLoading,
  redeemingRewardId,
  onRedeemReward,
}: CartSummaryProps) {
  const currency = useMemo(() => {
    const fromItem = items.find((item) => typeof item.currency === 'string' && item.currency.trim());
    return (fromItem?.currency ?? 'ARS').toUpperCase();
  }, [items]);

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
  const redemptionOptions = useMemo(
    () =>
      (rewardsProfile?.available_redemptions ?? []).filter((item) => {
        const rewardId = item.reward_id ?? item.id;
        return rewardId !== null && rewardId !== undefined && (item.label || item.title || item.description);
      }),
    [rewardsProfile?.available_redemptions],
  );
  const hasPromotionSavings =
    typeof promotions?.total_ahorrado === 'number' &&
    promotions.total_ahorrado > 0 &&
    typeof promotions?.total_con_descuento === 'number';

  const formatItemPrice = (item: MarketCartItem) => {
    if (item.priceText && !/^\s*\d+(?:[.,]\d{1,2})?\s*$/.test(item.priceText)) return item.priceText;
    if (item.priceText && typeof item.price !== 'number') return displayMarketPrice(item.priceText, null, item.currency ?? currency) ?? item.priceText;
    if (typeof item.price === 'number') {
      const amount = item.price * item.quantity;
      return formatCurrency(amount, item.currency ?? currency);
    }
    if (typeof item.points === 'number') return `${item.points * item.quantity} pts`;
    return 'Consultar';
  };

  const showPoints = derivedTotals.points > 0 || redemptionOptions.length > 0;
  const finalTotal = hasPromotionSavings ? promotions!.total_con_descuento! : derivedTotals.amount;

  // Buyer-first summary: what you are taking, what it costs, one clear next step.
  // Store-team context (stage, channel, continuity, gateway) lives in the panel.
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
        <CardTitle className="text-xl">Tu carrito</CardTitle>
        <span className="text-sm text-muted-foreground">
          {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
        </span>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {items.length ? (
          <ul className="divide-y divide-border/60">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
                    <ShoppingCart className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-snug text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} {item.quantity === 1 ? 'unidad' : 'unidades'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="font-semibold text-foreground">{formatItemPrice(item)}</span>
                  {onRemoveItem ? (
                    <button
                      type="button"
                      className="mt-0.5 text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
                      onClick={() => onRemoveItem(item.id)}
                      disabled={isUpdating}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-muted-foreground">Tu carrito está vacío.</p>
        )}

        {hasPromotionSavings ? (
          <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
            <span>Ahorrás con promociones</span>
            <span className="font-semibold">{formatCurrency(promotions!.total_ahorrado!, currency)}</span>
          </div>
        ) : null}

        <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
          <span className="text-muted-foreground">Total</span>
          <span className="text-2xl font-bold tracking-tight text-foreground">{formatCurrency(finalTotal, currency)}</span>
        </div>

        {showPoints ? (
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground"><Gift className="h-4 w-4" aria-hidden /> Puntos de esta compra</span>
              <span className="font-medium">{derivedTotals.points.toLocaleString('es-AR')}</span>
            </div>
            {redemptionOptions.length > 0 && onRedeemReward ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {redemptionOptions.slice(0, 3).map((item, index) => {
                  const rewardId = String(item.reward_id ?? item.id ?? index);
                  const label = item.label || item.title || item.description || rewardId;
                  const pointCost = item.cost_points ?? item.points;
                  return (
                    <Button key={`${rewardId}-${index}`} type="button" size="sm" variant="outline" className="h-8"
                      disabled={Boolean(item.disabled) || redeemingRewardId === rewardId || rewardsLoading}
                      onClick={() => onRedeemReward(rewardId)}>
                      {redeemingRewardId === rewardId ? '…' : `${label}${typeof pointCost === 'number' ? ` · ${pointCost.toLocaleString('es-AR')} pts` : ''}`}
                    </Button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {checkoutBlockedReason ? (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">{checkoutBlockedReason}</p>
        ) : checkoutOptions?.gateway_hint ? (
          <p className="text-xs text-muted-foreground">{checkoutOptions.gateway_hint}</p>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 pt-0">
        <Button className="w-full" size="lg" onClick={onCheckout} disabled={!items.length || isSubmitting || Boolean(checkoutBlockedReason)}>
          {isSubmitting ? 'Procesando…' : 'Finalizar pedido'}
        </Button>
        {onClearCart && items.length ? (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            onClick={onClearCart}
            disabled={isUpdating}
          >
            Vaciar carrito
          </button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
