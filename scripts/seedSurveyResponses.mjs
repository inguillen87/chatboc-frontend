#!/usr/bin/env node

import process from 'node:process';

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const [flag, rawValue] = current.split('=');
    if (typeof rawValue !== 'undefined') {
      args[flag.slice(2)] = rawValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[flag.slice(2)] = next;
      index += 1;
    } else {
      args[flag.slice(2)] = true;
    }
  }
  return args;
};

const requiredArg = (args, name, alias) => {
  const value = args[name] ?? (alias ? args[alias] : undefined);
  if (!value) {
    throw new Error(`Falta el parámetro --${name}${alias ? ` (o --${alias})` : ''}`);
  }
  return String(value);
};

const randomFromArray = (array) => array[Math.floor(Math.random() * array.length)];

const randomCoordinate = (centerLat, centerLng, radiusKm) => {
  const radiusInDegrees = (radiusKm / 111) * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const deltaLat = radiusInDegrees * Math.cos(theta);
  const deltaLng = (radiusInDegrees * Math.sin(theta)) / Math.cos((centerLat * Math.PI) / 180);

  return {
    lat: centerLat + deltaLat,
    lng: centerLng + deltaLng,
  };
};

const SUGGESTION_TEXTS = [
  'Sería ideal sumar un mapa con obras en ejecución.',
  'Propongo reforzar la iluminación en los accesos principales.',
  'Podríamos organizar reuniones barriales itinerantes.',
  'Sugiero integrar las consultas con el asistente virtual municipal.',
  'Me gustaría que la app permita seguir el avance de cada proyecto.',
  'Sumaría capacitaciones para vecinas y vecinos sobre reciclaje.',
];

const DEMO_BARRIOS = [
  'Centro',
  'Barrio Norte',
  'Barrio Sur',
  'Los Alerces',
  'Paseo del Lago',
  'Altos del Este',
  'Residencial Oeste',
  'La Rivera',
];

const DEMO_CANALES = ['web', 'qr', 'whatsapp'];
const DEMO_GENDERS = ['femenino', 'masculino', 'prefiero_no_decirlo'];
const DEMO_AGE_RANGES = ['18-29', '30-44', '45-59', '60+'];

const buildRandomAnswers = (survey, suggestionIndex) =>
  survey.preguntas.map((pregunta) => {
    if (pregunta.tipo === 'abierta') {
      const texto = SUGGESTION_TEXTS[suggestionIndex % SUGGESTION_TEXTS.length];
      return { pregunta_id: pregunta.id, texto_libre: texto };
    }

    const opciones = Array.isArray(pregunta.opciones) ? pregunta.opciones : [];
    if (!opciones.length) {
      return { pregunta_id: pregunta.id, opcion_ids: [] };
    }

    if (pregunta.tipo === 'opcion_unica') {
      const opcion = randomFromArray(opciones);
      return { pregunta_id: pregunta.id, opcion_ids: [opcion.id] };
    }

    const min = Math.max(1, pregunta.min_selecciones ?? 1);
    const max = Math.max(min, pregunta.max_selecciones ?? opciones.length);
    const total = Math.min(opciones.length, min + Math.floor(Math.random() * (max - min + 1)));
    const shuffled = [...opciones].sort(() => Math.random() - 0.5);
    const seleccionadas = shuffled.slice(0, total).map((opcion) => opcion.id);
    return { pregunta_id: pregunta.id, opcion_ids: seleccionadas };
  });

const buildPayload = (survey, index, options) => {
  const { centerLat, centerLng, radiusKm, municipio } = options;
  const { lat, lng } = randomCoordinate(centerLat, centerLng, radiusKm);
  const barrio = randomFromArray(DEMO_BARRIOS);
  const canal = randomFromArray(DEMO_CANALES);
  const genero = randomFromArray(DEMO_GENDERS);
  const rangoEtario = randomFromArray(DEMO_AGE_RANGES);

  const respuestas = buildRandomAnswers(survey, index);

  const payload = {
    respuestas,
    metadata: {
      demographics: {
        genero,
        rangoEtario,
        ubicacion: {
          lat,
          lng,
          precision: 'gps',
          origen: 'gps',
          ciudad: municipio ?? 'Ciudad Demo',
          barrio,
        },
      },
      canal,
      submittedAt: new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)).toISOString(),
    },
  };

  if (survey.politica_unicidad === 'por_dni') {
    payload.dni = String(30000000 + index);
  }

  if (survey.politica_unicidad === 'por_phone') {
    payload.phone = `11${String(50000000 + index).padStart(8, '0')}`;
  }

  return payload;
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  try {
    const args = parseArgs(process.argv.slice(2));
    const slug = requiredArg(args, 'slug', 's');
    const count = Number.parseInt(args.count ?? args.c ?? '50', 10);
    const apiBase = String(args.api ?? process.env.CHATBOC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const municipio = args.municipality ?? args.m ?? null;

    const centerArg = args.center ?? args.latlng;
    const radiusKm = Number.parseFloat(args.radius ?? args.r ?? '5');

    let centerLat = -33.0865;
    let centerLng = -68.4683;

    if (centerArg) {
      const [latRaw, lngRaw] = String(centerArg).split(',').map((item) => item.trim());
      const parsedLat = Number.parseFloat(latRaw);
      const parsedLng = Number.parseFloat(lngRaw);
      if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
        centerLat = parsedLat;
        centerLng = parsedLng;
      }
    }

    console.log(`Obteniendo la encuesta pública "${slug}" desde ${apiBase}…`);
    const surveyResponse = await fetch(`${apiBase}/public/encuestas/${slug}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!surveyResponse.ok) {
      const body = await surveyResponse.text();
      throw new Error(`No se pudo cargar la encuesta (${surveyResponse.status}): ${body}`);
    }

    const survey = await surveyResponse.json();
    if (!survey || !survey.preguntas) {
      throw new Error('La respuesta obtenida no tiene el formato esperado.');
    }

    console.log(`Generando ${count} respuestas de demostración para "${survey.titulo}"…`);

    const results = [];

    for (let index = 0; index < count; index += 1) {
      const payload = buildPayload(survey, index, { centerLat, centerLng, radiusKm, municipio });

      try {
        const response = await fetch(`${apiBase}/public/encuestas/${slug}/respuestas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Error ${response.status}: ${errorBody}`);
        }

        const body = await response.json().catch(() => ({}));
        results.push({ ok: true, id: body?.id });
        process.stdout.write('.');
      } catch (error) {
        results.push({ ok: false, error });
        process.stdout.write('x');
      }

      await delay(120);
    }

    process.stdout.write('\n');

    const ok = results.filter((item) => item.ok).length;
    const failed = results.length - ok;

    console.log(`Listo: ${ok} respuestas cargadas${failed ? `, ${failed} con error` : ''}.`);

    if (failed) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
};

run();
