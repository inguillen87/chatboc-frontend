import { Layers, Map, MonitorSmartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Pillar {
  title: string;
  description: string;
  badge: string;
  icon: LucideIcon;
}

interface Highlight {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface ChecklistItem {
  label: string;
  impact: string;
  status: 'completado' | 'en curso' | 'pendiente';
}

interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

interface Milestone {
  label: string;
  detail: string;
  owner: string;
  status: 'listo' | 'en progreso' | 'pendiente';
}

interface AutomationTrack {
  title: string;
  focus: string;
  actions: string[];
}

export const marketplacePillars: Pillar[] = [
  {
    title: 'Rutas públicas por slug',
    description: 'Catálogo, carrito y checkout aislados para cada tenant usando el mismo frontend.',
    badge: 'Listo',
    icon: Map,
  },
  {
    title: 'Catálogos vivos',
    description: 'Productos y precios se consumen de la API; sin textos hardcodeados por municipio.',
    badge: 'Listo',
    icon: Layers,
  },
  {
    title: 'Carrito portátil',
    description: 'Se conserva por slug y se comparte por QR o WhatsApp.',
    badge: 'Listo',
    icon: MonitorSmartphone,
  },
  {
    title: 'Checkout express',
    description: 'Formulario ligero que guarda contacto y dispara la orden al backend.',
    badge: 'En curso',
    icon: Map,
  },
];

export const rolloutMilestones: Milestone[] = [
  {
    label: 'Catálogo público por tenant',
    detail: 'Slug, categorías y tarjetas alimentadas 100% por API.',
    owner: 'frontend',
    status: 'listo',
  },
  {
    label: 'Carrito aislado',
    detail: 'Persistencia local por tenant con add/remove y totales.',
    owner: 'frontend',
    status: 'listo',
  },
  {
    label: 'Checkout express',
    detail: 'Captura de contacto y disparo de pedido vía API.',
    owner: 'backend',
    status: 'en progreso',
  },
  {
    label: 'Pagos y logística',
    detail: 'Integraciones de cobro y cálculo de entrega configurables por tenant.',
    owner: 'backend',
    status: 'pendiente',
  },
];

export const blueprintHighlights: Highlight[] = [
  {
    title: 'Demo perpetua',
    description: 'Siempre hay un catálogo demo listo para compartir mientras llega el catálogo real.',
    icon: MonitorSmartphone,
  },
  {
    title: 'Modo sin login',
    description: 'Permite agregar productos y generar pedidos rápidos sin requerir sesión.',
    icon: Map,
  },
  {
    title: 'Widget token-ready',
    description: 'Las llamadas usan tenantSlug y anon_id para aislar sesiones.',
    icon: Layers,
  },
];

export const readinessChecklist: ChecklistSection[] = [
  {
    title: 'Frontend white label',
    items: [
      {
        label: 'Sin textos locales',
        impact: 'Todos los labels y CTA provienen de la API o del catálogo demo.',
        status: 'completado',
      },
      {
        label: 'Mapeo de categorías',
        impact: 'Las categorías se generan a partir de los datos recibidos.',
        status: 'en curso',
      },
      {
        label: 'Fallback seguro',
        impact: 'Demo pública operativa si el backend no responde.',
        status: 'completado',
      },
    ],
  },
  {
    title: 'Operación',
    items: [
      {
        label: 'Checkout desacoplado',
        impact: 'Envía contacto y carrito al backend usando las rutas por slug.',
        status: 'en curso',
      },
      {
        label: 'Integraciones',
        impact: 'Webhooks, notificaciones y pagos se configuran por tenant.',
        status: 'pendiente',
      },
      {
        label: 'Soporte QR',
        impact: 'URLs cortas y QR para compartir el carrito.',
        status: 'completado',
      },
    ],
  },
  {
    title: 'Observabilidad',
    items: [
      {
        label: 'Monitoreo por slug',
        impact: 'Errores y latencias segmentadas por tenant.',
        status: 'pendiente',
      },
      {
        label: 'Alertas',
        impact: 'Notificaciones ante caídas de catálogo o checkout.',
        status: 'pendiente',
      },
      {
        label: 'Health checks',
        impact: 'Verificaciones periódicas de rutas públicas y API.',
        status: 'en curso',
      },
    ],
  },
];

export const automationTracks: AutomationTrack[] = [
  {
    title: 'Catálogo y precios',
    focus: 'Datos',
    actions: [
      'Sincronizar productos por API con normalización automática.',
      'Generar secciones dinámicas sin hardcodear categorías.',
      'Publicar QR y enlaces del carrito desde el panel.',
    ],
  },
  {
    title: 'Pedidos y pagos',
    focus: 'Operación',
    actions: [
      'Persistir carrito por slug con anon_id.',
      'Iniciar checkout ligero y enviar webhook de pedido.',
      'Preparar integración de pagos y cálculo de envío.',
    ],
  },
  {
    title: 'Soporte y NPS',
    focus: 'Experiencia',
    actions: [
      'Colectar feedback post-compra y reclamos centralizados.',
      'Activar encuestas breves en puntos críticos del flujo.',
      'Consolidar métricas de conversión por tenant.',
    ],
  },
  {
    title: 'Observabilidad',
    focus: 'Calidad',
    actions: [
      'Alertar por fallas de catálogo o checkout.',
      'Registrar latencia de API y ratio de errores.',
      'Mantener dashboard de salud por slug.',
    ],
  },
];
