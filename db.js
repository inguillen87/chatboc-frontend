
let mockTickets = null;

export function __setTickets(tickets) {
  mockTickets = tickets;
}

export function getTickets(filters) {
    if (mockTickets) {
        return mockTickets;
    }

    const N = 1000;
    const tickets = [];
    const now = Date.now();
    for (let i = 0; i < N; i++) {
        tickets.push({
            id: i,
            category: i % 2 === 0 ? 'Alumbrado' : 'Bacheo',
            municipality: 'Muni1',
            responseMs: Math.random() * 20000000,
            createdAt: new Date(now - Math.random() * 2000000000).toISOString()
        });
    }
    return cachedTickets;
}

let mockMessages = null;

export function __setMessages(msgs) {
  mockMessages = msgs;
}

export function getMessages() {
  if (mockMessages) {
    return mockMessages;
  }

  const N = 10000;
  const messages = [];
  const now = Date.now();
  for (let i = 0; i < N; i++) {
    messages.push({
      id: i,
      text: `Message ${i}`,
      timestamp: now - Math.floor(Math.random() * 31536000000)
    });
  }
  return messages;
}
