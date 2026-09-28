import React, { useEffect, useMemo, useReducer, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';

import { MarketCartProvider, useMarketCart } from '@/context/MarketCartContext';
import { previewPaymentCheckout, startMarketCheckout } from '@/api/market';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/utils/currency';
import { buildTenantPath } from '@/utils/tenantPaths';
import CommercialStateCard from '@/components/market/CommercialStateCard';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { trackFrontendEvent } from '@/utils/frontendTelemetry';
import { getMarketCommercialValidation } from '@/utils/marketValidation';
import SecureCheckoutNotice from '@/components/market/SecureCheckoutNotice';
import type { MarketCartItem } from '@/types/market';
import {
  checkoutReducer,
  createInitialCheckoutState,
  resolveCheckoutOutcome,
  type CheckoutStatus,
} from './checkoutMachine';

const checkoutStateStorageKey = (tenantSlug: string) => `chatboc_market_checkout_state_${tenantSlug}`;

const checkoutItemPayload = (item: MarketCartItem) => {
  const catalogoItemId = item.catalogo_item_id ?? item.catalog_item_id ?? item.product_id ?? item.id;
  return {
    id: String(item.id),
    product_id: item.product_id ?? catalogoItemId,
    catalogo_item_id: catalogoItemId,
    catalog_item_id: catalogoItemId,
    quantity: item.quantity,
    cantidad: item.quantity,
  };
};

function CheckoutContent({ tenantSlug }: { tenantSlug: string }) {
  const {
    items,
    totalAmount,
    totalPoints,
    isLoading,
    error,
    refreshCart,
    customerProfile,
    commercialState,
    checkoutOptions,
    checkoutPreview,
  } = useMarketCart();
  const [checkoutState, dispatch] = useReducer(checkoutReducer, undefined, createInitialCheckoutState);
  const outcomeRef = useRef<HTMLDivElement>(null);
  const attempt = useRef({ active: true, busy: false, submitted: false });
  const cartSignature = JSON.stringify(items.map(checkoutItemPayload));
  const latestCart = useRef({ signature: cartSignature, blocked: false });
  latestCart.current = {
    signature: cartSignature,
    blocked: isLoading || Boolean(error) || !getMarketCommercialValidation(checkoutOptions, checkoutPreview, ...items).canStartCheckout,
  };
  useEffect(() => {
    const session = { active: true, busy: false, submitted: false };
    attempt.current = session;
    // Retire the previous browser-state format; never hydrate links or contact PII.
    safeLocalStorage.removeItem(checkoutStateStorageKey(tenantSlug));
    return () => { session.active = false; };
  }, [tenantSlug]);

  const moveToState = (to: CheckoutStatus, payload?: Record<string, unknown>) => {
    dispatch({ type: 'TRANSITION', to, payload });
    trackFrontendEvent('market_checkout_transition', {
      tenant_slug: tenantSlug,
      to,
      has_items: items.length > 0,
    });
  };

  const retryCheckout = () => {
    if (attempt.current.busy || attempt.current.submitted) return;
    moveToState('idle', { error: null, message: null, paymentUrl: null, orderId: null });
  };

  const handleCheckout = async () => {
    const session = attempt.current;
    if (!session.active || session.busy || session.submitted || isLoading || error) return;
    session.busy = true;
    const submittedCart = cartSignature;
    const fail = (message: string | null = null) => {
      if (session.active) moveToState('error', { error: message, message: null, paymentUrl: null, orderId: null });
    };
    moveToState('validating', { error: null, message: null, paymentUrl: null, orderId: null });
    try {
      if (items.length === 0) return fail('Tu carrito está vacío. Agregá productos para continuar.');
      const name = checkoutState.contact.name.trim();
      const phone = checkoutState.contact.phone.trim();
      const requiresContactOrAuth = checkoutOptions?.requires_contact_or_auth ?? true;
      const contactReady = checkoutPreview?.contact_ready === true || Boolean(phone);
      if (requiresContactOrAuth && !contactReady) return fail('Necesitamos un teléfono para continuar con el checkout.');
      const currentValidation = getMarketCommercialValidation(checkoutOptions, checkoutPreview, ...items);
      if (!currentValidation.canStartCheckout) return fail(currentValidation.reason);
      const checkoutPayload = {
        items: items.map(checkoutItemPayload),
        customer: { name, ...(phone ? { phone } : {}) },
      };
      const preview = await previewPaymentCheckout(tenantSlug, checkoutPayload);
      if (!session.active) return;
      if (latestCart.current.signature !== submittedCart || latestCart.current.blocked) return fail();
      if (preview?.payment_required && preview.payment_ready === false) {
        const experience = preview.checkout_experience ?? preview.checkout_options?.checkout_experience;
        return fail(experience?.copy?.customer_pending_gateway ?? experience?.copy?.customer_locked ?? preview.next_step_label ?? preview.checkout_options?.gateway_hint ?? null);
      }
      const validation = getMarketCommercialValidation(preview, checkoutOptions, checkoutPreview, ...items);
      if (!validation.canStartCheckout) return fail(validation.reason);
      // Synchronous gate covers the complete write attempt, including uncertainty.
      // It does not claim server-side idempotency or protect a different browser session.
      session.submitted = true;
      moveToState('creating_order');
      const response = await startMarketCheckout(tenantSlug, checkoutPayload);
      if (!session.active) return;
      const outcome = resolveCheckoutOutcome(response);
      if (outcome.status === 'error') return fail(outcome.message);
      moveToState(outcome.status, {
        message: outcome.message, paymentUrl: outcome.paymentUrl,
        orderId: outcome.orderId, error: null,
      });
      // Cart refresh is not the checkout receipt. Never overwrite a verified
      // result or enable another submission because that ancillary read failed.
      try { await refreshCart(); } catch { /* Existing cart context owns its read error. */ }
    } catch {
      fail();
    } finally {
      session.busy = false;
    }
  };

  useEffect(() => {
    if (!checkoutState.contact.name && customerProfile?.name) {
      dispatch({ type: 'SET_CONTACT', payload: { name: customerProfile.name } });
    }
    if (!checkoutState.contact.phone && customerProfile?.phone) {
      dispatch({ type: 'SET_CONTACT', payload: { phone: customerProfile.phone } });
    }
  }, [checkoutState.contact.name, checkoutState.contact.phone, customerProfile?.name, customerProfile?.phone]);

  useEffect(() => {
    if (['error', 'success', 'awaiting_payment'].includes(checkoutState.status)) {
      outcomeRef.current?.focus({ preventScroll: true });
      outcomeRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    }
  }, [checkoutState.status]);

  const isBusy = checkoutState.status === 'validating' || checkoutState.status === 'creating_order';
  const cartValidation = useMemo(
    () => getMarketCommercialValidation(checkoutOptions, checkoutPreview, ...items),
    [checkoutOptions, checkoutPreview, items],
  );
  const checkoutBlockedReason = cartValidation.canStartCheckout ? null : cartValidation.reason;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Checkout</h1>
          <p className="text-muted-foreground">Revisá tu carrito y completá tus datos de contacto.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={buildTenantPath('/market', tenantSlug)}>Volver al catálogo</Link>
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

      {checkoutState.status === 'error' ? (
        <Alert data-testid="checkout-outcome" ref={outcomeRef} tabIndex={-1} variant="destructive" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <AlertTitle>No pudimos iniciar el checkout</AlertTitle>
          <AlertDescription className="space-y-3">
            {checkoutState.error ? <p>{checkoutState.error}</p> : null}
            <div className="flex flex-wrap gap-2">
              {!attempt.current.submitted ? <Button size="sm" onClick={retryCheckout}>Reintentar</Button> : null}
              <Button asChild size="sm" variant="outline">
                <Link to={buildTenantPath('/market', tenantSlug)}>Editar carrito</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {(checkoutState.status === 'success' || checkoutState.status === 'awaiting_payment') && checkoutState.message ? (
        <Alert data-testid="checkout-outcome" ref={outcomeRef} tabIndex={-1} role="status" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <AlertTitle>{checkoutState.status === 'awaiting_payment' ? 'Pago pendiente' : 'Checkout iniciado'}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{checkoutState.message}</p>
            {checkoutState.orderId ? <p className="text-xs text-muted-foreground">Orden: {checkoutState.orderId}</p> : null}
            {checkoutState.paymentUrl ? (
              <Button asChild size="sm">
                <a href={checkoutState.paymentUrl} target="_blank" rel="noopener noreferrer">Continuar al pago</a>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {customerProfile || commercialState ? (
        <CommercialStateCard customerProfile={customerProfile} commercialState={commercialState} />
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

        <form aria-labelledby="checkout-contact-title" onSubmit={(event) => { event.preventDefault(); void handleCheckout(); }}>
        <Card>
          <CardHeader>
            <CardTitle id="checkout-contact-title">Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkout-name">Nombre</Label>
              <Input
                id="checkout-name"
                autoComplete="name"
                disabled={isBusy || attempt.current.submitted}
                value={checkoutState.contact.name}
                onChange={(e) => dispatch({ type: 'SET_CONTACT', payload: { name: e.target.value } })}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-phone">Teléfono</Label>
              <Input
                id="checkout-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                disabled={isBusy || attempt.current.submitted}
                value={checkoutState.contact.phone}
                onChange={(e) => dispatch({ type: 'SET_CONTACT', payload: { phone: e.target.value } })}
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
            <SecureCheckoutNotice
              checkoutOptions={checkoutOptions}
              checkoutPreview={checkoutPreview}
              blockedReason={checkoutBlockedReason}
              compact
            />
            <Button type="submit" className="w-full" disabled={isBusy || attempt.current.submitted || isLoading || Boolean(error) || items.length === 0 || Boolean(checkoutBlockedReason)}>
              {isBusy ? 'Procesando checkout…' : 'Iniciar checkout'}
            </Button>
          </CardFooter>
        </Card>
        </form>
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
    <MarketCartProvider key={tenantSlug} tenantSlug={tenantSlug}>
      <CheckoutContent key={tenantSlug} tenantSlug={tenantSlug} />
    </MarketCartProvider>
  );
}
