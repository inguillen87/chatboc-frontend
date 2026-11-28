import { LOCALE } from '../config';

/**
 * Format a numeric value as currency using Intl.NumberFormat.
 * Falls back to a simple "$" prefix when formatting fails.
 */
export function formatCurrency(value: number | string, currency = 'ARS'): string {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[^0-9.,]/g, '').replace(',', '.'));
  if (isNaN(num)) return String(value);
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(num);
  } catch {
    return `$${num}`;
  }
}

/**
 * The price a shopper reads. A written price («Desde $ 900 por kilo») is kept as
 * written; a bare imported number («2900») gets its currency and separators.
 */
export function displayMarketPrice(
  priceText: string | null | undefined,
  price: number | null | undefined,
  currency = 'ARS',
): string | null {
  const text = typeof priceText === 'string' ? priceText.trim() : '';
  const bare = /^\d+(?:[.,]\d{1,2})?$/.test(text);
  if (text && !bare) return text;
  const amount = typeof price === 'number' && Number.isFinite(price) ? price : bare ? Number(text.replace(',', '.')) : NaN;
  return Number.isFinite(amount) ? formatCurrency(amount, (currency || 'ARS').toUpperCase()) : null;
}
