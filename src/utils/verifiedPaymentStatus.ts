export type PaymentTone = 'success' | 'warning' | 'error' | 'info';
export type VerifiedPaymentStatus = { label: string; tone: PaymentTone; pending: boolean };

/** Input is an authorized backend response, never a query-string assertion. */
export function getVerifiedPaymentStatus(status?: string | null): VerifiedPaymentStatus {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (['approved', 'paid', 'pagado'].includes(value)) {
    return { label: 'Pago acreditado', tone: 'success', pending: false };
  }
  if (['pending', 'pendiente', 'pendiente_pago', 'pending_payment', 'in_process'].includes(value)) {
    return { label: 'Pago pendiente de acreditación', tone: 'warning', pending: true };
  }
  if (['rejected', 'rechazado', 'payment_failed', 'failure'].includes(value)) {
    return { label: 'Pago rechazado', tone: 'error', pending: false };
  }
  if (['cancelled', 'canceled', 'cancelado'].includes(value)) {
    return { label: 'Pago cancelado', tone: 'info', pending: false };
  }
  if (['refunded', 'reembolsado'].includes(value)) {
    return { label: 'Pago reembolsado', tone: 'info', pending: false };
  }
  if (['authorized', 'autorizado'].includes(value)) {
    return { label: 'Pago autorizado, aún no acreditado', tone: 'info', pending: true };
  }
  return { label: 'Estado de pago por verificar', tone: 'info', pending: !value };
}

export const shouldRefreshOrder = (order: { estado?: string | null }) =>
  getVerifiedPaymentStatus(order.estado).pending;
