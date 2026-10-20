import type {
  ExecutiveOverviewBasis,
  ExecutiveOverviewDataMode,
  ExecutiveOverviewIconName,
  ExecutiveOverviewRanking,
  ExecutiveOverviewScorecard,
  ExecutiveOverviewViewModel,
} from '@/components/demo/ExecutiveOverviewPanel';
import { formatDemoPresentationLabel } from '@/features/demo/demoPresentationLabels';
import type {
  DemoAdminPreviewCard,
  DemoAdminPreviewChannelSummary,
  DemoAdminPreviewMetric,
  DemoAdminPreviewResponse,
} from '@/features/demo/demoTypes';

type IndexedPreviewValue = DemoAdminPreviewMetric | DemoAdminPreviewCard;

const readText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const readDisplayValue = (value: unknown): string | number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
};

const readNonNegativeNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const readStructuredBasis = (source: IndexedPreviewValue): ExecutiveOverviewBasis | null => {
  const rawDenominator = source.denominator;
  if (rawDenominator && typeof rawDenominator === 'object' && !Array.isArray(rawDenominator)) {
    const denominator = rawDenominator as Record<string, unknown>;
    const label = readText(denominator.label);
    const value = readDisplayValue(denominator.value);
    if (label && value !== null) return { label, value };
  }

  const label = readText(source.denominator_label);
  const value = readDisplayValue(source.denominator_value);
  return label && value !== null ? { label, value } : null;
};

const normalizeIconKey = (value: unknown) =>
  typeof value === 'string'
    ? value
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_')
        .toLowerCase()
    : '';

const resolveIcon = (source: IndexedPreviewValue): ExecutiveOverviewIconName => {
  const key = normalizeIconKey(source.icon ?? source.id ?? source.key);
  if (key.includes('sla') || key.includes('compliance')) return 'sla';
  if (key.includes('whatsapp') || key.includes('response') || key.includes('message')) return 'whatsapp';
  if (key.includes('survey') || key.includes('vote') || key.includes('encuesta')) return 'surveys';
  if (key.includes('map') || key.includes('location') || key.includes('coverage')) return 'coverage';
  if (key.includes('claim') || key.includes('case') || key.includes('ticket') || key.includes('reclamo')) return 'claims';
  return 'activity';
};

const buildMetricScorecards = (
  metrics: DemoAdminPreviewMetric[],
  sourceLabel: string,
  fallbackDataMode: ExecutiveOverviewDataMode | null,
): ExecutiveOverviewScorecard[] =>
  metrics.flatMap((metric, index) => {
    const label = readText(metric.label, metric.title, metric.id, metric.key);
    const value = readDisplayValue(metric.value);
    if (!label || value === null) return [];

    return [{
      id: String(metric.id ?? metric.key ?? `metric-${index}`),
      label,
      value,
      unit: readText(metric.unit),
      detail: readText(metric.detail, metric.description),
      icon: resolveIcon(metric),
      evidence: {
        sourceLabel,
        basis: readStructuredBasis(metric),
        period: readText(metric.period),
        dataMode: (readText(metric.data_mode) as ExecutiveOverviewDataMode | null) ?? fallbackDataMode,
      },
    }];
  });

const buildCardScorecards = (
  cards: DemoAdminPreviewCard[],
  sourceLabel: string,
  fallbackDataMode: ExecutiveOverviewDataMode | null,
): ExecutiveOverviewScorecard[] =>
  cards.flatMap((card, index) => {
    const label = readText(card.label, card.title, card.id, card.key);
    const value = readDisplayValue(card.value ?? card.status);
    if (!label || value === null) return [];

    return [{
      id: String(card.id ?? card.key ?? `card-${index}`),
      label,
      value,
      detail: readText(card.detail, card.description),
      icon: resolveIcon(card),
      evidence: {
        sourceLabel,
        basis: readStructuredBasis(card),
        period: readText(card.period),
        dataMode: (readText(card.data_mode) as ExecutiveOverviewDataMode | null) ?? fallbackDataMode,
      },
    }];
  });

const readChannelBasis = (summary: DemoAdminPreviewChannelSummary): ExecutiveOverviewBasis | null => {
  if (readNonNegativeNumber(summary.total_interactions) !== null) {
    return { label: 'Interacciones', value: readDisplayValue(summary.total_interactions)! };
  }
  if (readNonNegativeNumber(summary.total_cases) !== null) {
    return { label: 'Casos', value: readDisplayValue(summary.total_cases)! };
  }
  return null;
};

const buildRanking = (
  summary: DemoAdminPreviewChannelSummary | null | undefined,
  fallbackSourceLabel: string,
): ExecutiveOverviewRanking | null => {
  if (!summary || !Array.isArray(summary.channels)) return null;

  const items = summary.channels.flatMap((channel, index) => {
    const label = readText(channel.label, channel.id);
    const value = readDisplayValue(channel.value);
    const share = readNonNegativeNumber(channel.share_pct);
    const validShare = share !== null && share <= 100 ? share : null;
    if (!label || (value === null && validShare === null)) return [];

    return [{
      id: String(channel.id ?? `channel-${index}`),
      label,
      value,
      sharePercent: validShare,
    }];
  });

  if (!items.length) return null;

  const scale: ExecutiveOverviewRanking['scale'] = items.every((item) => item.sharePercent !== null)
    ? 'share'
    : 'relative';
  const basis = readChannelBasis(summary);

  return {
    title: readText(summary.label) ?? 'Distribución por canal',
    description: readText(summary.note),
    measureLabel: scale === 'share' ? 'Participación del total' : (basis?.label ?? 'Volumen por canal'),
    scale,
    sourceLabel: readText(summary.contract_version) ?? fallbackSourceLabel,
    basis,
    items,
  };
};

const buildJourney = (preview: DemoAdminPreviewResponse): ExecutiveOverviewViewModel['journey'] => {
  const timeline = Array.isArray(preview.timeline) ? preview.timeline : [];
  const fallbackDetail = readText(preview.labels?.timeline_detail);
  const steps = timeline.flatMap((item, index) => {
    const title = readText(item.title, item.label, item.description);
    if (!title) return [];
    const description = readText(item.detail, item.description, fallbackDetail);

    return [{
      id: readText(item.id) ?? `timeline-${index}`,
      title,
      description: description === title ? null : description,
      timeLabel: readText(item.time),
      channel: formatDemoPresentationLabel(readText(item.channel)),
      status: formatDemoPresentationLabel(readText(item.status)),
    }];
  });

  if (!steps.length) return null;

  return {
    title: readText(preview.labels?.timeline_title, preview.labels?.timeline) ?? 'Circuito operativo visible',
    description: fallbackDetail,
    badge: readText(preview.labels?.timeline_badge),
    steps,
  };
};

export const buildExecutiveOverviewModel = (
  preview: DemoAdminPreviewResponse,
): ExecutiveOverviewViewModel => {
  const provenance = preview.data_provenance;
  const contractVersion = readText(preview.contract_version) ?? 'Contrato no informado';
  const dataMode = readText(provenance?.mode) as ExecutiveOverviewDataMode | null;
  const synthetic = Boolean(
    provenance?.synthetic === true ||
      provenance?.contains_synthetic === true ||
      dataMode === 'synthetic_demo_scenario' ||
      dataMode === 'synthetic',
  );
  const rawMetrics = Array.isArray(preview.metrics) ? preview.metrics : [];
  const rawCards = Array.isArray(preview.cards) ? preview.cards : [];
  const scorecards = rawMetrics.length
    ? buildMetricScorecards(rawMetrics, contractVersion, dataMode)
    : buildCardScorecards(rawCards, contractVersion, dataMode);
  const summaryTitle = readText(preview.labels?.summary_title);
  const summaryDescription = readText(preview.labels?.summary_description);

  return {
    eyebrow: 'Inteligencia de gestión',
    title: readText(preview.title) ?? 'Resumen ejecutivo',
    description: readText(preview.description, preview.outcome),
    source: {
      label: contractVersion,
      mode: dataMode,
      synthetic,
      partial: provenance?.partial === true,
      suitableForDecisions:
        typeof provenance?.suitable_for_government_decisions === 'boolean'
          ? provenance.suitable_for_government_decisions
          : null,
      note: readText(provenance?.label),
    },
    scorecards,
    ranking: buildRanking(preview.channel_summary, contractVersion),
    journey: buildJourney(preview),
    callout:
      summaryTitle || summaryDescription
        ? { title: summaryTitle, description: summaryDescription }
        : null,
    emptyMessage: 'El backend no publicó indicadores, comparaciones ni hitos con evidencia suficiente.',
  };
};

export default buildExecutiveOverviewModel;
