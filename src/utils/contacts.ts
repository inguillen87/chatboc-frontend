export interface SpecializedContact {
  nombre: string;
  titulo?: string;
  telefono?: string;
  horario?: string;
  email?: string;
}

let contactsCache: Record<string, SpecializedContact> | null = null;

async function loadContacts(): Promise<Record<string, SpecializedContact>> {
  if (contactsCache) return contactsCache;
  try {
    const res = await fetch('/contactos-especializados.json');
    if (!res.ok) throw new Error('No se pudo cargar el archivo de contactos');
    contactsCache = await res.json();
    return contactsCache || {};
  } catch (err) {
    console.error('Error loading specialized contacts', err);
    contactsCache = {};
    return contactsCache;
  }
}

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getSpecializedContact(categoria?: string): Promise<SpecializedContact | null> {
  if (!categoria) return null;
  const contacts = await loadContacts();
  const target = normalizeKey(categoria);

  const match = Object.entries(contacts).find(
    ([key]) => normalizeKey(key) === target,
  );

  if (match) return match[1];

  const otros = Object.entries(contacts).find(
    ([key]) => normalizeKey(key) === normalizeKey('Otros'),
  );

  return otros?.[1] || contacts['default'] || null;
}
