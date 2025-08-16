import { describe, it, expect } from 'vitest';
import * as db from '../server/db.cjs';
import { getMunicipalAnalytics } from '../server/municipalAnalytics.cjs';

describe('getMunicipalAnalytics', () => {
  it('should return municipal analytics', () => {
    db.__setTickets([
      { municipality: 'Alpha', category: 'baches', responseMs: 3600000 },
      { municipality: 'Alpha', category: 'baches', responseMs: 7200000 },
      { municipality: 'Beta', category: 'limpieza', responseMs: 3600000 },
    ]);

    const analytics = getMunicipalAnalytics();

    expect(analytics.municipalities.length).toBe(2);
    const alpha = analytics.municipalities.find(m => m.name === 'Alpha');
    expect(alpha.totalTickets).toBe(2);
    expect(alpha.categories.baches).toBe(2);
    expect(alpha.averageResponseHours).toBe(1.5);

    const beta = analytics.municipalities.find(m => m.name === 'Beta');
    expect(beta.totalTickets).toBe(1);
    expect(beta.categories.limpieza).toBe(1);
  });
});
