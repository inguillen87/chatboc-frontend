export const RUBROS_PUBLICOS = [
  'municipio',
  'municipios',
  'ong',
  'gobierno',
  'hospital_publico',
  'entidad_publica',
];

export const esRubroPublico = (rubro?: string | null): boolean => {
  if (!rubro) return false;
  return RUBROS_PUBLICOS.includes(rubro.trim().toLowerCase());
};

interface GetEndpointOptions {
  tipoChat?: 'municipio' | 'pyme';
  rubro?: string | null;
}

export function getAskEndpoint({ tipoChat, rubro }: GetEndpointOptions): string {
  const esPublico = rubro ? esRubroPublico(rubro) : false;
  if (esPublico) return '/ask/municipio';
  return tipoChat === 'municipio' ? '/ask/municipio' : '/ask/pyme';
}
