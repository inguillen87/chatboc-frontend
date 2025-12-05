import { DemoLoyaltySummary, getDemoLoyaltySummary } from '@/utils/demoLoyalty';

export type PortalNotification = {
  id: string;
  title: string;
  message: string;
  severity?: 'info' | 'success' | 'warning' | 'error';
  actionLabel?: string;
  actionHref?: string;
  date?: string;
};

export type PortalEvent = {
  id: string;
  title: string;
  date: string;
  location: string;
  status: 'inscripcion' | 'proximo' | 'finalizado';
  description: string;
  spots?: number;
  registered?: number;
  coverUrl?: string;
};

export type PortalNewsItem = {
  id: string;
  title: string;
  category: string;
  date: string;
  summary: string;
  link?: string;
  featured?: boolean;
  coverUrl?: string;
};

export type PortalCatalogItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  priceLabel?: string;
  price?: number; // Added numeric price
  status?: 'available' | 'coming_soon' | 'paused';
  imageUrl?: string;
};

export type PortalActivity = {
  id: string;
  description: string;
  type: string;
  status?: string;
  statusType?: 'success' | 'warning' | 'info' | 'error';
  date?: string;
  link?: string;
};

export type PortalSurvey = {
  id: string;
  title: string;
  link?: string;
};

export type PortalContent = {
  notifications: PortalNotification[];
  events: PortalEvent[];
  news: PortalNewsItem[];
  catalog: PortalCatalogItem[];
  activities: PortalActivity[];
  surveys: PortalSurvey[];
  loyaltySummary?: DemoLoyaltySummary;
};

export const demoPortalContent: PortalContent = {
  loyaltySummary: getDemoLoyaltySummary(),
  notifications: [
    {
      id: 'notif-01',
      title: 'Recibe alertas personalizadas',
      message: 'Activa tus avisos para pedidos, reclamos, encuestas y eventos en curso.',
      severity: 'info',
      actionLabel: 'Configurar',
      actionHref: '/portal/cuenta',
      date: 'Hace 2 h',
    },
    {
      id: 'notif-02',
      title: 'Sincroniza tu perfil',
      message: 'Usa tu correo o teléfono para mantener tu actividad y puntos conectados a tu cuenta.',
      severity: 'success',
      date: 'Hoy',
    },
  ],
  events: [
    {
      id: 'event-001',
      title: 'Sesión de onboarding digital',
      date: '15/08/2024 · 18:00',
      location: 'Transmisión en vivo',
      status: 'inscripcion',
      description: 'Guía práctica para seguir pedidos, reclamos y beneficios desde el portal.',
      spots: 200,
      registered: 132,
      coverUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=60',
    },
    {
      id: 'event-002',
      title: 'Lanzamiento de nuevas notificaciones',
      date: '22/08/2024 · 10:00',
      location: 'Streaming',
      status: 'proximo',
      description: 'Descubre mejoras en avisos push, email y recordatorios para tus trámites.',
      coverUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=900&q=60',
    },
    {
      id: 'event-003',
      title: 'Mesa de participación digital',
      date: '02/08/2024 · 17:00',
      location: 'Centro cívico - Sala colaborativa',
      status: 'finalizado',
      description: 'Sesión de escucha activa para priorizar mejoras del portal.',
      coverUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=60',
    },
  ],
  news: [
    {
      id: 'news-001',
      title: 'Panel de usuario con vista unificada',
      category: 'plataforma',
      date: '08/08/2024',
      summary: 'Revisa pedidos, reclamos, encuestas y beneficios desde un solo lugar con métricas en tiempo real.',
      featured: true,
      coverUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=60',
    },
    {
      id: 'news-002',
      title: 'Consejos para mantener tus datos actualizados',
      category: 'tips',
      date: '05/08/2024',
      summary: 'Asegura entregas y avisos en horario manteniendo tu información de contacto vigente.',
      coverUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=60',
    },
    {
      id: 'news-003',
      title: 'Programa de recompensas por participación',
      category: 'participación',
      date: '01/08/2024',
      summary: 'Suma puntos con compras, encuestas y sugerencias para canjear beneficios.',
      coverUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=60',
    },
  ],
  catalog: [
    {
      id: 'catalog-001',
      title: 'Seguimiento de pedidos y trámites',
      description: 'Monitorea estados, pagos y entregas con actualizaciones en tiempo real.',
      category: 'gestiones',
      priceLabel: '$ 1,500',
      price: 1500,
      status: 'available',
      imageUrl: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=900&q=60',
    },
    {
      id: 'catalog-002',
      title: 'Recordatorios y notificaciones',
      description: 'Recibe avisos de vencimientos, retiros y eventos importantes en todos tus dispositivos.',
      category: 'avisos',
      priceLabel: '$ 500',
      price: 500,
      status: 'available',
      imageUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=60',
    },
    {
      id: 'catalog-003',
      title: 'Módulo de beneficios y puntos',
      description: 'Consulta tu saldo, canjes disponibles y próximas metas de participación.',
      category: 'beneficios',
      priceLabel: 'Próximamente',
      status: 'coming_soon',
      imageUrl: 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&w=900&q=60',
    },
  ],
  activities: [
    {
      id: 'activity-001',
      description: 'Revisaste el seguimiento de tu último pedido',
      type: 'Gestión',
      status: 'En seguimiento',
      statusType: 'info',
      date: 'Hoy',
      link: '/portal/pedidos',
    },
    {
      id: 'activity-002',
      description: 'Enviaste una sugerencia desde el panel',
      type: 'Participación',
      status: 'Recibida',
      statusType: 'success',
      date: 'Ayer',
      link: '/portal/beneficios',
    },
    {
      id: 'activity-003',
      description: 'Registraste un reclamo logístico',
      type: 'Reclamo',
      status: 'En revisión',
      statusType: 'warning',
      date: 'Esta semana',
      link: '/portal/pedidos',
    },
  ],
  surveys: [
    {
      id: 'survey-001',
      title: 'Encuesta rápida sobre la experiencia en el portal',
      link: '/portal/encuestas',
    },
  ],
};
