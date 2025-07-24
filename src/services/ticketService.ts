import { Ticket } from '@/types/tickets';

const generateRandomAvatar = (seed: string) => {
    return `https://i.pravatar.cc/150?u=${seed}`;
}

const simulatedTickets: Ticket[] = [
  {
    id: 'TICKET-1234',
    title: 'Problema con mi última factura',
    status: 'nuevo',
    priority: 'alta',
    user: {
      id: 'USER-001',
      name: 'Juan Perez',
      email: 'juan.perez@example.com',
      avatarUrl: generateRandomAvatar('juan.perez@example.com'),
      location: 'Buenos Aires, Argentina',
      phone: '+54 9 11 1234-5678',
    },
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    lastMessage: 'Hola, tengo un problema con mi última factura. El monto es incorrecto.',
    messages: [
      { id: 'MSG-1', author: 'user', content: 'Hola, tengo un problema con mi última factura. El monto es incorrecto.', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString() },
      { id: 'MSG-2', author: 'agent', agentName: 'Ana', content: 'Hola Juan, gracias por contactarnos. ¿Podrías por favor indicarme el número de factura?', timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString() },
    ],
    attachments: [
      { id: 'ATT-1', filename: 'factura_error.pdf', url: '#', size: 128000 },
    ],
    activityLog: [
       { type: 'status_change', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), content: 'Ticket creado con prioridad Alta.' },
    ]
  },
  {
    id: 'TICKET-1233',
    title: 'Duda sobre la garantía del producto X',
    status: 'abierto',
    priority: 'media',
    user: {
      id: 'USER-002',
      name: 'Maria Garcia',
      email: 'maria.garcia@example.com',
      avatarUrl: generateRandomAvatar('maria.garcia@example.com'),
      location: 'Madrid, España',
      phone: '+34 91 987 65 43',
    },
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    lastMessage: 'Sí, es el modelo Pro. ¿Qué cubre la garantía?',
    messages: [],
    attachments: [],
    activityLog: []
  },
];


export const getTickets = async (anonId?: string): Promise<Ticket[]> => {
  console.log(`Fetching tickets... (anonId: ${anonId})`);
  // Simular una llamada a la API
  return new Promise(resolve => {
    setTimeout(() => {
      console.log('Resolving with simulated tickets.');
      resolve(simulatedTickets);
    }, 500); // Simular un pequeño retraso de red
  });
};

export const getTicketById = async (id: string): Promise<Ticket | undefined> => {
    console.log(`Fetching ticket by id: ${id}`);
    return new Promise(resolve => {
        setTimeout(() => {
            const ticket = simulatedTickets.find(t => t.id === id);
            resolve(ticket);
        }, 300);
    });
};
