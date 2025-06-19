export const RUBROS_PUBLICOS = [
  'municipio',
  'municipios',
  'gobierno',
  'ciudad',
  'intendente',
  'administracion publica',
  'ong',
  'hospital publico',
  'entidad publica',
];


export const esRubroPublico = (
  rubro?: string | { nombre?: string; clave?: string } | null,
): boolean => {
  if (!rubro) return false;
  let rubroStr: string | null = null;
  if (typeof rubro === "string") {
    rubroStr = rubro;
  } else if (typeof rubro === "object") {
    rubroStr = rubro.clave || rubro.nombre || null;
  }
  if (!rubroStr) return false;
  const normalized = rubroStr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .trim();
  return RUBROS_PUBLICOS.includes(normalized);
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
