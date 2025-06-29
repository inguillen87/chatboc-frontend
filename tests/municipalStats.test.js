const assert = require('assert');
const { getMunicipalStats } = require('../server/municipalStats'); // Adjusted path assuming tests are in tests/ and municipalStats.js in server/
const db = require('../server/db'); // Adjusted path

describe('Municipal Stats - getMunicipalStats', () => {
  const originalTickets = db.getTickets(); // Save original tickets if any

  beforeEach(() => {
    // Default mock tickets for each test
    db.__setTickets([
      { municipality: 'Alpha', category: 'baches', responseMs: 1 * 60 * 60 * 1000 }, // 1h
      { municipality: 'Alpha', category: 'limpieza', responseMs: 3 * 60 * 60 * 1000 }, // 3h
      { municipality: 'Alpha', category: 'baches', responseMs: 5 * 60 * 60 * 1000 }, // 5h
      { municipality: 'Beta', category: 'limpieza', responseMs: 2 * 60 * 60 * 1000 }, // 2h
      { municipality: 'Beta', category: 'arbolado', responseMs: 10 * 60 * 60 * 1000 }, // 10h
      { municipality: 'Gamma', category: 'baches', responseMs: 30 * 60 * 60 * 1000 }, // 30h
    ]);
  });

  after(() => {
    db.__setTickets(originalTickets); // Restore original tickets after all tests
  });

  it('should return stats for all tickets when no filters are applied', () => {
    const result = getMunicipalStats({});
    assert.ok(Array.isArray(result.stats), 'Should return an array of stats');

    const totalTicketsStat = result.stats.find(s => s.label === 'Total Tickets');
    assert.strictEqual(totalTicketsStat.value, 6, 'Total tickets should be 6');

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h)'));
    // (1+3+5+2+10+30) / 6 = 51 / 6 = 8.5
    assert.strictEqual(avgResponseStat.value, 8.5, 'Average response time should be 8.5h');

    // Check for municipality breakdown
    assert.ok(result.stats.find(s => s.label === 'Tickets in Alpha' && s.value === 3), "Alpha tickets count");
    assert.ok(result.stats.find(s => s.label === 'Tickets in Beta' && s.value === 2), "Beta tickets count");
    assert.ok(result.stats.find(s => s.label === 'Tickets in Gamma' && s.value === 1), "Gamma tickets count");

    // Check for category breakdown
    assert.ok(result.stats.find(s => s.label === 'Category: baches' && s.value === 3), "Baches category count");
    assert.ok(result.stats.find(s => s.label === 'Category: limpieza' && s.value === 2), "Limpieza category count");
    assert.ok(result.stats.find(s => s.label === 'Category: arbolado' && s.value === 1), "Arbolado category count");
  });

  it('should filter by rubro (category)', () => {
    const result = getMunicipalStats({ rubro: 'baches' });

    const totalTicketsStat = result.stats.find(s => s.label === 'Tickets de baches');
    assert.strictEqual(totalTicketsStat.value, 3, 'Total "baches" tickets should be 3');

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h) for baches'));
    // (1+5+30) / 3 = 36 / 3 = 12
    assert.strictEqual(avgResponseStat.value, 12, 'Average response time for "baches" should be 12h');

    // Should not have general municipality or category breakdown when rubro is filtered
    assert.strictEqual(result.stats.find(s => s.label.startsWith('Tickets in')), undefined, "No general municipality breakdown when rubro is filtered");
  });

  it('should filter by rango (Respondido < 4hs)', () => {
    const result = getMunicipalStats({ rango: 'Respondido < 4hs' });
    // Tickets with responseMs < 4h: Alpha (1h), Alpha (3h), Beta (2h) = 3 tickets
    const totalTicketsStat = result.stats.find(s => s.label === 'Total Tickets (Respondido < 4hs)');
    assert.strictEqual(totalTicketsStat.value, 3, 'Total tickets responded < 4hs should be 3');

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h)  (Respondido < 4hs)'));
    // (1+3+2)/3 = 6/3 = 2
    assert.strictEqual(avgResponseStat.value, 2, 'Average response time for "Respondido < 4hs" should be 2h');
  });

  it('should filter by rango (Respondido > 24hs)', () => {
    const result = getMunicipalStats({ rango: 'Respondido > 24hs' });
    // Tickets with responseMs > 24h: Gamma (30h) = 1 ticket
    const totalTicketsStat = result.stats.find(s => s.label === 'Total Tickets (Respondido > 24hs)');
    assert.strictEqual(totalTicketsStat.value, 1, 'Total tickets responded > 24hs should be 1');

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h)  (Respondido > 24hs)'));
    assert.strictEqual(avgResponseStat.value, 30, 'Average response time for "Respondido > 24hs" should be 30h');
  });

  it('should combine rubro and rango filters', () => {
    const result = getMunicipalStats({ rubro: 'baches', rango: 'Respondido < 4hs' });
    // Baches: Alpha (1h), Alpha (5h), Gamma (30h)
    // Respondido < 4hs: Alpha (1h)
    const totalTicketsStat = result.stats.find(s => s.label === 'Tickets de baches (Respondido < 4hs)');
    assert.strictEqual(totalTicketsStat.value, 1, 'Total "baches" tickets responded < 4hs should be 1');

    const avgResponseStat = result.stats.find(s => s.label.startsWith('Avg. Response Time (h) for baches (Respondido < 4hs)'));
    assert.strictEqual(avgResponseStat.value, 1, 'Average response time for "baches" (Respondido < 4hs) should be 1h');
  });

  it('should return empty stats array if no tickets match filters', () => {
    const result = getMunicipalStats({ rubro: 'nonexistent' });
    assert.deepStrictEqual(result, { stats: [] }, 'Should return { stats: [] } for no matching tickets');
  });

  it('should handle rango filter "Todas" correctly (no time filtering)', () => {
    const result = getMunicipalStats({ rango: 'Todas' });
     const totalTicketsStat = result.stats.find(s => s.label === 'Total Tickets (Todas)'); // Label includes (Todas)
    assert.strictEqual(totalTicketsStat.value, 6, 'Total tickets should be 6 with rango "Todas"');
  });

  // Note: Filters for 'barrio' and 'tipo' are not effectively tested here as the mock data
  // and current getMunicipalStats implementation don't fully support them.
  // Similarly, date-based 'rango' filters ('Últimas 24hs', etc.) are not tested
  // as mock tickets lack a creation timestamp.
});

console.log('Municipal stats tests (getMunicipalStats) passed');
