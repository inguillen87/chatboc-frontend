const assert = require('assert');
const { getMunicipalStatsFiltersData } = require('../server/municipalStats');

// Mocking db.js
let mockTickets = [];
const mockDb = {
  getTickets: () => mockTickets,
};

// Override require cache for db
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path === './db' || path === '../server/db' || path.endsWith('/db')) { // Adjust path as necessary from municipalStats.js
    return mockDb;
  }
  return originalRequire.apply(this, arguments);
};


describe('Municipal Stats Filters', () => {
  beforeEach(() => {
    // Reset mock tickets before each test
    mockTickets = [];
  });

  it('should return correct structure and default values when no tickets', () => {
    const filters = getMunicipalStatsFiltersData();
    assert.deepStrictEqual(filters.rubros, [], 'Rubros should be empty');
    assert.deepStrictEqual(filters.barrios, ['Barrio Default 1', 'Barrio Default 2'], 'Barrios should be default placeholders');
    assert.deepStrictEqual(filters.tipos, ['Tipo Default A', 'Tipo Default B'], 'Tipos should be default placeholders');
    assert.deepStrictEqual(filters.rangos, [
      'Todas',
      'Últimas 24hs',
      'Últimos 7 días',
      'Últimos 30 días',
      'Respondido < 4hs',
      'Respondido > 24hs',
    ], 'Rangos should be the predefined list');
  });

  it('should extract unique rubros from tickets', () => {
    mockTickets = [
      { category: 'baches' },
      { category: 'limpieza' },
      { category: 'baches' },
      { category: 'alumbrado' },
      { category: null }, // should be filtered out
      { category: undefined }, // should be filtered out
    ];
    const filters = getMunicipalStatsFiltersData();
    // Order might vary with Set, so sort for comparison
    assert.deepStrictEqual(filters.rubros.sort(), ['alumbrado', 'baches', 'limpieza'].sort(), 'Rubros should be unique categories from tickets');
  });

  it('should return default barrios and tipos regardless of tickets', () => {
    mockTickets = [{ category: 'baches', barrio: 'Centro', tipo: 'Urgente' }]; // barrio/tipo in ticket here won't affect output due to current implementation
    const filters = getMunicipalStatsFiltersData();
    assert.deepStrictEqual(filters.barrios, ['Barrio Default 1', 'Barrio Default 2'], 'Barrios should remain default');
    assert.deepStrictEqual(filters.tipos, ['Tipo Default A', 'Tipo Default B'], 'Tipos should remain default');
  });

  it('should return predefined rangos', () => {
    const filters = getMunicipalStatsFiltersData();
    assert.deepStrictEqual(filters.rangos, [
      'Todas',
      'Últimas 24hs',
      'Últimos 7 días',
      'Últimos 30 días',
      'Respondido < 4hs',
      'Respondido > 24hs',
    ], 'Rangos list should be consistent');
  });
});

// Restore original require
Module.prototype.require = originalRequire;
