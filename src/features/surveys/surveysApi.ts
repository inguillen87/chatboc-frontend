import { panelApi, publicApi } from '@/api/v2/client';
import { postPublicResponse } from '@/api/encuestas';
import type { PublicResponsePayload } from '@/types/encuestas';
import { parseSurveyConditionalLogic } from '@/utils/surveyConditionalLogic';
import {
  SURVEY_DOCUMENT_SCHEMA_VERSION,
  SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
  assertSurveyDocument,
  durableBuilderDraftToSurveyDocument,
  isSurveyDocument,
  surveyDocumentToDurableBuilderDraft,
} from './surveyDocument';
import type { SurveyDocument, SurveyDocumentSchemaVersion } from './surveyDocument';
import type {
  SurveyDraftDocument,
  SurveyDraftMaterializationAck,
  SurveyDraftPersistenceAck,
  SurveyDraftSaveInput,
  SurveyQuestionDraft,
  SurveyQuestionType,
  SurveyV2,
} from './surveyTypes';

type PrimitiveParam = string | number | boolean | undefined | null;
type QueryParams = Record<string, PrimitiveParam | PrimitiveParam[]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const DRAFT_TRANSPORT_PROVENANCE_FIELDS = new Set([
  'draft_id',
  'idempotency_key',
  'revision',
  'schema_version',
  'document',
]);

export const stripSurveyDraftTransportProvenance = (
  document: SurveyDocument,
): SurveyDocument => {
  const source = document.extensions.durable_builder;
  if (!source) return document;
  const { source_values: previousSourceValues, ...sourceWithoutValues } = source;
  const sourceValues = Object.fromEntries(
    Object.entries(previousSourceValues ?? {}).filter(([key]) => !DRAFT_TRANSPORT_PROVENANCE_FIELDS.has(key)),
  );
  return {
    ...document,
    extensions: {
      ...document.extensions,
      durable_builder: {
        ...sourceWithoutValues,
        present_fields: source.present_fields.filter((field) => !DRAFT_TRANSPORT_PROVENANCE_FIELDS.has(field)),
        ...(Object.keys(sourceValues).length ? { source_values: sourceValues } : {}),
      },
    },
  } as SurveyDocument;
};

const stableJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]),
  );
};

const comparablePersistedSurveyDocument = (document: SurveyDocument) => {
  const { revision: _revision, ...withoutRevision } = stripSurveyDraftTransportProvenance(document);
  return JSON.stringify(stableJsonValue(withoutRevision));
};

const comparableSurveyDraftContent = (value: unknown) => {
  const record = isRecord(value) ? value : {};
  return JSON.stringify(stableJsonValue({
    title: typeof record.title === 'string' ? record.title : '',
    description: typeof record.description === 'string' ? record.description : '',
    questions: Array.isArray(record.questions) ? record.questions : [],
  }));
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim()
    ? value.trim()
    : typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : undefined;

const getFirst = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const buildQueryString = (params?: QueryParams) => {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => (item === undefined || item === null || item === '' ? null : String(item)))
        .filter((item): item is string => Boolean(item));
      if (normalized.length) search.set(key, normalized.join(','));
      return;
    }
    search.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const normalizeQuestionType = (value: unknown): SurveyQuestionType => {
  const normalized = asString(value)?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  if (['single', 'single_choice', 'opcion_unica', 'radio'].includes(normalized)) return 'single';
  if (['multi', 'multiple', 'multiple_choice', 'opcion_multiple', 'checkbox'].includes(normalized)) return 'multi';
  if (['rating', 'rating_emoji', 'emoji_rating', 'emoji'].includes(normalized)) return 'rating';
  if (['text', 'open', 'open_text', 'abierta', 'free_text'].includes(normalized)) return 'text';
  if (normalized === 'nps') return 'nps';
  if (normalized === 'ranking') return 'ranking';
  if (normalized === 'location' || normalized === 'ubicacion') return 'location';
  throw new Error(`Tipo de pregunta desconocido (${normalized || 'vacio'}); el borrador fue bloqueado.`);
};

const normalizeQuestion = (value: unknown, index = 0): SurveyQuestionDraft | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'question_id', 'key'])) ?? `question_${index + 1}`;
  const optionsSource = Array.isArray(value.options)
    ? value.options
    : Array.isArray(value.opciones)
      ? value.opciones
      : [];
  const conditionalLogicSource = getFirst(value, ['conditional_logic', 'conditionalLogic']);
  const conditionalLogic = parseSurveyConditionalLogic(conditionalLogicSource);
  if (conditionalLogicSource !== undefined && conditionalLogicSource !== null && !conditionalLogic) {
    throw new Error(`La pregunta ${id} contiene conditional_logic invalida; el borrador fue bloqueado.`);
  }
  return {
    ...value,
    id,
    title: asString(getFirst(value, ['title', 'label', 'text', 'pregunta'])) ?? '',
    type: normalizeQuestionType(getFirst(value, ['type', 'tipo'])),
    ...(conditionalLogic ? { conditional_logic: conditionalLogic } : {}),
    options: optionsSource.length
      ? optionsSource
          .map((option): NonNullable<SurveyQuestionDraft['options']>[number] | null => {
            if (!isRecord(option)) return null;
            return {
              ...option,
              id: asString(getFirst(option, ['id', 'key'])) ?? undefined,
              label: asString(getFirst(option, ['label', 'title', 'text', 'opcion'])) ?? undefined,
              value: (option.value as string | number | undefined) ?? asString(getFirst(option, ['id', 'key', 'label'])),
            };
          })
          .filter((option): option is NonNullable<SurveyQuestionDraft['options']>[number] => option !== null)
      : undefined,
  };
};

const asRevision = (value: unknown): number | undefined => {
  const revision = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isInteger(revision) && revision >= 0 ? revision : undefined;
};

const normalizeSurveyDraftDocument = (
  value: unknown,
  fallback: Record<string, unknown>,
): { draft?: SurveyDraftDocument; document?: SurveyDocument } => {
  const draft = isRecord(value) ? value : {};
  const nestedDraftId = asString(getFirst(draft, ['draft_id', 'id']));
  const rootDraftId = asString(fallback.draft_id);
  const nestedRevision = asRevision(draft.revision);
  const rootRevision = asRevision(fallback.revision);
  const nestedSchemaVersion = asString(draft.schema_version);
  const rootSchemaVersion = asString(fallback.schema_version);
  if (nestedDraftId && rootDraftId && nestedDraftId !== rootDraftId) {
    throw new Error('draft_id raiz y nested no coinciden; el ACK fue bloqueado.');
  }
  if (nestedRevision !== undefined && rootRevision !== undefined && nestedRevision !== rootRevision) {
    throw new Error('revision raiz y nested no coinciden; el ACK fue bloqueado.');
  }
  if (nestedSchemaVersion && rootSchemaVersion && nestedSchemaVersion !== rootSchemaVersion) {
    throw new Error('schema_version raiz y nested no coinciden; el ACK fue bloqueado.');
  }
  const draftId = nestedDraftId ?? rootDraftId;
  const revision = nestedRevision ?? rootRevision;
  if (!draftId || revision === undefined) return {};
  const schemaVersion = nestedSchemaVersion ?? rootSchemaVersion;

  const canonicalCandidate = {
    ...draft,
    schema_version: schemaVersion,
    document_ref: asString(draft.document_ref) ?? draftId,
    revision,
  };
  if (draft.document_ref !== undefined || draft.policies !== undefined || draft.experience !== undefined) {
    assertSurveyDocument(canonicalCandidate);
    if (canonicalCandidate.document_ref !== draftId) {
      throw new Error('document_ref no coincide con draft_id; el ACK fue bloqueado.');
    }
    const document = canonicalCandidate;
    const builderView = surveyDocumentToDurableBuilderDraft(document);
    return {
      document,
      draft: {
        ...builderView,
        draft_id: draftId,
        revision,
        schema_version: document.schema_version,
      },
    };
  }

  const questionsSource = Array.isArray(draft.questions)
    ? draft.questions
    : Array.isArray(fallback.questions)
      ? fallback.questions
      : [];

  const legacyDraft: SurveyDraftDocument = {
    ...draft,
    draft_id: draftId,
    revision,
    ...(schemaVersion ? { schema_version: schemaVersion } : {}),
    title: asString(draft.title) ?? asString(fallback.title) ?? '',
    description: asString(draft.description) ?? asString(fallback.description) ?? '',
    questions: questionsSource
      .map(normalizeQuestion)
      .filter((question): question is SurveyQuestionDraft => Boolean(question)),
  };
  return {
    draft: legacyDraft,
    document: durableBuilderDraftToSurveyDocument(legacyDraft),
  };
};

export const normalizeSurveyDraftPersistenceAck = (response: unknown): SurveyDraftPersistenceAck => {
  const record = isRecord(response) ? response : {};
  const advertisedSchemaVersion = asString(record.schema_version);
  if (
    advertisedSchemaVersion?.startsWith('survey-document.')
    && advertisedSchemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION
    && advertisedSchemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION_V2
  ) {
    throw new Error(`schema_version de survey-document no soportada: ${advertisedSchemaVersion}`);
  }
  const normalized = normalizeSurveyDraftDocument(record.draft, record);
  const draft = normalized.draft;
  const draftId = asString(record.draft_id) ?? draft?.draft_id;
  const revision = asRevision(record.revision) ?? draft?.revision;
  let embeddedDocument: SurveyDocument | undefined;
  let embeddedProjectedDraft: SurveyDraftDocument | undefined;
  if (record.document !== undefined) {
    assertSurveyDocument(record.document);
    embeddedDocument = record.document;
    if (draftId && embeddedDocument.document_ref !== draftId) {
      throw new Error('El document embebido no coincide con draft_id; el ACK fue bloqueado.');
    }
    if (
      revision !== undefined
      && embeddedDocument.revision !== undefined
      && embeddedDocument.revision !== revision
    ) {
      throw new Error('El document embebido no coincide con revision; el ACK fue bloqueado.');
    }
    if (
      (record.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION
        || record.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2)
      && embeddedDocument.schema_version !== record.schema_version
    ) {
      throw new Error('El document embebido no coincide con schema_version; el ACK fue bloqueado.');
    }
    const projectedDraft = surveyDocumentToDurableBuilderDraft(embeddedDocument);
    if (draftId && revision !== undefined) {
      embeddedProjectedDraft = {
        ...projectedDraft,
        draft_id: draftId,
        revision,
        schema_version: embeddedDocument.schema_version,
      };
    }
    if (
      record.draft !== undefined
      && comparableSurveyDraftContent(draft) !== comparableSurveyDraftContent(projectedDraft)
    ) {
      throw new Error('El document embebido y draft contienen datos distintos; el ACK fue bloqueado.');
    }
  }

  return {
    ok: typeof record.ok === 'boolean' ? record.ok : undefined,
    contract_version: asString(record.contract_version),
    schema_version: asString(record.schema_version) ?? draft?.schema_version ?? embeddedDocument?.schema_version,
    persisted: record.persisted === true,
    draft_id: draftId,
    revision,
    created_at: asString(record.created_at),
    updated_at: asString(record.updated_at),
    draft: embeddedDocument && record.draft === undefined ? embeddedProjectedDraft : draft,
    document: embeddedDocument ?? normalized.document,
    raw: response,
  };
};

export const isPersistedSurveyDraftAck = (
  ack: SurveyDraftPersistenceAck,
): ack is SurveyDraftPersistenceAck & { persisted: true; draft_id: string; revision: number } =>
  ack.persisted === true && Boolean(ack.draft_id) && ack.revision !== undefined;

export const saveSurveyDraftV2 = async (
  payload: SurveyDraftSaveInput,
  tenantSlug?: string | null,
): Promise<SurveyDraftPersistenceAck> => {
  let document: SurveyDocument;
  try {
    document = isSurveyDocument(payload)
      ? payload
      : durableBuilderDraftToSurveyDocument(payload, {
          baseDocument: isSurveyDocument(payload.document) ? payload.document : undefined,
        });
    assertSurveyDocument(document);
    if (payload.draft_id !== undefined && document.document_ref !== payload.draft_id) {
      throw new Error('document_ref debe coincidir exactamente con draft_id');
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'documento invalido';
    throw new Error(`El borrador no se envio: ${detail}`);
  }
  const persistedDocument = stripSurveyDraftTransportProvenance(document);
  const requestPayload = {
    ...persistedDocument,
    draft_id: payload.draft_id ?? document.document_ref,
    ...(payload.idempotency_key !== undefined ? { idempotency_key: payload.idempotency_key } : {}),
    ...(payload.revision !== undefined ? { revision: payload.revision } : {}),
    schema_version: document.schema_version,
  };
  const response = tenantSlug
    ? await panelApi.post<unknown>('/api/v2/surveys/draft', requestPayload, { tenantSlug })
    : await panelApi.post<unknown>('/api/v2/surveys/draft', requestPayload);
  const ack = normalizeSurveyDraftPersistenceAck(response);
  if (ack.persisted) {
    const rawDraft = isRecord(response) && isRecord(response.draft) ? response.draft : undefined;
    const hasCanonicalDocumentAck = Boolean(
      rawDraft
      && (rawDraft.document_ref !== undefined || rawDraft.policies !== undefined || rawDraft.experience !== undefined),
    );
    const requestedDraftId = payload.draft_id ?? document.document_ref;
    if (!ack.draft_id || ack.draft_id !== requestedDraftId) {
      throw new Error('El ACK durable no coincide con el draft_id solicitado.');
    }
    if (payload.revision !== undefined && (ack.revision === undefined || ack.revision < payload.revision)) {
      throw new Error('El ACK durable devolvio una revision anterior a la solicitada.');
    }
    const acknowledgedSchema = hasCanonicalDocumentAck
      ? ack.document?.schema_version
      : (ack.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION
        || ack.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2
        ? ack.schema_version
        : undefined);
    if (acknowledgedSchema !== undefined && acknowledgedSchema !== document.schema_version) {
      throw new Error('El ACK durable no coincide con el schema_version solicitado.');
    }
    if (
      hasCanonicalDocumentAck
      && ack.document
      && (
        ack.document.document_ref !== requestedDraftId
        || comparablePersistedSurveyDocument(ack.document) !== comparablePersistedSurveyDocument(persistedDocument)
      )
    ) {
      throw new Error('El ACK durable no coincide con el survey-document enviado.');
    }
  }
  return ack;
};

export const getSurveyDraftV2 = async (
  draftId: string,
  tenantSlug?: string | null,
): Promise<SurveyDraftPersistenceAck> => {
  const path = `/api/v2/surveys/draft/${encodeURIComponent(draftId)}`;
  const response = tenantSlug
    ? await panelApi.get<unknown>(path, { tenantSlug })
    : await panelApi.get<unknown>(path);
  const ack = normalizeSurveyDraftPersistenceAck(response);
  if (
    ack.persisted
    && (
      !ack.draft_id
      || ack.draft_id !== draftId
      || (ack.document !== undefined && ack.document.document_ref !== draftId)
    )
  ) {
    throw new Error('El ACK durable recuperado no coincide con el draft_id solicitado.');
  }
  return ack;
};

const MATERIALIZATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/;
const DURABLE_DRAFT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;

const stableMaterializationHash = (value: string) => {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
    right ^= right >>> 13;
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
};

export const createSurveyMaterializationIdempotencyKey = (draftId: string, revision: number) => {
  const normalizedDraftId = draftId.trim();
  if (!DURABLE_DRAFT_ID_PATTERN.test(normalizedDraftId) || !Number.isInteger(revision) || revision <= 0) {
    throw new Error('La materializacion requiere draft_id y revision positiva.');
  }
  const safePrefix = normalizedDraftId.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 48) || 'draft';
  const key = `survey-materialize-v1:${safePrefix}:r${revision}:${stableMaterializationHash(normalizedDraftId)}`;
  if (!MATERIALIZATION_KEY_PATTERN.test(key)) {
    throw new Error('No se pudo generar una clave de materializacion segura.');
  }
  return key;
};

const requiredPositiveInteger = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`El backend devolvio ${field} invalido al materializar.`);
  }
  return value;
};

export const normalizeSurveyDraftMaterializationAck = (response: unknown): SurveyDraftMaterializationAck => {
  if (!isRecord(response) || response.contract_version !== 'surveys.materialization.v1') {
    throw new Error('El backend devolvio un contrato de materializacion invalido.');
  }
  if (response.ok !== true || response.persisted !== true || typeof response.replayed !== 'boolean') {
    throw new Error('El backend no confirmo la materializacion durable.');
  }
  if (!isRecord(response.draft) || !isRecord(response.survey)) {
    throw new Error('La confirmacion de materializacion esta incompleta.');
  }

  const receiptId = requiredPositiveInteger(response.receipt_id, 'receipt_id');
  const surveyId = requiredPositiveInteger(response.survey_id, 'survey_id');
  const revision = requiredPositiveInteger(response.draft.revision, 'draft.revision');
  const draftId = asString(response.draft.draft_id);
  const documentRef = asString(response.draft.document_ref);
  const idempotencyKey = asString(response.idempotency_key);
  const payloadHash = asString(response.draft.payload_hash);
  const schemaVersion = response.draft.schema_version;
  if (
    !draftId ||
    !documentRef ||
    draftId !== documentRef ||
    !idempotencyKey ||
    !MATERIALIZATION_KEY_PATTERN.test(idempotencyKey) ||
    (schemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION
      && schemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION_V2) ||
    !payloadHash ||
    !/^[a-f0-9]{64}$/i.test(payloadHash)
  ) {
    throw new Error('La identidad del recibo de materializacion es invalida.');
  }
  if (response.survey.id !== undefined && response.survey.id !== surveyId) {
    throw new Error('La encuesta materializada no coincide con su recibo.');
  }

  return {
    contract_version: 'surveys.materialization.v1',
    ok: true,
    persisted: true,
    replayed: response.replayed,
    idempotency_key: idempotencyKey,
    receipt_id: receiptId,
    survey_id: surveyId,
    draft: {
      draft_id: draftId,
      revision,
      schema_version: schemaVersion as SurveyDocumentSchemaVersion,
      document_ref: documentRef,
      payload_hash: payloadHash,
    },
    survey: response.survey,
    raw: response,
  };
};

export const materializeSurveyDraftV2 = async (
  draftId: string,
  input: {
    expectedRevision: number;
    idempotencyKey?: string;
    schemaVersion?: SurveyDocumentSchemaVersion;
  },
  tenantSlug?: string | null,
) => {
  const normalizedDraftId = draftId.trim();
  if (
    !DURABLE_DRAFT_ID_PATTERN.test(normalizedDraftId)
    || !Number.isInteger(input.expectedRevision)
    || input.expectedRevision <= 0
    || (input.schemaVersion !== undefined
      && input.schemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION
      && input.schemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION_V2)
  ) {
    throw new Error('La materializacion requiere un borrador durable y una revision positiva.');
  }
  const idempotencyKey = input.idempotencyKey?.trim()
    || createSurveyMaterializationIdempotencyKey(normalizedDraftId, input.expectedRevision);
  if (!MATERIALIZATION_KEY_PATTERN.test(idempotencyKey)) {
    throw new Error('La clave de idempotencia de materializacion es invalida.');
  }
  const response = await panelApi.post<unknown>(
    `/api/v2/surveys/drafts/${encodeURIComponent(normalizedDraftId)}/materialize`,
    {
      expected_revision: input.expectedRevision,
      idempotency_key: idempotencyKey,
    },
    {
      tenantSlug,
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  );
  const ack = normalizeSurveyDraftMaterializationAck(response);
  if (
    ack.idempotency_key !== idempotencyKey
    || ack.draft.draft_id !== normalizedDraftId
    || ack.draft.document_ref !== normalizedDraftId
    || ack.draft.revision !== input.expectedRevision
    || (input.schemaVersion !== undefined && ack.draft.schema_version !== input.schemaVersion)
  ) {
    throw new Error('El recibo no coincide con la operacion de materializacion solicitada.');
  }
  return ack;
};

const normalizeSurvey = (value: unknown, index = 0): SurveyV2 | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'survey_id', 'slug', 'public_token'])) ?? `survey_${index + 1}`;
  const questionsSource =
    getFirst(value, ['questions', 'preguntas']) ??
    (isRecord(value.schema) ? getFirst(value.schema, ['questions', 'preguntas']) : undefined);
  return {
    id,
    title: asString(getFirst(value, ['title', 'titulo', 'name'])) ?? id,
    description: asString(getFirst(value, ['description', 'descripcion'])) ?? null,
    status: asString(getFirst(value, ['status', 'estado'])) ?? null,
    public_token: asString(getFirst(value, ['public_token', 'token_publico', 'slug'])) ?? null,
    opens_at: asString(getFirst(value, ['opens_at', 'inicio_at'])) ?? null,
    closes_at: asString(getFirst(value, ['closes_at', 'fin_at'])) ?? null,
    questions: Array.isArray(questionsSource)
      ? questionsSource.map(normalizeQuestion).filter((item): item is SurveyQuestionDraft => Boolean(item))
      : [],
    raw: value,
  };
};

const firstArray = (response: unknown, keys: string[]) => {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return [];
  for (const key of keys) {
    const value = response[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.items)) return value.items;
  }
  return [];
};

export const normalizeSurveyListV2 = (response: unknown) => ({
  contract_version: isRecord(response) ? asString(response.contract_version) : undefined,
  request_id: isRecord(response) ? asString(response.request_id) : undefined,
  items: firstArray(response, ['items', 'surveys', 'data'])
    .map(normalizeSurvey)
    .filter((item): item is SurveyV2 => Boolean(item)),
  pagination: isRecord(response) && isRecord(response.pagination) ? response.pagination : undefined,
  raw: response,
});

export const listSurveysV2 = async (tenantSlug?: string | null, params?: QueryParams) => {
  const response = await panelApi.get<unknown>(`/api/v2/surveys${buildQueryString(params)}`, { tenantSlug });
  return normalizeSurveyListV2(response);
};

export const createSurveyV2 = async (
  payload: { title: string; description?: string; questions: SurveyQuestionDraft[]; [key: string]: unknown },
  tenantSlug?: string | null,
) => {
  const response = await panelApi.post<unknown>('/api/v2/surveys', payload, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const getSurveyV2 = async (surveyId: string | number, tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}`, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const updateSurveyV2 = async (
  surveyId: string | number,
  payload: Partial<{ title: string; description: string; questions: SurveyQuestionDraft[]; opens_at: string; closes_at: string }>,
  tenantSlug?: string | null,
) => {
  const response = await panelApi.patch<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}`, payload, {
    tenantSlug,
  });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const publishSurveyV2 = async (surveyId: string | number, tenantSlug?: string | null) => {
  const response = await panelApi.post<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}/publish`, {}, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const closeSurveyV2 = async (surveyId: string | number, tenantSlug?: string | null) => {
  const response = await panelApi.post<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}/close`, {}, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const getSurveyAnalyticsV2 = (surveyId: string | number, tenantSlug?: string | null) =>
  panelApi.get<unknown>(`/api/v2/surveys/${encodeURIComponent(String(surveyId))}/analytics`, { tenantSlug });

export const getPublicSurveyV2 = async (publicToken: string, tenantSlug?: string | null) => {
  const response = await publicApi.get<unknown>(`/api/v2/public/surveys/${encodeURIComponent(publicToken)}`, { tenantSlug });
  const record = isRecord(response) ? response : {};
  return normalizeSurvey(getFirst(record, ['survey', 'item', 'data']) ?? response);
};

export const respondPublicSurveyV2 = (
  publicToken: string,
  payload: PublicResponsePayload,
  tenantSlug?: string | null,
) => postPublicResponse(publicToken, payload, tenantSlug?.trim() || undefined);

export interface SurveyLiveResultsV2 {
  contract_version?: string;
  request_id?: string;
  encuesta_id?: number;
  slug?: string;
  slug_publico?: string;
  total_respuestas?: number;
  preguntas?: Array<{
    id?: number | string;
    titulo?: string;
    tipo?: string;
    total_votos?: number;
    is_multi?: boolean;
    opciones?: Array<{
      id?: number | string;
      label?: string;
      value?: number;
      votos?: number;
      porcentaje?: number;
    }>;
  }>;
  timeline_minute?: Array<{ timestamp?: string; total?: number }>;
  momentum?: {
    window_minutes?: number;
    last_window?: number;
    previous_window?: number;
    trend?: string;
    delta?: number;
  };
  kpis?: Record<string, unknown>;
  heatmap?: {
    enabled?: boolean;
    points?: unknown[];
    cells?: unknown[];
    metadata?: Record<string, unknown>;
  };
  ai_summary?: string;
  ai_insights?: string[];
  render_contract?: {
    preferred_visualization?: string;
    supports?: string[];
    polling_interval_ms?: number;
    empty_state?: string;
  };
  updated_at?: string;
}

export const getPublicSurveyLiveResultsV2 = (
  publicToken: string,
  tenantSlug?: string | null,
  params?: { include_heatmap?: boolean; max_points?: number; max_cells?: number; window_minutes?: number },
) =>
  publicApi.get<SurveyLiveResultsV2>(
    `/api/v2/public/surveys/${encodeURIComponent(publicToken)}/live-results${buildQueryString(params)}`,
    { tenantSlug },
  );
