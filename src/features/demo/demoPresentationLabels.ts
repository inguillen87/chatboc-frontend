export const DEMO_DATA_NOTICE = 'Datos de ejemplo. No son respuestas ni reclamos reales.';

const DEMO_PRESENTATION_LABELS: Record<string, string> = {
  assigned: 'Asignado',
  at_risk: 'En riesgo',
  audio: 'Audio',
  demo_publicada: 'Demo publicada',
  done: 'Completado',
  educacion: 'Educación',
  empresas: 'Empresas',
  field_team: 'Equipo de campo',
  file: 'Archivo',
  gobierno: 'Gobierno',
  image: 'Imagen',
  in_progress: 'En curso',
  in_target: 'Dentro de SLA',
  location: 'Ubicación',
  met: 'Cumplido',
  new: 'Nuevo',
  online: 'En línea',
  operations: 'Operaciones',
  pendiente_datos: 'Pendiente de datos',
  pending_data: 'Pendiente de datos',
  presencial: 'Presencial',
  ready: 'Listo',
  resolved: 'Resuelto',
  survey: 'Encuesta',
  telefono: 'Teléfono',
  web: 'Web',
  whatsapp: 'WhatsApp',
};

const normalizeEnum = (value: string) =>
  value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();

export const formatDemoPresentationLabel = (value?: string | null) => {
  const source = value?.trim();
  if (!source) return '';

  const normalized = normalizeEnum(source);
  const translated = DEMO_PRESENTATION_LABELS[normalized];
  if (translated) return translated;

  const readable = source.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return readable.charAt(0).toLocaleUpperCase('es-AR') + readable.slice(1);
};

export const isResolvedDemoStatus = (value?: string | null) => {
  const token = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  return /(resuelt|resolved)/.test(token);
};

export const isDemoDisclaimerBoilerplate = (value?: string | null) => {
  const text = (value ?? '').trim();
  if (!text) return false;
  return /^(DEMO\s+NO\s+OFICIAL|Base\s+sint[eé]tica\s+determin[ií]stica|Escenario\s+demostrativo\s+sint[eé]tico)/i.test(
    text,
  );
};

export const cleanDemoText = (value?: string | null): string => {
  const source = value?.trim();
  if (!source) return '';

  if (isDemoDisclaimerBoilerplate(source)) {
    // If the text starts with "Base sintética de ... . Actual result", extract the useful trailing sentence.
    const trailing = source.replace(/^Base\s+sint[eé]tica\s+de\s+[^.]+\.\s*/i, '').trim();
    if (trailing && trailing !== source && !isDemoDisclaimerBoilerplate(trailing)) {
      return cleanDemoText(trailing);
    }
    return '';
  }

  const timeMatch = source.match(/^(\d{1,2}:\d{2})\s+del\s+d[ií]a\s+simulado$/i);
  if (timeMatch) {
    return `Hoy, ${timeMatch[1]}`;
  }
  if (/^d[ií]a\s+simulado\s+anterior$/i.test(source)) {
    return 'Ayer';
  }
  const daysAgoMatch = source.match(/^hace\s+(\d+)\s+d[ií]as\s+simulados$/i);
  if (daysAgoMatch) {
    return `Hace ${daysAgoMatch[1]} días`;
  }

  let cleaned = source
    .replace(/\s*\(DEMO\s+NO\s+OFICIAL\)/gi, '')
    .replace(/^Base\s+sint[eé]tica\s+de\s+[^.]+\.\s*/i, '')
    .replace(/^Partici[oó]n\s+sint[eé]tica\s+independiente;[^.]+\.\s*/i, '')
    .replace(/\brespuestas\s+sint[eé]ticas\b/gi, 'respuestas')
    .replace(/\brespuestas\s+demo\b/gi, 'respuestas')
    .replace(/\b[uú]ltimos\s+30\s+d[ií]as\s+simulados\b/gi, 'Últimos 30 días')
    .replace(/\bmuestra\s+determin[ií]stica\s+simulada\b/gi, 'Últimos 30 días')
    .replace(/\bpermanecen\s+abiertos\s+en\s+el\s+escenario\b/gi, 'siguen abiertos')
    .replace(/\bObjetivo\s+demostrativo:\s*/gi, 'Objetivo: ')
    .replace(/\bMediana\s+del\s+escenario\s+demostrativo\b/gi, 'Tiempo mediano de primera respuesta')
    .replace(/\bDistribuci[oó]n\s+de\s+canales\s+del\s+escenario\s+demostrativo\b/gi, 'Por dónde entran las consultas')
    .replace(/\bCanales\s+y\s+SLA\s+del\s+escenario\b/gi, 'Por dónde entran las consultas')
    .replace(/\bdel\s+escenario\s+demostrativo\s+consolidado\b/gi, 'en los últimos 30 días')
    .replace(/\bdel\s+escenario\s+demostrativo\b/gi, '')
    .replace(/\bdel\s+escenario\b/gi, '')
    .replace(/\ben\s+el\s+escenario\b/gi, '')
    .replace(/\bobjetivo\s+operativo\s+simulado\b/gi, 'plazo objetivo')
    .replace(/\bCorte\s+ejecutivo\s+de\s+/gi, 'Resultados de ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();

  if (!cleaned) return '';
  return cleaned;
};

export const cleanDemoUnit = (unit?: string | null): string | null => {
  const trimmed = unit?.trim();
  if (!trimmed) return null;
  const cleaned = trimmed
    .replace(/\brespuestas\s+sint[eé]ticas\b/gi, 'respuestas')
    .replace(/\brespuestas\s+demo\b/gi, 'respuestas')
    .trim();
  return cleaned || null;
};
