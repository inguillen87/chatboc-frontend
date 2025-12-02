import type { PublicResponsePayload, SurveyPregunta, SurveyPublic } from '@/types/encuestas';

const BASE_OPEN_ANSWERS = [
  'Sería ideal sumar un mapa con obras en ejecución y alertas de avance.',
  'Propongo reforzar la iluminación en accesos escolares y avenidas barriales.',
  'Podríamos organizar reuniones itinerantes para acercar programas a los distritos rurales.',
  'Sugiero integrar las consultas con el asistente virtual municipal para acelerar respuestas.',
  'Me gustaría que la app permita seguir cada proyecto con etapas, fotos y votaciones.',
  'Sumaría capacitaciones sobre reciclaje y eficiencia energética en centros comunitarios.',
];

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

type WeightedEntry<T> = T & { weight?: number };

type SeedCluster = WeightedEntry<{
  lat: number;
  lng: number;
  radiusKm?: number;
  barrio?: string;
  ciudad?: string;
  provincia?: string;
  codigoPostal?: string;
}>;

type SeedChannel = WeightedEntry<{ value: string }>;

type SeedUtm = WeightedEntry<{ source?: string | null; campaign?: string | null }>;

type SeedDemographicEntry = WeightedEntry<{ value: string; descripcion?: string }>;

type QuestionBias = {
  [questionOrder: string]: {
    weights: Record<string, number>;
  };
};

interface SurveySeedScenario {
  label: string;
  municipalityLabel: string;
  clusters: SeedCluster[];
  channels: SeedChannel[];
  utms: SeedUtm[];
  genders: SeedDemographicEntry[];
  ageRanges: SeedDemographicEntry[];
  education: SeedDemographicEntry[];
  employment: SeedDemographicEntry[];
  occupations: SeedDemographicEntry[];
  residency: SeedDemographicEntry[];
  openAnswers: string[];
  questionBias: QuestionBias;
}

const weightedChoice = <T extends { weight?: number }>(entries: T[]): T | null => {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const totalWeight = entries.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  if (totalWeight <= 0) {
    return entries[Math.floor(Math.random() * entries.length)];
  }
  const target = Math.random() * totalWeight;
  let cursor = 0;
  for (const entry of entries) {
    cursor += entry.weight ?? 1;
    if (target <= cursor) {
      return entry;
    }
  }
  return entries[entries.length - 1];
};

const randomCoordinate = (centerLat: number, centerLng: number, radiusKm: number) => {
  const radiusInDegrees = (radiusKm / 111) * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const deltaLat = radiusInDegrees * Math.cos(theta);
  const denominator = Math.cos((centerLat * Math.PI) / 180) || 1;
  const deltaLng = (radiusInDegrees * Math.sin(theta)) / denominator;

  return {
    lat: centerLat + deltaLat,
    lng: centerLng + deltaLng,
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const BASE_SCENARIO: SurveySeedScenario = {
  label: 'Escenario demo general',
  municipalityLabel: 'Ciudad Demo',
  clusters: [
    { lat: -32.8908, lng: -68.8272, radiusKm: 2.2, weight: 3, barrio: 'Centro', ciudad: 'Ciudad Demo', provincia: 'Mendoza' },
    { lat: -32.9421, lng: -68.7796, radiusKm: 2.8, weight: 2.4, barrio: 'Barrio Norte', ciudad: 'Ciudad Demo', provincia: 'Mendoza' },
    { lat: -32.905, lng: -68.863, radiusKm: 2.5, weight: 1.8, barrio: 'Los Alerces', ciudad: 'Ciudad Demo', provincia: 'Mendoza' },
  ],
  channels: [
    { value: 'web', weight: 3.2 },
    { value: 'qr', weight: 2 },
    { value: 'whatsapp', weight: 3.6 },
    { value: 'email', weight: 1 },
  ],
  utms: [
    { source: 'newsletter', campaign: 'participacion-ciudadana', weight: 2.6 },
    { source: 'whatsapp', campaign: 'encuesta-barrial', weight: 3.2 },
    { source: 'facebook', campaign: 'difusion-digital', weight: 1.8 },
    { source: 'sin_fuente', campaign: null, weight: 1 },
  ],
  genders: [
    { value: 'femenino', weight: 3.1 },
    { value: 'masculino', weight: 2.9 },
    { value: 'no_binario', weight: 0.2, descripcion: 'No binarie / Género fluido' },
    { value: 'prefiero_no_decirlo', weight: 0.6 },
  ],
  ageRanges: [
    { value: '18-29', weight: 2.2 },
    { value: '30-44', weight: 3 },
    { value: '45-59', weight: 2.4 },
    { value: '60+', weight: 1.6 },
  ],
  education: [
    { value: 'Secundario completo', weight: 2.6 },
    { value: 'Terciario o tecnicatura', weight: 2.2 },
    { value: 'Universitario en curso', weight: 1.8 },
    { value: 'Universitario completo', weight: 1.6 },
    { value: 'Postgrado', weight: 0.6 },
  ],
  employment: [
    { value: 'Empleado/a en relación de dependencia', weight: 2.6 },
    { value: 'Emprendedor/a o comerciante', weight: 1.8 },
    { value: 'Estudiante', weight: 1.2 },
    { value: 'Jubilado/a o pensionado/a', weight: 1 },
    { value: 'Trabajo informal o changas', weight: 1.4 },
    { value: 'Sin empleo', weight: 0.8 },
  ],
  occupations: [
    { value: 'Servicios y turismo', weight: 2 },
    { value: 'Comercio minorista', weight: 1.8 },
    { value: 'Docencia', weight: 1.2 },
    { value: 'Salud', weight: 1 },
    { value: 'Industria / logística', weight: 1.1 },
    { value: 'Tecnología / software', weight: 0.8 },
    { value: 'Productor/a rural', weight: 0.7 },
  ],
  residency: [
    { value: 'Menos de 2 años', weight: 0.6 },
    { value: 'Entre 2 y 5 años', weight: 1.2 },
    { value: 'Entre 6 y 10 años', weight: 1.8 },
    { value: 'Más de 10 años', weight: 3 },
  ],
  openAnswers: BASE_OPEN_ANSWERS,
  questionBias: {},
};

const SCENARIO_PRESETS: Record<string, Partial<SurveySeedScenario>> = {
  'mendoza-sustentable-2025': {
    label: 'Demo sustentabilidad Junín 2025',
    municipalityLabel: 'Junín, Mendoza',
    clusters: [
      { lat: -33.0865, lng: -68.4683, radiusKm: 2.1, weight: 3.4, barrio: 'Centro', ciudad: 'Junín', provincia: 'Mendoza' },
      { lat: -32.925, lng: -68.791, radiusKm: 2.4, weight: 2.1, barrio: 'Los Barriales', ciudad: 'Junín', provincia: 'Mendoza' },
      { lat: -33.011, lng: -68.533, radiusKm: 2.7, weight: 1.5, barrio: 'Phillips', ciudad: 'Junín', provincia: 'Mendoza' },
      { lat: -32.977, lng: -68.602, radiusKm: 2.3, weight: 1.2, barrio: 'La Colonia', ciudad: 'Junín', provincia: 'Mendoza' },
    ],
    utms: [
      { source: 'newsletter', campaign: 'agenda-verde-2025', weight: 2.4 },
      { source: 'whatsapp', campaign: 'ciudad-sustentable', weight: 3.6 },
      { source: 'instagram', campaign: 'junin-sustentable', weight: 1.4 },
      { source: 'sin_fuente', campaign: null, weight: 0.8 },
    ],
    channels: [
      { value: 'whatsapp', weight: 3.5 },
      { value: 'web', weight: 2.6 },
      { value: 'qr', weight: 1.8 },
      { value: 'email', weight: 0.9 },
    ],
    openAnswers: [
      'Instalar paneles solares comunitarios en clubes y escuelas rurales.',
      'Crear un programa de compostaje domiciliario con seguimiento por la app municipal.',
      'Sumar talleres de separación en origen en los distritos productivos.',
      'Integrar sensores para detectar pérdidas de agua en la red y mostrar métricas en tiempo real.',
      'Implementar créditos verdes para pymes que reduzcan consumo energético.',
    ],
    questionBias: {
      '1': {
        weights: {
          'programas-para-reducir-el-consumo-de-agua': 2.6,
          'eficiencia-energetica-y-luminarias-led': 2.2,
          'fortalecer-puntos-limpios-y-reciclaje': 2.4,
          'huertas-urbanas-y-compostaje-comunitario': 1.6,
          'capacitaciones-sobre-uso-responsable-de-gas': 1,
        },
      },
      '2': {
        weights: {
          'muy-util-deberia-ser-una-prioridad': 3.1,
          'util-como-complemento-de-otras-acciones': 2.2,
          'poco-util-frente-a-otras-necesidades': 0.8,
          'no-es-necesario': 0.4,
        },
      },
      '3': {
        weights: {
          'recursos-digitales-interactivos': 2.5,
          'combinacion-de-formatos': 2.2,
          'historietas-y-cuentos-ilustrados': 1.4,
          'libros-y-cuadernos-impresos': 1.1,
        },
      },
    },
  },
  'mendoza-intencion-voto-2025': {
    label: 'Intención de voto Mendoza 2025',
    municipalityLabel: 'Área Metropolitana de Mendoza',
    clusters: [
      { lat: -32.8895, lng: -68.8458, radiusKm: 2.4, weight: 3.5, barrio: 'Ciudad', ciudad: 'Mendoza', provincia: 'Mendoza' },
      { lat: -32.923, lng: -68.801, radiusKm: 2.1, weight: 2.4, barrio: 'Godoy Cruz', ciudad: 'Mendoza', provincia: 'Mendoza' },
      { lat: -32.9805, lng: -68.7773, radiusKm: 2.2, weight: 1.8, barrio: 'Maipú Centro', ciudad: 'Maipú', provincia: 'Mendoza' },
      { lat: -32.898, lng: -68.812, radiusKm: 1.9, weight: 1.6, barrio: 'Las Heras', ciudad: 'Las Heras', provincia: 'Mendoza' },
    ],
    utms: [
      { source: 'whatsapp', campaign: 'intencion-voto-2025', weight: 3.4 },
      { source: 'radio', campaign: 'consulta-electoral', weight: 1.1 },
      { source: 'newsletter', campaign: 'agenda-electoral', weight: 1.9 },
      { source: 'facebook', campaign: 'participacion-politica', weight: 1.6 },
    ],
    channels: [
      { value: 'whatsapp', weight: 3.8 },
      { value: 'web', weight: 2.4 },
      { value: 'qr', weight: 1.5 },
      { value: 'email', weight: 0.8 },
    ],
    questionBias: {
      '1': {
        weights: {
          'frente-desarrollo-local': 2.6,
          'alianza-futuro-verde': 1.9,
          'coalicion-seguridad-y-familia': 1.8,
          'todavia-no-lo-deci': 1.2,
        },
      },
      '2': {
        weights: {
          'totalmente-definida': 2.2,
          'casi-definida-pero-podria-cambiar': 2.8,
          'estoy-evaluando-opciones': 1.9,
          'necesito-mas-informacion': 1.1,
        },
      },
      '3': {
        weights: {
          'trabajo-y-produccion': 2.4,
          'seguridad-ciudadana': 2.2,
          'servicios-publicos-y-urbanismo': 2,
          'educacion-y-primera-infancia': 1.4,
          'ambiente-y-cambio-climatico': 1.3,
        },
      },
    },
    openAnswers: [
      'Pido debates temáticos transmitidos en vivo para comparar propuestas.',
      'Sería útil un tablero en tiempo real con compromisos y métricas por candidato.',
      'Necesitamos integrar denuncias y datos de seguridad al panel ciudadano.',
      'Solicito compromisos concretos para parques industriales y economía del conocimiento.',
    ],
  },
  'mendoza-costo-vida-2025': {
    label: 'Costo de vida Hogares 2025',
    municipalityLabel: 'Gran Mendoza',
    utms: [
      { source: 'newsletter', campaign: 'inflacion-hogar', weight: 2.6 },
      { source: 'whatsapp', campaign: 'termometro-precios', weight: 3.1 },
      { source: 'radio', campaign: 'panel-economico', weight: 1 },
    ],
    channels: [
      { value: 'web', weight: 2.8 },
      { value: 'whatsapp', weight: 2.6 },
      { value: 'qr', weight: 1.4 },
      { value: 'email', weight: 1 },
    ],
    questionBias: {
      '1': {
        weights: {
          'impacto-muy-fuerte-tuviste-que-endeudarte': 2.2,
          'impacto-importante-tuviste-que-ajustar-varios-gastos': 2.8,
          'impacto-moderado-ajustaste-algunos-habitos': 1.6,
          'impacto-bajo-pudiste-mantener-tu-presupuesto': 0.8,
        },
      },
      '2': {
        weights: {
          'mayor-oferta-de-precios-cuidados-locales': 2.4,
          'capacitaciones-financieras-y-planificacion': 1.6,
          'ferias-populares-y-compras-comunitarias': 2.1,
          'creditos-a-tasa-subsidiada-para-emprender': 1.7,
        },
      },
    },
    openAnswers: [
      'Difundir alertas de precios máximos y comercios adheridos en la app.',
      'Crear un club de compras municipal para artículos esenciales.',
      'Integrar beneficios con billeteras digitales y seguimiento de consumo.',
    ],
  },
  'mendoza-agua-2026': {
    label: 'Agenda hídrica 2026',
    municipalityLabel: 'Cuenca Norte de Mendoza',
    clusters: [
      { lat: -32.8205, lng: -68.8014, radiusKm: 3, weight: 2.6, barrio: 'Costa Canal', ciudad: 'Guaymallén', provincia: 'Mendoza' },
      { lat: -32.7801, lng: -68.6342, radiusKm: 3.4, weight: 2.2, barrio: 'Lavalle Centro', ciudad: 'Lavalle', provincia: 'Mendoza' },
      { lat: -32.715, lng: -68.585, radiusKm: 3.8, weight: 1.8, barrio: 'Jocolí', ciudad: 'Lavalle', provincia: 'Mendoza' },
    ],
    utms: [
      { source: 'whatsapp', campaign: 'plan-hidrico-2026', weight: 3.4 },
      { source: 'newsletter', campaign: 'emergencia-hidrica', weight: 2 },
      { source: 'radio', campaign: 'sequias-2026', weight: 1 },
    ],
    questionBias: {
      '1': {
        weights: {
          'muy-preocupado-la-sequia-impacta-en-mi-zona': 3,
          'preocupacion-media-se-necesitan-mas-medidas': 2.4,
          'preocupacion-baja-por-ahora-estamos-cubiertos': 0.8,
          'no-tengo-informacion-suficiente': 0.6,
        },
      },
      '2': {
        weights: {
          'obras-de-riego-y-mejora-de-canales': 2.8,
          'programas-de-uso-eficiente-y-reutilizacion': 2.4,
          'monitoreo-con-sensores-y-alertas-en-tiempo-real': 2,
          'educacion-comunitaria-y-capacitaciones': 1.6,
        },
      },
    },
    openAnswers: [
      'Instalar riego presurizado comunitario con sensores de humedad.',
      'Coordinar turnos de riego inteligentes según caudal disponible.',
      'Crear mesas de agua con productores, cooperativas y municipios.',
    ],
  },
};

const SCENARIO_MATCHERS: Array<{
  predicate: (survey: SurveyPublic) => boolean;
  scenario: keyof typeof SCENARIO_PRESETS;
}> = [
  { predicate: (survey) => survey?.slug?.includes('ciudad-sustentable-2025') ?? false, scenario: 'mendoza-sustentable-2025' },
  { predicate: (survey) => survey?.slug?.includes('intencion-voto-municipal-2025') ?? false, scenario: 'mendoza-intencion-voto-2025' },
  { predicate: (survey) => survey?.slug?.includes('inflacion-hogar-2025') ?? false, scenario: 'mendoza-costo-vida-2025' },
  { predicate: (survey) => survey?.slug?.includes('agenda-hidrica-2026') ?? false, scenario: 'mendoza-agua-2026' },
];

const detectScenarioName = (survey: SurveyPublic, explicit?: string | null) => {
  if (explicit) return explicit;
  const matched = SCENARIO_MATCHERS.find((entry) => entry.predicate(survey));
  return matched?.scenario ?? 'default';
};

const buildScenario = (scenarioName: string, survey: SurveyPublic, overrides?: { municipalityLabel?: string }) => {
  const base = scenarioName !== 'default' ? SCENARIO_PRESETS[scenarioName] : undefined;
  const scenario: SurveySeedScenario = {
    ...BASE_SCENARIO,
    ...(base ?? {}),
    label: base?.label ?? BASE_SCENARIO.label,
    municipalityLabel:
      overrides?.municipalityLabel ??
      survey.municipio_nombre ??
      base?.municipalityLabel ??
      BASE_SCENARIO.municipalityLabel,
    clusters: (base?.clusters ?? BASE_SCENARIO.clusters).map((item) => ({ ...item })),
    channels: (base?.channels ?? BASE_SCENARIO.channels).map((item) => ({ ...item })),
    utms: (base?.utms ?? BASE_SCENARIO.utms).map((item) => ({ ...item })),
    genders: (base?.genders ?? BASE_SCENARIO.genders).map((item) => ({ ...item })),
    ageRanges: (base?.ageRanges ?? BASE_SCENARIO.ageRanges).map((item) => ({ ...item })),
    education: (base?.education ?? BASE_SCENARIO.education).map((item) => ({ ...item })),
    employment: (base?.employment ?? BASE_SCENARIO.employment).map((item) => ({ ...item })),
    occupations: (base?.occupations ?? BASE_SCENARIO.occupations).map((item) => ({ ...item })),
    residency: (base?.residency ?? BASE_SCENARIO.residency).map((item) => ({ ...item })),
    openAnswers: [...(base?.openAnswers ?? BASE_SCENARIO.openAnswers)],
    questionBias: { ...BASE_SCENARIO.questionBias, ...(base?.questionBias ?? {}) },
  };
  return scenario;
};

type ClusterOverride = {
  lat: number;
  lng: number;
  radiusKm?: number;
  barrio?: string;
  ciudad?: string;
  provincia?: string;
};

const pickClusterCoordinate = (scenario: SurveySeedScenario, override?: ClusterOverride | null) => {
  if (override) {
    return {
      location: {
        lat: override.lat,
        lng: override.lng,
        barrio: override.barrio ?? 'Centro',
        ciudad: override.ciudad ?? scenario.municipalityLabel,
        provincia: override.provincia ?? 'Mendoza',
      },
      radiusKm: override.radiusKm ?? 2.5,
    };
  }
  const selected = weightedChoice(scenario.clusters);
  if (!selected) {
    return {
      location: {
        lat: -32.8908,
        lng: -68.8272,
        barrio: 'Centro',
        ciudad: scenario.municipalityLabel,
        provincia: 'Mendoza',
      },
      radiusKm: 2.5,
    };
  }
  return {
    location: {
      lat: selected.lat,
      lng: selected.lng,
      barrio: selected.barrio ?? 'Centro',
      ciudad: selected.ciudad ?? scenario.municipalityLabel,
      provincia: selected.provincia ?? 'Mendoza',
      codigoPostal: selected.codigoPostal,
    },
    radiusKm: selected.radiusKm ?? 2.5,
  };
};

const selectOptionsWithWeights = (pregunta: SurveyPregunta, scenario: SurveySeedScenario) => {
  const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : [];
  if (!opciones.length) return [] as number[];

  const bias = scenario.questionBias?.[String(pregunta.orden ?? '')];
  const weights = bias?.weights ?? {};

  const normalizedOptions = opciones.map((opcion) => ({
    ...opcion,
    normalizedKey: normalizeText(opcion.texto ?? opcion.valor ?? opcion.id ?? ''),
  }));

  if (pregunta.tipo === 'opcion_unica') {
    const choice = weightedChoice(
      normalizedOptions.map((opcion) => ({
        value: opcion,
        weight: weights[opcion.normalizedKey] ?? 1,
      })),
    );
    return choice ? [choice.value.id] : [normalizedOptions[0].id];
  }

  const min = clamp(pregunta.min_selecciones ?? 1, 1, opciones.length);
  const max = clamp(pregunta.max_selecciones ?? opciones.length, min, opciones.length);
  const count = clamp(Math.round(min + Math.random() * (max - min)), min, max);
  const pool = normalizedOptions.map((opcion) => ({
    value: opcion,
    weight: weights[opcion.normalizedKey] ?? 1,
  }));
  const selected: typeof normalizedOptions = [];

  while (selected.length < count && pool.length) {
    const choice = weightedChoice(pool);
    if (!choice) break;
    selected.push(choice.value);
    const index = pool.findIndex((item) => item.value.id === choice.value.id);
    if (index >= 0) {
      pool.splice(index, 1);
    }
  }

  if (!selected.length) {
    selected.push(normalizedOptions[0]);
  }

  return selected.map((item) => item.id);
};

const buildRandomAnswers = (survey: SurveyPublic, scenario: SurveySeedScenario, suggestionIndex: number) =>
  (Array.isArray(survey.preguntas) ? survey.preguntas : []).map((pregunta) => {
    const preguntaId = pregunta.id ?? pregunta.orden ?? suggestionIndex;
    if (pregunta.tipo === 'abierta') {
      const textos = scenario.openAnswers?.length ? scenario.openAnswers : BASE_OPEN_ANSWERS;
      const texto = textos[suggestionIndex % textos.length];
      return { pregunta_id: preguntaId, texto_libre: texto };
    }

    const opcionIds = selectOptionsWithWeights(pregunta, scenario);
    return { pregunta_id: preguntaId, opcion_ids: opcionIds };
  });

export interface GenerateSurveySeedOptions {
  count?: number;
  scenario?: string | null;
  municipalityLabel?: string;
  centerOverride?: ClusterOverride | null;
  radiusKm?: number;
}

export interface GeneratedSeedResult {
  payloads: PublicResponsePayload[];
  scenario: SurveySeedScenario;
}

export const generateSurveySeedPayloads = (
  survey: SurveyPublic,
  options: GenerateSurveySeedOptions = {},
): GeneratedSeedResult => {
  const total = Math.max(1, Math.round(options.count ?? 100));
  const scenarioName = detectScenarioName(survey, options.scenario);
  const scenario = buildScenario(scenarioName, survey, { municipalityLabel: options.municipalityLabel });
  const payloads: PublicResponsePayload[] = [];

  for (let index = 0; index < total; index += 1) {
    const cluster = pickClusterCoordinate(scenario, options.centerOverride);
    const radiusKm = Number.isFinite(options.radiusKm ?? Number.NaN)
      ? (options.radiusKm as number)
      : cluster.radiusKm ?? 2.5;
    const coordinate = randomCoordinate(cluster.location.lat, cluster.location.lng, radiusKm || 2.5);

    const canalChoice = weightedChoice(scenario.channels) ?? { value: 'web' };
    const generoChoice = weightedChoice(scenario.genders) ?? { value: 'prefiero_no_decirlo' };
    const edadChoice = weightedChoice(scenario.ageRanges) ?? { value: '30-44' };
    const educacionChoice = weightedChoice(scenario.education) ?? { value: 'Secundario completo' };
    const empleoChoice = weightedChoice(scenario.employment) ?? { value: 'Empleado/a en relación de dependencia' };
    const ocupacionChoice = weightedChoice(scenario.occupations) ?? { value: 'Comercio minorista' };
    const residenciaChoice = weightedChoice(scenario.residency) ?? { value: 'Más de 10 años' };
    const utmChoice = weightedChoice(scenario.utms) ?? { source: 'sin_fuente', campaign: null };

    const respuestas = buildRandomAnswers(survey, scenario, index);
    const submittedAt = new Date(Date.now() - Math.floor(Math.random() * 21 * 24 * 60 * 60 * 1000));

    const payload: PublicResponsePayload = {
      respuestas,
      canal: canalChoice.value,
      utm_source: utmChoice.source ?? undefined,
      utm_campaign: utmChoice.campaign ?? undefined,
      metadata: {
        canal: canalChoice.value,
        submittedAt: submittedAt.toISOString(),
        totalQuestions: respuestas.length,
        answeredQuestions: respuestas.length,
        demographics: {
          genero: generoChoice.value,
          generoDescripcion: generoChoice.descripcion ?? undefined,
          rangoEtario: edadChoice.value,
          nivelEducativo: educacionChoice.value,
          situacionLaboral: empleoChoice.value,
          ocupacion: ocupacionChoice.value,
          tiempoResidencia: residenciaChoice.value,
          ubicacion: {
            lat: Number(coordinate.lat.toFixed(6)),
            lng: Number(coordinate.lng.toFixed(6)),
            precision: 'gps',
            origen: 'gps',
            pais: 'Argentina',
            provincia: cluster.location.provincia ?? scenario.municipalityLabel,
            ciudad: cluster.location.ciudad ?? scenario.municipalityLabel,
            barrio: cluster.location.barrio ?? 'Centro',
            codigoPostal: cluster.location.codigoPostal ?? undefined,
          },
        },
      },
    };

    if (survey.politica_unicidad === 'por_dni') {
      payload.dni = String(30000000 + index);
    }

    if (survey.politica_unicidad === 'por_phone') {
      payload.phone = `11${String(50000000 + index).padStart(8, '0')}`;
    }

    payloads.push(payload);
  }

  return { payloads, scenario };
};
