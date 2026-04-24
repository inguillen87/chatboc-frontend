import { Ticket } from '@/types/tickets';

/**
 * Returns the best phone number to contact the ticket's owner.
 * Prefers explicitly provided contact information and falls back to
 * the WhatsApp conversation identifier if available.
 */
export function getContactPhone(ticket?: Ticket | null): string | undefined {
  if (!ticket) return undefined;

  if (ticket.informacion_personal_vecino?.telefono) {
    return ticket.informacion_personal_vecino.telefono;
  }

  if (ticket.user?.phone) {
    return ticket.user.phone;
  }

  if (ticket.whatsapp_conversation_id) {
    // Remove any suffix like "@c.us" that might come from WhatsApp IDs
    return ticket.whatsapp_conversation_id.replace(/@.*/, '');
  }

  return undefined;
}

export function getCitizenDni(ticket?: Ticket | null): string | undefined {
  if (!ticket) return undefined;

  return (
    ticket.informacion_personal_vecino?.dni ||
    (ticket.informacion_personal_vecino as any)?.documento ||
    ticket.dni ||
    (ticket as any)?.documento
  );
}

/**
 * Returns a human readable channel label for the ticket.
 * Falls back to "N/A" when no channel information is available.
 */
export function getTicketChannel(ticket?: Ticket | null): string {
  if (!ticket) return 'N/A';

  const aliasMap: Record<string, string> = {
    whatsapp: 'WhatsApp',
    ws: 'WhatsApp',
    wsp: 'WhatsApp',
    web: 'Web',
    email: 'Email',
    correo: 'Email',
    mail: 'Email',
    telefono: 'Teléfono',
    teléfono: 'Teléfono',
    phone: 'Teléfono',
    llamada: 'Teléfono',
    callcenter: 'Teléfono',
    presencial: 'Presencial',
    oficina: 'Presencial',
  };

  const isNaLabel = (value: string) => /^n\s*\/\s*a$/i.test(value);

  const normalizeCandidate = (value: unknown): string | null => {
    if (value == null) return null;

    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      return text && !isNaLabel(text) ? text : null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = normalizeCandidate(item);
        if (nested) return nested;
      }
      return null;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const candidateKeys = [
        'label',
        'nombre',
        'name',
        'value',
        'canal',
        'channel',
        'tipo',
        'texto',
        'display',
      ];

      for (const key of candidateKeys) {
        const nested = normalizeCandidate(record[key]);
        if (nested) return nested;
      }
    }

    return null;
  };

  const toDisplayLabel = (raw: string): string => {
    const normalized = raw.toLowerCase();

    for (const [key, label] of Object.entries(aliasMap)) {
      if (normalized === key) {
        return label;
      }
      if (normalized.includes(key) && key.length > 2) {
        return label;
      }
    }

    return raw
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const directKeys = [
    'channel',
    'canal',
    'canal_ingreso',
    'canalIngreso',
    'canal_nombre',
    'canal_atencion',
    'canal_origen',
    'canal_display',
    'medio',
    'medio_ingreso',
    'medio_atencion',
    'medio_contacto',
    'via',
    'via_ingreso',
    'origen',
    'origin',
    'source',
    'source_channel',
    'communication_channel',
    'contact_channel',
  ];

  for (const key of directKeys) {
    const candidate = normalizeCandidate((ticket as any)?.[key]);
    if (candidate) {
      return toDisplayLabel(candidate);
    }
  }

  const nestedPaths: Array<Array<string>> = [
    ['metadata', 'canal'],
    ['metadata', 'channel'],
    ['metadata', 'via'],
    ['metadata', 'origen'],
    ['informacion_personal_vecino', 'canal'],
    ['informacion_personal_vecino', 'canal_ingreso'],
    ['informacion_personal_vecino', 'medio'],
    ['user', 'canal'],
    ['user', 'channel'],
  ];

  for (const path of nestedPaths) {
    let current: any = ticket;
    for (const segment of path) {
      if (current == null) break;
      current = current?.[segment];
    }
    const candidate = normalizeCandidate(current);
    if (candidate) {
      return toDisplayLabel(candidate);
    }
  }

  if (typeof ticket === 'object' && ticket !== null) {
    for (const [key, value] of Object.entries(ticket as Record<string, unknown>)) {
      if (!value) continue;
      if (/canal|channel|medio|via|origen/i.test(key)) {
        const candidate = normalizeCandidate(value);
        if (candidate) {
          return toDisplayLabel(candidate);
        }
      }
    }
  }

  if (ticket.whatsapp_conversation_id) {
    return aliasMap.whatsapp;
  }

  if (ticket.email || ticket.email_usuario) {
    return aliasMap.email;
  }

  if (
    ticket.telefono ||
    ticket.informacion_personal_vecino?.telefono ||
    ticket.user?.phone
  ) {
    return aliasMap.telefono;
  }

  return 'N/A';
}
