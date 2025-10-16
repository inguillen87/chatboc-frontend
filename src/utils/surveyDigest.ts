import { getPublicSurveyQrPageUrl, getPublicSurveyQrUrl, getPublicSurveyUrl } from '@/utils/publicSurveyUrl';
import type { SurveyChannelAsset, SurveyPublic } from '@/types/encuestas';

type ChannelKey = 'widget_chat' | 'whatsapp' | 'web' | string;

export interface SurveyChannelResolvedAssets {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  footer?: string | null;
}

const CANDIDATE_IMAGE_KEYS = [
  'imagen_url',
  'imagen',
  'image_url',
  'imageUrl',
  'image',
  'header_image_url',
  'headerImageUrl',
  'header_image',
  'headerImage',
  'portada_url',
  'portada',
  'banner_url',
  'banner',
  'cover_image_url',
  'coverImageUrl',
  'cover_url',
  'cover',
  'media_url',
  'mediaUrl',
  'url',
  'href',
  'src',
  'path',
];

const CANDIDATE_TITLE_KEYS = ['titulo', 'title', 'encabezado', 'header', 'nombre', 'heading'];
const CANDIDATE_DESCRIPTION_KEYS = ['descripcion', 'description', 'texto', 'text', 'subtitulo', 'subtitle', 'body', 'detalle'];
const CANDIDATE_FOOTER_KEYS = ['footer', 'nota', 'pie', 'footnote'];

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as Record<string, unknown>;
};

const resolveString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const resolved = resolveString(item);
      if (resolved) return resolved;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const key of Object.keys(record)) {
    const resolved = resolveString(record[key]);
    if (resolved) return resolved;
  }
  return null;
};

const resolveStringFromKeys = (value: unknown, keys: string[]): string | null => {
  const record = asRecord(value);
  if (!record) {
    return resolveString(value);
  }
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const resolved = resolveString(record[key]);
      if (resolved) return resolved;
    }
  }
  return null;
};

const findInArrayByChannel = (
  items: unknown,
  channel: ChannelKey,
): SurveyChannelAsset | Record<string, unknown> | null => {
  if (!Array.isArray(items)) return null;
  const normalizedChannel = channel.toLowerCase();
  for (const item of items) {
    const record = asRecord(item);
    if (!record) continue;
    const channelValue = resolveString(record.canal ?? record.channel ?? record.id ?? record.slug);
    if (!channelValue) continue;
    if (channelValue.toLowerCase() === normalizedChannel) {
      return record;
    }
  }
  return null;
};

const traversePossibleContainers = (
  source: Record<string, unknown>,
  channel: ChannelKey,
): Record<string, unknown> | null => {
  const containers = [
    source.canales,
    source.channelAssets,
    source.channel_assets,
    source.recursos,
    source.resources,
    source.difusion,
    source.assets,
    source.media,
    source.branding,
  ];

  for (const container of containers) {
    if (!container) continue;
    if (Array.isArray(container)) {
      const match = findInArrayByChannel(container, channel);
      if (match) return match as Record<string, unknown>;
      continue;
    }

    const record = asRecord(container);
    if (!record) continue;

    const direct =
      record[channel] ??
      record[channel.toLowerCase()] ??
      record[channel.toUpperCase()] ??
      record[`canal_${channel}`] ??
      record[`channel_${channel}`];

    if (direct) {
      const resolved = asRecord(direct);
      if (resolved) return resolved;
    }
  }

  return null;
};

const extractAssetsFromRecord = (record: Record<string, unknown>): SurveyChannelResolvedAssets => ({
  title: resolveStringFromKeys(record, CANDIDATE_TITLE_KEYS),
  description: resolveStringFromKeys(record, CANDIDATE_DESCRIPTION_KEYS),
  imageUrl: resolveStringFromKeys(record, CANDIDATE_IMAGE_KEYS),
  footer: resolveStringFromKeys(record, CANDIDATE_FOOTER_KEYS),
});

export const getSurveyChannelAssets = (
  survey: SurveyPublic | undefined,
  channel: ChannelKey,
): SurveyChannelResolvedAssets => {
  if (!survey) return {};

  const surveyRecord = survey as Record<string, unknown>;

  const fromContainers = traversePossibleContainers(surveyRecord, channel);
  if (fromContainers) {
    return extractAssetsFromRecord(fromContainers);
  }

  const direct = extractAssetsFromRecord(surveyRecord);
  if (direct.title || direct.description || direct.imageUrl) {
    return direct;
  }

  return {};
};

export const getSurveyGeneralImage = (
  survey: SurveyPublic | undefined,
  channel?: ChannelKey,
): string | null => {
  if (!survey) return null;
  const channelAssets = channel ? getSurveyChannelAssets(survey, channel) : null;
  if (channelAssets?.imageUrl) return channelAssets.imageUrl;

  const surveyRecord = survey as Record<string, unknown>;
  const direct = resolveStringFromKeys(surveyRecord, CANDIDATE_IMAGE_KEYS);
  if (direct) return direct;

  if (channel) {
    const fallbackChannelAssets = getSurveyChannelAssets(survey, channel === 'whatsapp' ? 'widget_chat' : 'whatsapp');
    if (fallbackChannelAssets?.imageUrl) {
      return fallbackChannelAssets.imageUrl;
    }
  }

  return null;
};

export const shortenUrlForDisplay = (url: string): string => {
  try {
    const instance = new URL(url);
    const host = instance.host.replace(/^www\./, '');
    const pathname = instance.pathname.replace(/\/+/g, '/');
    const query = instance.searchParams.toString();
    return `${host}${pathname}${query ? `?${query}` : ''}`;
  } catch (error) {
    return url.replace(/^https?:\/\//i, '');
  }
};

const formatShareUrls = ({
  participationUrl,
  widgetUrl,
  qrPageUrl,
  qrUrl,
}: {
  participationUrl?: string | null;
  widgetUrl?: string | null;
  qrPageUrl?: string | null;
  qrUrl?: string | null;
}) => {
  const lines: string[] = [];
  if (participationUrl) {
    lines.push(`• Abrir la encuesta en la web: ${participationUrl}`);
  }
  if (qrPageUrl) {
    lines.push(`• Descargar el código QR (imagen PNG): ${qrPageUrl}`);
  } else if (qrUrl) {
    lines.push(`• Descargar el código QR (imagen PNG): ${qrUrl}`);
  }
  if (widgetUrl) {
    lines.push(`• Usar el asistente virtual en la web: ${widgetUrl}`);
  }
  if (participationUrl) {
    const shareLink = `https://wa.me/?text=${encodeURIComponent(participationUrl)}`;
    lines.push(`• Compartir con un mensaje listo para WhatsApp: ${shareLink}`);
  }
  return lines;
};

export const buildSurveyShareMessage = (
  survey: SurveyPublic,
  urls: {
    participationUrl?: string | null;
    widgetUrl?: string | null;
    qrPageUrl?: string | null;
    qrUrl?: string | null;
  },
  channelAssets?: SurveyChannelResolvedAssets,
): string => {
  const lines: string[] = [];
  const headerTitle = channelAssets?.title ?? 'Encuesta ciudadana';
  const headerDescription = channelAssets?.description;

  lines.push(`*${headerTitle}*`);
  lines.push(survey.titulo);
  if (survey.descripcion) {
    lines.push(` ${survey.descripcion}`);
  }
  if (headerDescription) {
    lines.push(` ${headerDescription}`);
  }

  lines.push(...formatShareUrls(urls));

  return lines.join('\n');
};

export interface DigestBuildOptions {
  surveys: SurveyPublic[];
  limit?: number;
  channel?: ChannelKey;
  headerTitle?: string | null;
  headerDescription?: string | null;
  includeHeaderImage?: boolean;
  fallbackImageUrl?: string | null;
}

export interface DigestBuildResult {
  message: string;
  imageUrl?: string | null;
}

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const sortAndFilterActiveSurveys = (surveys: SurveyPublic[]): SurveyPublic[] => {
  const now = new Date();
  return [...surveys]
    .filter((survey) => {
      const start = parseDate(survey.inicio_at);
      const end = parseDate(survey.fin_at);
      if (start && start > now) return false;
      if (end && end < now) return false;
      return true;
    })
    .sort((a, b) => {
      const aDate = parseDate(a.inicio_at) ?? parseDate(a.fin_at) ?? new Date(0);
      const bDate = parseDate(b.inicio_at) ?? parseDate(b.fin_at) ?? new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
};

export const buildSurveyDigestMessage = ({
  surveys,
  limit = 10,
  channel = 'whatsapp',
  headerTitle,
  headerDescription,
  includeHeaderImage = false,
  fallbackImageUrl = null,
}: DigestBuildOptions): DigestBuildResult => {
  const active = sortAndFilterActiveSurveys(surveys);
  const limited = active.slice(0, limit);

  if (!limited.length) {
    return { message: 'No hay encuestas activas para compartir en este momento.' };
  }

  const primary = limited[0];
  const channelAssets = getSurveyChannelAssets(primary, channel);
  const resolvedHeaderTitle = headerTitle ?? channelAssets.title ?? 'Participación Ciudadana';
  const resolvedHeaderDescription =
    headerDescription ??
    channelAssets.description ??
    'Últimas encuestas disponibles (máximo 10).';

  const lines: string[] = [];
  lines.push(`*${resolvedHeaderTitle}*`);
  lines.push(resolvedHeaderDescription);

  limited.forEach((survey, index) => {
    lines.push(`${index + 1}. *${survey.titulo}*`);
    if (survey.descripcion) {
      lines.push(`   ${survey.descripcion}`);
    }
    const participationUrl = getPublicSurveyUrl(survey.slug);
    const widgetUrl = buildWidgetUrlWithChannel(participationUrl);
    const qrPageUrl = getPublicSurveyQrPageUrl(survey.slug);
    const qrUrl = getPublicSurveyQrUrl(survey.slug, { size: 512 });
    const shareLines = formatShareUrls({ participationUrl, widgetUrl, qrPageUrl, qrUrl });
    shareLines.forEach((line) => lines.push(`   ${line}`));
  });

  const qrUrl = getPublicSurveyQrUrl(primary.slug, { size: 512 });
  if (qrUrl) {
    lines.push('');
    lines.push(
      `Adjuntamos el código QR de *${primary.titulo}* para que puedas compartirlo al instante desde WhatsApp.`,
    );
    lines.push(qrUrl);
  }

  const imageUrl = includeHeaderImage
    ? channelAssets.imageUrl ?? getSurveyGeneralImage(primary, channel) ?? fallbackImageUrl
    : null;

  if (imageUrl) {
    lines.push('');
    lines.push(`Imagen destacada: ${imageUrl}`);
  }

  lines.push('');
  lines.push('Seleccioná una encuesta para participar o volvé al inicio.');
  lines.push('Ver simple');

  return { message: lines.join('\n').trim(), imageUrl };
};

export const buildWidgetUrlWithChannel = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const target = new URL(url);
    target.searchParams.set('canal', 'widget_chat');
    return target.toString();
  } catch (error) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}canal=widget_chat`;
  }
};
