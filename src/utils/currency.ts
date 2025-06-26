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
