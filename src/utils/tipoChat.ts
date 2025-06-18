import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { esRubroPublico } from './chatEndpoints';

function parseRubro(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.toLowerCase();
  if (typeof raw === 'object') {
    return (
      raw.clave?.toLowerCase() ||
      raw.nombre?.toLowerCase() ||
      null
    );
  }
  return null;
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
