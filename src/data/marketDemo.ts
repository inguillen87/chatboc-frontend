import type { MarketCatalogSection, MarketProduct } from '@/types/market';

const PLACEHOLDER_BASE = 'https://images.unsplash.com';

const buildImage = (seed: string) => `${PLACEHOLDER_BASE}/${seed}?auto=format&fit=crop&w=900&q=80`;

export const MARKET_DEMO_PRODUCTS: MarketProduct[] = [
  {
    id: 'canje-ecopuntos',
    name: 'Kit de eco bolsas',
    description: 'Cambiá tus puntos verdes por un set de bolsas reutilizables y compostables.',
    points: 120,
    price: null,
    imageUrl: buildImage('photo-1505390593764-8a0b8e0b7e1c'),
    category: 'Canjes',
    promoInfo: 'Canje eco',
    modality: 'canje',
  },
  {
    id: 'reciclaje-premium',
    name: 'Bonificación de tasa de residuos',
    description: 'Premiamos tu reciclaje con un descuento en la próxima liquidación.',
    points: 240,
    price: null,
    imageUrl: buildImage('photo-1508873699372-7aeab60b44ce'),
    category: 'Canjes',
    modality: 'canje',
  },
  {
    id: 'kit-escolar-solidario',
    name: 'Kit escolar solidario',
    description: 'Útiles esenciales para escuelas y programas comunitarios.',
    price: 3500,
    points: null,
    imageUrl: buildImage('photo-1523580846011-d3a5bc25702b'),
    category: 'Productos',
    promoInfo: 'Stock limitado',
    modality: 'venta',
  },
  {
    id: 'campus-digital',
    name: 'Licencia aula digital',
    description: 'Acceso anual a biblioteca y cursos para docentes.',
    price: 5200,
    points: null,
    imageUrl: buildImage('photo-1523580846011-d3a5bc25702b'),
    category: 'Servicios',
    modality: 'Online',
  },
  {
    id: 'bicicleta-diaria',
    name: 'Pase diario de bicis compartidas',
    description: 'Canjeá tus puntos por 24 horas de movilidad sustentable.',
    points: 150,
    price: null,
    imageUrl: buildImage('photo-1508979827776-5b7eb0f58c01'),
    category: 'Movilidad',
    modality: 'canje',
  },
  {
    id: 'arbol-nativo',
    name: 'Adopción de árbol nativo',
    description: 'Sumate al plan forestal y recibe seguimiento del equipo ambiental.',
    price: 950,
    points: null,
    imageUrl: buildImage('photo-1455218873509-8097305ee378'),
    category: 'Sustentabilidad',
    modality: 'venta',
  },
  {
    id: 'visita-planta',
    name: 'Visita guiada a planta de reciclaje',
    description: 'Experiencia educativa para escuelas y empresas.',
    price: 1800,
    points: null,
    imageUrl: buildImage('photo-1441974231531-c6227db76b6e'),
    category: 'Experiencias',
    modality: 'venta',
  },
  {
    id: 'donacion-alimentos',
    name: 'Caja solidaria de alimentos',
    description: 'Arma tu aporte para comedores y organizaciones locales.',
    price: null,
    points: 300,
    imageUrl: buildImage('photo-1504753793650-d4a2b783c15e'),
    category: 'Solidario',
    modality: 'donación',
  },
];

export const MARKET_DEMO_SECTIONS: MarketCatalogSection[] = [
  {
    title: 'Productos con fotos y fichas claras',
    description: 'Catálogo mobile-first con precios, puntos, modalidad y enlaces públicos listos para compartir.',
    badge: 'Catálogo',
    items: [
      MARKET_DEMO_PRODUCTS[2],
      MARKET_DEMO_PRODUCTS[5],
      MARKET_DEMO_PRODUCTS[6],
      MARKET_DEMO_PRODUCTS[3],
    ],
  },
  {
    title: 'Canjes y beneficios',
    description: 'Combina productos pagos con canjes por puntos en un mismo carrito y muestra las bonificaciones disponibles.',
    badge: 'Puntos',
    items: [MARKET_DEMO_PRODUCTS[0], MARKET_DEMO_PRODUCTS[1], MARKET_DEMO_PRODUCTS[4], MARKET_DEMO_PRODUCTS[7]],
  },
  {
    title: 'Carrito compartible',
    description: 'URL y QR públicos para compartir por WhatsApp o email, manteniendo el carrito aislado por tenant.',
    badge: 'Link + QR',
  },
];

export const buildDemoMarketCatalog = (
  tenantSlug: string,
): {
  catalog: {
    tenantName?: string;
    tenantLogoUrl?: string;
    products: MarketProduct[];
    isDemo: true;
    demoReason: string;
    heroImageUrl: string;
    heroSubtitle: string;
    sections: MarketCatalogSection[];
  };
} => {
  const humanizedTenant = tenantSlug
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

  return {
    catalog: {
      tenantName: humanizedTenant || 'Catálogo demo',
      tenantLogoUrl: undefined,
      products: MARKET_DEMO_PRODUCTS,
      isDemo: true,
      demoReason: 'Mostrando catálogo de demostración mientras se conecta el backend.',
      heroImageUrl: buildImage('photo-1520607162513-77705c0f0d4a'),
      heroSubtitle: 'Catálogo listo con fotos, secciones, buscador y carrito demo estilo marketplace.',
      sections: MARKET_DEMO_SECTIONS,
    },
  };
};
