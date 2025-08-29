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

function getTickets() {
  return tickets;
}

function __setTickets(newTickets) {
  tickets = newTickets;
}

function getMessages() {
  return messages;
}

function __setMessages(newMessages) {
  messages = newMessages;
}

// Devuelve el historial de mensajes para un ticket específico
function getTicketMessagesById(ticketId) {
  return messages.filter(m => m.ticketId === Number(ticketId));
}

module.exports = {
  getTickets,
  __setTickets,
  getMessages,
  __setMessages,
  getTicketMessagesById,
};
