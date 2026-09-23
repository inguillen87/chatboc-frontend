import { describe, expect, it } from 'vitest';
import { getVerifiedPaymentStatus, shouldRefreshOrder } from './verifiedPaymentStatus';

describe('verified backend payment status', () => {
  it.each(['approved', 'paid', 'pagado', ' PAID '])('recognizes backend settlement %s', (status) => {
    expect(getVerifiedPaymentStatus(status)).toEqual({ label: 'Pago acreditado', tone: 'success', pending: false });
  });
  it.each(['pending', 'pendiente', 'pendiente_pago', 'pending_payment', 'in_process'])('keeps %s pending', (estado) => {
    expect(getVerifiedPaymentStatus(estado).tone).toBe('warning');
    expect(shouldRefreshOrder({ estado })).toBe(true);
  });
  it.each(['authorized', 'autorizado'])('does not equate authorization %s to settlement', (estado) => {
    expect(getVerifiedPaymentStatus(estado).tone).not.toBe('success');
    expect(shouldRefreshOrder({ estado })).toBe(true);
  });
  it.each(['rejected', 'rechazado', 'payment_failed', 'failure', 'cancelled', 'canceled', 'cancelado', 'refunded', 'reembolsado'])('stops after terminal state %s', (estado) => {
    expect(shouldRefreshOrder({ estado })).toBe(false);
    expect(getVerifiedPaymentStatus(estado).tone).not.toBe('success');
  });
  it.each([null, undefined, '', 'unknown', 'entregado', 'status=approved'])('never invents settlement for %s', (status) => {
    expect(getVerifiedPaymentStatus(status).tone).toBe('info');
  });
});
