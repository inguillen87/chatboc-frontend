const dbState = globalThis.__chatbocDbState || {
  tickets: [],
  messages: [
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
  ],
};

globalThis.__chatbocDbState = dbState;

function getTickets() {
  return dbState.tickets;
}

function __setTickets(newTickets) {
  dbState.tickets = newTickets;
}

function getMessages() {
  return dbState.messages;
}

function __setMessages(newMessages) {
  dbState.messages = newMessages;
}

function getTicketMessagesById(ticketId) {
  return dbState.messages.filter(m => m.ticketId === Number(ticketId));
}

module.exports = {
  getTickets,
  __setTickets,
  getMessages,
  __setMessages,
  getTicketMessagesById,
};
