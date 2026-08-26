import type { HeatPoint } from "@/services/statsService";

export type DemoIconKey =
  | "accessibility"
  | "bell"
  | "briefcase"
  | "calendar"
  | "callback"
  | "catalog"
  | "clipboard"
  | "contact"
  | "document"
  | "education"
  | "form"
  | "health"
  | "human"
  | "image"
  | "layers"
  | "location"
  | "message"
  | "microphone"
  | "pdf"
  | "route"
  | "users"
  | "wallet";

export type DemoScenario = {
  id: string;
  tabLabel: string;
  title: string;
  citizenMessage: string;
  roleChoice: "Para mí" | "Familia / red";
  agentMessages: string[];
  caseCode: string;
  category: string;
  status: string;
  owner: string;
  nextStep: string;
  audience: string;
  checklist: string[];
  alert: string;
  registration: string;
  csat: string;
  operational: {
    queue: string;
    priority: string;
    sla: string;
    locality: string;
    attachments: string;
    transfer: string;
  };
  citizenAsset: {
    kind: "audio" | "image" | "location";
    label: string;
    detail: string;
  };
  deliverables: Array<{
    icon: DemoIconKey;
    label: string;
    detail: string;
  }>;
  history: string[];
};

export const disabilityAIAgentDemoContent = {
  metadata: {
    title: "Agente de IA de Discapacidad | Demostración ejecutiva",
    description:
      "Demostración conceptual de atención accesible por WhatsApp y gestión sincronizada en CRM para el área de discapacidad de Tierra del Fuego.",
  },
  truthNotice: {
    title: "Demostración conceptual · datos representativos",
    detail:
      "No contiene datos personales reales ni sustituye una validación funcional, jurídica, técnica o de seguridad para producción.",
  },
  brand: {
    entity: "Tierra del Fuego",
    program: "Atención integral en discapacidad",
    product: "Agente de IA de Discapacidad",
    whiteLabel: "Identidad institucional configurable",
  },
  navigation: [
    { label: "Atención", href: "#atencion" },
    { label: "Experiencia", href: "#experiencia" },
    { label: "Operación", href: "#operacion" },
    { label: "Indicadores", href: "#indicadores" },
    { label: "Implementación", href: "#implementacion" },
  ],
  hero: {
    eyebrow: "Propuesta ejecutiva · alcance exclusivo discapacidad",
    title: "Una puerta de entrada accesible para orientar, gestionar y acompañar",
    description:
      "WhatsApp y el CRM trabajan sobre el mismo caso: la persona conversa en un canal conocido y el equipo recibe contexto, trazabilidad y próximos pasos en un centro operativo único.",
    primaryAction: { label: "Ver experiencia", href: "#experiencia" },
    secondaryAction: { label: "Explorar operación", href: "#operacion" },
    highlights: [
      "Solo discapacidad",
      "WhatsApp + CRM sincronizados",
      "Ventana humana propuesta · 09:00–13:00",
      "Marca blanca configurable",
      "Responsive en iPhone y Android",
    ],
    visualLabel: "Vista sincronizada de muestra",
  },
  scenarios: [
    {
      id: "cud",
      tabLabel: "Orientación CUD",
      title: "Orientación para una gestión de CUD",
      citizenMessage: "Quiero saber si tengo la documentación necesaria para iniciar el CUD.",
      roleChoice: "Para mí",
      agentMessages: [
        "Armamos una lista de cotejo orientativa para CUD y CMO. En esta demo no te pediré DNI ni documentación real.",
        "Puedo devolverte una guía PDF, un formulario o el Catálogo de servicios accesible y ofrecer un turno o contacto humano.",
      ],
      caseCode: "DEMO-DISC-0142",
      category: "Documentación · CUD / CMO",
      status: "Preevaluación orientativa",
      owner: "Mesa Discapacidad",
      nextStep: "Entregar cotejo, formulario oficial y opción de turno",
      audience: "Persona con discapacidad",
      checklist: ["CMO o respaldo aplicable", "Requisitos CUD por validar", "Canal y turno sugeridos"],
      alert: "Aviso conceptual 90 días antes del vencimiento de CUD",
      registration: "REG-DEMO-CUD-0142",
      csat: "Se ofrece al cierre · escala accesible 1–5",
      operational: {
        queue: "Orientación CUD",
        priority: "Media",
        sla: "Muestra · 1ª respuesta en 4 min",
        locality: "Ushuaia · muestra",
        attachments: "2 entregables",
        transfer: "Disponible si la persona la solicita",
      },
      citizenAsset: {
        kind: "audio",
        label: "Nota de voz · 00:24",
        detail: "Transcripción accesible preparada",
      },
      deliverables: [
        { icon: "pdf", label: "Guía CUD · PDF", detail: "Documento de muestra" },
        { icon: "form", label: "Formulario guiado", detail: "Vista de muestra" },
      ],
      history: ["Ingreso por WhatsApp", "Motivo clasificado", "Cotejo preparado"],
    },
    {
      id: "rupe",
      tabLabel: "Consulta RUPE",
      title: "Seguimiento de una consulta RUPE",
      citizenMessage: "Necesito ordenar una consulta sobre RUPE, pensión y fe de vida.",
      roleChoice: "Familia / red",
      agentMessages: [
        "La preevaluación orientativa separa RUPE, pensión, licencias y fe de vida para identificar el organismo y el próximo paso.",
        "Puedo registrar alertas representativas, compartir el contacto correcto y dejar un callback sin consultar fuentes reales.",
      ],
      caseCode: "DEMO-DISC-0187",
      category: "Pensión · RUPE · licencias",
      status: "En seguimiento",
      owner: "Orientación y prestaciones",
      nextStep: "Validar fuente oficial requerida y registrar callback",
      audience: "Familia o red de apoyo",
      checklist: ["Tipo de prestación", "Estado RUPE por validar", "Fe de vida si corresponde"],
      alert: "Alertas conceptuales de RUPE, fe de vida y vencimientos",
      registration: "REG-DEMO-RUPE-0187",
      csat: "Se ofrece al cierre · escala accesible 1–5",
      operational: {
        queue: "Prestaciones",
        priority: "Media alta",
        sla: "Muestra · callback en 30 min",
        locality: "Río Grande · muestra",
        attachments: "1 imagen",
        transfer: "Callback solicitado",
      },
      citizenAsset: {
        kind: "image",
        label: "Captura compartida",
        detail: "Imagen simulada · sin documentación real",
      },
      deliverables: [
        { icon: "contact", label: "Contacto responsable", detail: "Directorio de muestra" },
        { icon: "callback", label: "Devolución de llamada", detail: "Solicitud registrada" },
      ],
      history: ["Imagen recibida", "Consulta separada por gestión", "Callback solicitado"],
    },
    {
      id: "support",
      tabLabel: "Caso complejo",
      title: "Derivación humana con contexto completo",
      citizenMessage: "Necesito ayuda con medicación, apoyo escolar y una gestión que no pude resolver.",
      roleChoice: "Para mí",
      agentMessages: [
        "Organizo salud, farmacia, educación y apoyos en un mismo caso. La identidad solo se solicita si el trámite y una fuente oficial lo requieren.",
        "Por la complejidad, genero la derivación conceptual DER-DEMO-0214. Al cierre se ofrece una encuesta CSAT accesible de 1 a 5.",
      ],
      caseCode: "DEMO-DISC-0214",
      category: "Salud · educación · apoyos",
      status: "Revisión humana",
      owner: "Equipo territorial",
      nextStep: "Ventana humana propuesta 09:00–13:00, con resumen y prioridad",
      audience: "Persona con discapacidad + red de apoyo",
      checklist: ["Necesidad de salud", "Apoyo educativo", "Criterio de derivación"],
      alert: "Seguimiento conceptual de farmacia y ciclo educativo",
      registration: "DER-DEMO-0214",
      csat: "Encuesta final 1–5 · pendiente de cierre",
      operational: {
        queue: "Casos complejos",
        priority: "Alta",
        sla: "Muestra · atención humana en 12 min",
        locality: "Tolhuin · muestra",
        attachments: "3 referencias",
        transfer: "Lista para equipo territorial",
      },
      citizenAsset: {
        kind: "location",
        label: "Ubicación voluntaria",
        detail: "Tolhuin · coordenada general simulada",
      },
      deliverables: [
        { icon: "catalog", label: "Servicios cercanos", detail: "Catálogo accesible" },
        { icon: "human", label: "Transferir a una persona", detail: "Contexto preservado" },
      ],
      history: ["Necesidad priorizada", "Ubicación consentida", "Derivación preparada"],
    },
  ] satisfies DemoScenario[],
  experience: {
    eyebrow: "Experiencia omnicanal",
    title: "Una conversación simple; un circuito operativo completo",
    description:
      "El Agente de IA recibe información en formatos accesibles, estructura el caso y entrega una respuesta o una derivación con contexto.",
    inputsTitle: "La persona puede enviar",
    inputs: [
      { icon: "message", label: "Texto", detail: "Consultas en lenguaje cotidiano" },
      { icon: "microphone", label: "Voz", detail: "Notas de audio como alternativa de entrada" },
      { icon: "image", label: "Imagen", detail: "Capturas o fotografías para contextualizar" },
      { icon: "document", label: "Documento", detail: "Archivos compartidos voluntariamente" },
      { icon: "location", label: "Ubicación", detail: "Pin territorial con consentimiento" },
    ] as { icon: DemoIconKey; label: string; detail: string }[],
    bridge: {
      label: "Agente de IA",
      title: "Comprende, ordena y registra",
      detail: "Sin cambiar de conversación",
    },
    outputsTitle: "El circuito puede devolver",
    outputs: [
      { icon: "pdf", label: "PDF", detail: "Guías y documentación preparada" },
      { icon: "catalog", label: "Catálogo de servicios accesible", detail: "Oferta institucional navegable y en lenguaje claro" },
      { icon: "contact", label: "Directorio accesible", detail: "Prestaciones y recursos organizados por zona" },
      { icon: "form", label: "Formulario", detail: "Acceso directo al paso correspondiente" },
      { icon: "contact", label: "Contacto", detail: "Área o referente correcto" },
      { icon: "calendar", label: "Turno", detail: "Solicitud o confirmación disponible" },
      { icon: "callback", label: "Callback", detail: "Pedido de devolución de llamada" },
      { icon: "human", label: "Derivación humana", detail: "Ventana propuesta de 09:00 a 13:00" },
    ] as { icon: DemoIconKey; label: string; detail: string }[],
  },
  serviceModel: {
    eyebrow: "Modelo de atención",
    title: "Cinco ejes para orientar sin convertir la conversación en un trámite",
    description:
      "El Agente de IA reconoce el motivo, arma una preevaluación orientativa y dirige cada caso al organismo competente. La decisión y la validación final permanecen en las fuentes y equipos autorizados.",
    audiencesTitle: "A quién acompaña",
    audiences: [
      {
        icon: "accessibility",
        title: "Personas con discapacidad",
        detail: "Orientación accesible, autonomía de canal y continuidad del caso.",
      },
      {
        icon: "users",
        title: "Familia, cuidadores y red de apoyo",
        detail: "Acompañamiento con rol declarado y alcance visible.",
      },
    ] as { icon: DemoIconKey; title: string; detail: string }[],
    identityPolicy: {
      title: "Identidad y rol, solo cuando corresponda",
      detail:
        "Se solicitan únicamente si el trámite y una fuente oficial autorizada lo requieren. Esta demostración no pide DNI, credenciales ni documentación personal real.",
    },
    axes: [
      {
        icon: "clipboard",
        title: "Documentación y certificación",
        topics: "CUD · CMO · lista de cotejo",
        responsible: "Junta evaluadora y autoridad sanitaria competente",
        agentRole: "Prepara requisitos, detecta faltantes y dirige al canal o turno aplicable.",
      },
      {
        icon: "health",
        title: "Salud y apoyos clínicos",
        topics: "Terapias · medicación · derivaciones · banco de ortopedia",
        responsible: "Salud y red de prestadores autorizados",
        agentRole: "Ordena la necesidad, ubica recursos y deriva los casos que requieren criterio profesional.",
      },
      {
        icon: "wallet",
        title: "Prestaciones y licencias",
        topics: "Pensión · RUPE · licencias · fe de vida",
        responsible: "Organismos previsionales y áreas provinciales competentes",
        agentRole: "Distingue gestiones, prepara el cotejo y activa recordatorios configurados.",
      },
      {
        icon: "education",
        title: "Escuela, recreación y apoyos",
        topics: "Inclusión educativa · actividades · acompañamientos",
        responsible: "Educación, municipios y red de apoyos",
        agentRole: "Conecta necesidades con servicios y conserva el contexto entre derivaciones.",
      },
      {
        icon: "briefcase",
        title: "Empleo y formación",
        topics: "Ley 48 · búsquedas · cursos · apoyos laborales",
        responsible: "Trabajo, empleo público y organismos de capacitación",
        agentRole: "Orienta oportunidades, requisitos y próximos pasos con fuentes validadas.",
      },
    ] as { icon: DemoIconKey; title: string; topics: string; responsible: string; agentRole: string }[],
  },
  operations: {
    eyebrow: "Centro operativo sincronizado",
    title: "WhatsApp atiende; el CRM organiza y da continuidad",
    description:
      "Cada interacción representativa se convierte en un caso trazable con estado, responsable y próxima acción. El equipo puede retomar la conversación sin pedirle a la persona que empiece de nuevo.",
    channelLabel: "Canal ciudadano",
    channelValue: "WhatsApp",
    crmLabel: "Centro de control",
    crmValue: "CRM de discapacidad",
    syncLabel: "Sincronización del caso",
    stages: [
      { label: "Ingreso", detail: "Mensaje y formato recibido", status: "completo" },
      { label: "Clasificación", detail: "Motivo y prioridad sugeridos", status: "completo" },
      { label: "Resolución", detail: "Respuesta, documento o acción", status: "activo" },
      { label: "Seguimiento", detail: "Estado, callback o derivación", status: "pendiente" },
    ],
    humanWindow: {
      title: "Intervención humana visible",
      schedule: "Ventana propuesta · 09:00–13:00",
      detail:
        "Durante la ventana de atención, una persona puede tomar el caso desde el CRM y continuar en el mismo hilo. Fuera de horario, queda registrada la solicitud de contacto.",
    },
    whiteLabel: {
      title: "Operación con marca blanca",
      detail:
        "Dominio, logotipo, colores, remitente, permisos y mensajes pueden configurarse para que la experiencia opere bajo identidad institucional.",
    },
    alertsTitle: "Alertas preventivas configurables",
    alertsDescription:
      "Ejemplos conceptuales sujetos a fuentes, consentimiento y reglas que deben validarse antes de producción.",
    alertsMetric: "74% de alertas completadas · muestra conceptual",
    alerts: [
      { icon: "clipboard", label: "CUD · 90 días", detail: "Anticipación de vencimiento" },
      { icon: "calendar", label: "Turnos", detail: "Confirmación y recordatorio" },
      { icon: "wallet", label: "RUPE", detail: "Seguimiento de estado aplicable" },
      { icon: "health", label: "Farmacia", detail: "Continuidad de medicación" },
      { icon: "education", label: "Educación", detail: "Hitos y apoyos del ciclo" },
    ] as { icon: DemoIconKey; label: string; detail: string }[],
  },
  territory: {
    eyebrow: "Inteligencia territorial",
    title: "Tablero conceptual para orientar la operación",
    description:
      "El mapa combina ubicaciones de muestra y volumen representativo para mostrar cómo podrían detectarse patrones por zona sin exponer identidades personales.",
    mapTitle: "Mapa de demanda representativa",
    mapDescription:
      "Seis ubicaciones simuladas en Tierra del Fuego. El color expresa volumen de interacciones de muestra, no personas ni casos reales.",
    viewLabel: "Perspectiva territorial",
    views: {
      thematic: "Mapa de calor",
      geographic: "Mapa geográfico",
    },
    metrics: [
      { value: "320", label: "interacciones por canal", detail: "WhatsApp 86% · widget 14%" },
      { value: "68%", label: "cierre autónomo", detail: "Escenario representativo" },
      { value: "18%", label: "derivación humana", detail: "Escenario representativo" },
      { value: "82%", label: "completitud de preevaluación", detail: "Escenario representativo" },
      { value: "1 m 40 s", label: "tiempo de primera respuesta", detail: "Escenario representativo" },
      { value: "38 min", label: "tiempo medio de resolución", detail: "Escenario representativo" },
      { value: "4,6 / 5", label: "CSAT al cierre", detail: "Escenario representativo" },
    ],
    breakdownTitle: "Motivos de consulta en la muestra",
    breakdown: [
      { label: "Documentación CUD / CMO", value: 28 },
      { label: "Salud y apoyos clínicos", value: 24 },
      { label: "Pensión, RUPE y licencias", value: 21 },
      { label: "Escuela y recreación", value: 15 },
      { label: "Empleo y formación", value: 12 },
    ],
    note:
      "Las cifras, categorías y coordenadas de esta sección son representativas y no deben utilizarse para decisiones de política pública.",
    points: [
      { lat: -53.786, lng: -67.7, weight: 92, totalWeight: 92, categoria: "Orientación CUD", barrio: "Río Grande", canal: "WhatsApp", source: "conceptual_demo" },
      { lat: -53.817, lng: -67.724, weight: 41, totalWeight: 41, categoria: "Accesibilidad y apoyos", barrio: "Margen Sur", canal: "WhatsApp", source: "conceptual_demo" },
      { lat: -54.8019, lng: -68.303, weight: 78, totalWeight: 78, categoria: "RUPE y prestaciones", barrio: "Ushuaia", canal: "WhatsApp", source: "conceptual_demo" },
      { lat: -54.833, lng: -68.36, weight: 45, totalWeight: 45, categoria: "Turnos y servicios", barrio: "Río Pipo", canal: "WhatsApp", source: "conceptual_demo" },
      { lat: -54.51, lng: -67.195, weight: 28, totalWeight: 28, categoria: "Orientación CUD", barrio: "Tolhuin", canal: "WhatsApp", source: "conceptual_demo" },
      { lat: -53.58, lng: -68.05, weight: 36, totalWeight: 36, categoria: "Accesibilidad y apoyos", barrio: "Zona norte", canal: "WhatsApp", source: "conceptual_demo" },
    ] satisfies HeatPoint[],
    center: [-67.9, -54.2] as [number, number],
    fitToBounds: [
      [-68.36, -54.833],
      [-67.195, -53.58],
    ] as [number, number][],
  },
  governance: {
    eyebrow: "Accesibilidad y gobernanza",
    title: "Diseñada para incluir; preparada para ser gobernada",
    description:
      "La experiencia conceptual contempla accesibilidad web, control institucional y una implementación progresiva con validaciones antes de producción.",
    accessibilityTitle: "Accesibilidad WCAG",
    accessibilityItems: [
      "Navegación completa por teclado y foco visible",
      "Etiquetas y estructura semántica para tecnologías de asistencia",
      "Contraste legible y objetivos táctiles de al menos 44 px",
      "Animaciones reducidas cuando el dispositivo lo solicita",
      "Alternativas de texto, voz, imagen, documento y ubicación",
    ],
    controlsTitle: "Controles previstos",
    controlsItems: [
      "Acceso por roles y trazabilidad de acciones",
      "Minimización de datos y consentimiento por finalidad",
      "Políticas configurables de retención y eliminación",
      "Revisión humana para decisiones y casos sensibles",
      "Auditoría técnica, jurídica y de seguridad previa al lanzamiento",
    ],
    cautionTitle: "Condición para producción",
    caution:
      "La protección efectiva depende de la configuración final, los proveedores, los circuitos administrativos y las evaluaciones correspondientes. Esta demo no afirma seguridad absoluta ni acceso irrestricto a padrones.",
  },
  implementation: {
    eyebrow: "Hoja de ruta y alcance",
    title: "Una implementación gobernada, medible y presupuestable",
    description:
      "Cuatro fases permiten validar el servicio antes de conectar canales, fuentes o datos reales, con responsabilidades explícitas entre la Mesa Única, la Agencia de Innovación Fueguina y el proveedor tecnológico.",
    phases: [
      { number: "01", title: "Descubrimiento", detail: "Servicios, fuentes, riesgos, métricas y responsables." },
      { number: "02", title: "Configuración", detail: "Marca blanca, catálogo, flujos, CRM y prototipo accesible." },
      { number: "03", title: "Piloto controlado", detail: "Pruebas, capacitación, ajustes y criterios de aceptación." },
      { number: "04", title: "Operación", detail: "Salida gradual, monitoreo, soporte y mejora continua." },
    ],
    responsibilitiesTitle: "Responsabilidades de trabajo",
    responsibilities: [
      {
        party: "Mesa Única",
        items: [
          "Validar contenidos, protocolos, fuentes y organismos responsables",
          "Designar referentes y aprobar reglas de derivación y niveles de atención",
          "Autorizar el piloto y los criterios de operación institucional",
        ],
      },
      {
        party: "Agencia de Innovación Fueguina (AIF)",
        items: [
          "Coordinar la implementación técnica dentro del marco institucional",
          "Gestionar autorizaciones de datos, accesos y fuentes oficiales",
          "Participar en validaciones de integración, seguridad y continuidad",
        ],
      },
      {
        party: "Proveedor tecnológico",
        items: [
          "Proveer licencia, marca blanca y configuración del Agente de IA y CRM",
          "Operar la infraestructura gestionada, monitoreo y mantenimiento acordados",
          "Brindar soporte, capacitación y evolución dentro del alcance contratado",
        ],
      },
    ],
    budget: {
      title: "Alcance presupuestable",
      price: "ARS 3.500.000–5.000.000 mensuales",
      priceDetail:
        "Servicio gestionado punta a punta. El rango se confirma tras validar complejidad, integraciones, volumen y nivel de soporte.",
      initialTitle: "Implementación inicial",
      initialItems: [
        "Descubrimiento y diseño del circuito",
        "Configuración de marca, catálogo, flujos y CRM",
        "Piloto, capacitación y criterios de aceptación",
      ],
      operationTitle: "Licencia y operación",
      operationItems: [
        "Licencia, mejoras y actualizaciones mensuales",
        "Hosting gestionado, dominio, base de datos y backups",
        "Redundancia, continuidad, monitoreo y soporte acordado",
        "Operación estándar e infraestructura incluidas dentro del rango acordado",
        "Mantenimiento de ciberseguridad sin promesa de seguridad absoluta",
        "NDA y acuerdo de tratamiento de datos",
      ],
      dependenciesTitle: "Dependencias",
      dependencies: [
        "Fuentes y catálogo institucional autorizados",
        "Referentes, horarios, roles y reglas de derivación",
        "Canal de WhatsApp, revisiones jurídicas y de seguridad",
      ],
      exclusionsTitle: "Revisión mediante acuerdo o addenda",
      exclusions: [
        "Crecimiento relevante de volumen o cobertura",
        "Nuevas integraciones o ampliaciones de alcance",
        "Cambios de SLA o niveles de soporte",
        "Mejoras futuras no incluidas en el alcance acordado",
      ],
    },
  },
  closing: {
    eyebrow: "Próximo paso",
    title: "Validar el circuito con el equipo antes de integrar datos o canales reales",
    description:
      "La siguiente instancia debería acordar categorías, responsables, fuentes autorizadas, horarios, reglas de derivación y métricas de éxito del módulo de discapacidad.",
    primaryAction: { label: "Revisar implementación", href: "#implementacion" },
    secondaryAction: { label: "Volver al inicio", href: "#inicio" },
  },
  footer: {
    label: "Agente de IA de Discapacidad",
    detail: "Tecnología licenciada · experiencia de marca blanca",
    creator:
      "Hecho por Marcelo Guillén, Ingeniero en Informática y Telecomunicaciones, fundador y CEO de Inmovar Latam.",
    disclaimer: "Demostración conceptual · datos representativos · agosto de 2026",
  },
} as const;
