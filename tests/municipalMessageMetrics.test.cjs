import { describe, it, expect } from 'vitest';
import * as db from 'server/db.js';
import { getMunicipalMessageMetrics } from 'server/municipalMessageMetrics.js';

describe('getMunicipalMessageMetrics', () => {
  it('should return municipal message metrics', () => {
    const now = Date.now();

    // messages: 2 days ago, 8 days ago, 20 days ago, 370 days ago
    const msgs = [
      { municipality: 'Alpha', timestamp: now - 2 * 86400000 },
      { municipality: 'Alpha', timestamp: now - 8 * 86400000 },
      { municipality: 'Beta', timestamp: now - 20 * 86400000 },
      { municipality: 'Beta', timestamp: now - 370 * 86400000 },
    ];

    db.__setMessages(msgs);

    const metrics = getMunicipalMessageMetrics();
    expect(metrics.week).toBe(1);
    expect(metrics.month).toBe(3);
    expect(metrics.year).toBe(3);
  });
});
