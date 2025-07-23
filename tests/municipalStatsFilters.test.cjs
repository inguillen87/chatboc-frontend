import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMunicipalStatsFiltersData } from '../server/municipalStats.cjs';
import * as db from '../server/db.cjs';

vi.mock('../server/db.cjs', () => {
  let tickets = [];
  return {
    getTickets: () => tickets,
    __setTickets: (newTickets) => {
      tickets = newTickets;
    },
  };
});

describe('Municipal Stats Filters', () => {
  beforeEach(() => {
    db.__setTickets([]);
  });

  it('should return correct structure and default values when no tickets', () => {
    const filters = getMunicipalStatsFiltersData();
    expect(filters.rubros).toEqual([]);
    expect(filters.barrios).toEqual(['Barrio Default 1', 'Barrio Default 2']);
    expect(filters.tipos).toEqual(['Tipo Default A', 'Tipo Default B']);
    expect(filters.rangos).toEqual([
      'Todas',
      'Últimas 24hs',
      'Últimos 7 días',
      'Últimos 30 días',
      'Respondido < 4hs',
      'Respondido > 24hs',
    ]);
  });

  it('should extract unique rubros from tickets', () => {
    db.__setTickets([
      { category: 'baches' },
      { category: 'limpieza' },
      { category: 'baches' },
      { category: 'alumbrado' },
      { category: null },
      { category: undefined },
    ]);
    const filters = getMunicipalStatsFiltersData();
    expect(filters.rubros.sort()).toEqual(['alumbrado', 'baches', 'limpieza'].sort());
  });

  it('should return default barrios and tipos regardless of tickets', () => {
    db.__setTickets([{ category: 'baches', barrio: 'Centro', tipo: 'Urgente' }]);
    const filters = getMunicipalStatsFiltersData();
    expect(filters.barrios).toEqual(['Barrio Default 1', 'Barrio Default 2']);
    expect(filters.tipos).toEqual(['Tipo Default A', 'Tipo Default B']);
  });

  it('should return predefined rangos', () => {
    const filters = getMunicipalStatsFiltersData();
    expect(filters.rangos).toEqual([
      'Todas',
      'Últimas 24hs',
      'Últimos 7 días',
      'Últimos 30 días',
      'Respondido < 4hs',
      'Respondido > 24hs',
    ]);
  });
});
