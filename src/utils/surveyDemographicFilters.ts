export type SurveyDemographicFilter = 'genero' | 'rango_etario' | 'pais' | 'provincia' | 'ciudad' | 'barrio';
export interface SurveyDemographicOption { value: string; label: string }
const aliases: Record<SurveyDemographicFilter, readonly string[]> = {
  genero: ['genero', 'generos'],
  rango_etario: ['rango_etario', 'rangos_etarios', 'rangoEtario', 'rangosEtarios'],
  pais: ['pais', 'paises'], provincia: ['provincia', 'provincias'], ciudad: ['ciudad', 'ciudades'], barrio: ['barrio', 'barrios'],
};
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 &&
  value.length <= 512 && value !== '__all__' && !/[\p{Cc}\p{Cf}]/u.test(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function options(value: unknown): SurveyDemographicOption[] | null {
  const rows = Array.isArray(value) ? value : record(value)
    ? Object.entries(value).filter(([, total]) => count(total)).map(([label, total]) => ({ label, value: total })) : null;
  if (!rows) return null;
  const seen = new Set<string>();
  return rows.flatMap(row => {
    if (!record(row)) return [];
    // Current label/value uses value as a count, never as the filter term.
    const term = [row.clave, row.etiqueta, row.label].find(text);
    if (!term || seen.has(term)) return [];
    const label = [row.etiqueta, row.label, term].find(text)!;
    seen.add(term);
    return [{ value: term, label }];
  });
}

/** Use the published demographic labels, including current nested territory series and legacy maps. */
export function readSurveyDemographicFilters(value: unknown): Record<SurveyDemographicFilter, SurveyDemographicOption[]> {
  const source = record(value) ? value : {};
  const territory = Array.isArray(source.territorio) ? source.territorio.filter(record) : [];
  const territoryMap = record(source.territorio_map) ? source.territorio_map : {};
  return Object.fromEntries(Object.entries(aliases).map(([dimension, keys]) => {
    const candidates = [
      ...keys.map(key => source[key]),
      ...keys.map(key => source[`${key}_series`]),
      ...territory.filter(section => keys.includes(String(section.key))).map(section => section.series),
      ...keys.map(key => territoryMap[key]),
      ...keys.map(key => source[`${key}_map`]),
    ];
    for (const candidate of candidates) {
      const normalized = options(candidate);
      // An explicit empty current series must not resurrect a stale legacy alias.
      if (normalized !== null) return [dimension, normalized];
    }
    return [dimension, []];
  })) as Record<SurveyDemographicFilter, SurveyDemographicOption[]>;
}
