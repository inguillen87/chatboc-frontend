export const RUBROS_PUBLICOS = [
  'municipio',
  'municipios',
  'ong',
  'gobierno',
  'hospital_publico',
  'entidad_publica',
];

import { safeLocalStorage } from "@/utils/safeLocalStorage";

// Normaliza valores de rubro que pueden ser string u objeto
export function normalizeRubro(
  rubro?: string | { nombre?: unknown; clave?: unknown } | null,
): string | null {
  if (!rubro) return null;
  if (typeof rubro === "string") return rubro;
  if (typeof rubro === "object") {
    const val = rubro.clave ?? rubro.nombre;
    return typeof val === "string" ? val : null;
  }
  return null;
}

export const esRubroPublico = (
  rubro?: string | { nombre?: unknown; clave?: unknown } | null,
): boolean => {
  const rubroStr = normalizeRubro(rubro);
  if (!rubroStr) return false;
  const loggedIn = Boolean(safeLocalStorage.getItem("authToken"));
  if (loggedIn) return false;
  return RUBROS_PUBLICOS.includes(rubroStr.trim().toLowerCase());
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
