export type DemoCatalogAsset = {
  slug: string;
  title: string;
  sector: "gobierno" | "empresas" | "educacion";
  href: string;
  subtitle?: string;
  description?: string;
  highlights?: string[];
  packages?: Array<{
    name: string;
    detail: string;
    price: string;
  }>;
  workflows?: string[];
  questions?: string[];
};

const commonGovernment = {
  highlights: ["Atencion omnicanal", "Trazabilidad por ticket", "Derivacion humana", "Analytics operativo"],
  packages: [
    { name: "Mesa digital", detail: "Consultas, turnos y reclamos basicos.", price: "Demo incluido" },
    { name: "Operaciones", detail: "SLA, mapas, reportes y action center.", price: "Plan gobierno" },
    { name: "Omnicanal", detail: "WhatsApp, widget, voz realtime y handoff.", price: "Plan enterprise" },
  ],
  workflows: ["Crear caso con categoria", "Pedir datos faltantes", "Consultar estado", "Derivar urgencias"],
};

const commonBusiness = {
  highlights: ["Catalogo con precios", "Pedidos guiados", "Lead capture", "Resumen por WhatsApp"],
  packages: [
    { name: "Catalogo demo", detail: "Productos, servicios y FAQs comerciales.", price: "Demo incluido" },
    { name: "Ventas asistidas", detail: "Pedidos, checkout preview y handoff comercial.", price: "Plan pyme" },
    { name: "Operacion premium", detail: "Analytics, rewards, pagos y voz realtime.", price: "Plan enterprise" },
  ],
  workflows: ["Consultar disponibilidad", "Crear pedido", "Capturar lead", "Derivar a ventas"],
};

const commonEducation = {
  highlights: ["Quick menu escolar", "Adjuntos medico/PDF/audio", "Casos sensibles", "Panel para secretaria"],
  packages: [
    { name: "Secretaria digital", detail: "Consultas frecuentes, certificados y comunicados.", price: "Demo incluido" },
    { name: "Familias", detail: "Asistencia, documentos, pagos y admisiones.", price: "Plan colegio" },
    { name: "Operaciones escolares", detail: "Casos sensibles, heatmap y trazabilidad.", price: "Plan enterprise" },
  ],
  workflows: ["Justificar inasistencia", "Consultar secretaria", "Adjuntar certificado", "Derivar a preceptoria"],
};

export const DEMO_CATALOG_ASSETS: DemoCatalogAsset[] = [
  {
    ...commonGovernment,
    slug: "municipio",
    title: "Municipio inteligente",
    sector: "gobierno",
    href: "/demo-catalogs/municipio.pdf",
    subtitle: "Atencion ciudadana, reclamos y tramites con IA operativa.",
    description: "Catalogo demo para probar reclamos con ubicacion, consulta de estado, turnos, derivacion humana y seguimiento por WhatsApp.",
    questions: ["Quiero iniciar un reclamo por luminaria", "Donde reporto baches con ubicacion?", "Consultar estado del ticket 1234"],
  },
  {
    ...commonGovernment,
    slug: "concejo-deliberante",
    title: "Concejo deliberante",
    sector: "gobierno",
    href: "/demo-catalogs/concejo-deliberante.pdf",
    subtitle: "Consultas legislativas, expedientes y participacion vecinal.",
    description: "Experiencia demo para sesiones, proyectos, agenda publica, reclamos vinculados y derivacion a bloque o comision.",
  },
  {
    ...commonGovernment,
    slug: "legisladores",
    title: "Legisladores y bloques",
    sector: "gobierno",
    href: "/demo-catalogs/legisladores.pdf",
    subtitle: "Agenda territorial, consultas ciudadanas y seguimiento politico.",
    description: "Demo para recibir consultas, registrar temas por territorio, priorizar pedidos y mantener trazabilidad.",
  },
  {
    ...commonGovernment,
    slug: "campana-electoral",
    title: "Campana electoral",
    sector: "gobierno",
    href: "/demo-catalogs/campana-electoral.pdf",
    subtitle: "Voluntarios, propuestas, recorridas y mensajes segmentados.",
    description: "Demo para ordenar consultas de campana, registrar apoyos y capturar oportunidades de contacto.",
  },
  {
    ...commonBusiness,
    slug: "almacen",
    title: "Almacen de barrio",
    sector: "empresas",
    href: "/demo-catalogs/almacen.pdf",
    subtitle: "Pedidos rapidos, promos semanales y entrega barrial.",
    description: "Catalogo demo para consultar productos, armar pedidos, pedir entrega y capturar contacto sin friccion.",
  },
  {
    ...commonBusiness,
    slug: "bodega",
    title: "Bodega boutique",
    sector: "empresas",
    href: "/demo-catalogs/bodega.pdf",
    subtitle: "Venta consultiva de vinos, catas privadas y envios premium.",
    description: "Demo para probar recomendaciones por ocasion, maridajes, combos, stock guiado y pedido confirmado.",
    packages: [
      { name: "Malbec Reserva", detail: "Caja x6 con ficha de cata y maridaje.", price: "$54.000" },
      { name: "Blend Degustacion", detail: "Seleccion mixta para regalo corporativo.", price: "$72.000" },
      { name: "Experiencia Cata", detail: "Cata guiada para 8 personas.", price: "$180.000" },
    ],
    questions: ["Necesito vinos para un asado", "Arma un regalo para 10 clientes", "Quiero reservar una cata"],
  },
  {
    ...commonBusiness,
    slug: "kiosco",
    title: "Kiosco 24hs",
    sector: "empresas",
    href: "/demo-catalogs/kiosco.pdf",
    subtitle: "Combos, snacks, bebidas y pedidos por WhatsApp.",
    description: "Demo para venta rapida, consulta de disponibilidad, combos nocturnos y retiro en tienda.",
  },
  {
    ...commonBusiness,
    slug: "restaurante",
    title: "Restaurante",
    sector: "empresas",
    href: "/demo-catalogs/restaurante.pdf",
    subtitle: "Reservas, menu digital, delivery y promociones por horario.",
    description: "Demo para responder preguntas del menu, tomar reservas, confirmar pedidos y derivar a salon.",
  },
  {
    ...commonBusiness,
    slug: "ferreteria",
    title: "Ferreteria tecnica",
    sector: "empresas",
    href: "/demo-catalogs/ferreteria.pdf",
    subtitle: "Asesoramiento, cotizaciones y stock por sucursal.",
    description: "Demo para resolver consultas tecnicas, enviar fotos, pedir repuestos y generar presupuesto.",
  },
  {
    ...commonBusiness,
    slug: "tienda_ropa",
    title: "Tienda de ropa",
    sector: "empresas",
    href: "/demo-catalogs/tienda_ropa.pdf",
    subtitle: "Talles, colores, reservas, cambios y colecciones.",
    description: "Demo para buscar prendas, consultar talles, reservar productos y continuar compra.",
  },
  {
    ...commonBusiness,
    slug: "logistica",
    title: "Logistica",
    sector: "empresas",
    href: "/demo-catalogs/logistica.pdf",
    subtitle: "Seguimiento, cotizaciones, retiros y entregas programadas.",
    description: "Demo para cotizar envios, consultar estado, recibir documentacion y escalar incidentes.",
  },
  {
    ...commonBusiness,
    slug: "seguros",
    title: "Seguros",
    sector: "empresas",
    href: "/demo-catalogs/seguros.pdf",
    subtitle: "Polizas, siniestros, leads y derivacion humana.",
    description: "Demo para orientar coberturas, iniciar siniestros, pedir adjuntos y entregar resumen al asesor.",
  },
  {
    ...commonBusiness,
    slug: "fintech",
    title: "Fintech",
    sector: "empresas",
    href: "/demo-catalogs/fintech.pdf",
    subtitle: "Onboarding, soporte, reclamos, KYC y operaciones.",
    description: "Demo para guiar alta de usuario, resolver reclamos y sostener handoff seguro.",
  },
  {
    ...commonBusiness,
    slug: "inmobiliaria",
    title: "Inmobiliaria",
    sector: "empresas",
    href: "/demo-catalogs/inmobiliaria.pdf",
    subtitle: "Propiedades, visitas, reservas y leads calificados.",
    description: "Demo para recomendar propiedades, coordinar visita y capturar intencion comercial.",
  },
  {
    ...commonBusiness,
    slug: "industria",
    title: "Industria y energia",
    sector: "empresas",
    href: "/demo-catalogs/industria.pdf",
    subtitle: "Soporte tecnico, ventas B2B y mantenimiento operativo.",
    description: "Demo para registrar incidencias, pedir adjuntos tecnicos y priorizar operaciones.",
  },
  {
    ...commonBusiness,
    slug: "clinica",
    title: "Clinica medica",
    sector: "empresas",
    href: "/demo-catalogs/clinica.pdf",
    subtitle: "Turnos, estudios, consultas y recordatorios.",
    description: "Demo para orientar al paciente, tomar datos minimos y derivar a recepcion.",
  },
  {
    ...commonBusiness,
    slug: "farmacia",
    title: "Farmacia",
    sector: "empresas",
    href: "/demo-catalogs/farmacia.pdf",
    subtitle: "Recetas, disponibilidad, envios y pagos.",
    description: "Demo para consultar productos, adjuntar receta, confirmar entrega y escalar al farmaceutico.",
  },
  {
    ...commonEducation,
    slug: "colegio-demo",
    title: "Colegio privado integral",
    sector: "educacion",
    href: "/demo-catalogs/colegio-demo.pdf",
    subtitle: "Secretaria, familias, inasistencias y casos escolares.",
    description: "Catalogo demo para probar menu escolar, justificativos, comunicados, admisiones, pagos y derivacion humana.",
    questions: ["Quiero justificar una inasistencia", "Necesito un certificado de alumno regular", "Quiero consultar admisiones"],
  },
  {
    ...commonEducation,
    slug: "colegio-bilingue",
    title: "Colegio bilingue",
    sector: "educacion",
    href: "/demo-catalogs/colegio-bilingue.pdf",
    subtitle: "Admisiones, agenda, cuotas y convivencia.",
    description: "Demo para instituciones con secretaria bilingue, seguimiento de familias y casos escolares.",
  },
  {
    ...commonEducation,
    slug: "escuela-publica",
    title: "Escuela publica",
    sector: "educacion",
    href: "/demo-catalogs/escuela-publica.pdf",
    subtitle: "Asistencia, certificados, comedor y orientacion.",
    description: "Demo para ordenar consultas de familias, documentacion y derivaciones internas.",
  },
  {
    ...commonEducation,
    slug: "supervision-escolar",
    title: "Supervision escolar",
    sector: "educacion",
    href: "/demo-catalogs/supervision-escolar.pdf",
    subtitle: "Casos por sede, derivaciones, reportes y seguimiento.",
    description: "Demo para equipos de supervision con tablero operativo y trazabilidad multi-sede.",
  },
];

const normalizeSlug = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/\s+/g, "-");

export const findDemoCatalogAsset = (slug?: string | null) => {
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;
  return DEMO_CATALOG_ASSETS.find((asset) => normalizeSlug(asset.slug) === normalized) ?? null;
};

