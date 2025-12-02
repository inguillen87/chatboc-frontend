import type React from 'react';
import { ShieldCheck, Workflow, Sparkles, ShoppingBag, Rocket, Headphones, Clock, ServerCog } from 'lucide-react';

export interface BlueprintPillar {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
}

export interface BlueprintMilestone {
  label: string;
  detail: string;
  status: 'listo' | 'en progreso' | 'pendiente';
  owner: string;
}

export interface BlueprintChecklistItem {
  label: string;
  impact: string;
  status: 'completado' | 'en curso' | 'pendiente';
}

export interface BlueprintChecklistSection {
  title: string;
  items: BlueprintChecklistItem[];
}

export interface BlueprintTrack {
  title: string;
  focus: string;
  actions: string[];
}

export const marketplacePillars: BlueprintPillar[] = [
  {
    title: 'Aislamiento y dominios',
    description: 'Slugs por tenant, catálogos independientes y URLs compartibles por QR o WhatsApp.',
    icon: ShieldCheck,
    badge: 'Multi-tenant',
  },
  {
    title: 'Catálogo y checkout',
    description: 'Catálogo público, carrito aislado y checkout express con verificación mínima.',
    icon: ShoppingBag,
    badge: 'Conversacional',
  },
  {
    title: 'Automatización',
    description: 'Webhooks y orquestaciones para stock, pagos, envíos y notificaciones.',
    icon: Workflow,
    badge: 'Operativo',
  },
  {
    title: 'Experiencia premium',
    description: 'Recomendaciones, bundles y reseñas moderadas para mejorar conversión.',
    icon: Sparkles,
    badge: 'Upsell',
  },
];

export const rolloutMilestones: BlueprintMilestone[] = [
  {
    label: 'Catálogo público por tenant',
    detail: 'Catálogo público en /market/{slug} con productos, puntos y vista mobile-first.',
    status: 'listo',
    owner: 'Frontend + API',
  },
  {
    label: 'Carrito aislado',
    detail: 'Agregar/remover ítems por slug con totales y compartir por WhatsApp.',
    status: 'listo',
    owner: 'Frontend + API',
  },
  {
    label: 'Checkout express',
    detail: 'Inicio de checkout con teléfono verificado y limpieza de carrito.',
    status: 'en progreso',
    owner: 'Backend',
  },
  {
    label: 'Pagos y logística',
    detail: 'Webhooks para pagos, cálculo de envíos y estados en tiempo real.',
    status: 'pendiente',
    owner: 'Integraciones',
  },
  {
    label: 'Postventa y NPS',
    detail: 'Encuestas post compra, reclamos y devoluciones unificados por tenant.',
    status: 'en progreso',
    owner: 'CX',
  },
];

export const readinessChecklist: BlueprintChecklistSection[] = [
  {
    title: 'Dominio y branding',
    items: [
      {
        label: 'Slug por organización con QR listo para compartir',
        impact: 'Permite catálogos independientes sin conflicto de datos.',
        status: 'completado',
      },
      {
        label: 'Tema claro/oscuro configurable',
        impact: 'White label listo para reventa y experiencias propias.',
        status: 'en curso',
      },
    ],
  },
  {
    title: 'Checkout y cuentas',
    items: [
      {
        label: 'Validación de teléfono/WhatsApp sin fricción',
        impact: 'Reduce abandono en mobile y mantiene trazabilidad.',
        status: 'en curso',
      },
      {
        label: 'Historial de pedidos y notificaciones',
        impact: 'Seguimiento visible para operaciones y atención al cliente.',
        status: 'pendiente',
      },
    ],
  },
  {
    title: 'Operaciones y riesgo',
    items: [
      {
        label: 'Webhooks de stock y pagos',
        impact: 'Evita sobreventas y consolida conciliaciones.',
        status: 'pendiente',
      },
      {
        label: 'Alertas por SLA y fraude',
        impact: 'Protege la reputación del marketplace y reduce contracargos.',
        status: 'pendiente',
      },
    ],
  },
];

export const automationTracks: BlueprintTrack[] = [
  {
    title: 'Catálogo vivo',
    focus: 'Sincronización continua',
    actions: [
      'Importar productos por API o CSV con validación asistida.',
      'Webhooks para stock y precios dinámicos.',
      'Versionado de catálogos y rollback rápido.',
    ],
  },
  {
    title: 'Checkout inteligente',
    focus: 'Conversión y pagos',
    actions: [
      'Prefill con datos del chat y tokenización segura.',
      'Pasarelas configurables por tenant y modos de prueba.',
      'Estados de pedido con eventos push.',
    ],
  },
  {
    title: 'CX y postventa',
    focus: 'Retención',
    actions: [
      'Encuestas post compra y NPS por tenant.',
      'Portal de reclamos y devoluciones integrado.',
      'Alertas internas cuando la satisfacción cae.',
    ],
  },
  {
    title: 'Observabilidad',
    focus: 'Calidad y uptime',
    actions: [
      'Tablero de latencia y errores por slug.',
      'Monitoreo de webhooks y reintentos automáticos.',
      'Pruebas de humo para catálogos críticos.',
    ],
  },
];

export const blueprintHighlights = [
  {
    title: 'Aislamiento total',
    description: 'Cada tenant opera con catálogo y carrito dedicados sin mezclar datos.',
    icon: Rocket,
  },
  {
    title: 'Orquestación lista',
    description: 'Hooks para pagos, logística y CRM listos para conectar.',
    icon: ServerCog,
  },
  {
    title: 'Soporte escalable',
    description: 'Operaciones y soporte con playbooks reutilizables para todos los tenants.',
    icon: Headphones,
  },
  {
    title: 'Time-to-market veloz',
    description: 'Slugs y catálogos demo se publican en minutos para demos o pilotos.',
    icon: Clock,
  },
];
