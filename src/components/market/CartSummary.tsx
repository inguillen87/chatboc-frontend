import React, { useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MarketCartItem, MarketCheckoutPreview, MarketCommercialState, MarketContinuity, MarketCustomerProfile, MarketRecommendation, MarketSuggestedAction } from '@/types/market';
import { formatCurrency } from '@/utils/currency';
import { ArrowRightLeft, MessageCircle, Phone, ShoppingCart } from 'lucide-react';
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
        {stageLabel || customerProfile?.name || contactPhone || continuity?.summary || checkoutPreview?.next_step_label || continuity?.resume_key ? (
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
            {(customerProfile?.name || contactPhone || continuity?.summary || continuity?.resume_key || checkoutPreview?.next_step_label) ? (
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
        <Button className="w-full" size="lg" onClick={onCheckout} disabled={!items.length || isSubmitting}>
          {isSubmitting ? 'Procesando...' : 'Finalizar pedido'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Confirma tu pedido y coordinaremos el detalle con el comercio.
        </p>
      </CardFooter>
    </Card>
  );
}
