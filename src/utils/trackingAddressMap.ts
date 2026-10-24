import { isValidTrackingPoint, type TrackingMapPoint } from './trackingMapPoints';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalized = (value: unknown) => text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');

export function trackingPoint(lat: unknown, lng: unknown): TrackingMapPoint | null {
  const number = (value: unknown) => typeof value === 'number' ? value
    : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  const point = { lat: number(lat), lng: number(lng) };
  return isValidTrackingPoint(point) ? point : null;
}

/** Only an existing Google Maps address search, with no credentials or unrelated query, is eligible. */
export function safeTrackingAddressSearch(value: unknown, address: string): string | null {
  if (!text(value) || !address) return null;
  try {
    const url = new URL(text(value));
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null;
    const short = url.hostname === 'maps.google.com' && url.pathname === '/';
    const search = url.hostname === 'www.google.com' && /^\/maps\/search\/?$/.test(url.pathname);
    if (!short && !search) return null;
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length) return null;
    if (short ? keys.length !== 1 || keys[0] !== 'q'
      : keys.some(key => !['api', 'query'].includes(key)) || url.searchParams.get('api') !== '1') return null;
    if (text(url.searchParams.get(short ? 'q' : 'query')) !== address.trim()) return null;
    return text(value);
  } catch { return null; }
}

export interface TrackingGeocodingCapability {
  jurisdiction: { city: string; province: string; country: string;
    bounds: { west: number; south: number; east: number; north: number } };
  labels: { loading: string; unavailable: string; approximate: string };
}

export function trackingGeocodingCapability(payload: unknown, kind: string): TrackingGeocodingCapability | null {
  if (!record(payload) || !record(payload.map) || !record(payload.resource) || !record(payload.tenant)) return null;
  const capability = payload.map.geocoding;
  if (!record(capability) || capability.contract_version !== 'tracking.address_geocoding.v1'
    || capability.enabled !== true || capability.provider !== 'nominatim' || capability.persists_coordinates !== false
    || !record(capability.scope) || !record(capability.jurisdiction) || !record(capability.labels)) return null;
  const scope = capability.scope;
  if (scope.kind !== kind || scope.code !== payload.resource.code || !text(scope.code)
    || scope.tenant_id !== payload.tenant.id || !Number.isInteger(scope.tenant_id) || Number(scope.tenant_id) <= 0
    || scope.tenant_slug !== payload.tenant.slug || !text(scope.tenant_slug)) return null;
  const jurisdiction = capability.jurisdiction;
  const city = text(jurisdiction.city), province = text(jurisdiction.province), country = text(jurisdiction.country);
  const bounds = jurisdiction.bounds;
  if (!city || !province || !/^[A-Z]{2}$/.test(country) || !record(bounds)
    || !['west', 'south', 'east', 'north'].every(key => typeof bounds[key] === 'number' && Number.isFinite(bounds[key]))) return null;
  const checked = bounds as TrackingGeocodingCapability['jurisdiction']['bounds'];
  if (!(-180 <= checked.west && checked.west < checked.east && checked.east <= 180
    && -90 <= checked.south && checked.south < checked.north && checked.north <= 90)) return null;
  const labels = { loading: text(capability.labels.loading), unavailable: text(capability.labels.unavailable),
    approximate: text(capability.labels.approximate) };
  if (!labels.loading || !labels.unavailable || !labels.approximate) return null;
  return { jurisdiction: { city, province, country, bounds: checked }, labels };
}

export function trackingAddressQuery(address: string, capability: TrackingGeocodingCapability): string {
  const { city, province, country, bounds } = capability.jurisdiction;
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', limit: '2', bounded: '1',
    q: [address, city, province, country].join(', '), countrycodes: country.toLowerCase(),
    viewbox: [bounds.west, bounds.north, bounds.east, bounds.south].join(',') }).toString();
  return url.toString();
}

/** A temporary, unique street/building/intersection match is orientation, never persisted GPS. */
export function uniqueTrackingAddressPoint(results: unknown, capability: TrackingGeocodingCapability): TrackingMapPoint | null {
  if (!Array.isArray(results) || results.length > 2) return null;
  const { city, province, country, bounds } = capability.jurisdiction;
  const points = results.flatMap(result => {
    if (!record(result) || !record(result.address)) return [];
    const precision = text(result.addresstype) || text(result.type);
    if (!['house', 'building', 'road', 'street', 'intersection'].includes(precision)) return [];
    const point = trackingPoint(result.lat, result.lon);
    if (!point || point.lng < bounds.west || point.lng > bounds.east || point.lat < bounds.south || point.lat > bounds.north) return [];
    const address = result.address;
    if (normalized(address.country_code) !== country.toLowerCase() || normalized(address.state || address.province) !== normalized(province)
      || !['city', 'town', 'village', 'municipality'].some(key => normalized(address[key]) === normalized(city))) return [];
    return [point];
  });
  return points.length === 1 ? points[0] : null;
}
