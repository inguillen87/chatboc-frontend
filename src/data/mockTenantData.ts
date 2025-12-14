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

export const getFallbackTenantInfo = (slug: string | null | undefined, token?: string | null): TenantPublicInfo => {
    const s = slug || 'demo-tenant';

    // Detailed mocks for specific demos
    if (s.includes('bodega')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Bodega Demo',
            tipo: 'pyme',
            descripcion: 'Vinos de autor, catas y envíos a todo el país.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/920/920583.png', // Wine bottle & glass icon
            tema: { primaryColor: '#722F37', secondaryColor: '#A52A2A' } // Wine colors
        };
    }
    if (s.includes('ferreteria')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Ferretería Demo',
            tipo: 'pyme',
            descripcion: 'Herramientas profesionales y asesoramiento técnico.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/1037/1037970.png', // Hammer/Wrench icon
            tema: { primaryColor: '#F97316', secondaryColor: '#475569' } // Orange/Slate
        };
    }
    if (s.includes('almacen') || s.includes('kiosco')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Almacén Demo',
            tipo: 'pyme',
            descripcion: 'Todo lo que necesitás para tu hogar, cerca de vos.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/3081/3081986.png', // Groceries icon
            tema: { primaryColor: '#16A34A', secondaryColor: '#FCD34D' }
        };
    }
    if (s.includes('farmacia')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Farmacia Demo',
            tipo: 'pyme',
            descripcion: 'Salud y bienestar. Envíos a domicilio.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/3022/3022588.png', // Medical cross/pill icon
            tema: { primaryColor: '#06B6D4', secondaryColor: '#10B981' }
        };
    }
    if (s.includes('restaurante') || s.includes('gastronomia')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Restaurante Demo',
            tipo: 'pyme',
            descripcion: 'Sabores únicos. Reservas y delivery.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png', // Chef hat/Cutlery
            tema: { primaryColor: '#DC2626', secondaryColor: '#FBBF24' }
        };
    }
    if (s.includes('tienda') || s.includes('ropa') || s.includes('local_comercial')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Tienda de Ropa Demo',
            tipo: 'pyme',
            descripcion: 'Moda y estilo. Nueva colección disponible.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/3159/3159614.png', // Shopping bag/shirt
            tema: { primaryColor: '#EC4899', secondaryColor: '#8B5CF6' }
        };
    }
    if (s.includes('logistica') || s.includes('transporte')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Logística Demo',
            tipo: 'pyme',
            descripcion: 'Tu carga en movimiento. Envíos seguros.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/759/759238.png', // Truck icon
            tema: { primaryColor: '#2563EB', secondaryColor: '#64748B' }
        };
    }
    if (s.includes('seguros')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Seguros Demo',
            tipo: 'pyme',
            descripcion: 'Tranquilidad para vos y tu familia.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/2966/2966334.png', // Shield icon
            tema: { primaryColor: '#4F46E5', secondaryColor: '#A5B4FC' }
        };
    }
    if (s.includes('fintech') || s.includes('banca')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Fintech Demo',
            tipo: 'pyme',
            descripcion: 'Tus finanzas, simplificadas.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png', // Wallet/Coin icon
            tema: { primaryColor: '#7C3AED', secondaryColor: '#C4B5FD' }
        };
    }
    if (s.includes('inmobiliaria')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Inmobiliaria Demo',
            tipo: 'pyme',
            descripcion: 'Encontrá tu lugar en el mundo.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/602/602182.png', // House icon
            tema: { primaryColor: '#059669', secondaryColor: '#6EE7B7' }
        };
    }
    if (s.includes('industria') || s.includes('energia')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Industria Demo',
            tipo: 'pyme',
            descripcion: 'Soluciones integrales para tu empresa.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/1541/1541413.png', // Factory icon
            tema: { primaryColor: '#475569', secondaryColor: '#94A3B8' }
        };
    }
    if (s.includes('clinica') || s.includes('medico') || s.includes('salud')) {
        return {
            ...MOCK_TENANT_INFO,
            slug: s,
            nombre: 'Clínica Demo',
            tipo: 'pyme',
            descripcion: 'Cuidamos tu salud. Turnos online.',
            logo_url: 'https://cdn-icons-png.flaticon.com/512/2966/2966327.png', // Stethoscope icon
            tema: { primaryColor: '#0EA5E9', secondaryColor: '#7DD3FC' }
        };
    }

    return { ...MOCK_TENANT_INFO, slug: s, nombre: s === 'demo-tenant' ? 'Demo Tenant' : s };
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
