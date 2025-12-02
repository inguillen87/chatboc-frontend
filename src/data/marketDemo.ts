import { type MarketCatalogResponse, type MarketCatalogSection, type MarketProduct } from '@/types/market';

export const MARKET_DEMO_PRODUCTS: MarketProduct[] = [
  {
    id: 'demo-market-1',
    name: 'Básicos de almacén',
    description: 'Pack de demostración para probar el flujo de compra.',
    price: 3500,
    imageUrl: null,
    category: 'General',
    tags: ['demo', 'venta'],
  },
  {
    id: 'demo-market-2',
    name: 'Kit de puntos',
    description: 'Ejemplo de producto canjeable con puntos.',
    price: null,
    points: 1500,
    imageUrl: null,
    category: 'Beneficios',
    modality: 'puntos',
    tags: ['puntos'],
  },
  {
    id: 'demo-market-3',
    name: 'Donación solidaria',
    description: 'Simulación de aporte a una causa.',
    price: 0,
    imageUrl: null,
    category: 'Impacto',
    modality: 'donacion',
    tags: ['donacion'],
  },
  {
    id: 'demo-market-4',
    name: 'Combo mayorista',
    description: 'Producto en pack para probar cantidades mayores.',
    price: 8900,
    imageUrl: null,
    category: 'Mayorista',
    tags: ['venta'],
  },
];

export const MARKET_DEMO_SECTIONS: MarketCatalogSection[] = [
  {
    title: 'Destacados',
    description: 'Productos listos para compartir mientras se conecta el catálogo en vivo.',
    items: MARKET_DEMO_PRODUCTS.slice(0, 2),
  },
  {
    title: 'Explorá más',
    description: 'Ejemplos adicionales para probar el flujo de carrito y checkout.',
    items: MARKET_DEMO_PRODUCTS.slice(2),
  },
];

export function buildDemoMarketCatalog(tenantSlug: string): { catalog: MarketCatalogResponse } {
  const tenantName = tenantSlug ? tenantSlug.replace(/[-_]/g, ' ').trim() : 'Catálogo demo';

  const catalog: MarketCatalogResponse = {
    tenantName: tenantName || 'Catálogo demo',
    products: MARKET_DEMO_PRODUCTS,
    sections: MARKET_DEMO_SECTIONS,
    isDemo: true,
    demoReason: 'Usando catálogo de demostración por falta de datos del backend.',
    publicCartUrl: null,
    whatsappShareUrl: null,
  };

  return { catalog };
}
