import { Ticket } from '@/types/tickets';

export const mockTickets: Ticket[] = [
  {
    id: 'TICKET-1234',
    title: 'Problema con mi última factura',
    status: 'nuevo',
    priority: 'alta',
    user: {
      id: 'USER-001',
      name: 'Juan Perez',
      email: 'juan.perez@example.com',
      avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
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
      avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
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
  {
    id: 'TICKET-1232',
    title: 'El pedido no ha llegado',
    status: 'en-espera',
    priority: 'alta',
    user: {
      id: 'USER-003',
      name: 'Carlos Sanchez',
      email: 'carlos.sanchez@example.com',
       avatarUrl: 'https://randomuser.me/api/portraits/men/33.jpg',
    },
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    lastMessage: 'Sigo esperando una respuesta sobre mi pedido.',
    messages: [],
    attachments: [],
    activityLog: []
  },
    {
    id: 'TICKET-1231',
    title: 'Problema de acceso a mi cuenta',
    status: 'resuelto',
    priority: 'media',
    user: {
      id: 'USER-004',
      name: 'Laura Fernandez',
      email: 'laura.fernandez@example.com',
      avatarUrl: 'https://randomuser.me/api/portraits/women/34.jpg',
    },
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    lastMessage: '¡Muchas gracias! Ya pude acceder.',
    messages: [],
    attachments: [],
    activityLog: []
  },
  {
    id: 'TICKET-1230',
    title: 'Consulta sobre precios mayoristas',
    status: 'cerrado',
    priority: 'baja',
    user: {
      id: 'USER-005',
      name: 'Pedro Rodriguez',
      email: 'pedro.rodriguez@example.com',
    },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastMessage: 'Perfecto, gracias por la información.',
    messages: [],
    attachments: [],
    activityLog: []
  },
];
