import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { esRubroPublico, normalizeRubro } from './chatEndpoints';

function parseRubro(raw: any): string | null {
  const val = normalizeRubro(raw);
  return typeof val === 'string' ? val.toLowerCase() : null;
}

export function getCurrentRubro(): string | null {
  try {
    const selected = safeLocalStorage.getItem('rubroSeleccionado');
    if (selected) return selected.toLowerCase();
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
 * Si no hay usuario o no se puede determinar, usa APP_TARGET.
 */
export function getCurrentTipoChat(): 'pyme' | 'municipio' {
  const rubro = getCurrentRubro();
  if (rubro) {
    return esRubroPublico(rubro) ? 'municipio' : 'pyme';
  }
  try {
    const stored = safeLocalStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      const tipoChat = user?.tipo_chat;
      if (tipoChat === 'pyme' || tipoChat === 'municipio') {
        return tipoChat;
      }
    }
  } catch {
    /* ignore */
  }
  return 'municipio';
}

/**
 * Asegura que el tipo de chat coincida con el rubro proporcionado.
 * Si hay discrepancia, se ajusta al valor correcto y se muestra una
 * advertencia en consola. No lanza errores para evitar romper la UX.
 */
export function enforceTipoChatForRubro(
  tipoChat: 'pyme' | 'municipio',
  rubro: string | null,
): 'pyme' | 'municipio' {
  if (!rubro) return tipoChat;
  const esperado = esRubroPublico(rubro) ? 'municipio' : 'pyme';
  if (tipoChat !== esperado) {
    console.warn(
      `Tipo de chat '${tipoChat}' no coincide con el rubro '${rubro}'. Ajustando a '${esperado}'.`,
    );
    return esperado;
  }
  return tipoChat;
}
