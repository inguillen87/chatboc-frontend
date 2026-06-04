import { describe, expect, it } from 'vitest';

import { getMarketCommercialValidation } from './marketValidation';

describe('getMarketCommercialValidation', () => {
  it('blocks checkout when backend marks stock as unknown or unavailable', () => {
    expect(getMarketCommercialValidation({ stock_status: 'stock_unknown' })).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'Stock a confirmar por backend.',
    });

    expect(getMarketCommercialValidation({ stock_status: 'out_of_stock' })).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'Sin stock confirmado.',
    });
  });

  it('blocks confirmed purchase when amount is not backend validated', () => {
    expect(getMarketCommercialValidation({ amount_validated: false })).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'Monto a validar por backend.',
    });
  });

  it('allows confirmed purchase only with explicit backend validation', () => {
    expect(
      getMarketCommercialValidation({
        amount_validated: true,
        stock_status: 'validated',
        available_to_sell: true,
      }),
    ).toMatchObject({
      canStartCheckout: true,
      canConfirmPurchase: true,
      reason: null,
    });
  });

  it('honors demo inventory policy that disables real orders', () => {
    expect(
      getMarketCommercialValidation({
        inventory_policy: {
          confirm_orders: false,
        },
      }),
    ).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'Esta demo no confirma pedidos reales.',
    });
  });

  it('blocks checkout when the tenant plan does not allow payment integrations', () => {
    expect(
      getMarketCommercialValidation({
        checkout_options: {
          checkout_experience: {
            ready: false,
            reason_code: 'plan_full_required',
            copy: {
              customer_locked: 'Plan Full requerido para cobrar desde WhatsApp o widget.',
            },
            integration_access: {
              enabled: false,
            },
          },
        },
      }),
    ).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'Plan Full requerido para cobrar desde WhatsApp o widget.',
    });
  });

  it('blocks checkout when backend returns the shared plan_required frontend contract', () => {
    expect(
      getMarketCommercialValidation({
        ok: false,
        error: 'plan_required',
        reason_code: 'plan_full_required',
        action_hint: 'upgrade_full_plan',
        message: 'Plan Full requerido para cobrar desde WhatsApp, widget o checkout publico.',
        frontend_contract: {
          render_as: 'payment_integration_locked',
        },
      }),
    ).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'Plan Full requerido para cobrar desde WhatsApp, widget o checkout publico.',
    });
  });

  it('blocks online checkout when the payment gateway is not configured', () => {
    expect(
      getMarketCommercialValidation({
        payment_required: true,
        checkout_experience: {
          ready: false,
          reason_code: 'payment_gateway_not_configured',
          gateway: {
            configured: false,
            provider_label: 'Mercado Pago',
          },
          copy: {
            customer_pending_gateway: 'Mercado Pago pendiente de configurar para cobrar online.',
          },
        },
      }),
    ).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'Mercado Pago pendiente de configurar para cobrar online.',
    });
  });

  it('allows checkout when stock, amount and payment contract are ready', () => {
    expect(
      getMarketCommercialValidation({
        amount_validated: true,
        stock_status: 'validated',
        available_to_sell: true,
        payment_required: true,
        checkout_experience: {
          ready: true,
          gateway: {
            configured: true,
          },
          policy: {
            card_data_in_chat: false,
            confirmation_source: 'server_to_server_webhook',
            webhook_required_for_paid_state: true,
          },
          integration_access: {
            enabled: true,
          },
        },
      }),
    ).toMatchObject({
      canStartCheckout: true,
      canConfirmPurchase: true,
      reason: null,
    });
  });

  it('blocks unsafe payment contracts even when a stale payload says ready', () => {
    expect(
      getMarketCommercialValidation({
        payment_required: true,
        checkout_experience: {
          ready: true,
          gateway: { configured: true },
          policy: {
            card_data_in_chat: true,
            confirmation_source: 'client_return',
            webhook_required_for_paid_state: false,
          },
        },
      }),
    ).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'Por seguridad, Chatboc no permite capturar datos de tarjeta dentro del chat.',
    });
  });

  it('blocks payment contracts that trust client returns instead of provider webhooks', () => {
    expect(
      getMarketCommercialValidation({
        payment_required: true,
        checkout_experience: {
          ready: true,
          gateway: { configured: true },
          policy: {
            card_data_in_chat: false,
            confirmation_source: 'client_return',
            webhook_required_for_paid_state: true,
          },
        },
      }),
    ).toMatchObject({
      canStartCheckout: false,
      canConfirmPurchase: false,
      reason: 'El pago debe confirmarse por webhook del proveedor antes de marcar la orden como pagada.',
    });
  });
});
