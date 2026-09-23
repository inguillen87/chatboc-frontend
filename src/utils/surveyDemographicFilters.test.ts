import { describe, expect, it } from 'vitest';
import { readSurveyDemographicFilters } from './surveyDemographicFilters';

describe('published survey demographic filter terms', () => {
  it('reads current counter arrays and nested territory sections without using counts as terms', () => {
    const filters = readSurveyDemographicFilters({
      genero: [{ label: 'Declarado QA', value: 8 }], rango_etario: [{ label: '35-44', value: 4 }],
      territorio: [{ key: 'barrios', label: 'Barrios', series: [{ label: 'Centro QA', value: 4 }] },
        { key: 'ciudades', label: 'Ciudades', series: [{ label: 'Ciudad QA', value: 8 }] }],
    });
    expect(filters.genero).toEqual([{ value: 'Declarado QA', label: 'Declarado QA' }]);
    expect(filters.rango_etario).toEqual([{ value: '35-44', label: '35-44' }]);
    expect(filters.barrio).toEqual([{ value: 'Centro QA', label: 'Centro QA' }]);
    expect(filters.ciudad).toEqual([{ value: 'Ciudad QA', label: 'Ciudad QA' }]);
    expect(filters.pais).toEqual([]);
  });
  it('preserves existing explicit keys and display labels', () => {
    expect(readSurveyDemographicFilters({ barrios: [{ clave: 'centro', etiqueta: 'Centro', respuestas: 4 }] }).barrio)
      .toEqual([{ value: 'centro', label: 'Centro' }]);
  });
  it('supports published legacy maps when current series are absent', () => {
    const filters = readSurveyDemographicFilters({ genero_map: { Declarado: 2 },
      territorio_map: { barrios: [{ label: 'Centro', value: 2 }], paises: { País: 2 } } });
    expect(filters.genero).toEqual([{ value: 'Declarado', label: 'Declarado' }]);
    expect(filters.barrio).toEqual([{ value: 'Centro', label: 'Centro' }]);
    expect(filters.pais).toEqual([{ value: 'País', label: 'País' }]);
  });
  it('prefers explicit current series, including empty ones, over stale aliases', () => {
    const filters = readSurveyDemographicFilters({ genero: [], genero_map: { Antiguo: 2 },
      territorio: [{ key: 'barrios', series: [{ label: 'Actual', value: 1 }] }],
      territorio_map: { barrios: [{ label: 'Antiguo', value: 2 }] } });
    expect(filters.genero).toEqual([]);
    expect(filters.barrio).toEqual([{ value: 'Actual', label: 'Actual' }]);
  });
  it('deduplicates terms and rejects malformed, reserved or control-bearing values', () => {
    const filters = readSurveyDemographicFilters({ barrio: [null, {}, { value: 2 }, { label: '' },
      { label: ' ' }, { label: '__all__' }, { label: 'x\u0000y' }, { label: 'x\u202Ey' },
      { label: 'Centro', value: 2 }, { clave: 'Centro', etiqueta: 'Duplicado' }] });
    expect(filters.barrio).toEqual([{ value: 'Centro', label: 'Centro' }]);
  });
  it.each([null, undefined, [], 'unknown'])('does not invent options without demographic data %#', value => {
    expect(Object.values(readSurveyDemographicFilters(value)).flat()).toEqual([]);
  });
});
