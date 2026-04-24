import { safeLocalStorage } from '@/utils/safeLocalStorage';
import type { GuestContactValues } from '@/components/cart/GuestContactDialog';

const STORAGE_KEY = 'chatboc_guest_contact';

export const loadGuestContact = (): Partial<GuestContactValues> => {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed
      ? {
          nombre: typeof parsed.nombre === 'string' ? parsed.nombre : undefined,
          email: typeof parsed.email === 'string' ? parsed.email : undefined,
          telefono: typeof parsed.telefono === 'string' ? parsed.telefono : undefined,
        }
      : {};
  } catch (err) {
    console.warn('[guestContact] No se pudo leer contacto invitado', err);
    return {};
  }
};

export const saveGuestContact = (values: GuestContactValues) => {
  try {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch (err) {
    console.warn('[guestContact] No se pudo guardar contacto invitado', err);
  }
};
