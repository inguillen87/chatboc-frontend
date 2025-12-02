import type { MarketCatalogSection, MarketProduct } from '@/types/market';

const PLACEHOLDER_BASE = 'https://images.unsplash.com';

const buildImage = (seed: string) => `${PLACEHOLDER_BASE}/${seed}?auto=format&fit=crop&w=900&q=80`;

export const MARKET_DEMO_PRODUCTS: MarketProduct[] = [
  {
    id: 'kit-ecobolsas',
    name: 'Kit de eco bolsas reutilizables',
    description: 'Pack de bolsas compostables con ilustraciones educativas.',
    descriptionShort: '4 bolsas · Compostables',
    points: 120,
    price: null,
    imageUrl: buildImage('photo-1505390593764-8a0b8e0b7e1c'),
    category: 'Reciclaje',
    promoInfo: 'Canje eco',
    modality: 'canje',
    publicUrl: '/market/demo/product/kit-ecobolsas',
  },
  {
    id: 'bonificacion-residuos',
    name: 'Bonificación en tasa de residuos',
    description: 'Premiamos tu reciclaje con crédito en la tasa ambiental.',
    descriptionShort: 'Descuento mensual',
    points: 240,
    price: null,
    imageUrl: buildImage('photo-1508873699372-7aeab60b44ce'),
    category: 'Reciclaje',
    modality: 'canje',
    publicUrl: '/market/demo/product/bonificacion-residuos',
  },
  {
    id: 'kit-escolar-solidario',
    name: 'Kit escolar solidario',
    description: 'Útiles esenciales para programas comunitarios y escuelas.',
    descriptionShort: 'Mochila + cuadernos',
    price: 3500,
    points: null,
    imageUrl: buildImage('photo-1523580846011-d3a5bc25702b'),
    category: 'Educación',
    promoInfo: 'Stock limitado',
    modality: 'venta',
    publicUrl: '/market/demo/product/kit-escolar-solidario',
  },
  {
    id: 'licencia-aula-digital',
    name: 'Licencia de aula digital',
    description: 'Acceso anual a cursos y biblioteca digital para docentes.',
    descriptionShort: 'Suscripción anual',
    price: 5200,
    points: null,
    imageUrl: buildImage('photo-1489515217757-5fd1be406fef'),
    category: 'Servicios',
    modality: 'online',
    publicUrl: '/market/demo/product/licencia-aula-digital',
  },
  {
    id: 'pase-bici-compartida',
    name: 'Pase diario de bicis compartidas',
    description: 'Canjeá puntos por 24 horas de movilidad sustentable.',
    descriptionShort: 'Movilidad verde',
    points: 150,
    price: null,
    imageUrl: buildImage('photo-1508979827776-5b7eb0f58c01'),
    category: 'Movilidad',
    modality: 'canje',
    promoInfo: 'Beneficio ciudadano',
    publicUrl: '/market/demo/product/pase-bici-compartida',
  },
  {
    id: 'arbol-nativo',
    name: 'Adopción de árbol nativo',
    description: 'Incluye plantación, riego y seguimiento ambiental.',
    descriptionShort: 'Plan forestal',
    price: 950,
    points: null,
    imageUrl: buildImage('photo-1455218873509-8097305ee378'),
    category: 'Sustentabilidad',
    modality: 'venta',
    publicUrl: '/market/demo/product/arbol-nativo',
  },
  {
    id: 'visita-planta',
    name: 'Visita guiada a planta de reciclaje',
    description: 'Experiencia educativa para escuelas, empresas o barrios.',
    descriptionShort: 'Turno programado',
    price: 1800,
    points: null,
    imageUrl: buildImage('photo-1441974231531-c6227db76b6e'),
    category: 'Experiencias',
    modality: 'venta',
    publicUrl: '/market/demo/product/visita-planta',
  },
  {
    id: 'caja-solidaria',
    name: 'Caja solidaria de alimentos',
    description: 'Aporte completo para comedores y organizaciones locales.',
    descriptionShort: 'Donación curada',
    price: null,
    points: 300,
    imageUrl: buildImage('photo-1504753793650-d4a2b783c15e'),
    category: 'Solidario',
    modality: 'donación',
    publicUrl: '/market/demo/product/caja-solidaria',
  },
  {
    id: 'combo-reciclados',
    name: 'Combo de artículos reciclados',
    description: 'Cuadernos, lapiceras y portanotebooks hechos con reciclaje local.',
    descriptionShort: 'Hecho con materiales recuperados',
    price: 7200,
    points: null,
    imageUrl: buildImage('photo-1523475472560-d2df97ec485c'),
    category: 'Reciclaje',
    modality: 'venta',
    promoInfo: 'Edición circular',
    publicUrl: '/market/demo/product/combo-reciclados',
  },
  {
    id: 'donacion-tecnologia',
    name: 'Donación de notebooks reacondicionadas',
    description: 'Equipos listos para programas de inclusión digital.',
    descriptionShort: 'Equipos reacondicionados',
    price: null,
    points: 450,
    imageUrl: buildImage('photo-1518779578993-ec3579fee39f'),
    category: 'Solidario',
    modality: 'donación',
    publicUrl: '/market/demo/product/donacion-tecnologia',
  },
  {
    id: 'servicio-retorno',
    name: 'Servicio de retiro de reciclables',
    description: 'Agenda un retiro para oficinas, empresas o edificios.',
    descriptionShort: 'Programación semanal',
    price: 2100,
    points: null,
    imageUrl: buildImage('photo-1581578027605-89c5c23cd1af'),
    category: 'Servicios',
    modality: 'venta',
    publicUrl: '/market/demo/product/servicio-retorno',
  },
  {
    id: 'kit-compost',
    name: 'Kit de compostaje domiciliario',
    description: 'Incluye composteras, manual y soporte técnico.',
    descriptionShort: 'Starter kit',
    price: 4800,
    points: null,
    imageUrl: buildImage('photo-1441974231531-c6227db76b6e?crop=entropy'),
    category: 'Sustentabilidad',
    modality: 'venta',
    promoInfo: 'Incluye capacitación',
    publicUrl: '/market/demo/product/kit-compost',
  },
];

export const MARKET_DEMO_SECTIONS: MarketCatalogSection[] = [
  {
    title: 'Catálogo con fotos y fichas listas',
    description: 'Precios, puntos, modalidad y enlaces públicos para compartir en segundos.',
    badge: 'Catálogo',
    items: [
      MARKET_DEMO_PRODUCTS[2],
      MARKET_DEMO_PRODUCTS[8],
      MARKET_DEMO_PRODUCTS[5],
      MARKET_DEMO_PRODUCTS[11],
    ],
  },
  {
    title: 'Canjes, puntos y recompensas',
    description: 'Combina pagos con canjes en un mismo checkout y muestra los beneficios disponibles.',
    badge: 'Puntos',
    items: [MARKET_DEMO_PRODUCTS[0], MARKET_DEMO_PRODUCTS[1], MARKET_DEMO_PRODUCTS[4], MARKET_DEMO_PRODUCTS[7]],
  },
  {
    title: 'Reciclaje y economía circular',
    description: 'Artículos reciclados, retiros y programas verdes administrables por tenant.',
    badge: 'Economía circular',
    items: [MARKET_DEMO_PRODUCTS[8], MARKET_DEMO_PRODUCTS[9], MARKET_DEMO_PRODUCTS[10], MARKET_DEMO_PRODUCTS[0]],
  },
  {
    title: 'Carrito compartible con QR',
    description: 'URL pública aislada por tenant para campañas de WhatsApp, email o códigos QR.',
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
      demoReason: 'Mostramos un catálogo listo mientras se conecta el backend.',
      heroImageUrl: buildImage('photo-1520607162513-77705c0f0d4a'),
      heroSubtitle: 'Marketplace con fotos, canjes, donaciones, buscador y carrito funcional para demos o producción.',
      sections: MARKET_DEMO_SECTIONS,
    },
  };
};
