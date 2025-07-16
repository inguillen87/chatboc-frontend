let tickets = [
  { municipality: 'Alpha', category: 'baches', responseMs: 4 * 60 * 60 * 1000 },
  { municipality: 'Alpha', category: 'limpieza', responseMs: 2 * 60 * 60 * 1000 },
  { municipality: 'Beta', category: 'baches', responseMs: 8 * 60 * 60 * 1000 },
  { municipality: 'Beta', category: 'arbolado', responseMs: 6 * 60 * 60 * 1000 },
];

let messages = [
  { municipality: 'Alpha', timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000 },
  { municipality: 'Alpha', timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000 },
  { municipality: 'Beta', timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000 },
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

export {
  getTickets,
  __setTickets,
  getMessages,
  __setMessages,
};
