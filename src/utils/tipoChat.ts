import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { APP_TARGET } from '@/config';

/**
 * Devuelve el tipo de chat actual basándose en el usuario guardado.
 * Si no hay usuario o no se puede determinar, usa APP_TARGET.
 */
export function getCurrentTipoChat(): 'pyme' | 'municipio' {
  try {
    const stored = safeLocalStorage.getItem('user');
    if (stored) {
      const user = JSON.parse(stored);
      const tipoChat = user?.tipo_chat;
      if (tipoChat === 'pyme' || tipoChat === 'municipio') {
        return tipoChat;
      }
      // Compatibilidad con versiones antiguas basadas en rubro
      const rubro = (user?.rubro || '').toLowerCase();
      if (rubro === 'municipios') return 'municipio';
      if (rubro) return 'pyme';
    }
  } catch {
    /* ignore */
  }
  return APP_TARGET;
}
