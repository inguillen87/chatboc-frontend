import { describe, expect, it } from 'vitest';
import { readTerritoryInitialView } from './territoryInitialView';

describe('territory initial view', () => {
  it('reads the declared camera framing as two [lng, lat] corners', () => {
    expect(readTerritoryInitialView({
      initial_view_bounds: { west: -68.75, south: -55.15, east: -63.7, north: -52.55 },
    })).toEqual([[-68.75, -55.15], [-63.7, -52.55]]);
  });

  it('ignores a missing, malformed or inverted view instead of guessing one', () => {
    for (const jurisdiction of [
      undefined, null, {}, { initial_view_bounds: null }, { initial_view_bounds: [-68, -55, -63, -52] },
      { initial_view_bounds: { west: '-68', south: -55, east: -63, north: -52 } },
      { initial_view_bounds: { west: -63, south: -55, east: -68, north: -52 } },
      { initial_view_bounds: { west: -68, south: -95, east: -63, north: -52 } },
      { initial_view_bounds: { west: -68, south: -55, east: Number.NaN, north: -52 } },
    ]) {
      expect(readTerritoryInitialView(jurisdiction), JSON.stringify(jurisdiction)).toBeNull();
    }
  });
});
