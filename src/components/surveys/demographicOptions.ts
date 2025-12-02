export interface DemographicOption {
  value: string;
  label: string;
}

export const AGE_RANGE_OPTIONS: DemographicOption[] = [
  { value: 'under-18', label: 'Menos de 18 años' },
  { value: '18-24', label: '18 a 24 años' },
  { value: '25-34', label: '25 a 34 años' },
  { value: '35-44', label: '35 a 44 años' },
  { value: '45-54', label: '45 a 54 años' },
  { value: '55-64', label: '55 a 64 años' },
  { value: '65+', label: '65 años o más' },
];

export const GENDER_OPTIONS: DemographicOption[] = [
  { value: 'female', label: 'Mujer' },
  { value: 'male', label: 'Varón' },
  { value: 'non-binary', label: 'No binarie' },
  { value: 'trans', label: 'Persona trans/travesti' },
  { value: 'prefer-not-say', label: 'Prefiero no responder' },
  { value: 'self-described', label: 'Autodescripción' },
];

export const EDUCATION_LEVEL_OPTIONS: DemographicOption[] = [
  { value: 'primary-incomplete', label: 'Primario incompleto' },
  { value: 'primary-complete', label: 'Primario completo' },
  { value: 'secondary-incomplete', label: 'Secundario incompleto' },
  { value: 'secondary-complete', label: 'Secundario completo' },
  { value: 'tertiary-incomplete', label: 'Terciario/universitario incompleto' },
  { value: 'tertiary-complete', label: 'Terciario/universitario completo' },
  { value: 'postgraduate', label: 'Posgrado' },
  { value: 'prefer-not-say', label: 'Prefiero no responder' },
];

export const EMPLOYMENT_STATUS_OPTIONS: DemographicOption[] = [
  { value: 'employed', label: 'Trabajo en relación de dependencia' },
  { value: 'self-employed', label: 'Trabajo independiente' },
  { value: 'unemployed', label: 'Busco empleo' },
  { value: 'student', label: 'Estudiante' },
  { value: 'retired', label: 'Jubilada/o' },
  { value: 'care-work', label: 'Trabajo doméstico o de cuidados' },
  { value: 'prefer-not-say', label: 'Prefiero no responder' },
];
