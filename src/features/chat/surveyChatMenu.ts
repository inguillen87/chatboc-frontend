export interface SurveyChatMenuItem {
  id: string;
  title: string;
  description?: string | null;
  type: 'survey' | 'voting';
  publicUrl: string;
  whatsappShareUrl?: string | null;
  responseCount?: number | null;
  demoResponses: boolean;
}

export interface SurveyChatMenu {
  title: string;
  description: string;
  items: SurveyChatMenuItem[];
  totalAvailable: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
};

const safeHref = (...values: unknown[]) => {
  const candidate = readString(...values);
  if (!candidate) return null;
  if (/^https?:\/\/[^\s]+$/i.test(candidate)) return candidate;
  if (/^\/(?!\/)[^\s]*$/.test(candidate)) return candidate;
  return null;
};

const readSurveyContract = (response: Record<string, unknown>) => {
  const data = isRecord(response.data) ? response.data : null;
  const nested = data && isRecord(data.surveys_votings) ? data.surveys_votings : null;
  if (nested) return nested;

  const directItems = Array.isArray(response.demo_surveys)
    ? response.demo_surveys
    : Array.isArray(response.surveys)
      ? response.surveys
      : null;
  return directItems ? { items: directItems } : null;
};

const isSurveyMenuResponse = (response: Record<string, unknown>, contract: Record<string, unknown>) => {
  const marker = [response.fuente, response.source, response.accion_backend, response.contract_version]
    .map((value) => readString(value).toLowerCase())
    .filter(Boolean)
    .join(' ');
  const contractVersion = readString(contract.contract_version).toLowerCase();
  return (
    marker.includes('encuestas_menu') ||
    marker.includes('survey_menu') ||
    contractVersion.includes('surveys_votings') ||
    contractVersion.includes('encuestas_menu')
  );
};

export const normalizeSurveyChatMenu = (response: unknown): SurveyChatMenu | null => {
  if (!isRecord(response)) return null;
  const contract = readSurveyContract(response);
  if (!contract || !isSurveyMenuResponse(response, contract)) return null;

  const rawItems = Array.isArray(contract.items)
    ? contract.items
    : Array.isArray(response.demo_surveys)
      ? response.demo_surveys
      : Array.isArray(response.surveys)
        ? response.surveys
        : [];
  const seen = new Set<string>();
  const items: SurveyChatMenuItem[] = [];

  rawItems.forEach((value, index) => {
    if (!isRecord(value)) return;
    const publicUrl = safeHref(value.public_url, value.url_publica, value.public_page_url, value.share_url);
    const title = readString(value.titulo, value.title, value.name, value.slug);
    if (!publicUrl || !title) return;
    const key = `${publicUrl}|${title}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const seed = isRecord(value.seed) ? value.seed : null;
    const results = isRecord(value.results) ? value.results : null;
    const analyticsSummary = isRecord(value.analytics_summary) ? value.analytics_summary : null;
    const rawType = readString(value.tipo, value.type).toLowerCase();
    const isVoting = rawType.includes('vot') || value.es_votacion_envivo === true;
    const realPeople = seed?.real_people;
    const demoResponses = value.demo_mode === true || realPeople === false;

    items.push({
      id: readString(value.id, value.slug) || `survey-${index + 1}`,
      title,
      description: readString(value.descripcion, value.description, value.question) || null,
      type: isVoting ? 'voting' : 'survey',
      publicUrl,
      whatsappShareUrl: safeHref(value.whatsapp_share_url, value.share_whatsapp_url) || null,
      responseCount: readNumber(
        results?.total_respuestas,
        analyticsSummary?.responses,
        seed?.responses,
        results?.seeded_responses,
      ),
      demoResponses,
    });
  });

  if (!items.length) return null;
  const totalAvailable = readNumber(contract.total_available) ?? items.length;
  return {
    title: readString(contract.label) || 'Encuestas y votaciones',
    description:
      readString(contract.description) ||
      'Seleccioná una consulta para participar y ver sus resultados.',
    items,
    totalAvailable: Math.max(items.length, totalAvailable),
  };
};

export const isSurveyMenuNavigationAction = (value: unknown) => {
  if (!isRecord(value)) return false;
  const actionId = readString(value.action_id, value.intent, value.action, value.id, value.key).toLowerCase();
  const label = readString(value.texto, value.label, value.title, value.text).toLowerCase();
  if (actionId.startsWith('chatboc_survey_open::') || actionId.startsWith('chatboc_survey_share::')) {
    return false;
  }
  return (
    actionId.startsWith('mostrar_menu_encuestas') ||
    actionId.includes('volver') ||
    /^(ver (mas|m[aá]s|anteriores)|volver)$/.test(label)
  );
};
