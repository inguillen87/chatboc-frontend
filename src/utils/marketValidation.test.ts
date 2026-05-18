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
});
