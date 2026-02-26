import { PortalContent } from "@/hooks/usePortalContent";

export const getDemoPortalContent = (): PortalContent => ({
  notifications: [
    {
      id: 'n1',
      title: 'Recibe alertas personalizadas',
      message: 'Activa tus avisos para pedidos y reclamos vía WhatsApp.',
      severity: 'info',
      actionLabel: 'Configurar',
      actionHref: '/portal/cuenta',
      date: 'Hace 2 h',
    },
    {
      id: 'n2',
      title: 'Nuevo beneficio disponible',
      message: 'Canjea tus puntos por descuentos en comercios locales.',
      severity: 'success',
      actionLabel: 'Ver',
      actionHref: '/portal/beneficios',
      date: 'Ayer',
    },
  ],
  events: [
    {
      id: 'e1',
      title: 'Feria de Emprendedores',
      date: '15/08/2024 · 18:00',
      location: 'Plaza Principal',
      status: 'proximo',
      description: 'Conoce los productos de nuestros emprendedores locales.',
      coverUrl: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&q=80&w=800',
    },
    {
      id: 'e2',
      title: 'Taller de Reciclaje',
      date: '20/08/2024 · 10:00',
      location: 'Centro Cultural',
      status: 'inscripcion',
      description: 'Aprende a separar residuos y cuidar el ambiente.',
      coverUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&q=80&w=800',
    }
  ],
  news: [
    {
      id: 'new1',
      title: 'Nuevo sistema de turnos online',
      category: 'servicios',
      date: 'Hoy',
      summary: 'Ahora puedes sacar turnos para trámites municipales desde tu celular.',
      coverUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=800',
    },
    {
      id: 'new2',
      title: 'Campaña de vacunación',
      category: 'salud',
      date: 'Ayer',
      summary: 'Acércate al centro de salud más cercano.',
      coverUrl: 'https://images.unsplash.com/photo-1576091160550-2187d80a8508?auto=format&fit=crop&q=80&w=800',
    }
  ],
  catalog: [
    {
      id: 'b1',
      title: '2x1 en Cine Municipal',
      description: 'Válido para funciones de fin de semana.',
      category: 'beneficios',
      price: 500, // Points
      status: 'available',
      imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=800',
    },
    {
      id: 't1',
      title: 'Solicitud de Poda',
      description: 'Trámite para autorización de poda de arbolado.',
      category: 'tramites',
      status: 'available',
      imageUrl: 'https://images.unsplash.com/photo-1557429287-b2e26467fc2b?auto=format&fit=crop&q=80&w=800',
    }
  ],
  activities: [
    {
      id: 'a1',
      description: 'Solicitud de poda #4021',
      type: 'Trámite',
      status: 'En Proceso',
      statusType: 'info',
      date: 'Hace 2 días',
      link: '/portal/pedidos',
    },
    {
      id: 'a2',
      description: 'Reclamo por luminaria #3992',
      type: 'Reclamo',
      status: 'Resuelto',
      statusType: 'success',
      date: 'Hace 1 semana',
      link: '/portal/pedidos',
    }
  ],
  surveys: [
    {
      id: 's1',
      title: 'Encuesta de Satisfacción Urbana',
      link: '/portal/encuestas/urbana-2024',
    }
  ],
  loyaltySummary: {
    points: 1250,
    level: 'Vecino Participativo',
    surveysCompleted: 3,
    suggestionsShared: 1,
    claimsFiled: 2,
  }
});
