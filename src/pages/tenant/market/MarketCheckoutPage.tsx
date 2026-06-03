import React, { useEffect, useMemo, useReducer } from 'react';
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
import {
  checkoutReducer,
  createInitialCheckoutState,
  resolveCheckoutOutcome,
  serializeCheckoutState,
  type CheckoutStatus,
} from './checkoutMachine';

const checkoutStateStorageKey = (tenantSlug: string) => `chatboc_market_checkout_state_${tenantSlug}`;

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

  const moveToState = (to: CheckoutStatus, payload?: Record<string, unknown>) => {
    dispatch({ type: 'TRANSITION', to, payload });
    trackFrontendEvent('market_checkout_transition', {
      tenant_slug: tenantSlug,
      to,
      has_items: items.length > 0,
    });
  };

  const retryCheckout = () => {
    moveToState('idle', { error: null, message: null });
  };

  const handleCheckout = async () => {
    moveToState('validating', { error: null, message: null });

    if (items.length === 0) {
      moveToState('error', { error: 'Tu carrito está vacío. Agregá productos para continuar.' });
      return;
    }

    const name = checkoutState.contact.name.trim();
    const phone = checkoutState.contact.phone.trim();
    const requiresContactOrAuth = checkoutOptions?.requires_contact_or_auth ?? true;
    const contactReady = checkoutPreview?.contact_ready === true || Boolean(phone);

    if (requiresContactOrAuth && !contactReady) {
      moveToState('error', { error: 'Necesitamos un teléfono para continuar con el checkout.' });
      return;
    }

    const currentValidation = getMarketCommercialValidation(checkoutOptions, checkoutPreview, ...items);
    if (!currentValidation.canStartCheckout && currentValidation.reason) {
      moveToState('error', { error: currentValidation.reason });
      return;
    }

    const checkoutPayload = {
      items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
      customer: {
        name,
        ...(phone ? { phone } : {}),
      },
    };

    try {
      const preview = await previewPaymentCheckout(tenantSlug, checkoutPayload);
      if (preview?.payment_required && preview.payment_ready === false) {
        const previewExperience = preview.checkout_experience ?? preview.checkout_options?.checkout_experience ?? null;
        moveToState('error', {
          error:
            previewExperience?.copy?.customer_pending_gateway ??
            previewExperience?.copy?.customer_locked ??
            preview.next_step_label ??
            preview.checkout_options?.gateway_hint ??
            'El checkout todavia no esta listo para recibir pagos.',
        });
        return;
      }
      const previewValidation = getMarketCommercialValidation(preview, checkoutOptions, checkoutPreview, ...items);
      if (!previewValidation.canStartCheckout && previewValidation.reason) {
        moveToState('error', { error: previewValidation.reason });
        return;
      }
    } catch (err) {
      moveToState('error', {
        error: err instanceof Error ? err.message : 'No se pudo validar el checkout.',
      });
      return;
    }

    moveToState('creating_order');

    try {
      const response = await startMarketCheckout(tenantSlug, checkoutPayload);

      const outcome = resolveCheckoutOutcome(response);
      moveToState(outcome.status, {
        message: outcome.message,
        paymentUrl: outcome.paymentUrl,
        orderId: outcome.orderId,
        error: null,
      });

      await refreshCart();
    } catch (err) {
      moveToState('error', {
        error: err instanceof Error ? err.message : 'No se pudo iniciar el checkout.',
      });
    }
  };

  useEffect(() => {
    const storageKey = checkoutStateStorageKey(tenantSlug);
    const raw = safeLocalStorage.getItem(storageKey);
    if (!raw) return;
    try {
      dispatch({ type: 'HYDRATE', payload: JSON.parse(raw) });
    } catch {
      // no-op
    }
  }, [tenantSlug]);

  useEffect(() => {
    safeLocalStorage.setItem(checkoutStateStorageKey(tenantSlug), JSON.stringify(serializeCheckoutState(checkoutState)));
  }, [checkoutState, tenantSlug]);

  useEffect(() => {
    if (!checkoutState.contact.name && customerProfile?.name) {
      dispatch({ type: 'SET_CONTACT', payload: { name: customerProfile.name } });
    }
    if (!checkoutState.contact.phone && customerProfile?.phone) {
      dispatch({ type: 'SET_CONTACT', payload: { phone: customerProfile.phone } });
    }
  }, [checkoutState.contact.name, checkoutState.contact.phone, customerProfile?.name, customerProfile?.phone]);

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

      {checkoutState.status === 'error' && checkoutState.error ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos iniciar el checkout</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{checkoutState.error}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={retryCheckout}>Reintentar</Button>
              <Button asChild size="sm" variant="outline">
                <Link to={buildTenantPath('/market', tenantSlug)}>Editar carrito</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      {(checkoutState.status === 'success' || checkoutState.status === 'awaiting_payment') && checkoutState.message ? (
        <Alert>
          <AlertTitle>{checkoutState.status === 'awaiting_payment' ? 'Pago pendiente' : 'Checkout iniciado'}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{checkoutState.message}</p>
            {checkoutState.orderId ? <p className="text-xs text-muted-foreground">Orden: {checkoutState.orderId}</p> : null}
            {checkoutState.paymentUrl ? (
              <Button asChild size="sm">
                <a href={checkoutState.paymentUrl} target="_blank" rel="noreferrer">Continuar al pago</a>
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

        <Card>
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkout-name">Nombre</Label>
              <Input
                id="checkout-name"
                value={checkoutState.contact.name}
                onChange={(e) => dispatch({ type: 'SET_CONTACT', payload: { name: e.target.value } })}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkout-phone">Teléfono</Label>
              <Input
                id="checkout-phone"
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
            <Button className="w-full" onClick={handleCheckout} disabled={isBusy || items.length === 0 || Boolean(checkoutBlockedReason)}>
              {isBusy ? 'Procesando checkout…' : 'Iniciar checkout'}
            </Button>
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
