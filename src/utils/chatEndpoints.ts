// Lista robusta y tolerante de rubros públicos (todos en minúsculas, sin tildes, sin guiones)
export const RUBROS_PUBLICOS = [
  "municipio",
  "municipios",
  "gobierno",
  "ciudad",
  "intendente",
  "administracion publica",
  "municipalidad",
  "ayuntamiento",
  "gobierno municipal",
  "ong",
  "hospital publico",
  "entidad publica"
];

// Función para normalizar cualquier texto/rubro
export function normalizeRubro(str: any): string {
  if (!str) return "";
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes
    .replace(/[_-]/g, " ")           // reemplaza _ y - por espacio
    .replace(/\s+/g, " ")            // normaliza espacios dobles
    .trim();
}

// Si recibís un objeto rubro o string, SIEMPRE devolvés el string normalizado
export function parseRubro(rubro: any): string | null {
  if (!rubro) return null;
  if (typeof rubro === "string") return normalizeRubro(rubro);
  if (typeof rubro === "object") {
    // Busca clave o nombre, y normaliza igual
    return normalizeRubro(rubro.clave || rubro.nombre || "");
  }
  return null;
}

// Chequea si un rubro es público
export function esRubroPublico(
  rubro?: string | { nombre?: string; clave?: string } | null
): boolean {
  const rubroStr = parseRubro(rubro);
  if (!rubroStr) return false;

  return RUBROS_PUBLICOS.some(
    publico =>
      rubroStr === publico ||
      rubroStr.startsWith(publico + " ") // permite cosas como "municipio xyz"
  );
}

// Elige el endpoint correcto según tipo de chat y rubro
interface GetEndpointOptions {
  tipoChat?: "municipio" | "pyme";
  rubro?: string | null;
}
export function getAskEndpoint({
  tipoChat,
  rubro
}: GetEndpointOptions): string {
  const esPublico = rubro ? esRubroPublico(rubro) : false;
  if (esPublico) return "/ask/municipio";
  return tipoChat === "municipio" ? "/ask/municipio" : "/ask/pyme";
}
