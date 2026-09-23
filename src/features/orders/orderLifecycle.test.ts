import { describe, expect, it } from 'vitest';
import { assertOrderReceipt, orderLifecycle } from './orderLifecycle';
import { parsePublicOrder, publicOrderBranding, publicOrderPoint, publicOrderPrivacy } from './publicOrderView';

describe('independent order lifecycle', () => {
  it.each(['confirmed', 'confirmado', 'shipped', 'enviado', 'delivered', 'entregado', 'completed'])('never infers payment from %s', (status) => {
    expect(orderLifecycle({ status, total: 1200, preference_id: 'pref', mp_payment_id: '123', commercial_stage: 'completed' }).payment.label).toBe('Pago no informado');
  });
  it.each(['paid', 'pagado'])('marks %s as an order signal, not independent provider proof', (status) => {
    const value = orderLifecycle({ status });
    expect(value.payment.source).toContain('sin verificación independiente'); expect(value.delivery.known).toBe(false);
  });
  it('does not treat a missing state as pending, received or complete', () => {
    const value = orderLifecycle({}); expect(value.order.label).toBe('Estado no informado');
    expect(value.payment.label).toBe('Pago no informado'); expect(value.delivery.label).toBe('Entrega no informada');
  });
  it.each(['toString', '__proto__', 'a_new_state', 12, null])('handles unsupported status %s without crashing', (status) => expect(orderLifecycle({ status }).order.known).toBe(false));
  it('uses explicit provider status without deriving delivery', () => {
    const value = orderLifecycle({ status: 'confirmed', metadata: { payment: { mp_status: 'approved' } } });
    expect(value.payment.label).toBe('Aprobado'); expect(value.delivery.known).toBe(false);
  });
  it('does not turn an unrecognized provider state into a successful legacy payment', () => {
    expect(orderLifecycle({ status: 'paid', mp_status: 'future_status' }).payment.known).toBe(false);
  });
  it('does not choose success when provider fields disagree', () => {
    const value = orderLifecycle({ status: 'paid', mp_status: 'approved', metadata: { payment: { mp_status: 'refunded' } } });
    expect(value.payment.known).toBe(false); expect(value.payment.label).toBe('Pago por verificar'); expect(value.attention.join()).toMatch(/contradictorios/);
  });
  it('distinguishes authorized from captured', () => expect(orderLifecycle({ mp_status: 'authorized' }).payment.tone).toBe('warning'));
  it('warns that cancellation does not prove a refund', () => expect(orderLifecycle({ status: 'cancelled', mp_status: 'approved' }).attention.join()).toMatch(/reintegro/));
  it('warns about a delivered order with a payment failure', () => expect(orderLifecycle({ status: 'delivered', mp_status: 'rejected' }).attention.join()).toMatch(/incidencia/));
  it('does not claim physical delivery from the generic completed state', () => expect(orderLifecycle({ status: 'completed' }).delivery.known).toBe(false));
  it('validates exact source-prefixed ID and status receipt', () => {
    expect(() => assertOrderReceipt({ id: 'market:42', status: 'shipped' }, 'market:42', 'shipped')).not.toThrow();
    expect(() => assertOrderReceipt({ id: 'conversational:42', status: 'shipped' }, 'market:42', 'shipped')).toThrow();
    expect(() => assertOrderReceipt({ id: 'market:42', status: 'confirmed' }, 'market:42', 'shipped')).toThrow();
  });
  it.each([{}, { ok: true }, { id: 'market:42' }, null])('rejects incomplete write receipt', (receipt) => expect(() => assertOrderReceipt(receipt, 'market:42', 'shipped')).toThrow());
  it('rejects an explicitly foreign tenant receipt', () => {
    expect(() => assertOrderReceipt({ id: 'market:42', status: 'shipped', tenant_slug: 'other' }, 'market:42', 'shipped', 'junin')).toThrow();
    expect(() => assertOrderReceipt({ id: 'market:42', status: 'shipped', tenant: { slug: 'other' } }, 'market:42', 'shipped', 'junin')).toThrow();
  });
});
describe('public order boundary', () => {
  it('rejects a different visible reference or tracking identity', () => {
    expect(() => parsePublicOrder({ nro_pedido: 'A' }, 'B')).toThrow();
    expect(() => parsePublicOrder({ nro_pedido: 'A', tracking_id: 'B' }, 'A')).toThrow();
  });
  it('omits non-scalar SKUs and invalid support tenant identifiers', () => {
    const value = parsePublicOrder({ nro_pedido: 'A', tenant_slug: '../other', detalles: [{ sku: { unsafe: true } }] }, 'A');
    expect(value.detalles[0].sku).toBeUndefined(); expect(value.tenant_slug).toBeUndefined();
    expect(parsePublicOrder({ nro_pedido: 'A', tenant_slug: 'org-a', detalles: [{ sku: ' SKU-1 ' }] }, 'A').detalles[0].sku).toBe('SKU-1');
  });
  it('normalizes details without mutating the transport response', () => {
    const raw = { nro_pedido: 'A', detalles: '[{"nombre_producto":"Caja"},null,3]' };
    expect(parsePublicOrder(raw, 'A').detalles).toHaveLength(1); expect(typeof raw.detalles).toBe('string');
    expect(parsePublicOrder({ nro_pedido: 'A', detalles: '{bad' }, 'A').detalles).toEqual([]);
  });
  it.each([{ lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: '', lng: '' }, { lat: false, lng: false }, { lat: '0x40', lng: '0' }, { lat: NaN, lng: 0 }])('rejects invalid map coordinates', (point) => expect(publicOrderPoint(point, 'Destino')).toBeNull());
  it('accepts actual zero coordinates and supported aliases', () => {
    expect(publicOrderPoint({ lat: 0, lng: 0 }, 'Destino')).toEqual({ lat: 0, lng: 0, name: 'Destino' });
    expect(publicOrderPoint({ latitud: '-54.8', longitud: '-68.3' }, 'Destino')?.lat).toBe(-54.8);
  });
  it('redaction wins over accidental private contact fields and coordinates', () => {
    expect(publicOrderPrivacy({ nombre_cliente: 'Private Name', privacy: { pii_redacted: true }, telefono_cliente: '123' })).toMatchObject({ phone: true, coordinates: true, address: true, name: true });
    expect(publicOrderPrivacy({})).toMatchObject({ phone: true, coordinates: true });
  });
  it('honors field-level location redaction even when full redaction is false', () => expect(publicOrderPrivacy({ privacy: { pii_redacted: false, redacted_fields: ['driver_location'] } }).coordinates).toBe(true));
  it('preserves valid institutional branding and rejects executable or unsupported URLs', () => {
    expect(publicOrderBranding({ tenant_theme: { primaryColor: '#036', secondaryColor: '#112233' }, tenant_logo: '/logo.svg' })).toEqual({ primary: '#036', secondary: '#112233', logo: '/logo.svg' });
    expect(publicOrderBranding({ branding: { primaryColor: 'red;display:none', logo_url: 'javascript:alert(1)' } })).toEqual({ primary: null, secondary: null, logo: null });
  });
});
