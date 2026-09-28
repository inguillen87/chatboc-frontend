import { describe, expect, it, vi } from 'vitest';

import {
  checkoutReducer,
  createInitialCheckoutState,
  hydrateCheckoutState,
  resolveCheckoutOutcome,
  serializeCheckoutState,
} from './checkoutMachine';

describe('checkoutMachine', () => {
  it('handles explicit reducer transitions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T10:00:00.000Z'));

    const initial = createInitialCheckoutState();
    const next = checkoutReducer(initial, { type: 'TRANSITION', to: 'validating' });
    expect(next.status).toBe('validating');
    expect(next.updatedAt).toBe('2026-04-18T10:00:00.000Z');

    vi.useRealTimers();
  });

  it('retires unverified persisted checkout state after refresh', () => {
    const hydrated = hydrateCheckoutState({
      status: 'awaiting_payment',
      paymentUrl: 'https://pay.example.com/session',
      orderId: 'ORD-123',
      contact: { name: 'Ana', phone: '+54911' },
      message: 'Continuar pago',
      updatedAt: '2026-04-18T09:59:59.000Z',
    });

    expect(hydrated.status).toBe('idle');
    expect(hydrated.paymentUrl).toBeNull();
    expect(hydrated.orderId).toBeNull();
    expect(hydrated.contact).toEqual({name:'',phone:''});

    const persisted = serializeCheckoutState(hydrated);
    expect(persisted).toEqual({});
  });

  it('supports retry flow after temporary failure', () => {
    const initial = createInitialCheckoutState();
    const failed = checkoutReducer(initial, {
      type: 'TRANSITION',
      to: 'error',
      payload: { error: 'timeout' },
    });
    expect(failed.status).toBe('error');

    const retried = checkoutReducer(failed, {
      type: 'TRANSITION',
      to: 'creating_order',
      payload: { error: null },
    });

    expect(retried.status).toBe('creating_order');
    expect(retried.error).toBeNull();
  });

  it('resets transient persisted statuses during hydration', () => {
    const validating = hydrateCheckoutState({
      status: 'validating',
      message: 'Validando stock',
    });
    expect(validating.status).toBe('idle');
    expect(validating.message).toBeNull();

    const creatingOrder = hydrateCheckoutState({
      status: 'creating_order',
      error: 'timeout',
    });
    expect(creatingOrder.status).toBe('idle');
    expect(creatingOrder.error).toBeNull();
  });

  it('normalizes API response to awaiting_payment or success', () => {
    const awaiting = resolveCheckoutOutcome({
      status: 'pending',
      init_point: 'https://mercadopago.example.com/pay',
      order_id: '001',
    });
    expect(awaiting.status).toBe('awaiting_payment');
    expect(awaiting.paymentUrl).toContain('mercadopago');

    const success = resolveCheckoutOutcome({ status: 'confirmed', order_id: '002' });
    expect(success.status).toBe('success');
    expect(success.orderId).toBe('002');
  });

  it('does not expose payment url when backend did not validate stock or amount', () => {
    const unsafe = resolveCheckoutOutcome({
      status: 'pending',
      init_point: 'https://mercadopago.example.com/pay',
      order_id: '003',
      amount_validated: false,
      stock_status: 'stock_unknown',
    });

    expect(unsafe.status).toBe('awaiting_payment');
    expect(unsafe.paymentUrl).toBeNull();
  });
});
