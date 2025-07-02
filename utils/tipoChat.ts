// src/utils/tipoChat.ts
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { esRubroPublico, normalizeRubro } from './chatEndpoints'; // Importar normalizeRubro
import { APP_TARGET } from '@/config';

export function parseRubro(raw: any): string | null {
  if (!raw) return null;
  let rubroStr: string | null = null;
  if (typeof raw === 'string') {
    rubroStr = raw;
  } else if (typeof raw === 'object') {
    rubroStr = raw.clave || raw.nombre || null;
  }
  if (!rubroStr) return null;
  return normalizeRubro(rubroStr); // Usar la normalizeRubro de chatEndpoints para consistencia
}

export function getCurrentRubro(): string | null {
  try {
    const selected = safeLocalStorage.getItem('rubroSeleccionado');
    if (selected) return parseRubro(selected); // Usar parseRubro para normalizar
    const stored = safeLocalStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      return parseRubro(user?.rubro);
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Devuelve el tipo de chat actual basándose en el usuario guardado.
 * Si no hay usuario o no se puede determinar, usa 'pyme' como default para demos.
 */
export function getCurrentTipoChat(): 'pyme' | 'municipio' {
  const rubro = getCurrentRubro();
  if (rubro) {
    return esRubroPublico(rubro) ? 'municipio' : 'pyme';
  }
  
  // Si no hay rubro (ej. demo anónima sin rubro pre-seleccionado),
  // por defecto debería ser 'pyme' para las demos generales.
  // Tu APP_TARGET en src/config.ts debería ser 'pyme' si esa es la configuración por defecto de la app.
  // Si el APP_TARGET es 'municipio', entonces el fallback seguirá siendo 'municipio' aquí.
  // Ajusta esto según el default deseado.
  return APP_TARGET;
}

/**
 * Asegura que el tipo de chat coincida con el rubro proporcionado.
 * Si hay discrepancia, se ajusta al valor correcto y se muestra una
 * advertencia en consola. No lanza errores para evitar romper la UX.
 */
export function enforceTipoChatForRubro(
  tipoChat: 'pyme' | 'municipio',
  rubro?: string | null
): 'pyme' | 'municipio' {
  const rubroStr = parseRubro(rubro);
  if (rubroStr) {
    const isPublico = esRubroPublico(rubroStr);
    if (isPublico && tipoChat === 'pyme') {
      console.warn(`Discrepancia: tipoChat 'pyme' con rubro público '${rubroStr}'. Forzando a 'municipio'.`);
      return 'municipio';
    }
    if (!isPublico && tipoChat === 'municipio') {
      console.warn(`Discrepancia: tipoChat 'municipio' con rubro no público '${rubroStr}'. Forzando a 'pyme'.`);
      return 'pyme';
    }
  }
  return tipoChat;
}