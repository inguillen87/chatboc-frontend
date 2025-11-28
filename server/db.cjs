const defaultState = {
  tickets: [
    { municipality: 'Alpha', category: 'baches', responseMs: 4 * 60 * 60 * 1000 },
    { municipality: 'Alpha', category: 'limpieza', responseMs: 2 * 60 * 60 * 1000 },
    { municipality: 'Beta', category: 'baches', responseMs: 8 * 60 * 60 * 1000 },
    { municipality: 'Beta', category: 'arbolado', responseMs: 6 * 60 * 60 * 1000 },
  ],
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

const state = globalThis.__chatbocDbState || { ...defaultState };
globalThis.__chatbocDbState = state;

function getTickets() {
  return state.tickets;
}

function __setTickets(newTickets) {
  state.tickets = newTickets;
}

function getMessages() {
  return state.messages;
}

function __setMessages(newMessages) {
  state.messages = newMessages;
}

function getTicketMessagesById(ticketId) {
  return state.messages.filter(m => m.ticketId === Number(ticketId));
}

module.exports = {
  getTickets,
  __setTickets,
  getMessages,
  __setMessages,
  getTicketMessagesById,
};
