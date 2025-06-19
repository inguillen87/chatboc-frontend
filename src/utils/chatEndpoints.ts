export const RUBROS_PUBLICOS = [

];

// Función robusta, siempre compara en minúsculas y sin tildes
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

  // Normalizo el texto: minúsculas y sin tildes
  const normalized = rubroStr
    .trim()
    .toLowerCase()
    .normalize("NFD")

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
