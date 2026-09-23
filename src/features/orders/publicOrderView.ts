import type { PublicOrderTrackingResponse } from '@/types/tracking';
import { record } from './orderLifecycle';
export const publicOrderText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function parsePublicOrder(value: unknown, code: string): PublicOrderTrackingResponse {
  const data = record(value);
  if (data.nro_pedido !== code || (data.tracking_id !== undefined && data.tracking_id !== code)) throw new Error('El pedido recibido no corresponde a esta referencia.');
  let details = data.detalles;
  if (typeof details === 'string') { try { details = JSON.parse(details); } catch { details = []; } }
  const tenantSlug = publicOrderText(data.tenant_slug);
  const items = Array.isArray(details) ? details.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item)) : [];
  // Malformed display keys do not reach JSX; missing money and quantities stay missing.
  return { ...data, tenant_slug: /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(tenantSlug) ? tenantSlug : undefined,
    detalles: items.map((item) => ({ ...item, sku: publicOrderText(item.sku) || undefined })) } as unknown as PublicOrderTrackingResponse;
}
export function publicOrderPoint(value: unknown, name: string): { lat: number; lng: number; name: string } | null {
  const point = record(value);
  const numeric = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && /^[-+]?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  const lat = numeric(point.latitud ?? point.lat ?? point.latitude), lng = numeric(point.longitud ?? point.lng ?? point.lon ?? point.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng, name } : null;
}
export function publicOrderBranding(value: unknown) {
  const data = record(value);
  let source = data.tenant_branding || data.branding || data.tenantTheme || data.tenant_theme;
  if (typeof source === 'string') { try { source = JSON.parse(source); } catch { source = {}; } }
  const brand = record(source);
  const hex = (value: unknown) => typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim()) ? value.trim() : null;
  const logo = publicOrderText(brand.logo_url || brand.logoUrl || data.tenant_logo);
  return { primary: hex(brand.primary_color || brand.primaryColor), secondary: hex(brand.secondary_color || brand.secondaryColor),
    logo: /^https:\/\//i.test(logo) || (/^\/(?!\/)/.test(logo) && !logo.includes('\\')) ? logo : null };
}
export function publicOrderPrivacy(value: unknown) {
  const privacy = record(record(value).privacy);
  const fields = new Set(Array.isArray(privacy.redacted_fields) ? privacy.redacted_fields : []);
  const redacted = privacy.pii_redacted !== false;
  return { redacted, address: redacted || fields.has('direccion'), phone: redacted || fields.has('telefono_cliente'),
    coordinates: redacted || ['latitud', 'longitud', 'lat', 'lng', 'coordinates', 'location', 'delivery_location', 'customer_location', 'driver_location', 'store_location'].some((key) => fields.has(key)),
    name: redacted || fields.has('nombre_cliente') || fields.has('customer') };
}
