import React, { useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MarketCartItem, MarketCheckoutOptions, MarketCheckoutPreview, MarketCommercialState, MarketContinuity, MarketCustomerProfile, MarketRecommendation, MarketRewardsProfile, MarketSuggestedAction } from '@/types/market';
import { formatCurrency } from '@/utils/currency';
import { ArrowRightLeft, Gift, MessageCircle, Phone, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  getCommercialStageLabel,
  getCommercialStageTone,
  getCommercialToneClassName,
  normalizeChannelLabel,
} from '@/utils/orderCommercial';

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
  const stageLabel = getCommercialStageLabel(commercialState?.stage);
  const channelLabel = normalizeChannelLabel(commercialState?.channel || customerProfile?.channel_group || null);
  const contactPhone = customerProfile?.phone?.trim() || customerProfile?.whatsapp?.trim() || null;
  const validSuggestedActions = Array.isArray(suggestedActions) ? suggestedActions.filter((item) => item?.label) : [];
  const validRecommendations = Array.isArray(recommendations) ? recommendations.filter((item) => item?.title || item?.label) : [];
  const redemptionOptions = useMemo(
    () =>
      (rewardsProfile?.available_redemptions ?? []).filter((item) => {
        const rewardId = item.reward_id ?? item.id;
        return rewardId !== null && rewardId !== undefined && (item.label || item.title || item.description);
      }),
    [rewardsProfile?.available_redemptions],
  );

  const formatItemPrice = (item: MarketCartItem) => {
    if (item.priceText) return item.priceText;
    if (typeof item.price === 'number') {
      const amount = item.price * item.quantity;
      return formatCurrency(amount, item.currency ?? currency);
    }
    if (typeof item.points === 'number') return `${item.points * item.quantity} pts`;
    return 'Consultar';
  };

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
        {stageLabel || customerProfile?.name || contactPhone || continuity?.summary || checkoutPreview?.next_step_label || checkoutOptions?.gateway_hint || continuity?.resume_key ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {stageLabel ? (
                <Badge variant="outline" className={getCommercialToneClassName(getCommercialStageTone(commercialState?.stage))}>
                  {stageLabel}
                </Badge>
              ) : null}
              <Badge variant="outline" className="border-border/60 bg-background/80">
                {channelLabel}
              </Badge>
              {commercialState?.supports_handoff ? (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  <ArrowRightLeft className="mr-1 h-3 w-3" /> Handoff disponible
                </Badge>
              ) : null}
            </div>
            {(customerProfile?.name || contactPhone || continuity?.summary || continuity?.resume_key || checkoutPreview?.next_step_label || checkoutOptions?.gateway_hint) ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {customerProfile?.name ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Perfil</p>
                    <p className="mt-1 font-medium text-foreground">{customerProfile.name}</p>
                  </div>
                ) : null}
                {contactPhone ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Canal de contacto</p>
                    <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
                      {(commercialState?.channel || customerProfile?.channel_group) === 'phone' ? <Phone className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                      {contactPhone}
                    </p>
                  </div>
                ) : null}
                {continuity?.summary ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Continuidad</p>
                    <p className="mt-1 font-medium text-foreground">{continuity.summary}</p>
                  </div>
                ) : null}
                {(continuity?.resume_key || checkoutPreview?.next_step_label) ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Checkout</p>
                    {checkoutPreview?.next_step_label ? <p className="mt-1 font-medium text-foreground">{checkoutPreview.next_step_label}</p> : null}
                    {continuity?.resume_key ? <p className="mt-1 text-xs text-muted-foreground">{continuity.resume_key}</p> : null}
                  </div>
                ) : null}
                {checkoutOptions?.gateway_hint ? (
                  <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Gateway</p>
                    <p className="mt-1 font-medium text-foreground">{checkoutOptions.gateway_hint}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {validSuggestedActions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {validSuggestedActions.slice(0, 4).map((action, index) => (
                  <Badge key={`${action.label}-${index}`} variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                    {action.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                <div className="space-y-1">
                  <p className="font-medium leading-snug">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Cantidad: {item.quantity}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase text-muted-foreground">
                    {item.modality ? <span className="font-semibold">{item.modality}</span> : null}
                    {item.points ? <span>{item.points} pts</span> : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                  <span className="text-sm font-semibold text-foreground">{formatItemPrice(item)}</span>
                  {onRemoveItem ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => onRemoveItem(item.id)}
                      disabled={isUpdating}
                    >
                      Quitar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Tu carrito está vacío.</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total</span>
          <span className="text-lg font-semibold">{formatCurrency(derivedTotals.amount, currency)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Puntos</span>
          <span className="font-medium">{derivedTotals.points}</span>
        </div>

        {(rewardsLoading || rewardsProfile) ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Puntos disponibles</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {typeof rewardsProfile?.wallet?.balance === 'number'
                    ? rewardsProfile.wallet.balance.toLocaleString('es-AR')
                    : rewardsLoading
                      ? '...'
                      : '0'}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Gift className="h-5 w-5" />
              </div>
            </div>
            {typeof rewardsProfile?.wallet?.pending_cart_points === 'number' ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Este carrito puede sumar {rewardsProfile.wallet.pending_cart_points.toLocaleString('es-AR')} pts.
              </p>
            ) : null}
            {redemptionOptions.length > 0 ? (
              <div className="mt-3 space-y-2">
                {redemptionOptions.slice(0, 3).map((item, index) => {
                  const rewardId = String(item.reward_id ?? item.id ?? index);
                  const label = item.label || item.title || item.description || rewardId;
                  const pointCost = item.cost_points ?? item.points;
                  return (
                    <div key={`${rewardId}-${index}`} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{label}</p>
                          {item.description && item.description !== label ? (
                            <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                          ) : null}
                          {typeof pointCost === 'number' ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {pointCost.toLocaleString('es-AR')} pts
                            </p>
                          ) : null}
                        </div>
                        {onRedeemReward ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 shrink-0"
                            disabled={Boolean(item.disabled) || redeemingRewardId === rewardId}
                            onClick={() => onRedeemReward(rewardId)}
                          >
                            {redeemingRewardId === rewardId ? '...' : 'Canjear'}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {validRecommendations.length > 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Recomendaciones</p>
            <div className="mt-2 space-y-2">
              {validRecommendations.slice(0, 3).map((item, index) => (
                <div key={`${item.id ?? item.title ?? item.label}-${index}`} className="rounded-xl border border-border/60 bg-background/80 px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{item.title || item.label}</p>
                  {item.description ? <p className="mt-1 text-xs text-muted-foreground">{item.description}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>

      <Separator />

      <CardFooter className="flex flex-col gap-3">
        {onClearCart && items.length ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onClearCart}
            disabled={isUpdating}
          >
            Vaciar carrito
          </Button>
        ) : null}
        {checkoutBlockedReason ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {checkoutBlockedReason}
          </p>
        ) : null}
        <Button className="w-full" size="lg" onClick={onCheckout} disabled={!items.length || isSubmitting || Boolean(checkoutBlockedReason)}>
          {isSubmitting ? 'Procesando...' : 'Finalizar pedido'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Confirma tu pedido y coordinaremos el detalle con el comercio.
        </p>
      </CardFooter>
    </Card>
  );
}
