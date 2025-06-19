export const RUBROS_PUBLICOS = [
  'municipio',
  'municipios',
  'ong',
  'gobierno',
  'hospital_publico',
  'entidad_publica',
];

import { safeLocalStorage } from "@/utils/safeLocalStorage";

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
