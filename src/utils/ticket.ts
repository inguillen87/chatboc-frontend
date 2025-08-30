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
