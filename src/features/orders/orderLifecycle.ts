/** Presentation only. Fulfillment never proves payment, and absence is not "pending". */
export type LifecycleTone = 'neutral' | 'active' | 'success' | 'warning' | 'danger';
export interface LifecycleSignal { key: string; label: string; tone: LifecycleTone; source: string; known: boolean }
export interface OrderLifecycle { order: LifecycleSignal; payment: LifecycleSignal; delivery: LifecycleSignal; attention: string[] }
export const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
type Labels = Record<string, [string, LifecycleTone]>;
const ORDER: Labels = {
  nuevo: ['Recibido', 'active'], open: ['Recibido', 'active'], submitted: ['Recibido', 'active'], recibido: ['Recibido', 'active'],
  pending: ['Pendiente de confirmación', 'warning'], pendiente: ['Pendiente de confirmación', 'warning'],
  confirmed: ['Confirmado', 'active'], confirmado: ['Confirmado', 'active'],
  pending_payment: ['A la espera del pago', 'warning'], pendiente_pago: ['A la espera del pago', 'warning'],
  paid: ['Pago informado', 'active'], pagado: ['Pago informado', 'active'],
  processing: ['En preparación', 'active'], preparing: ['En preparación', 'active'], preparando: ['En preparación', 'active'], en_proceso: ['En preparación', 'active'],
  shipped: ['Enviado', 'active'], enviado: ['Enviado', 'active'], en_camino: ['En camino', 'active'],
  delivered: ['Entregado', 'success'], entregado: ['Entregado', 'success'],
  completed: ['Completado', 'success'], completado: ['Completado', 'success'],
  cancelled: ['Cancelado', 'danger'], canceled: ['Cancelado', 'danger'], cancelado: ['Cancelado', 'danger'],
};
const PAYMENT: Labels = {
  approved: ['Aprobado', 'success'], paid: ['Pagado', 'success'], pagado: ['Pagado', 'success'],
  pending: ['Pendiente', 'warning'], pending_payment: ['Pendiente', 'warning'], pendiente_pago: ['Pendiente', 'warning'],
  in_process: ['En revisión', 'warning'], in_mediation: ['En mediación', 'warning'], authorized: ['Autorizado, no capturado', 'warning'],
  rejected: ['Rechazado', 'danger'], failed: ['Fallido', 'danger'], payment_failed: ['Fallido', 'danger'],
  cancelled: ['Cancelado', 'danger'], canceled: ['Cancelado', 'danger'], refunded: ['Reintegrado', 'neutral'],
  charged_back: ['Contracargo', 'danger'], partially_refunded: ['Reintegro parcial', 'warning'],
};
const DELIVERY: Labels = {
  processing: ['En preparación', 'active'], preparing: ['En preparación', 'active'], preparando: ['En preparación', 'active'], en_proceso: ['En preparación', 'active'],
  shipped: ['Enviado', 'active'], enviado: ['Enviado', 'active'], en_camino: ['En camino', 'active'],
  delivered: ['Entregado', 'success'], entregado: ['Entregado', 'success'],
};
function signal(value: unknown, labels: Labels, source: string, empty: string): LifecycleSignal {
  const key = text(value);
  const entry = Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : undefined;
  return { key, label: entry?.[0] || (key ? 'Estado no reconocido' : empty), tone: entry?.[1] || 'neutral', source: key ? source : '', known: Boolean(entry) };
}
export function orderLifecycle(value: unknown): OrderLifecycle {
  const data = record(value), metadata = record(data.metadata), storedPayment = record(metadata.payment);
  const raw = typeof data.status === 'string' ? data.status : data.estado;
  const order = signal(raw, ORDER, 'Estado del pedido', 'Estado no informado');
  // Only explicit provider fields from existing order metadata. Do not trust commercial stage or a preference/payment ID as proof.
  const providerValues = [data.mp_status, storedPayment.mp_status, metadata.mp_status].map(text).filter(Boolean);
  const provider = providerValues[0];
  const conflictingPayment = new Set(providerValues).size > 1;
  let payment = signal(provider, PAYMENT, 'Estado del proveedor publicado por el servidor', 'Pago no informado');
  if (!text(provider) && ['paid', 'pagado', 'pending_payment', 'pendiente_pago'].includes(text(raw))) {
    payment = signal(raw, PAYMENT, 'Estado general del pedido; sin verificación independiente del pago', 'Pago no informado');
  }
  const delivery = signal(Object.prototype.hasOwnProperty.call(DELIVERY, text(raw)) ? raw : '', DELIVERY, 'Estado general del pedido', 'Entrega no informada');
  const attention: string[] = [];
  if (conflictingPayment) {
    payment = { key: '', label: 'Pago por verificar', tone: 'warning', source: 'La respuesta incluye estados de proveedor distintos', known: false };
    attention.push('Hay estados de pago contradictorios. Verificá el registro antes de cobrar o devolver.');
  }
  if (!order.known) attention.push('El servicio no informó un estado de pedido reconocido.');
  if (['cancelled', 'canceled', 'cancelado'].includes(order.key) && payment.tone === 'success') {
    attention.push('Pedido cancelado con pago informado. Revisá la devolución: cancelar no acredita un reintegro.');
  }
  if (delivery.tone === 'success' && payment.tone === 'danger') attention.push('Entrega informada con incidencia de pago. Revisá ambos registros.');
  return { order, payment, delivery, attention };
}
export function assertOrderReceipt(value: unknown, id: string, expectedStatus?: string, tenantSlug?: string): void {
  const data = record(value);
  const foreignTenant = tenantSlug && ((data.tenant_slug !== undefined && data.tenant_slug !== tenantSlug) || (record(data.tenant).slug !== undefined && record(data.tenant).slug !== tenantSlug));
  if (foreignTenant || (typeof data.id !== 'string' && typeof data.id !== 'number') || String(data.id) !== id ||
      typeof data.status !== 'string' || !data.status.trim() || (expectedStatus && data.status !== expectedStatus)) {
    throw new Error('El servidor no confirmó la identidad y el estado de este pedido.');
  }
}
