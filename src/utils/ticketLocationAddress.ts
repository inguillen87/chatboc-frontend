export interface TicketLocationAddress {
  direccion?: string | null;
  esquinas_cercanas?: string | null;
  distrito?: string | null;
  municipio_nombre?: string | null;
  tipo?: 'pyme' | 'municipio';
}

export const buildFullAddress = (ticket: TicketLocationAddress) => {
  const parts: string[] = [];
  const addPart = (value?: string | null) => {
    if (typeof value !== 'string') {
      return;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    parts.push(trimmed);
  };

  addPart(ticket.direccion);
  addPart(ticket.esquinas_cercanas);
  addPart(ticket.distrito);

  const municipioNombre =
    typeof ticket.municipio_nombre === 'string'
      ? ticket.municipio_nombre.trim()
      : '';

  if (
    ticket.tipo !== 'pyme' &&
    municipioNombre &&
    !parts.some((part) =>
      part.toLowerCase().includes(municipioNombre.toLowerCase()),
    )
  ) {
    parts.push(municipioNombre);
  }

  return parts.join(', ');
};
