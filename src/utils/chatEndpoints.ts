export const RUBROS_PUBLICOS = [
<<<<<<< HEAD
  "municipio",
  "municipios",
  "ong",
  "gobierno",
  "hospital_publico",
  "entidad_publica",
  "municipalidad",
  "ciudad",
  "administracion publica",
  "intendente",
  // agregá todas las variantes que uses en tu sistema o que puedan venir de la DB
];

// Función robusta, siempre compara en minúsculas y sin tildes
=======
  'municipio',
  'municipios',
  'municipalidad',

  'gobierno',
  'ciudad',
  'intendente',
  'administracion publica',
  'alcaldia',
  'ayuntamiento',
  'ong',
  'hospital publico',
  'entidad publica',
];


>>>>>>> f8a348e0f5ebdd40ae319eabec1f32f793e15a88
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
<<<<<<< HEAD

  // Normalizo el texto: minúsculas y sin tildes
  const normalized = rubroStr
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return RUBROS_PUBLICOS.includes(normalized);
=======
  const normalized = rubroStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .trim();

>>>>>>> f8a348e0f5ebdd40ae319eabec1f32f793e15a88
};

interface GetEndpointOptions {
  tipoChat?: "municipio" | "pyme";
  rubro?: string | null;
}

export function getAskEndpoint({ tipoChat, rubro }: GetEndpointOptions): string {
  const esPublico = rubro ? esRubroPublico(rubro) : false;
  if (esPublico) return "/ask/municipio";
  return tipoChat === "municipio" ? "/ask/municipio" : "/ask/pyme";
}
