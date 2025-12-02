import {
  BarChart3,
  CreditCard,
  Globe2,
  LayoutPanelLeft,
  MessageCircle,
  ServerCog,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

export const marketplacePillars = [
  {
    title: 'Catálogo público por slug',
    description: 'URLs estables por tenant con cache optimizado para compartir en redes y QR.',
    badge: 'Listo',
    icon: Globe2,
  },
  {
    title: 'Carrito aislado por tenant',
    description: 'Sesión de carrito separada, sin mezclar productos entre municipios o pymes.',
    badge: 'Listo',
    icon: ShoppingBag,
  },
  {
    title: 'Checkout express',
    description: 'Formulario mínimo con datos validados y opción de contacto directo por WhatsApp.',
    badge: 'En curso',
    icon: CreditCard,
  },
  {
    title: 'Pagos y logística',
    description: 'Integraciones configurables para medios de pago y envíos sin tocar el frontend.',
    badge: 'Próximo',
    icon: ServerCog,
  },
];

export const rolloutMilestones = [
  {
    label: 'Catálogo público multitenant',
    detail: 'Rutas /market/:slug y páginas demo siempre disponibles.',
    owner: 'Frontend',
    status: 'listo',
  },
  {
    label: 'Carrito y checkout express',
    detail: 'Flujo de alta de pedido rápido con validación básica.',
    owner: 'Frontend',
    status: 'en progreso',
  },
  {
    label: 'Webhooks y backoffice',
    detail: 'Sincronización de catálogos, pedidos y tickets en el panel.',
    owner: 'Platform',
    status: 'pendiente',
  },
  {
    label: 'Pagos y logística',
    detail: 'Selector de proveedores y configuración centralizada por slug.',
    owner: 'Platform',
    status: 'pendiente',
  },
];

export const blueprintHighlights = [
  {
    title: 'Catalogación sin hardcode',
    description: 'Todo llega del backend: nombres, categorías, precios y modalidad.',
    icon: LayoutPanelLeft,
  },
  {
    title: 'Demostración siempre activa',
    description: 'Catálogo demo disponible aunque no exista tenant configurado.',
    icon: Sparkles,
  },
  {
    title: 'Compartible al instante',
    description: 'QR y enlaces listos para enviar por WhatsApp sin configuración extra.',
    icon: MessageCircle,
  },
  {
    title: 'Observabilidad por tenant',
    description: 'Métricas y alertas de disponibilidad separadas por slug.',
    icon: BarChart3,
  },
];

export const readinessChecklist = [
  {
    title: 'Frontend',
    items: [
      { label: 'Catálogo y carrito white label', impact: 'Sin textos locales ni datos fijos.', status: 'completado' },
      { label: 'Fallback demo', impact: 'Catálogo y carrito siguen operativos si falla el backend.', status: 'completado' },
      { label: 'Checkout express', impact: 'Recoge datos mínimos y deriva a WhatsApp si hace falta.', status: 'en curso' },
    ],
  },
  {
    title: 'Backend',
    items: [
      { label: 'API de catálogo y carrito', impact: 'Endpoints multitenant con aislamiento por slug.', status: 'en curso' },
      { label: 'Webhooks operativos', impact: 'Sincronización hacia CRM y panel.', status: 'pendiente' },
      { label: 'Pagos y envíos', impact: 'Configurables por tenant sin tocar el frontend.', status: 'pendiente' },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { label: 'Playbook de soporte', impact: 'Respuestas y escalamiento unificados por tenant.', status: 'en curso' },
      { label: 'Monitoreo y alertas', impact: 'Errores críticos y tiempos de respuesta por slug.', status: 'pendiente' },
      { label: 'Capacitación', impact: 'Guías de onboarding para nuevos operadores.', status: 'pendiente' },
    ],
  },
];

export const automationTracks = [
  {
    title: 'Integración de catálogo',
    focus: 'API / webhooks',
    actions: [
      'Importar productos y categorías desde el backend.',
      'Validar modalidades (venta, puntos, donación) y stock.',
      'Propagar imágenes optimizadas para móvil.',
    ],
  },
  {
    title: 'Checkout y pagos',
    focus: 'Operación',
    actions: [
      'Configurar checkout express con datos mínimos.',
      'Derivar a pagos o contacto según el tenant.',
      'Generar QR y enlaces compartibles automáticamente.',
    ],
  },
  {
    title: 'Soporte y postventa',
    focus: 'CX',
    actions: [
      'Conectar reclamos y NPS al panel.',
      'Automatizar avisos de stock y actualizaciones de pedido.',
      'Monitorear SLA de respuesta por canal.',
    ],
  },
  {
    title: 'Datos y seguridad',
    focus: 'Platform',
    actions: [
      'Auditar accesos y acciones por usuario.',
      'Alertar por anomalías en conversión o caídas de catálogo.',
      'Mantener backups y versionado de catálogos.',
    ],
  },
];

export const automationTracksFocus = automationTracks.map((track) => track.focus);
export const blueprintStatus = rolloutMilestones.map((item) => item.status);
export const checklistStatuses = readinessChecklist.flatMap((section) => section.items.map((item) => item.status));

export type ReadinessStatus = typeof blueprintStatus[number];
