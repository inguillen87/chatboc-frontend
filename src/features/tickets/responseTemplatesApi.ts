import { apiFetch } from '@/utils/api';

export type ResponseTemplateScope = 'tenant' | 'global';
export type ResponseTemplateTicketSourceModel =
  | 'TenantTicket'
  | 'MunicipioTicket'
  | 'PymeTicket';

export interface ResponseTemplateTicketPreview {
  renderedText: string;
  templateId: string;
  ticketId: number;
  sourceModel: ResponseTemplateTicketSourceModel;
}

export interface ResponseTemplate {
  id: string;
  tenantId: number | null;
  tenantSlug: string | null;
  scope: ResponseTemplateScope;
  name: string;
  text: string;
  keywords: string[];
  isActive: boolean;
  score?: number;
}

export interface ResponseTemplateSuggestionMetadata {
  category?: string | null;
  status?: string | null;
  channel?: string | null;
}

type UnknownRecord = Record<string, unknown>;

const MAX_METADATA_LENGTH = 80;
const MAX_SUGGESTION_COUNT = 5;
const MAX_RENDERED_TEMPLATE_BYTES = 16_384;
const TICKET_PREVIEW_CONTRACT_VERSION = 'ai.template_ticket_preview.v1';
const ALLOWED_TICKET_SOURCE_MODELS = new Set<ResponseTemplateTicketSourceModel>([
  'TenantTicket',
  'MunicipioTicket',
  'PymeTicket',
]);

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const normalizedNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : normalizedString(value);

const normalizedTenantId = (value: unknown): number | null | undefined => {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  return undefined;
};

const normalizedKeywords = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map(normalizedString)
        .filter((keyword): keyword is string => Boolean(keyword)),
    ),
  );
};

const parseScope = (value: unknown): ResponseTemplateScope | null =>
  value === 'tenant' || value === 'global' ? value : null;

export const parseResponseTemplate = (value: unknown): ResponseTemplate | null => {
  if (!isRecord(value)) return null;

  const rawId = value.id;
  const id =
    typeof rawId === 'string' || typeof rawId === 'number'
      ? String(rawId).trim()
      : '';
  const name = normalizedString(value.name);
  const text = normalizedString(value.text);
  const scope = parseScope(value.scope);
  const tenantId = normalizedTenantId(value.tenant_id);

  if (!id || !name || !text || !scope || tenantId === undefined) return null;
  if (scope === 'global' && tenantId !== null) return null;
  if (scope === 'tenant' && tenantId === null) return null;

  return {
    id,
    tenantId,
    tenantSlug: normalizedNullableString(value.tenant_slug),
    scope,
    name,
    text,
    keywords: normalizedKeywords(value.keywords),
    isActive: value.is_active === true,
  };
};

export const parseResponseTemplateList = (payload: unknown): ResponseTemplate[] => {
  if (!isRecord(payload) || !Array.isArray(payload.plantillas)) return [];

  return payload.plantillas
    .map(parseResponseTemplate)
    .filter((template): template is ResponseTemplate => Boolean(template))
    .filter((template) => template.isActive);
};

const parseSuggestedTemplate = (value: unknown): ResponseTemplate | null => {
  if (!isRecord(value)) return null;

  const parsed = parseResponseTemplate({
    ...value,
    id: value.id_plantilla,
    keywords: [],
    is_active: true,
  });
  if (!parsed) return null;

  return {
    ...parsed,
    score:
      typeof value.score === 'number' && Number.isFinite(value.score)
        ? value.score
        : undefined,
  };
};

export const parseSuggestedTemplateList = (payload: unknown): ResponseTemplate[] => {
  if (!isRecord(payload) || !Array.isArray(payload.sugerencias)) return [];

  return payload.sugerencias
    .map(parseSuggestedTemplate)
    .filter((template): template is ResponseTemplate => Boolean(template));
};

const sanitizeSuggestionMetadata = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;

  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_METADATA_LENGTH);
  return normalized || null;
};

export const hasSuggestionMetadata = (
  metadata: ResponseTemplateSuggestionMetadata | null | undefined,
): boolean =>
  Boolean(
    sanitizeSuggestionMetadata(metadata?.category) ||
      sanitizeSuggestionMetadata(metadata?.status) ||
      sanitizeSuggestionMetadata(metadata?.channel),
  );

export const responseTemplateQueryKeys = {
  list: (tenantSlug: string) => ['response-templates', tenantSlug] as const,
  suggestions: (
    tenantSlug: string,
    ticketKey: string,
    metadata: ResponseTemplateSuggestionMetadata,
  ) =>
    [
      'response-template-suggestions',
      tenantSlug,
      ticketKey,
      sanitizeSuggestionMetadata(metadata.category),
      sanitizeSuggestionMetadata(metadata.status),
      sanitizeSuggestionMetadata(metadata.channel),
    ] as const,
};

export const listResponseTemplates = async (tenantSlug: string): Promise<ResponseTemplate[]> => {
  const payload = await apiFetch<unknown>('/api/ai/templates', {
    tenantSlug,
    persistTenantSlug: false,
  });
  const normalizedTenantSlug = tenantSlug.trim().toLocaleLowerCase('es');

  return parseResponseTemplateList(payload).filter(
    (template) =>
      template.scope === 'global' ||
      template.tenantSlug?.toLocaleLowerCase('es') === normalizedTenantSlug,
  );
};

export const suggestResponseTemplates = async ({
  tenantSlug,
  metadata,
  topN = 3,
}: {
  tenantSlug: string;
  metadata: ResponseTemplateSuggestionMetadata;
  topN?: number;
}): Promise<ResponseTemplate[]> => {
  const category = sanitizeSuggestionMetadata(metadata.category);
  const status = sanitizeSuggestionMetadata(metadata.status);
  const channel = sanitizeSuggestionMetadata(metadata.channel);

  if (!category && !status && !channel) return [];

  const normalizedTopN = Number.isFinite(topN)
    ? Math.min(MAX_SUGGESTION_COUNT, Math.max(1, Math.trunc(topN)))
    : 3;

  const contextParts = [
    status ? `Estado: ${status}` : null,
    channel ? `Canal: ${channel}` : null,
  ].filter((part): part is string => Boolean(part));
  const payload = await apiFetch<unknown>('/api/ai/suggest-templates', {
    method: 'POST',
    tenantSlug,
    persistTenantSlug: false,
    body: {
      asunto: category ? `Categoría: ${category}` : 'Atención operativa',
      contexto_ticket: contextParts.join(' | '),
      top_n: normalizedTopN,
    },
  });

  return parseSuggestedTemplateList(payload);
};

const UNRESOLVED_TEMPLATE_PATTERNS = [
  /\{\{\s*[^{}]+\s*\}\}/,
  /\$\{\s*[^{}]+\s*\}/,
  /\{\s*[A-Za-z_][A-Za-z0-9_.-]*\s*\}/,
];

export const hasUnresolvedTemplateVariables = (text: string): boolean =>
  UNRESOLVED_TEMPLATE_PATTERNS.some((pattern) => pattern.test(text));

const invalidPreviewContract = () =>
  new Error('La vista previa de la plantilla no cumple el contrato seguro esperado.');

const normalizePreviewTenantSlug = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9_-]{0,126}[a-z0-9])?$/.test(normalized)
    ? normalized
    : null;
};

const normalizePreviewTemplateId = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value).trim();
  return normalized && new TextEncoder().encode(normalized).length <= 64 ? normalized : null;
};

const normalizePreviewTicketId = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizePreviewSourceModel = (
  value: unknown,
): ResponseTemplateTicketSourceModel | null =>
  typeof value === 'string' &&
  ALLOWED_TICKET_SOURCE_MODELS.has(value as ResponseTemplateTicketSourceModel)
    ? (value as ResponseTemplateTicketSourceModel)
    : null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && Boolean(item.trim()));

export const parseResponseTemplateTicketPreview = ({
  payload,
  tenantSlug,
  templateId,
  ticketId,
  sourceModel,
}: {
  payload: unknown;
  tenantSlug: string;
  templateId: string;
  ticketId: number;
  sourceModel: ResponseTemplateTicketSourceModel;
}): ResponseTemplateTicketPreview => {
  if (!isRecord(payload) || payload.contract_version !== TICKET_PREVIEW_CONTRACT_VERSION) {
    throw invalidPreviewContract();
  }

  const tenant = payload.tenant;
  const template = payload.template;
  const ticket = payload.ticket;
  const readiness = payload.readiness;
  const renderingPolicy = payload.rendering_policy;
  const sideEffects = payload.side_effects;
  if (
    !isRecord(tenant) ||
    !isRecord(template) ||
    !isRecord(ticket) ||
    !isRecord(readiness) ||
    !isRecord(renderingPolicy) ||
    !isRecord(sideEffects)
  ) {
    throw invalidPreviewContract();
  }

  const responseTenantSlug = normalizePreviewTenantSlug(tenant.slug);
  const responseTenantId = normalizedTenantId(tenant.id);
  const responseTemplateId = normalizePreviewTemplateId(template.id);
  const responseTicketId = normalizePreviewTicketId(ticket.id);
  const responseSourceModel = normalizePreviewSourceModel(ticket.source_model);
  const renderedText = typeof payload.rendered_text === 'string' ? payload.rendered_text : null;
  const requiredVariables = payload.required_variables;
  const resolvedVariables = payload.resolved_variables;
  const unresolvedVariables = payload.unresolved_variables;
  const templateScope = parseScope(template.scope);
  const allRequiredVariablesResolved =
    isStringArray(requiredVariables) &&
    isStringArray(resolvedVariables) &&
    requiredVariables.length === resolvedVariables.length &&
    requiredVariables.every((variable) => resolvedVariables.includes(variable));

  if (
    responseTenantSlug !== tenantSlug ||
    responseTenantId === null ||
    responseTenantId === undefined ||
    responseTemplateId !== templateId ||
    responseTicketId !== ticketId ||
    responseSourceModel !== sourceModel ||
    !templateScope ||
    typeof template.readonly !== 'boolean' ||
    (templateScope === 'global' && template.readonly !== true) ||
    (templateScope === 'tenant' && template.readonly !== false) ||
    typeof renderedText !== 'string' ||
    !renderedText.trim() ||
    new TextEncoder().encode(renderedText).length > MAX_RENDERED_TEMPLATE_BYTES ||
    hasUnresolvedTemplateVariables(renderedText) ||
    !allRequiredVariablesResolved ||
    !Array.isArray(unresolvedVariables) ||
    unresolvedVariables.length !== 0 ||
    readiness.ready_to_insert !== true ||
    readiness.server_rendered !== true ||
    readiness.blocker !== null ||
    renderingPolicy.content_type !== 'text/plain' ||
    renderingPolicy.html_allowed !== false ||
    renderingPolicy.client_interpolation_allowed !== false ||
    sideEffects.provider_calls_performed !== false ||
    sideEffects.messages_queued !== 0 ||
    sideEffects.messages_sent !== 0 ||
    sideEffects.records_written !== 0
  ) {
    throw invalidPreviewContract();
  }

  return {
    renderedText,
    templateId: responseTemplateId,
    ticketId: responseTicketId,
    sourceModel: responseSourceModel,
  };
};

export const previewResponseTemplateForTicket = async ({
  tenantSlug,
  templateId,
  ticketId,
  sourceModel,
}: {
  tenantSlug: string;
  templateId: string;
  ticketId: string | number;
  sourceModel: ResponseTemplateTicketSourceModel;
}): Promise<ResponseTemplateTicketPreview> => {
  const normalizedTenantSlug = normalizePreviewTenantSlug(tenantSlug);
  const normalizedTemplateId = normalizePreviewTemplateId(templateId);
  const normalizedTicketId = normalizePreviewTicketId(ticketId);
  const normalizedSourceModel = normalizePreviewSourceModel(sourceModel);
  if (
    !normalizedTenantSlug ||
    !normalizedTemplateId ||
    !normalizedTicketId ||
    !normalizedSourceModel
  ) {
    throw invalidPreviewContract();
  }

  const payload = await apiFetch<unknown>('/api/ai/templates/ticket-preview', {
    method: 'POST',
    tenantSlug: normalizedTenantSlug,
    persistTenantSlug: false,
    body: {
      template_id: normalizedTemplateId,
      ticket_id: normalizedTicketId,
      source_model: normalizedSourceModel,
    },
  });

  return parseResponseTemplateTicketPreview({
    payload,
    tenantSlug: normalizedTenantSlug,
    templateId: normalizedTemplateId,
    ticketId: normalizedTicketId,
    sourceModel: normalizedSourceModel,
  });
};
