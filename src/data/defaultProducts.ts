import type { ProductDetails } from '@/components/product/ProductCard';
import { enhanceProductDetails } from '@/utils/cartPayload';

const BASE_PLACEHOLDER = 'https://images.unsplash.com';

const RAW_DEFAULT_PRODUCTS: ProductDetails[] = [
  {
    id: 'donacion-alimentos',
    nombre: 'Caja solidaria de alimentos',
    descripcion: 'Combinación de alimentos no perecederos para reforzar programas comunitarios.',
    categoria: 'Donaciones',
    badge: 'Donación',
    badge_variant: 'success',
    precio_unitario: 4500,
    precio_anterior: 5200,
    presentacion: 'Incluye aceite, arroz, fideos y artículos de higiene básica.',
    imagen_url: `${BASE_PLACEHOLDER}/photo-1504753793650-d4a2b783c15e?auto=format&fit=crop&w=600&q=80`,
    stock_disponible: 48,
  },
  {
    id: 'kit-escolar',
    nombre: 'Kit escolar comunitario',
    descripcion: 'Mochila con útiles básicos para acompañar el inicio de clases.',
    categoria: 'Programas Sociales',
    badge: 'Beneficio',
    badge_variant: 'secondary',
    precio_unitario: 1500,
    precio_anterior: 1800,
    presentacion: 'Incluye cuadernos, lápices, cartuchera y set artístico.',
    imagen_url: `${BASE_PLACEHOLDER}/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80`,
    stock_disponible: 32,
  },
  {
    id: 'puntos-bicicleta',
    nombre: 'Pase diario de bicis compartidas',
    descripcion: 'Canjeá tus puntos por 24 horas de acceso a la red de bicicletas públicas.',
    categoria: 'Puntos Ciudadanos',
    badge: '120 pts',
    badge_variant: 'outline',
    precio_unitario: 240,
    precio_anterior: 320,
    presentacion: 'Disponible para vecinos registrados en el programa de movilidad.',
    imagen_url: `${BASE_PLACEHOLDER}/photo-1508979827776-5b7eb0f58c01?auto=format&fit=crop&w=600&q=80`,
    stock_disponible: 120,
  },
  {
    id: 'arbol-nativo',
    nombre: 'Adopción de árbol nativo',
    descripcion: 'Sumate al plan forestal municipal y apadriná un árbol.',
    categoria: 'Sustentabilidad',
    badge: 'Impacto+',
    badge_variant: 'success',
    precio_unitario: 820,
    precio_anterior: 980,
    presentacion: 'Incluye seguimiento durante el primer año.',
    imagen_url: `${BASE_PLACEHOLDER}/photo-1455218873509-8097305ee378?auto=format&fit=crop&w=600&q=80`,
    stock_disponible: 64,
  },
  {
    id: 'turismo-local',
    nombre: 'Tour cultural guiado',
    descripcion: 'Recorrido por puntos históricos para grupos reducidos.',
    categoria: 'Turismo',
    badge: 'Novedad',
    badge_variant: 'warning',
    precio_unitario: 2750,
    precio_anterior: 3100,
    presentacion: 'Duración 90 minutos. Incluye entrada a museos asociados.',
    imagen_url: `${BASE_PLACEHOLDER}/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=600&q=80`,
    stock_disponible: 18,
  },
  {
    id: 'canje-reciclaje',
    nombre: 'Canje eco puntos',
    descripcion: 'Bonificación sobre la tasa de residuos para quienes reciclan.',
    categoria: 'Puntos Ciudadanos',
    badge: 'Eco',
    badge_variant: 'success',
    precio_unitario: 680,
    precio_anterior: 840,
    presentacion: 'Disponible tras registrar entregas en los ecopuntos municipales.',
    imagen_url: `${BASE_PLACEHOLDER}/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=600&q=80`,
    stock_disponible: 90,
  },
];

export const DEFAULT_PUBLIC_PRODUCTS: ProductDetails[] = RAW_DEFAULT_PRODUCTS.map((item, index) =>
  enhanceProductDetails({ ...item, id: item.id ?? `demo-${index}` })
);
