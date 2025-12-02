import { describe, it, expect } from 'vitest';
import * as cart from '../cart.js';
import * as prefs from '../preferences.js';
import { getBusinessMetrics } from '../businessMetrics.js';

describe('getBusinessMetrics', () => {
  it('should return business metrics', () => {
    const session = {};
    cart.addItem(session, 'ProductoA', 2);
    cart.addItem(session, 'ProductoB', 1);
    prefs.addPreference(session, 'ProductoA');
    prefs.addPreference(session, 'ProductoB');
    prefs.addPreference(session, 'ProductoA');

    const metrics = getBusinessMetrics(session);
    expect(metrics.length).toBe(3);
    expect(metrics[0].value).toBe(3);
    expect(metrics[1].value).toBe(3);
    expect(metrics[2].value).toBe(2);
  });
});
