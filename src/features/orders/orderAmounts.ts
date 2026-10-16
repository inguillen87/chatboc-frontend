import type { OrderAmountEvidence, OrderItemAmountEvidence, PublishedValue } from '@/types/orderAmounts';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const missing = <T,>(): PublishedValue<T> => ({state:'missing',value:null});
const canonicalDecimal = (value: string): string => {
  const [whole, fraction=''] = value.split('.');
  const tail = fraction.replace(/0+$/, '');
  return (whole.replace(/^0+(?=\d)/, '') || '0') + (tail ? '.' + tail : '');
};
const expandedNumber = (value: number): string => {
  const text = String(value);
  if (!text.includes('e')) return text;
  const [mantissa, exponent] = text.split('e');
  const [whole, fraction=''] = mantissa.split('.');
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  if (point <= 0) return '0.' + '0'.repeat(-point) + digits;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return digits.slice(0, point) + '.' + digits.slice(point);
};

// Canonical decimal strings only: no locale guessing, boolean coercion or loss
// of significant decimal digits. Values outside safe display precision are not money.
export function publishedNonNegativeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER && (value === 0 || value >= 1e-20) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text.length > 128 || !/^\d+(?:\.\d+)?$/.test(text)) return null;
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > Number.MAX_SAFE_INTEGER || (numeric !== 0 && numeric < 1e-20)) return null;
  return canonicalDecimal(expandedNumber(numeric)) === canonicalDecimal(text) ? numeric : null;
}

function resolvePublished<T>(values: unknown[], parse: (value: unknown) => T | null): PublishedValue<T> {
  const supplied = values.filter(value => value !== undefined && value !== null);
  if (!supplied.length) return missing<T>();
  const parsed = supplied.map(parse);
  if (parsed.some(value => value === null)) return {state:'invalid',value:null};
  if (new Set(parsed).size !== 1) return {state:'conflicting',value:null};
  return {state:'reported',value:parsed[0]!};
}
const currencyCode = (value: unknown): string | null =>
  typeof value === 'string' && /^[a-z]{3}$/i.test(value.trim()) ? value.trim().toUpperCase() : null;
const numbers = (values: unknown[]) => resolvePublished(values, publishedNonNegativeNumber);
const currencies = (values: unknown[]) => resolvePublished(values, currencyCode);

export function assessOrderAmounts(value: unknown): OrderAmountEvidence {
  const source = record(value), totals = record(source.totals);
  return {
    total:numbers([source.total, totals.monetary, totals.total]),
    currency:currencies([source.currency, source.currency_id, totals.currency]),
  };
}
export function assessOrderItemAmounts(value: unknown, orderCurrency?: PublishedValue<string>): OrderItemAmountEvidence {
  const item = record(value);
  const currency = currencies([item.currency, item.currency_id]);
  return {
    quantity:numbers([item.quantity, item.cantidad]),
    price:numbers([item.price, item.unit_price, item.precio_float, item.precio]),
    // Subtotal is authoritative: discounts may make it differ from price * quantity.
    // Missing subtotal is never reconstructed, even when quantity and price exist.
    subtotal:numbers([item.subtotal]),
    currency:currency.state === 'missing' ? orderCurrency ?? currency : currency,
  };
}
export function assessPublicOrderAmounts(value: unknown): OrderAmountEvidence {
  const source = record(value);
  return { total:numbers([source.monto_total]), currency:currencies([source.moneda, source.currency, source.currency_id]) };
}
export function assessPublicOrderItemAmounts(value: unknown, orderCurrency?: PublishedValue<string>): OrderItemAmountEvidence {
  const item = record(value);
  const currency = currencies([item.moneda]);
  return {
    quantity:numbers([item.cantidad]),
    price:numbers([item.precio_unitario_original]),
    subtotal:numbers([item.subtotal_con_descuento]),
    currency:currency.state === 'missing' ? orderCurrency ?? currency : currency,
  };
}

export const orderAmountEvidence = (order: {amount_evidence?: OrderAmountEvidence}): OrderAmountEvidence =>
  order.amount_evidence ?? assessOrderAmounts(order);
export const orderItemAmountEvidence = (item: {amount_evidence?: OrderItemAmountEvidence}, currency?: PublishedValue<string>): OrderItemAmountEvidence =>
  item.amount_evidence ?? assessOrderItemAmounts(item, currency);

const numberLabel = (value: number) => new Intl.NumberFormat('es-AR', {maximumFractionDigits:20}).format(value);
export function formatPublishedAmount(amount: PublishedValue<number>, currency: PublishedValue<string>): string {
  if (amount.state === 'missing') return 'Importe no informado';
  if (amount.state !== 'reported' || amount.value === null) return 'Importe a revisar';
  if (currency.state !== 'reported' || !currency.value) {
    return numberLabel(amount.value) + ' · ' + (currency.state === 'missing' ? 'Moneda no informada' : 'Moneda a revisar');
  }
  return new Intl.NumberFormat('es-AR', {style:'currency',currency:currency.value,currencyDisplay:'code',maximumFractionDigits:20}).format(amount.value);
}
export function formatPublishedQuantity(quantity: PublishedValue<number>): string {
  if (quantity.state === 'missing') return 'Cantidad no informada';
  if (quantity.state !== 'reported' || quantity.value === null) return 'Cantidad a revisar';
  return numberLabel(quantity.value);
}
export function formatOrderTotal(order: {amount_evidence?: OrderAmountEvidence}): string {
  const evidence = orderAmountEvidence(order);
  return formatPublishedAmount(evidence.total, evidence.currency);
}


/** Sum reported totals per currency without floating-point addition or conversion. */
export function summarizeOrderAmounts(orders: Array<{amount_evidence?:OrderAmountEvidence}>) {
  const groups = new Map<string,{units:bigint;scale:number;count:number}>();
  let missingCount=0,reviewCount=0;
  for (const order of orders) {
    const evidence=orderAmountEvidence(order);
    if ([evidence.total.state,evidence.currency.state].some(state=>state==='invalid'||state==='conflicting')) { reviewCount++; continue; }
    if (evidence.total.value===null || evidence.currency.value===null) { missingCount++; continue; }
    const [whole,fraction='']=expandedNumber(evidence.total.value).split('.');
    const entry=groups.get(evidence.currency.value)??{units:0n,scale:0,count:0};
    const scale=Math.max(entry.scale,fraction.length);
    const units=BigInt(whole+fraction);
    entry.units=entry.units*10n**BigInt(scale-entry.scale)+units*10n**BigInt(scale-fraction.length);
    entry.scale=scale;entry.count++;groups.set(evidence.currency.value,entry);
  }
  return {totalCount:orders.length,missingCount,reviewCount,includedCount:orders.length-missingCount-reviewCount,
    groups:[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([currency,entry])=>{
      const factor=10n**BigInt(entry.scale),whole=entry.units/factor;
      const fraction=entry.scale?(entry.units%factor).toString().padStart(entry.scale,'0').replace(/0+$/,''):'';
      const minimum=new Intl.NumberFormat('es-AR',{style:'currency',currency}).resolvedOptions().minimumFractionDigits;
      const tail=fraction.padEnd(minimum,'0');
      return {currency,count:entry.count,label:currency+' '+whole.toLocaleString('es-AR')+(tail?','+tail:'')};
    })};
}

export function assessWidgetOrderAmounts(value:unknown):OrderAmountEvidence {
  const source=record(value),totals=record(source.totals);
  return {total:numbers([source.monto_total,source.total,totals.total,totals.monetary]),currency:currencies([source.moneda,source.currency,source.currency_id,totals.currency])};
}
export function assessWidgetOrderItemAmounts(value:unknown,orderCurrency?:PublishedValue<string>):OrderItemAmountEvidence {
  const item=record(value),currency=currencies([item.moneda,item.currency,item.currency_id]);
  return {quantity:numbers([item.quantity,item.cantidad,item.qty]),price:numbers([item.price,item.precio,item.unit_price]),subtotal:numbers([item.subtotal]),currency:currency.state==='missing'?orderCurrency??currency:currency};
}
