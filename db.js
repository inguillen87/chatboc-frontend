let tickets = [
  { municipality: 'Alpha', category: 'baches', responseMs: 4 * 60 * 60 * 1000 },
  { municipality: 'Alpha', category: 'limpieza', responseMs: 2 * 60 * 60 * 1000 },
  { municipality: 'Beta', category: 'baches', responseMs: 8 * 60 * 60 * 1000 },
  { municipality: 'Beta', category: 'arbolado', responseMs: 6 * 60 * 60 * 1000 },
];

// Mensajes de chat asociados a tickets. Cada mensaje incluye el ID del ticket
// para permitir filtrar su historial de conversación. Se mantienen los campos
// `municipality` y `timestamp` para compatibilidad con los tests existentes.
let messages = [
  {
    id: 1,
    ticketId: 1,
    municipality: 'Alpha',
    author: 'user',
    content: 'Hola, tengo un problema',
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 2,
    ticketId: 1,
    municipality: 'Alpha',
    author: 'agent',
    content: 'Gracias por avisar, lo revisamos.',
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 + 60000,
  },
  {
    id: 3,
    ticketId: 2,
    municipality: 'Alpha',
    author: 'user',
    content: '¿Hay novedades?',
    timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
  {
    id: 4,
    ticketId: 3,
    municipality: 'Beta',
    author: 'user',
    content: 'Se rompió la luminaria',
    timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000,
  },
];

// Index for O(1) access to messages by ticketId
let messagesByTicketId = new Map();

function rebuildIndex() {
  messagesByTicketId.clear();
  for (const m of messages) {
    const tid = m.ticketId;
    if (!messagesByTicketId.has(tid)) {
      messagesByTicketId.set(tid, []);
    }
    messagesByTicketId.get(tid).push(m);
  }
}

// Build index initially
rebuildIndex();

export function getTickets() {
  return tickets;
}

export function __setTickets(newTickets) {
  tickets = newTickets;
}

export function getMessages() {
  return messages;
}

export function __setMessages(newMessages) {
  messages = newMessages;
  rebuildIndex();
}

// Devuelve el historial de mensajes para un ticket específico
export function getTicketMessagesById(ticketId) {
  const msgs = messagesByTicketId.get(Number(ticketId));
  // Return a shallow copy to match original behavior (filter returns new array)
  return msgs ? [...msgs] : [];
}
