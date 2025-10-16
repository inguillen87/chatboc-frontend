import type { SurveyDraftPayload } from '@/types/encuestas';

export type SurveyTemplatePregunta = SurveyDraftPayload['preguntas'][number];

export interface SurveyTemplateDefinition {
  slug: string;
  titulo: string;
  descripcion?: string;
  tipo: SurveyDraftPayload['tipo'];
  politica_unicidad: SurveyDraftPayload['politica_unicidad'];
  anonimato?: boolean;
  requiere_datos_contacto?: boolean;
  preguntas: SurveyTemplatePregunta[];
  tags?: string[];
}

const MUNICIPAL_SURVEY_TEMPLATES: SurveyTemplateDefinition[] = [
  {
    slug: 'servicios-publicos',
    titulo: 'Encuesta sobre servicios públicos en {{municipality}}',
    descripcion:
      'Queremos conocer la experiencia de los vecinos y vecinas con los servicios urbanos para planificar mejoras.',
    tipo: 'opinion',
    politica_unicidad: 'por_dni',
    anonimato: false,
    requiere_datos_contacto: true,
    tags: ['Servicios públicos', 'Mantenimiento urbano'],
    preguntas: [
      {
        orden: 1,
        tipo: 'opcion_unica',
        texto: '¿Cómo calificás la limpieza urbana en {{municipality}}?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Muy buena' },
          { orden: 2, texto: 'Buena' },
          { orden: 3, texto: 'Regular' },
          { orden: 4, texto: 'Mala' },
        ],
      },
      {
        orden: 2,
        tipo: 'multiple',
        texto: '¿Qué aspectos deberían reforzarse prioritariamente?',
        obligatoria: true,
        min_selecciones: 1,
        max_selecciones: 3,
        opciones: [
          { orden: 1, texto: 'Recolección de residuos' },
          { orden: 2, texto: 'Iluminación pública' },
          { orden: 3, texto: 'Mantenimiento de calles' },
          { orden: 4, texto: 'Espacios verdes' },
        ],
      },
      {
        orden: 3,
        tipo: 'abierta',
        texto: '¿Qué propuesta concreta sugerís para mejorar los servicios públicos?',
        obligatoria: false,
      },
    ],
  },
  {
    slug: 'seguridad-ciudadana',
    titulo: 'Sondeo de seguridad ciudadana en {{municipality}}',
    descripcion: 'Medimos la percepción de seguridad barrial para coordinar acciones con fuerzas locales.',
    tipo: 'sondeo',
    politica_unicidad: 'por_phone',
    anonimato: false,
    requiere_datos_contacto: true,
    tags: ['Seguridad', 'Prevención'],
    preguntas: [
      {
        orden: 1,
        tipo: 'opcion_unica',
        texto: '¿Con qué frecuencia ves patrullajes o controles preventivos?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Todos los días' },
          { orden: 2, texto: 'Varias veces por semana' },
          { orden: 3, texto: 'Pocas veces al mes' },
          { orden: 4, texto: 'Nunca' },
        ],
      },
      {
        orden: 2,
        tipo: 'opcion_unica',
        texto: '¿Cómo evaluás la iluminación nocturna en tu cuadra?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Muy adecuada' },
          { orden: 2, texto: 'Adecuada' },
          { orden: 3, texto: 'Insuficiente' },
          { orden: 4, texto: 'Muy insuficiente' },
        ],
      },
      {
        orden: 3,
        tipo: 'abierta',
        texto: 'Comentá situaciones o zonas específicas donde te gustaría ver más presencia preventiva.',
        obligatoria: false,
      },
    ],
  },
  {
    slug: 'movilidad-y-transporte',
    titulo: 'Consulta sobre movilidad y transporte en {{municipality}}',
    descripcion:
      'Identificamos necesidades de infraestructura vial y transporte público para priorizar inversiones.',
    tipo: 'opinion',
    politica_unicidad: 'por_ip',
    anonimato: true,
    requiere_datos_contacto: false,
    tags: ['Movilidad', 'Transporte'],
    preguntas: [
      {
        orden: 1,
        tipo: 'multiple',
        texto: '¿Qué medios de transporte utilizás semanalmente?',
        obligatoria: true,
        min_selecciones: 1,
        max_selecciones: 4,
        opciones: [
          { orden: 1, texto: 'Colectivo' },
          { orden: 2, texto: 'Bicicleta' },
          { orden: 3, texto: 'Motocicleta' },
          { orden: 4, texto: 'Auto particular' },
          { orden: 5, texto: 'Caminata' },
        ],
      },
      {
        orden: 2,
        tipo: 'opcion_unica',
        texto: '¿Cuál es la principal dificultad para moverte por {{municipality}}?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Frecuencia del transporte público' },
          { orden: 2, texto: 'Estado de las calles' },
          { orden: 3, texto: 'Falta de ciclovías' },
          { orden: 4, texto: 'Congestión vehicular' },
          { orden: 5, texto: 'Inseguridad vial' },
        ],
      },
      {
        orden: 3,
        tipo: 'abierta',
        texto: '¿Qué cambio puntual ayudaría a mejorar tu traslado diario?',
        obligatoria: false,
      },
    ],
  },
  {
    slug: 'agenda-cultural-2025',
    titulo: 'Agenda cultural y turística 2025 para {{municipality}}',
    descripcion:
      'Priorizamos actividades, festivales y experiencias turísticas locales que potencien la identidad regional.',
    tipo: 'opinion',
    politica_unicidad: 'por_cookie',
    anonimato: true,
    requiere_datos_contacto: false,
    tags: ['Cultura', 'Turismo'],
    preguntas: [
      {
        orden: 1,
        tipo: 'multiple',
        texto: '¿Qué tipo de eventos te gustaría que se multipliquen en {{municipality}}?',
        obligatoria: true,
        min_selecciones: 1,
        max_selecciones: 3,
        opciones: [
          { orden: 1, texto: 'Festivales gastronómicos' },
          { orden: 2, texto: 'Ferias de emprendedores' },
          { orden: 3, texto: 'Shows musicales al aire libre' },
          { orden: 4, texto: 'Actividades deportivas' },
          { orden: 5, texto: 'Recorridos turísticos guiados' },
        ],
      },
      {
        orden: 2,
        tipo: 'opcion_unica',
        texto: '¿Cuál es tu principal motivación para asistir a eventos culturales locales?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Aprender y descubrir propuestas nuevas' },
          { orden: 2, texto: 'Compartir tiempo en familia o con amistades' },
          { orden: 3, texto: 'Apoyar a artistas y emprendedores locales' },
          { orden: 4, texto: 'Turismo y recreación' },
        ],
      },
      {
        orden: 3,
        tipo: 'abierta',
        texto: 'Comentá una idea innovadora para sumar a la agenda cultural.',
        obligatoria: false,
      },
    ],
  },
  {
    slug: 'ciudad-sustentable-2025',
    titulo: 'Encuesta 2025 de ciudad sustentable para {{municipality}}',
    descripcion:
      'Priorizamos acciones sobre energía, agua, residuos y economía circular con foco educativo.',
    tipo: 'planificacion',
    politica_unicidad: 'por_dni',
    anonimato: false,
    requiere_datos_contacto: true,
    tags: ['Sustentabilidad', 'Planificación'],
    preguntas: [
      {
        orden: 1,
        tipo: 'multiple',
        texto: '¿Qué iniciativas sustentables debería impulsar primero {{municipality}}?',
        obligatoria: true,
        min_selecciones: 1,
        max_selecciones: 3,
        opciones: [
          { orden: 1, texto: 'Programas para reducir el consumo de agua' },
          { orden: 2, texto: 'Eficiencia energética y luminarias LED' },
          { orden: 3, texto: 'Capacitaciones sobre uso responsable de gas' },
          { orden: 4, texto: 'Fortalecer puntos limpios y reciclaje' },
          { orden: 5, texto: 'Huertas urbanas y compostaje comunitario' },
        ],
      },
      {
        orden: 2,
        tipo: 'opcion_unica',
        texto:
          '¿Qué tan útil sería que el punto limpio produzca materiales educativos con IA y reciclados para escuelas y jardines?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Muy útil, debería ser una prioridad' },
          { orden: 2, texto: 'Útil como complemento de otras acciones' },
          { orden: 3, texto: 'Poco útil frente a otras necesidades' },
          { orden: 4, texto: 'No es necesario' },
        ],
      },
      {
        orden: 3,
        tipo: 'opcion_unica',
        texto: '¿Preferís materiales educativos reciclados en formato libros, historietas o recursos digitales?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Libros y cuadernos impresos' },
          { orden: 2, texto: 'Historietas y cuentos ilustrados' },
          { orden: 3, texto: 'Recursos digitales interactivos' },
          { orden: 4, texto: 'Combinación de formatos' },
        ],
      },
      {
        orden: 4,
        tipo: 'abierta',
        texto: 'Compartí ideas para reutilizar materiales reciclados en proyectos educativos o comunitarios.',
        obligatoria: false,
      },
    ],
  },
  {
    slug: 'obras-publicas-2025',
    titulo: 'Prioridades 2025 de obras públicas en {{municipality}}',
    descripcion: 'Identificamos intervenciones clave en pavimentación, plazas y seguridad vial.',
    tipo: 'planificacion',
    politica_unicidad: 'por_phone',
    anonimato: false,
    requiere_datos_contacto: true,
    tags: ['Obras públicas', 'Infraestructura'],
    preguntas: [
      {
        orden: 1,
        tipo: 'multiple',
        texto: '¿Qué proyectos de obra pública deberían priorizarse en tu barrio?',
        obligatoria: true,
        min_selecciones: 1,
        max_selecciones: 3,
        opciones: [
          { orden: 1, texto: 'Pavimentación y bacheo de calles' },
          { orden: 2, texto: 'Renovación y mantenimiento de plazas' },
          { orden: 3, texto: 'Modernización de semáforos' },
          { orden: 4, texto: 'Construcción de lomas de burro' },
          { orden: 5, texto: 'Mejoras en desagües pluviales' },
        ],
      },
      {
        orden: 2,
        tipo: 'opcion_unica',
        texto: '¿Cómo evaluás el estado actual de las veredas y accesos peatonales en tu zona?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Muy bueno' },
          { orden: 2, texto: 'Aceptable' },
          { orden: 3, texto: 'Deficiente' },
          { orden: 4, texto: 'Muy deficiente' },
        ],
      },
      {
        orden: 3,
        tipo: 'opcion_unica',
        texto: '¿Cuál debería ser el principal criterio para definir el cronograma de obras?',
        obligatoria: true,
        opciones: [
          { orden: 1, texto: 'Cantidad de reclamos registrados' },
          { orden: 2, texto: 'Impacto en la seguridad vial' },
          { orden: 3, texto: 'Beneficio para escuelas y espacios comunitarios' },
          { orden: 4, texto: 'Sincronización con otras obras de infraestructura' },
        ],
      },
      {
        orden: 4,
        tipo: 'abierta',
        texto: 'Indicá calles, plazas o cruces específicos donde debería focalizarse la próxima etapa de obras.',
        obligatoria: false,
      },
    ],
  },
];

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const replaceMunicipality = (text: string, municipality?: string) => {
  if (!municipality) return text;
  return text.replace(/\{\{municipality\}\}/g, municipality);
};

export interface BuildSurveyDraftOptions {
  municipality?: string;
  startDate?: Date;
  endDate?: Date;
}

export const buildDraftFromTemplate = (
  template: SurveyTemplateDefinition,
  options: BuildSurveyDraftOptions = {},
): SurveyDraftPayload => {
  const { municipality, startDate, endDate } = options;
  const start = startDate ?? new Date();
  const finish =
    endDate ??
    new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  const normalizedMunicipality = municipality?.trim();
  const slugSuffix = normalizedMunicipality ? `-${slugify(normalizedMunicipality)}` : '';

  return {
    titulo: replaceMunicipality(template.titulo, normalizedMunicipality),
    slug: `${template.slug}${slugSuffix}`.slice(0, 80),
    descripcion: template.descripcion
      ? replaceMunicipality(template.descripcion, normalizedMunicipality)
      : undefined,
    tipo: template.tipo,
    inicio_at: start.toISOString(),
    fin_at: finish.toISOString(),
    politica_unicidad: template.politica_unicidad,
    anonimato: Boolean(template.anonimato),
    requiere_datos_contacto: Boolean(template.anonimato ? false : template.requiere_datos_contacto),
    preguntas: template.preguntas.map((pregunta, preguntaIndex) => ({
      orden: typeof pregunta.orden === 'number' ? pregunta.orden : preguntaIndex + 1,
      tipo: pregunta.tipo,
      texto: replaceMunicipality(pregunta.texto, normalizedMunicipality),
      obligatoria: Boolean(pregunta.obligatoria),
      min_selecciones: pregunta.min_selecciones ?? null,
      max_selecciones: pregunta.max_selecciones ?? null,
      opciones: pregunta.opciones
        ? pregunta.opciones.map((opcion, opcionIndex) => ({
            orden: typeof opcion.orden === 'number' ? opcion.orden : opcionIndex + 1,
            texto: replaceMunicipality(opcion.texto, normalizedMunicipality),
            valor: opcion.valor,
          }))
        : undefined,
    })),
  } satisfies SurveyDraftPayload;
};

export const SURVEY_TEMPLATE_CATALOG = {
  municipal: MUNICIPAL_SURVEY_TEMPLATES,
};

export const ALL_SURVEY_TEMPLATES: SurveyTemplateDefinition[] = [...MUNICIPAL_SURVEY_TEMPLATES];

export type SurveyTemplateCatalogKey = keyof typeof SURVEY_TEMPLATE_CATALOG;
