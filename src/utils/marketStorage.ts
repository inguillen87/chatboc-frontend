import { safeLocalStorage } from '@/utils/safeLocalStorage';

type StoredContact = {
  name?: string;
  phone?: string;
};

const CONTACT_KEY_PREFIX = 'market_contact_';

export const loadMarketContact = (slug: string): StoredContact => {
  try {
    const raw = safeLocalStorage.getItem(`${CONTACT_KEY_PREFIX}${slug}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        name: typeof parsed.name === 'string' ? parsed.name : undefined,
        phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      };
    }
  } catch (error) {
    console.warn('[market] No se pudo leer el contacto guardado', error);
  }
  return {};
};

export const saveMarketContact = (slug: string, contact: StoredContact): void => {
  try {
    safeLocalStorage.setItem(`${CONTACT_KEY_PREFIX}${slug}`, JSON.stringify(contact));
  } catch (error) {
    console.warn('[market] No se pudo persistir el contacto', error);
  }
};
