
import { TenantEventItem, TenantNewsItem, TenantPublicInfo, TenantSummary } from '@/types/tenant';
import type { PublicSurveyListResult } from '@/api/encuestas';

export const MOCK_TENANT_INFO: TenantPublicInfo = {
  slug: 'demo-municipio',
  nombre: 'Municipio Demo',
  logo_url: '/chatbocar2.png',
  tipo: 'municipio',
  descripcion: 'Bienvenido al portal oficial de su municipio. Gestión, noticias y servicios en un solo lugar.',
  public_base_url: 'https://chatboc.ar/demo-municipio',
  public_cart_url: 'https://chatboc.ar/demo-municipio/cart',
  public_catalog_url: 'https://chatboc.ar/demo-municipio/productos',
  whatsapp_share_url: 'https://wa.me/?text=Visita%20nuestro%20portal',
  tema: {
    primaryColor: '#0ea5e9',
    secondaryColor: '#64748b',
  }
};

export const MOCK_JUNIN_TENANT_INFO: TenantPublicInfo = {
  slug: 'municipio-junin',
  nombre: 'Municipalidad de Junín',
  logo_url: 'https://chatboc-demo-widget-oigs.vercel.app/stickerJuni2.webp',
  tipo: 'municipio',
  descripcion: 'Bienvenido al asistente virtual JUNI de la Municipalidad de Junín. Gestión, trámites y servicios.',
  public_base_url: 'https://chatboc.ar/municipio-junin',
  public_cart_url: 'https://chatboc.ar/municipio-junin/cart',
  public_catalog_url: 'https://chatboc.ar/municipio-junin/productos',
  whatsapp_share_url: 'https://wa.me/?text=Municipalidad%20de%20Junín',
  tema: {
    primaryColor: '#006C3F',
    secondaryColor: '#d4a01a',
  }
};

export const MOCK_NEWS: TenantNewsItem[] = [
  {
    id: '1',
    titulo: 'Inauguración del nuevo centro cultural',
    resumen: 'Este viernes se abren las puertas del nuevo espacio para el arte y la cultura local.',
    body: 'El intendente y autoridades locales estarán presentes en la inauguración...',
    cover_url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&q=80&w=1000',
    publicado_at: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    tags: ['Cultura', 'Obras'],
  },
  {
    id: '2',
    titulo: 'Campaña de vacunación antigripal',
    resumen: 'Comienza la campaña anual en todos los centros de salud del municipio.',
    body: 'Acercate a tu centro de salud más cercano con tu DNI...',
    cover_url: 'https://images.unsplash.com/photo-1632635133649-57e05417852a?auto=format&fit=crop&q=80&w=1000',
    publicado_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    tags: ['Salud', 'Comunidad'],
  },
  {
    id: '3',
    titulo: 'Feria de emprendedores locales',
    resumen: 'Veni a conocer los productos de nuestros vecinos este fin de semana en la plaza central.',
    body: 'Habrá puestos de comida, artesanías y música en vivo...',
    cover_url: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&q=80&w=1000',
    publicado_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    tags: ['Economía', 'Eventos'],
  }
];

export const MOCK_EVENTS: TenantEventItem[] = [
  {
    id: '1',
    titulo: 'Festival de Música al Aire Libre',
    descripcion: 'Disfrutá de bandas locales en vivo en el anfiteatro municipal.',
    cover_url: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=1000',
    starts_at: new Date(Date.now() + 86400000 * 2).toISOString(), // In 2 days
    ends_at: new Date(Date.now() + 86400000 * 2 + 7200000).toISOString(), // +2 hours
    lugar: 'Anfiteatro Municipal',
    tags: ['Música', 'Gratis'],
  },
  {
    id: '2',
    titulo: 'Taller de Huertas Comunitarias',
    descripcion: 'Aprendé a cultivar tus propios alimentos en casa.',
    cover_url: 'https://images.unsplash.com/photo-1592419044706-39796d40f98c?auto=format&fit=crop&q=80&w=1000',
    starts_at: new Date(Date.now() + 86400000 * 5).toISOString(),
    lugar: 'Centro Cultural',
    tags: ['Ecología', 'Taller'],
  },
  {
    id: '3',
    titulo: 'Maratón Aniversario',
    descripcion: 'Sumate a los 10K por el aniversario de la ciudad.',
    cover_url: 'https://images.unsplash.com/photo-1552674605-46945596515a?auto=format&fit=crop&q=80&w=1000',
    starts_at: new Date(Date.now() + 86400000 * 14).toISOString(),
    lugar: 'Plaza Mayor',
    tags: ['Deporte', 'Salud'],
  }
];

export const MOCK_SURVEYS: PublicSurveyListResult = [
  {
    slug: 'satisfaccion-servicios',
    titulo: 'Encuesta de Satisfacción de Servicios Públicos',
    descripcion: 'Ayudanos a mejorar la recolección de residuos y alumbrado.',
    portada_url: null,
    estado: 'activa',
  },
  {
    slug: 'presupuesto-participativo',
    titulo: 'Votación Presupuesto Participativo',
    descripcion: 'Elegí qué obras querés para tu barrio este año.',
    portada_url: null,
    estado: 'activa',
  }
];
