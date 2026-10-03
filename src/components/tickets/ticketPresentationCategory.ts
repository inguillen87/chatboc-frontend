import type { Ticket } from '@/types/tickets';
import {
  getTicketRoutingIdentity,
  normalizeRoutingDimension,
  type TicketRoutingAuthorityResolution,
} from './ticketRoutingAuthority';

export type TicketPresentationCategoryState =
  | 'verified'
  | 'checking'
  | 'persisted'
  | 'conflict'
  | 'missing';

export interface TicketPresentationCategory {
  label: string;
  state: TicketPresentationCategoryState;
  detail: string;
}

const readCategory = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
};

const humanizeCategory = (value: string): string =>
  (() => {
    const cleaned = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    if (/\p{Lu}/u.test(cleaned)) return cleaned;
    return cleaned
      ? `${cleaned.charAt(0).toLocaleUpperCase('es-AR')}${cleaned.slice(1)}`
      : cleaned;
  })();

const directAuthoritativeCategory = (ticket: Ticket): { value: string | null; conflict: boolean; unverified: boolean } => {
  const record = ticket as Ticket & {
    authoritative_category?: unknown;
    authoritativeCategory?: unknown;
    category_authority?: unknown;
  };
  const publishedValues = [record.authoritative_category, record.authoritativeCategory]
    .filter((value) => value !== undefined);
  const values = publishedValues
    .map((value) => readCategory(value))
    .filter((value): value is string => Boolean(value));
  const authority = record.category_authority && typeof record.category_authority === 'object' &&
    !Array.isArray(record.category_authority)
    ? record.category_authority as Record<string, unknown>
    : null;
  const unverified = publishedValues.some((value) => !readCategory(value)) ||
    (authority?.contract_version === 'ticket.category_authority.v1' && authority.verified === false);
  const normalized = new Set(values.map(normalizeRoutingDimension));
  const conflict = normalized.size > 1;
  return { value: !unverified && !conflict ? values[0] ?? null : null, conflict, unverified };
};

export const resolveTicketPresentationCategory = ({
  ticket,
  routingResolution,
  routingLoading = false,
}: {
  ticket: Ticket;
  routingResolution: TicketRoutingAuthorityResolution | null;
  routingLoading?: boolean;
}): TicketPresentationCategory => {
  const identity = getTicketRoutingIdentity(ticket);
  const directAuthority = directAuthoritativeCategory(ticket);
  if (directAuthority.conflict) {
    return {
      label: 'Categoría por verificar',
      state: 'conflict',
      detail: 'El expediente publica categorías autoritativas contradictorias.',
    };
  }
  if (identity && directAuthority.value) {
    return {
      label: humanizeCategory(directAuthority.value),
      state: 'verified',
      detail: 'Categoría verificada para este expediente.',
    };
  }

  if (!directAuthority.unverified && routingResolution?.ok) {
    if (identity && routingResolution.authority.identity === identity && routingResolution.authority.category) {
      return {
        label: humanizeCategory(routingResolution.authority.category),
        state: 'verified',
        detail: 'Categoría verificada por source_model e identificador del expediente.',
      };
    }
    return {
      label: 'Categoría por verificar',
      state: 'conflict',
      detail: 'La categoría autoritativa no corresponde a la identidad de este expediente.',
    };
  }

  if (!directAuthority.unverified && routingResolution && 'reason' in routingResolution && routingResolution.reason === 'conflicting_authority') {
    return {
      label: 'Categoría por verificar',
      state: 'conflict',
      detail: 'El backend publicó categorías contradictorias para este expediente.',
    };
  }

  const persisted = readCategory(
    ticket.categoria,
    ticket.categoria_principal,
    ticket.categoria_simple,
    ticket.categoria_secundaria,
  );
  if (persisted) {
    return {
      label: humanizeCategory(persisted),
      state: routingLoading ? 'checking' : 'persisted',
      detail: routingLoading
        ? 'Categoría registrada; verificando autoridad del expediente.'
        : 'Categoría registrada en el ticket, sin autoridad correlacionada disponible.',
    };
  }

  return {
    label: 'Categoría no informada',
    state: 'missing',
    detail: 'El expediente no publica una categoría verificable.',
  };
};
