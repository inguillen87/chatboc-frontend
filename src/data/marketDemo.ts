import type { MarketProduct } from '@/types/market';

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
  },
  {
    id: 'reciclaje-premium',
    name: 'Bonificación de tasa de residuos',
    description: 'Premiamos tu reciclaje con un descuento en la próxima liquidación.',
    points: 240,
    price: null,
    imageUrl: buildImage('photo-1508873699372-7aeab60b44ce'),
  },
  {
    id: 'kit-escolar-solidario',
    name: 'Kit escolar solidario',
    description: 'Útiles esenciales para escuelas y programas comunitarios.',
    price: 3500,
    points: null,
    imageUrl: buildImage('photo-1523580846011-d3a5bc25702b'),
  },
  {
    id: 'campus-digital',
    name: 'Licencia aula digital',
    description: 'Acceso anual a biblioteca y cursos para docentes.',
    price: 5200,
    points: null,
    imageUrl: buildImage('photo-1523580846011-d3a5bc25702b'),
  },
  {
    id: 'bicicleta-diaria',
    name: 'Pase diario de bicis compartidas',
    description: 'Canjeá tus puntos por 24 horas de movilidad sustentable.',
    points: 150,
    price: null,
    imageUrl: buildImage('photo-1508979827776-5b7eb0f58c01'),
  },
  {
    id: 'arbol-nativo',
    name: 'Adopción de árbol nativo',
    description: 'Sumate al plan forestal y recibe seguimiento del equipo ambiental.',
    price: 950,
    points: null,
    imageUrl: buildImage('photo-1455218873509-8097305ee378'),
  },
  {
    id: 'visita-planta',
    name: 'Visita guiada a planta de reciclaje',
    description: 'Experiencia educativa para escuelas y empresas.',
    price: 1800,
    points: null,
    imageUrl: buildImage('photo-1441974231531-c6227db76b6e'),
  },
  {
    id: 'donacion-alimentos',
    name: 'Caja solidaria de alimentos',
    description: 'Arma tu aporte para comedores y organizaciones locales.',
    price: null,
    points: 300,
    imageUrl: buildImage('photo-1504753793650-d4a2b783c15e'),
  },
];

export const buildDemoMarketCatalog = (
  tenantSlug: string,
): { catalog: { tenantName?: string; tenantLogoUrl?: string; products: MarketProduct[]; isDemo: true; demoReason: string } } => {
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
    },
  };
};
