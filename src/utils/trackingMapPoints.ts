export interface TrackingMapPoint { lat: number; lng: number; name?: string }
export interface TrackingMapSources {
  storeLocation?: TrackingMapPoint | null;
  customerLocation?: TrackingMapPoint | null;
  driverLocation?: TrackingMapPoint | null;
  showDriverMarker?: boolean;
  status: string;
}
export type TrackingPointRole = 'store' | 'customer' | 'driver';
export interface ReportedTrackingPoint extends TrackingMapPoint { role: TrackingPointRole }
const ACTIVE_DRIVER_STATUSES = new Set(['en_proceso', 'enviado', 'shipped', 'en_camino', 'asignado', 'validando']);
export function isValidTrackingPoint(value: unknown): value is TrackingMapPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<TrackingMapPoint>;
  return typeof point.lat === 'number' && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    typeof point.lng === 'number' && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
}
/** Coordinates are reported data, never inferred from a business status or endpoints. */
export function reportedTrackingPoints(input: TrackingMapSources): ReportedTrackingPoint[] {
  const points: ReportedTrackingPoint[] = [];
  const append = (role: TrackingPointRole, point: unknown) => {
    if (isValidTrackingPoint(point)) points.push({ role, lat: point.lat, lng: point.lng,
      name: typeof point.name === 'string' && point.name.trim() ? point.name.trim() : undefined });
  };
  append('store', input.storeLocation); append('customer', input.customerLocation);
  if (input.showDriverMarker !== false && ACTIVE_DRIVER_STATUSES.has(input.status)) append('driver', input.driverLocation);
  return points;
}
