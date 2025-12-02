import type { MarketCatalogResponse, MarketCatalogSection, MarketProduct } from '@/types/market';

export const MARKET_DEMO_PRODUCTS: MarketProduct[] = [
  {
    id: 'demo-product-1',
    name: 'Servicio de orientación',
    description: 'Consulta breve para guiar el uso de la plataforma.',
    price: 0,
    points: 900,
    imageUrl: null,
    category: 'Servicios',
    tags: ['soporte', 'orientación'],
    unit: 'sesión',
    quantity: 1,
    promoInfo: 'Incluye seguimiento por chat',
  },
  {
    id: 'demo-product-2',
    name: 'Kit informativo digital',
    description: 'Material descargable con pasos y recomendaciones generales.',
    price: 3500,
    points: null,
    imageUrl: null,
    category: 'Recursos',
    tags: ['documentación'],
    unit: 'archivo',
    quantity: 1,
  },
  {
    id: 'demo-product-3',
    name: 'Credenciales autoadhesivas',
    description: 'Plancha con calcomanías genéricas listas para usar.',
    price: 6800,
    points: null,
    imageUrl: null,
    category: 'Materiales',
    tags: ['señalética'],
    unit: 'paquete',
    quantity: 1,
  },
  {
    id: 'demo-product-4',
    name: 'Participación solidaria',
    description: 'Contribución para iniciativas abiertas y comunitarias.',
    price: 1500,
    points: null,
    imageUrl: null,
    category: 'Donaciones',
    tags: ['donación'],
    unit: 'aporte',
    quantity: 1,
  },
];

export const MARKET_DEMO_SECTIONS: MarketCatalogSection[] = [
  {
    title: 'Productos destacados',
    description: 'Ejemplos de artículos disponibles mientras se conecta el catálogo en vivo.',
    items: MARKET_DEMO_PRODUCTS.slice(0, 3),
  },
  {
    title: 'Acciones rápidas',
    description: 'Opciones de prueba que ilustran el flujo de compra.',
    items: MARKET_DEMO_PRODUCTS,
  },
];

export function buildDemoMarketCatalog(tenantSlug?: string | null): { catalog: MarketCatalogResponse } {
  const fallbackName = tenantSlug ? `Catálogo demo (${tenantSlug})` : 'Catálogo demo';
  return {
    catalog: {
      tenantName: fallbackName,
      products: MARKET_DEMO_PRODUCTS,
      publicCartUrl: null,
      whatsappShareUrl: null,
      isDemo: true,
      demoReason: 'Se muestra un catálogo de demostración hasta recibir productos del backend.',
      heroSubtitle: 'Este catálogo es genérico y se reemplaza automáticamente cuando llegan productos en vivo.',
      sections: MARKET_DEMO_SECTIONS,
    },
  };
}
