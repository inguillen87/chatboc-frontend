import { describe, expect, it } from 'vitest';
import { isValidTrackingPoint, reportedTrackingPoints } from './trackingMapPoints';
const store = { lat: -33.08, lng: -68.48, name: 'Origen recibido' };
const customer = { lat: -33.079, lng: -68.47 };
describe('reported tracking coordinates', () => {
  it.each([null, {}, { lat: NaN, lng: 0 }, { lat: 0, lng: Infinity }, { lat: 91, lng: 0 },
    { lat: -91, lng: 0 }, { lat: 0, lng: 181 }, { lat: 0, lng: -181 }, { lat: '0', lng: 0 }])('rejects invalid geography %j', (point) => expect(isValidTrackingPoint(point)).toBe(false));
  it.each([{ lat: 0, lng: 0 }, { lat: 90, lng: 180 }, { lat: -90, lng: -180 }])('keeps genuine boundaries and zeros %j', (point) => expect(isValidTrackingPoint(point)).toBe(true));
  it.each(['en_proceso', 'enviado', 'shipped', 'en_camino', 'asignado', 'validando'])('never estimates driver coordinates for status %s', (status) => {
    expect(reportedTrackingPoints({ storeLocation: store, customerLocation: customer, status }).map((point) => point.role)).toEqual(['store', 'customer']);
  });
  it('keeps exactly the reported driver position, without interpolation', () => {
    const driver = { lat: -33.5, lng: -68.6 };
    expect(reportedTrackingPoints({ storeLocation: store, customerLocation: customer, driverLocation: driver, status: 'enviado' })[2]).toEqual({ ...driver, name: undefined, role: 'driver' });
  });
  it('honors the explicit driver visibility gate', () => expect(reportedTrackingPoints({ driverLocation: store, status: 'enviado', showDriverMarker: false })).toEqual([]));
  it('does not show a driver in terminal states', () => expect(reportedTrackingPoints({ driverLocation: store, status: 'entregado' })).toEqual([]));
  it('does not invent a Buenos Aires center without points', () => expect(reportedTrackingPoints({ status: 'enviado' })).toEqual([]));
  it('does not mutate backend coordinates', () => {
    const frozen = Object.freeze({ ...store });
    expect(reportedTrackingPoints({ storeLocation: frozen, status: 'nuevo' })[0]).toEqual({ ...store, role: 'store' });
  });
});
