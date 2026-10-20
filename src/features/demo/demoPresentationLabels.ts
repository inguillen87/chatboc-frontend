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
