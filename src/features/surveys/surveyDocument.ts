import type {
  PreguntaTipo,
  SurveyConditionalGroupV2,
  SurveyConditionalLogicV1,
  SurveyConditionalLogicV2,
  SurveyConditionalNodeV2,
  SurveyDraftPayload,
  SurveyOptionId,
  SurveyPublic,
  SurveyTipo,
} from '@/types/encuestas';
import { parseSurveyConditionalLogic } from '@/utils/surveyConditionalLogic';

import type { SurveyDraftSaveInput, SurveyQuestionDraft, SurveyQuestionType } from './surveyTypes';

export const SURVEY_DOCUMENT_SCHEMA_VERSION_V1 = 'survey-document.v1' as const;
/** Backwards-compatible v1 alias. Keep this value stable for legacy callers and fixtures. */
export const SURVEY_DOCUMENT_SCHEMA_VERSION = SURVEY_DOCUMENT_SCHEMA_VERSION_V1;
export const SURVEY_DOCUMENT_SCHEMA_VERSION_V2 = 'survey-document.v2' as const;
export type SurveyDocumentSchemaVersion =
  | typeof SURVEY_DOCUMENT_SCHEMA_VERSION_V1
  | typeof SURVEY_DOCUMENT_SCHEMA_VERSION_V2;
const SURVEY_DOCUMENT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~:/%+!$&'()*,;=@-]{0,159}$/;

export type SurveyDocumentQuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'free_text'
  | 'emoji_rating'
  | 'quarantined';

export interface SurveyDocumentSourceExtension {
  present_fields: string[];
  unknown_fields: Record<string, unknown>;
  source_values?: Record<string, unknown>;
  source_type?: string;
}

export interface SurveyDocumentExtensions extends Record<string, unknown> {
  admin?: SurveyDocumentSourceExtension;
  durable_builder?: SurveyDocumentSourceExtension;
}

export interface SurveyDocumentQuarantine {
  reason: 'unsupported_question_type' | 'invalid_materialization_shape';
  source: 'admin' | 'durable_builder';
  source_type: string;
  materializable: false;
}

export interface SurveyDocumentOptionV1 {
  option_ref: string;
  persisted_id?: SurveyOptionId;
  order: number;
  label: string;
  value?: string | number;
  extensions: SurveyDocumentExtensions;
}

export interface SurveyDocumentQuestionV1 {
  question_ref: string;
  persisted_id?: number;
  order: number;
  type: SurveyDocumentQuestionType;
  prompt: string;
  required: boolean;
  selection: {
    min: number | null;
    max: number | null;
  };
  visibility: null | {
    kind: 'option_selected';
    question_ref: string;
    option_ref: string;
  };
  options: SurveyDocumentOptionV1[];
  quarantine?: SurveyDocumentQuarantine;
  extensions: SurveyDocumentExtensions;
}

export interface SurveyDocumentV1 {
  schema_version: typeof SURVEY_DOCUMENT_SCHEMA_VERSION_V1;
  document_ref: string;
  revision?: number;
  title: string;
  slug?: string;
  description?: string;
  survey_type: SurveyTipo;
  schedule: {
    starts_at: string | null;
    ends_at: string | null;
  };
  policies: {
    uniqueness: SurveyPublic['politica_unicidad'];
    anonymous: boolean;
    requires_contact_data: boolean;
  };
  experience: {
    live_voting: boolean;
    show_live_results: boolean;
    allow_comments: boolean;
    reward_points: number;
  };
  questions: SurveyDocumentQuestionV1[];
  extensions: SurveyDocumentExtensions;
}

export interface SurveyDocumentVisibilityV2 {
  version: 2;
  root: SurveyConditionalGroupV2;
}

export interface SurveyDocumentQuestionV2 extends Omit<SurveyDocumentQuestionV1, 'visibility'> {
  visibility: null | SurveyDocumentVisibilityV2;
}

export interface SurveyDocumentV2 extends Omit<SurveyDocumentV1, 'schema_version' | 'questions'> {
  schema_version: typeof SURVEY_DOCUMENT_SCHEMA_VERSION_V2;
  questions: SurveyDocumentQuestionV2[];
}

export type SurveyDocument = SurveyDocumentV1 | SurveyDocumentV2;
export type SurveyDocumentQuestion = SurveyDocumentQuestionV1 | SurveyDocumentQuestionV2;

export class SurveyDocumentError extends Error {
  readonly code:
    | 'invalid_document'
    | 'duplicate_reference'
    | 'invalid_conditional_reference'
    | 'lossless_upgrade_required'
    | 'quarantined_question';

  constructor(
    code: SurveyDocumentError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'SurveyDocumentError';
    this.code = code;
  }
}

const ADMIN_ROOT_FIELDS = new Set([
  'document_ref',
  'expected_structure_revision',
  'titulo',
  'slug',
  'descripcion',
  'tipo',
  'inicio_at',
  'fin_at',
  'politica_unicidad',
  'anonimato',
  'requiere_datos_contacto',
  'preguntas',
  'es_votacion_envivo',
  'mostrar_resultados_envivo',
  'permitir_comentarios',
  'puntos_recompensa',
]);
const ADMIN_QUESTION_FIELDS = new Set([
  'question_ref',
  'id',
  'orden',
  'tipo',
  'texto',
  'obligatoria',
  'min_selecciones',
  'max_selecciones',
  'conditional_logic',
  'opciones',
]);
const ADMIN_OPTION_FIELDS = new Set(['option_ref', 'id', 'orden', 'texto', 'valor']);
const BUILDER_ROOT_FIELDS = new Set([
  'draft_id',
  'idempotency_key',
  'revision',
  'schema_version',
  'document',
  'title',
  'description',
  'questions',
]);
const BUILDER_QUESTION_FIELDS = new Set([
  'id',
  'title',
  'type',
  'required',
  'min_selections',
  'max_selections',
  'conditional_logic',
  'options',
]);
const BUILDER_OPTION_FIELDS = new Set(['id', 'label', 'value']);
const DOCUMENT_ROOT_FIELDS = new Set([
  'schema_version',
  'document_ref',
  'revision',
  'title',
  'slug',
  'description',
  'survey_type',
  'schedule',
  'policies',
  'experience',
  'questions',
  'extensions',
]);
const DOCUMENT_SCHEDULE_FIELDS = new Set(['starts_at', 'ends_at']);
const DOCUMENT_POLICY_FIELDS = new Set(['uniqueness', 'anonymous', 'requires_contact_data']);
const DOCUMENT_EXPERIENCE_FIELDS = new Set(['live_voting', 'show_live_results', 'allow_comments', 'reward_points']);
const DOCUMENT_QUESTION_FIELDS = new Set([
  'question_ref',
  'persisted_id',
  'order',
  'type',
  'prompt',
  'required',
  'selection',
  'visibility',
  'options',
  'quarantine',
  'extensions',
]);
const DOCUMENT_SELECTION_FIELDS = new Set(['min', 'max']);
const DOCUMENT_OPTION_FIELDS = new Set(['option_ref', 'persisted_id', 'order', 'label', 'value', 'extensions']);
const DOCUMENT_VISIBILITY_V1_FIELDS = new Set(['kind', 'question_ref', 'option_ref']);
const DOCUMENT_VISIBILITY_V2_FIELDS = new Set(['version', 'root']);
const DOCUMENT_QUARANTINE_FIELDS = new Set(['reason', 'source', 'source_type', 'materializable']);
const DOCUMENT_SOURCE_EXTENSION_FIELDS = new Set(['present_fields', 'unknown_fields', 'source_values', 'source_type']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: ReadonlySet<string>) =>
  Object.keys(value).every((key) => allowed.has(key));

const isValidSourceExtension = (value: unknown): value is SurveyDocumentSourceExtension => {
  if (!isRecord(value) || !hasOnlyKeys(value, DOCUMENT_SOURCE_EXTENSION_FIELDS)) return false;
  if (
    !Array.isArray(value.present_fields)
    || value.present_fields.some((field) => typeof field !== 'string')
    || new Set(value.present_fields).size !== value.present_fields.length
    || !isRecord(value.unknown_fields)
    || (value.source_values !== undefined && !isRecord(value.source_values))
    || (value.source_type !== undefined && (typeof value.source_type !== 'string' || !value.source_type))
  ) {
    return false;
  }
  return true;
};

const hasValidReservedExtensions = (value: unknown): value is SurveyDocumentExtensions =>
  isRecord(value)
  && (value.admin === undefined || isValidSourceExtension(value.admin))
  && (value.durable_builder === undefined || isValidSourceExtension(value.durable_builder));

const presentFields = (value: Record<string, unknown>) => Object.keys(value);

const unknownFields = (value: Record<string, unknown>, known: ReadonlySet<string>) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !known.has(key)));

const sourceExtension = (
  value: Record<string, unknown>,
  known: ReadonlySet<string>,
  sourceValues?: Record<string, unknown>,
  sourceType?: string,
): SurveyDocumentSourceExtension => ({
  present_fields: presentFields(value),
  unknown_fields: unknownFields(value, known),
  ...(sourceValues && Object.keys(sourceValues).length ? { source_values: sourceValues } : {}),
  ...(sourceType ? { source_type: sourceType } : {}),
});

const mergeSourceExtension = (
  previous: SurveyDocumentSourceExtension | undefined,
  next: SurveyDocumentSourceExtension | undefined,
) => {
  if (!previous) return next;
  if (!next) return previous;
  const sourceValues = { ...(previous.source_values ?? {}), ...(next.source_values ?? {}) };
  return {
    ...previous,
    ...next,
    present_fields: [...new Set([...previous.present_fields, ...next.present_fields])],
    unknown_fields: { ...previous.unknown_fields, ...next.unknown_fields },
    ...(Object.keys(sourceValues).length ? { source_values: sourceValues } : {}),
  } satisfies SurveyDocumentSourceExtension;
};

const mergeExtensions = (
  previous: SurveyDocumentExtensions,
  next: SurveyDocumentExtensions,
): SurveyDocumentExtensions => ({
  ...previous,
  ...next,
  ...(previous.admin || next.admin ? { admin: mergeSourceExtension(previous.admin, next.admin) } : {}),
  ...(previous.durable_builder || next.durable_builder
    ? { durable_builder: mergeSourceExtension(previous.durable_builder, next.durable_builder) }
    : {}),
});

const hasSourceField = (extension: SurveyDocumentSourceExtension | undefined, field: string) =>
  extension?.present_fields.includes(field) === true;

const encodeRefPart = (value: SurveyOptionId) => encodeURIComponent(String(value));

const adminQuestionRef = (question: Record<string, unknown>, index: number) => {
  if (typeof question.question_ref === 'string' && question.question_ref.trim()) return question.question_ref;
  const id = question.id;
  if (typeof id === 'number' && Number.isInteger(id)) return `admin-question:${id}`;
  const order = typeof question.orden === 'number' && Number.isInteger(question.orden) ? question.orden : index + 1;
  return `admin-question-order:${order}`;
};

const adminOptionRef = (
  questionRef: string,
  option: Record<string, unknown>,
  index: number,
) => {
  if (typeof option.option_ref === 'string' && option.option_ref.trim()) return option.option_ref;
  const id = option.id;
  if ((typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id.length > 0)) {
    return `${questionRef}/admin-option:${encodeRefPart(id)}`;
  }
  const order = typeof option.orden === 'number' && Number.isInteger(option.orden) ? option.orden : index + 1;
  return `${questionRef}/admin-option-order:${order}`;
};

const builderQuestionRef = (question: Record<string, unknown>, index: number) => {
  if (typeof question.question_ref === 'string' && question.question_ref.trim()) return question.question_ref;
  if (typeof question.id === 'string' && question.id.trim()) return question.id;
  return `builder-question:${index + 1}`;
};

const builderOptionRef = (questionRef: string, option: Record<string, unknown>, index: number) => {
  if (typeof option.option_ref === 'string' && option.option_ref.trim()) return option.option_ref;
  if (typeof option.id === 'string' && option.id.trim()) return option.id;
  return `${questionRef}/option:${index + 1}`;
};

const ADMIN_TO_DOCUMENT_TYPE: Record<PreguntaTipo, SurveyDocumentQuestionType> = {
  opcion_unica: 'single_choice',
  multiple: 'multiple_choice',
  abierta: 'free_text',
  rating_emoji: 'emoji_rating',
};

const DOCUMENT_TO_ADMIN_TYPE: Record<Exclude<SurveyDocumentQuestionType, 'quarantined'>, PreguntaTipo> = {
  single_choice: 'opcion_unica',
  multiple_choice: 'multiple',
  free_text: 'abierta',
  emoji_rating: 'rating_emoji',
};

const BUILDER_TO_DOCUMENT_TYPE: Record<Exclude<SurveyQuestionType, 'nps' | 'ranking' | 'location'>, SurveyDocumentQuestionType> = {
  single: 'single_choice',
  multi: 'multiple_choice',
  text: 'free_text',
  rating: 'emoji_rating',
};

const DOCUMENT_TO_BUILDER_TYPE: Record<Exclude<SurveyDocumentQuestionType, 'quarantined'>, SurveyQuestionType> = {
  single_choice: 'single',
  multiple_choice: 'multi',
  free_text: 'text',
  emoji_rating: 'rating',
};

const ensureUniqueReferences = (questions: readonly SurveyDocumentQuestion[]) => {
  const questionRefs = new Set<string>();
  for (const question of questions) {
    if (!question.question_ref || questionRefs.has(question.question_ref)) {
      throw new SurveyDocumentError('duplicate_reference', `Referencia de pregunta duplicada: ${question.question_ref || '(vacia)'}`);
    }
    questionRefs.add(question.question_ref);
    const optionRefs = new Set<string>();
    for (const option of question.options) {
      if (!option.option_ref || optionRefs.has(option.option_ref)) {
        throw new SurveyDocumentError('duplicate_reference', `Referencia de opcion duplicada: ${option.option_ref || '(vacia)'}`);
      }
      optionRefs.add(option.option_ref);
    }
  }
};

const cloneConditionalNodeV2 = (node: SurveyConditionalNodeV2): SurveyConditionalNodeV2 =>
  node.kind === 'option_selected'
    ? {
        kind: 'option_selected',
        question_ref: node.question_ref,
        option_ref: node.option_ref,
      }
    : {
        kind: 'group',
        operator: node.operator,
        children: node.children.map(cloneConditionalNodeV2),
      };

const cloneConditionalGroupV2 = (group: SurveyConditionalGroupV2): SurveyConditionalGroupV2 => ({
  kind: 'group',
  operator: group.operator,
  children: group.children.map(cloneConditionalNodeV2),
});

const conditionalLeavesV2 = (node: SurveyConditionalNodeV2): SurveyConditionalNodeV2[] =>
  node.kind === 'option_selected'
    ? [node]
    : node.children.flatMap(conditionalLeavesV2);

type SurveyConditionalLeafV2 = Extract<SurveyConditionalNodeV2, { kind: 'option_selected' }>;

const mandatoryLeavesInsideAnd = (node: SurveyConditionalNodeV2): SurveyConditionalLeafV2[] => {
  if (node.kind === 'option_selected') return [node];
  if (node.operator === 'or') return [];
  return node.children.flatMap(mandatoryLeavesInsideAnd);
};

const assertSatisfiableSingleChoiceConjunctions = (
  node: SurveyConditionalNodeV2,
  questions: readonly SurveyDocumentQuestion[],
  targetQuestionRef: string,
) => {
  if (node.kind === 'option_selected') return;
  if (node.operator === 'and') {
    const optionsByQuestion = new Map<string, Set<string>>();
    for (const leaf of node.children.flatMap(mandatoryLeavesInsideAnd)) {
      const options = optionsByQuestion.get(leaf.question_ref) ?? new Set<string>();
      options.add(leaf.option_ref);
      optionsByQuestion.set(leaf.question_ref, options);
    }
    for (const [questionRef, optionRefs] of optionsByQuestion) {
      const source = questions.find((question) => question.question_ref === questionRef);
      if (source?.type === 'single_choice' && optionRefs.size > 1) {
        throw new SurveyDocumentError(
          'invalid_conditional_reference',
          `visibility v2 de ${targetQuestionRef} exige opciones mutuamente excluyentes de ${questionRef}`,
        );
      }
    }
  }
  for (const child of node.children) assertSatisfiableSingleChoiceConjunctions(child, questions, targetQuestionRef);
};

const parseConditionalLogicOrThrow = (raw: unknown, targetIndex: number) => {
  if (raw === undefined || raw === null) return null;
  const logic = parseSurveyConditionalLogic(raw);
  if (!logic) {
    throw new SurveyDocumentError('invalid_conditional_reference', `conditional_logic invalida en pregunta ${targetIndex + 1}`);
  }
  return logic;
};

const visibilityFromLegacy = (
  raw: unknown,
  questions: SurveyDocumentQuestionV1[],
  targetIndex: number,
) => {
  if (raw === undefined || raw === null) return null;
  const logic = parseConditionalLogicOrThrow(raw, targetIndex);
  if (!logic) return null;
  if (logic.version !== 1) {
    throw new SurveyDocumentError(
      'lossless_upgrade_required',
      `conditional_logic v2 no puede representarse sin perdida en survey-document.v1 (pregunta ${targetIndex + 1})`,
    );
  }
  const sourceIndex = questions.findIndex((question) => question.order === logic.show_if.question_order);
  const source = questions[sourceIndex];
  const option = source?.options.find((candidate) => candidate.order === logic.show_if.option_order);
  if (!source || !option || source.order >= questions[targetIndex].order) {
    throw new SurveyDocumentError(
      'invalid_conditional_reference',
      `conditional_logic referencia una pregunta u opcion inexistente en pregunta ${targetIndex + 1}`,
    );
  }
  return {
    kind: 'option_selected' as const,
    question_ref: source.question_ref,
    option_ref: option.option_ref,
  };
};

const visibilityV2FromConditionalLogic = (
  raw: unknown,
  questions: SurveyDocumentQuestionV1[],
  targetIndex: number,
): SurveyDocumentQuestionV2['visibility'] => {
  const logic = parseConditionalLogicOrThrow(raw, targetIndex);
  if (!logic) return null;
  if (logic.version === 2) {
    return { version: 2, root: cloneConditionalGroupV2(logic.show_if) };
  }
  const leaf = visibilityFromLegacy(logic, questions, targetIndex);
  if (!leaf) return null;
  return {
    version: 2,
    root: {
      kind: 'group',
      operator: 'and',
      children: [leaf],
    },
  };
};

const conditionalLogicV2FromVisibility = (
  visibility: SurveyDocumentQuestionV2['visibility'],
): SurveyConditionalLogicV2 | null =>
  visibility
    ? { version: 2, show_if: cloneConditionalGroupV2(visibility.root) }
    : null;

const legacyLogicFromVisibility = (
  visibility: SurveyDocumentQuestionV1['visibility'],
  questions: SurveyDocumentQuestionV1[],
  targetIndex: number,
): SurveyConditionalLogicV1 | null => {
  if (!visibility) return null;
  const sourceIndex = questions.findIndex((question) => question.question_ref === visibility.question_ref);
  const option = sourceIndex >= 0
    ? questions[sourceIndex].options.find((candidate) => candidate.option_ref === visibility.option_ref)
    : undefined;
  if (sourceIndex < 0 || !option || questions[sourceIndex].order >= questions[targetIndex].order) {
    throw new SurveyDocumentError(
      'invalid_conditional_reference',
      `La visibilidad de ${questions[targetIndex].question_ref} apunta a referencias inexistentes o posteriores`,
    );
  }
  return {
    version: 1,
    show_if: { question_order: questions[sourceIndex].order, option_order: option.order },
  };
};

export const downgradeSurveyConditionalLogicV2ToV1 = (
  logic: SurveyConditionalLogicV2,
  questions: readonly SurveyDocumentQuestion[],
  targetIndex: number,
): SurveyConditionalLogicV1 => {
  const parsed = parseSurveyConditionalLogic(logic);
  if (!parsed || parsed.version !== 2) {
    throw new SurveyDocumentError('invalid_conditional_reference', 'conditional_logic v2 invalida');
  }
  const leaves = conditionalLeavesV2(parsed.show_if);
  if (leaves.length !== 1 || leaves[0].kind !== 'option_selected') {
    throw new SurveyDocumentError(
      'lossless_upgrade_required',
      'La expresion v2 no admite downgrade sin perdida: se requiere exactamente una condicion hoja',
    );
  }
  const leaf = leaves[0];
  const sourceIndex = questions.findIndex((question) => question.question_ref === leaf.question_ref);
  const source = questions[sourceIndex];
  const target = questions[targetIndex];
  const option = source?.options.find((candidate) => candidate.option_ref === leaf.option_ref);
  if (
    !source
    || !target
    || !option
    || source.order >= target.order
    || !['single_choice', 'multiple_choice'].includes(source.type)
  ) {
    throw new SurveyDocumentError(
      'invalid_conditional_reference',
      'La expresion v2 apunta a referencias inexistentes, posteriores o no seleccionables',
    );
  }
  return {
    version: 1,
    show_if: { question_order: source.order, option_order: option.order },
  };
};

const assertMaterializable = (question: SurveyDocumentQuestion) => {
  if (question.type === 'quarantined' || question.quarantine) {
    throw new SurveyDocumentError(
      'quarantined_question',
      `La pregunta ${question.question_ref} usa el tipo no materializable ${question.quarantine?.source_type ?? 'desconocido'}`,
    );
  }
};

export const adminPayloadToSurveyDocument = (
  input: SurveyDraftPayload,
  options?: { documentRef?: string },
): SurveyDocument => {
  const root = input as SurveyDraftPayload & Record<string, unknown>;
  if (!Array.isArray(root.preguntas)) {
    throw new SurveyDocumentError('invalid_document', 'preguntas debe ser un arreglo');
  }
  const requestedSchemaVersion = typeof root.schema_version === 'string' ? root.schema_version : undefined;
  if (
    requestedSchemaVersion?.startsWith('survey-document.')
    && requestedSchemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION_V1
    && requestedSchemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION_V2
  ) {
    throw new SurveyDocumentError(
      'invalid_document',
      `schema_version de survey-document no soportada: ${requestedSchemaVersion}`,
    );
  }
  const partialQuestions = root.preguntas.map((rawQuestion, index) => {
    const question = rawQuestion as typeof rawQuestion & Record<string, unknown>;
    const questionRef = adminQuestionRef(question, index);
    const sourceType = String(question.tipo ?? '');
    const rawOptions = Array.isArray(question.opciones) ? question.opciones : [];
    const mappedType = ADMIN_TO_DOCUMENT_TYPE[question.tipo];
    const invalidSelectionShape =
      mappedType !== undefined &&
      ['single_choice', 'multiple_choice', 'emoji_rating'].includes(mappedType) &&
      (rawOptions.length === 0 || rawOptions.some((option) => typeof option?.texto !== 'string' || !option.texto.trim()));
    const documentType = mappedType && !invalidSelectionShape ? mappedType : 'quarantined';
    return {
      question_ref: questionRef,
      ...(typeof question.id === 'number' ? { persisted_id: question.id } : {}),
      order: question.orden,
      type: documentType,
      prompt: question.texto,
      required: question.obligatoria,
      selection: {
        min: question.min_selecciones ?? null,
        max: question.max_selecciones ?? null,
      },
      visibility: null,
      options: rawOptions.map((rawOption, optionIndex) => {
        const option = rawOption as typeof rawOption & Record<string, unknown>;
        return {
          option_ref: adminOptionRef(questionRef, option, optionIndex),
          ...(option.id !== undefined ? { persisted_id: option.id } : {}),
          order: option.orden,
          label: option.texto,
          ...(option.valor !== undefined ? { value: option.valor } : {}),
          extensions: {
            admin: sourceExtension(option, ADMIN_OPTION_FIELDS),
          },
        } satisfies SurveyDocumentOptionV1;
      }),
      ...(documentType === 'quarantined'
        ? {
            quarantine: {
              reason: (mappedType ? 'invalid_materialization_shape' : 'unsupported_question_type') as SurveyDocumentQuarantine['reason'],
              source: 'admin' as const,
              source_type: sourceType,
              materializable: false as const,
            },
          }
        : {}),
      extensions: {
        admin: sourceExtension(question, ADMIN_QUESTION_FIELDS, undefined, sourceType),
      },
    } satisfies SurveyDocumentQuestionV1;
  });
  const conditionalLogic = root.preguntas.map((question, index) =>
    parseConditionalLogicOrThrow(question.conditional_logic, index));
  const requiresV2 = requestedSchemaVersion === SURVEY_DOCUMENT_SCHEMA_VERSION_V2
    || conditionalLogic.some((logic) => logic?.version === 2);
  const questions = requiresV2
    ? partialQuestions.map((question, index): SurveyDocumentQuestionV2 => ({
        ...question,
        visibility: visibilityV2FromConditionalLogic(conditionalLogic[index], partialQuestions, index),
      }))
    : partialQuestions.map((question, index): SurveyDocumentQuestionV1 => ({
        ...question,
        visibility: visibilityFromLegacy(conditionalLogic[index], partialQuestions, index),
      }));
  ensureUniqueReferences(questions);

  const slug = typeof root.slug === 'string' && root.slug ? root.slug : undefined;
  const commonDocument = {
    document_ref:
      options?.documentRef ??
      (typeof root.document_ref === 'string' && root.document_ref.trim()
        ? root.document_ref
        : slug
          ? `survey:slug:${encodeURIComponent(slug)}`
          : 'survey:admin:new'),
    ...(typeof root.expected_structure_revision === 'number' ? { revision: root.expected_structure_revision } : {}),
    title: root.titulo,
    ...(slug ? { slug } : {}),
    ...(typeof root.descripcion === 'string' ? { description: root.descripcion } : {}),
    survey_type: root.tipo,
    schedule: { starts_at: root.inicio_at ?? null, ends_at: root.fin_at ?? null },
    policies: {
      uniqueness: root.politica_unicidad,
      anonymous: root.anonimato,
      requires_contact_data: root.requiere_datos_contacto,
    },
    experience: {
      live_voting: root.es_votacion_envivo ?? false,
      show_live_results: root.mostrar_resultados_envivo ?? false,
      allow_comments: root.permitir_comentarios ?? false,
      reward_points: root.puntos_recompensa ?? 0,
    },
    questions,
    extensions: {
      admin: sourceExtension(root, ADMIN_ROOT_FIELDS, {
        ...(root.expected_structure_revision !== undefined
          ? { expected_structure_revision: root.expected_structure_revision }
          : {}),
      }),
    },
  };
  const document: SurveyDocument = requiresV2
    ? {
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
        ...commonDocument,
      } as SurveyDocumentV2
    : {
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V1,
        ...commonDocument,
      } as SurveyDocumentV1;
  assertSurveyDocument(document);
  return document;
};

export const surveyDocumentToAdminPayload = (document: SurveyDocument): SurveyDraftPayload => {
  assertSurveyDocument(document);
  const source = document.extensions.admin;
  const payload: Record<string, unknown> = { ...(source?.unknown_fields ?? {}) };
  const sourceValues = source?.source_values ?? {};
  if (document.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2) {
    payload.schema_version = SURVEY_DOCUMENT_SCHEMA_VERSION_V2;
  } else if (sourceValues.schema_version !== undefined) {
    payload.schema_version = sourceValues.schema_version;
  }
  payload.document_ref = document.document_ref;
  if (document.revision !== undefined || hasSourceField(source, 'expected_structure_revision')) {
    payload.expected_structure_revision = document.revision;
  }
  payload.titulo = document.title;
  if (document.slug !== undefined || hasSourceField(source, 'slug')) payload.slug = document.slug;
  if (document.description !== undefined || hasSourceField(source, 'descripcion')) payload.descripcion = document.description;
  payload.tipo = document.survey_type;
  if (document.schedule.starts_at !== null || hasSourceField(source, 'inicio_at')) payload.inicio_at = document.schedule.starts_at;
  if (document.schedule.ends_at !== null || hasSourceField(source, 'fin_at')) payload.fin_at = document.schedule.ends_at;
  payload.politica_unicidad = document.policies.uniqueness;
  payload.anonimato = document.policies.anonymous;
  payload.requiere_datos_contacto = document.policies.requires_contact_data;
  if (document.experience.live_voting || hasSourceField(source, 'es_votacion_envivo')) {
    payload.es_votacion_envivo = document.experience.live_voting;
  }
  if (document.experience.show_live_results || hasSourceField(source, 'mostrar_resultados_envivo')) {
    payload.mostrar_resultados_envivo = document.experience.show_live_results;
  }
  if (document.experience.allow_comments || hasSourceField(source, 'permitir_comentarios')) {
    payload.permitir_comentarios = document.experience.allow_comments;
  }
  if (document.experience.reward_points || hasSourceField(source, 'puntos_recompensa')) {
    payload.puntos_recompensa = document.experience.reward_points;
  }
  payload.preguntas = document.questions.map((question, index) => {
    assertMaterializable(question);
    const questionSource = question.extensions.admin;
    const output: Record<string, unknown> = { ...(questionSource?.unknown_fields ?? {}) };
    output.question_ref = question.question_ref;
    if (question.persisted_id !== undefined || hasSourceField(questionSource, 'id')) output.id = question.persisted_id;
    output.orden = question.order;
    output.tipo = DOCUMENT_TO_ADMIN_TYPE[question.type];
    output.texto = question.prompt;
    output.obligatoria = question.required;
    if (question.selection.min !== null || hasSourceField(questionSource, 'min_selecciones')) {
      output.min_selecciones = question.selection.min;
    }
    if (question.selection.max !== null || hasSourceField(questionSource, 'max_selecciones')) {
      output.max_selecciones = question.selection.max;
    }
    const logic = document.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2
      ? conditionalLogicV2FromVisibility((question as SurveyDocumentQuestionV2).visibility)
      : legacyLogicFromVisibility(
          (question as SurveyDocumentQuestionV1).visibility,
          document.questions as SurveyDocumentQuestionV1[],
          index,
        );
    if (logic || hasSourceField(questionSource, 'conditional_logic')) output.conditional_logic = logic;
    if (question.options.length || hasSourceField(questionSource, 'opciones')) {
      output.opciones = question.options.map((option) => {
        const optionSource = option.extensions.admin;
        const optionOutput: Record<string, unknown> = { ...(optionSource?.unknown_fields ?? {}) };
        optionOutput.option_ref = option.option_ref;
        if (option.persisted_id !== undefined || hasSourceField(optionSource, 'id')) optionOutput.id = option.persisted_id;
        optionOutput.orden = option.order;
        optionOutput.texto = option.label;
        if (option.value !== undefined || hasSourceField(optionSource, 'valor')) optionOutput.valor = option.value;
        return optionOutput;
      });
    }
    return output;
  });
  return payload as unknown as SurveyDraftPayload;
};

export const durableBuilderDraftToSurveyDocument = (
  input: SurveyDraftSaveInput,
  options?: { baseDocument?: SurveyDocument },
): SurveyDocument => {
  const root = input as SurveyDraftSaveInput & Record<string, unknown>;
  if (!Array.isArray(root.questions)) {
    throw new SurveyDocumentError('invalid_document', 'questions debe ser un arreglo');
  }
  const partialQuestions = root.questions.map((rawQuestion, index) => {
    const question = rawQuestion as SurveyQuestionDraft & Record<string, unknown>;
    const questionRef = builderQuestionRef(question, index);
    const sourceType = String(question.type ?? '');
    const knownType = sourceType in BUILDER_TO_DOCUMENT_TYPE;
    const rawOptions = Array.isArray(question.options) ? question.options : [];
    const mappedType = knownType
      ? BUILDER_TO_DOCUMENT_TYPE[sourceType as keyof typeof BUILDER_TO_DOCUMENT_TYPE]
      : undefined;
    const invalidSelectionShape =
      mappedType !== undefined &&
      ['single_choice', 'multiple_choice', 'emoji_rating'].includes(mappedType) &&
      (rawOptions.length === 0 || rawOptions.some((option) => typeof option?.label !== 'string' || !option.label.trim()));
    const documentType = mappedType && !invalidSelectionShape ? mappedType : 'quarantined';
    return {
      question_ref: questionRef,
      order: index + 1,
      type: documentType,
      prompt: typeof question.title === 'string' ? question.title : '',
      required: question.required ?? false,
      selection: {
        min: question.min_selections ?? null,
        max: question.max_selections ?? null,
      },
      visibility: null,
      options: rawOptions.map((rawOption, optionIndex) => {
        const option = rawOption as NonNullable<SurveyQuestionDraft['options']>[number] & Record<string, unknown>;
        return {
          option_ref: builderOptionRef(questionRef, option, optionIndex),
          order: optionIndex + 1,
          label: typeof option.label === 'string' ? option.label : '',
          ...(option.value !== undefined ? { value: option.value } : {}),
          extensions: {
            durable_builder: sourceExtension(option, BUILDER_OPTION_FIELDS),
          },
        } satisfies SurveyDocumentOptionV1;
      }),
      ...(documentType === 'quarantined'
        ? {
            quarantine: {
              reason: (knownType ? 'invalid_materialization_shape' : 'unsupported_question_type') as SurveyDocumentQuarantine['reason'],
              source: 'durable_builder' as const,
              source_type: sourceType,
              materializable: false as const,
            },
          }
        : {}),
      extensions: {
        durable_builder: sourceExtension(question, BUILDER_QUESTION_FIELDS, undefined, sourceType),
      },
    } satisfies SurveyDocumentQuestionV1;
  });
  const conditionalLogic = root.questions.map((question, index) =>
    parseConditionalLogicOrThrow(question.conditional_logic, index));
  const base = options?.baseDocument;
  const requestedSchemaVersion = typeof root.schema_version === 'string' ? root.schema_version : undefined;
  if (
    requestedSchemaVersion?.startsWith('survey-document.')
    && requestedSchemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION_V1
    && requestedSchemaVersion !== SURVEY_DOCUMENT_SCHEMA_VERSION_V2
  ) {
    throw new SurveyDocumentError(
      'invalid_document',
      `schema_version de survey-document no soportada: ${requestedSchemaVersion}`,
    );
  }
  const requiresV2 = base?.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2
    || requestedSchemaVersion === SURVEY_DOCUMENT_SCHEMA_VERSION_V2
    || conditionalLogic.some((logic) => logic?.version === 2);
  const questions = requiresV2
    ? partialQuestions.map((question, index): SurveyDocumentQuestionV2 => ({
        ...question,
        visibility: visibilityV2FromConditionalLogic(conditionalLogic[index], partialQuestions, index),
      }))
    : partialQuestions.map((question, index): SurveyDocumentQuestionV1 => ({
        ...question,
        visibility: visibilityFromLegacy(conditionalLogic[index], partialQuestions, index),
      }));
  ensureUniqueReferences(questions);

  const draftId = typeof root.draft_id === 'string' && root.draft_id ? root.draft_id : undefined;
  const commonFresh = {
    document_ref: draftId ?? base?.document_ref ?? 'draft-unsaved',
    ...(typeof root.revision === 'number' ? { revision: root.revision } : {}),
    title: typeof root.title === 'string' ? root.title : '',
    ...(typeof root.description === 'string' ? { description: root.description } : {}),
    survey_type: 'opinion',
    schedule: { starts_at: null, ends_at: null },
    policies: { uniqueness: 'libre', anonymous: true, requires_contact_data: false },
    experience: { live_voting: false, show_live_results: false, allow_comments: false, reward_points: 0 },
    questions,
    extensions: {
      durable_builder: sourceExtension(root, BUILDER_ROOT_FIELDS, {
        ...(draftId ? { draft_id: draftId } : {}),
        ...(root.idempotency_key !== undefined ? { idempotency_key: root.idempotency_key } : {}),
        ...(root.schema_version !== undefined ? { schema_version: root.schema_version } : {}),
      }),
    },
  };
  const fresh: SurveyDocument = requiresV2
    ? { schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2, ...commonFresh } as SurveyDocumentV2
    : { schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V1, ...commonFresh } as SurveyDocumentV1;
  assertSurveyDocument(fresh);
  if (!base) return fresh;
  assertSurveyDocument(base);

  const baseQuestionList = base.questions as SurveyDocumentQuestion[];
  const freshQuestionList = fresh.questions as SurveyDocumentQuestion[];
  const baseQuestions = new Map<string, SurveyDocumentQuestion>(
    baseQuestionList.map((question) => [question.question_ref, question] as const),
  );
  const mergedCommon = {
    ...base,
    document_ref: fresh.document_ref,
    ...(fresh.revision !== undefined ? { revision: fresh.revision } : {}),
    title: fresh.title,
    description: fresh.description,
    questions: freshQuestionList.map((question) => {
      const previous = baseQuestions.get(question.question_ref);
      if (!previous) return question;
      const previousOptions = new Map(
        previous.options.map((option) => [option.option_ref, option] as const),
      );
      return {
        ...previous,
        ...question,
        options: question.options.map((option) => {
          const previousOption = previousOptions.get(option.option_ref);
          return previousOption
            ? { ...previousOption, ...option, extensions: mergeExtensions(previousOption.extensions, option.extensions) }
            : option;
        }),
        extensions: mergeExtensions(previous.extensions, question.extensions),
      };
    }),
    extensions: mergeExtensions(base.extensions, fresh.extensions),
  };
  const merged: SurveyDocument = requiresV2
    ? { ...mergedCommon, schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2 } as SurveyDocumentV2
    : { ...mergedCommon, schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V1 } as SurveyDocumentV1;
  assertSurveyDocument(merged);
  return merged;
};

export const surveyDocumentToDurableBuilderDraft = (document: SurveyDocument): SurveyDraftSaveInput => {
  assertSurveyDocument(document);
  const source = document.extensions.durable_builder;
  const output: Record<string, unknown> = { ...(source?.unknown_fields ?? {}) };
  const sourceValues = source?.source_values ?? {};
  if (typeof sourceValues.draft_id === 'string') output.draft_id = sourceValues.draft_id;
  else output.draft_id = document.document_ref;
  if (sourceValues.idempotency_key !== undefined) output.idempotency_key = sourceValues.idempotency_key;
  if (document.revision !== undefined || hasSourceField(source, 'revision')) output.revision = document.revision;
  if (document.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2) {
    output.schema_version = SURVEY_DOCUMENT_SCHEMA_VERSION_V2;
  } else if (sourceValues.schema_version !== undefined) {
    output.schema_version = sourceValues.schema_version;
  }
  output.title = document.title;
  if (document.description !== undefined || hasSourceField(source, 'description')) output.description = document.description;
  output.questions = document.questions.map((question, index) => {
    const questionSource = question.extensions.durable_builder;
    const questionOutput: Record<string, unknown> = { ...(questionSource?.unknown_fields ?? {}) };
    questionOutput.id = question.question_ref;
    if (document.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2) {
      questionOutput.question_ref = question.question_ref;
    }
    questionOutput.title = question.prompt;
    questionOutput.type = question.type === 'quarantined'
      ? question.quarantine?.source_type ?? questionSource?.source_type
      : DOCUMENT_TO_BUILDER_TYPE[question.type];
    if (question.required || hasSourceField(questionSource, 'required')) questionOutput.required = question.required;
    if (question.selection.min !== null || hasSourceField(questionSource, 'min_selections')) {
      questionOutput.min_selections = question.selection.min;
    }
    if (question.selection.max !== null || hasSourceField(questionSource, 'max_selections')) {
      questionOutput.max_selections = question.selection.max;
    }
    const logic = document.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2
      ? conditionalLogicV2FromVisibility((question as SurveyDocumentQuestionV2).visibility)
      : legacyLogicFromVisibility(
          (question as SurveyDocumentQuestionV1).visibility,
          document.questions as SurveyDocumentQuestionV1[],
          index,
        );
    if (logic || hasSourceField(questionSource, 'conditional_logic')) questionOutput.conditional_logic = logic;
    if (question.options.length || hasSourceField(questionSource, 'options')) {
      questionOutput.options = question.options.map((option) => {
        const optionSource = option.extensions.durable_builder;
        const optionOutput: Record<string, unknown> = { ...(optionSource?.unknown_fields ?? {}) };
        if (hasSourceField(optionSource, 'id') || !option.option_ref.includes('/option:')) optionOutput.id = option.option_ref;
        if (document.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2) {
          optionOutput.option_ref = option.option_ref;
        }
        if (option.label || hasSourceField(optionSource, 'label')) optionOutput.label = option.label;
        if (option.value !== undefined || hasSourceField(optionSource, 'value')) optionOutput.value = option.value;
        return optionOutput;
      });
    }
    return questionOutput;
  });
  return output as unknown as SurveyDraftSaveInput;
};

function assertSurveyDocumentVersion(
  value: unknown,
  expectedVersion: SurveyDocumentSchemaVersion,
): asserts value is SurveyDocument {
  if (!isRecord(value) || value.schema_version !== expectedVersion) {
    throw new SurveyDocumentError('invalid_document', `schema_version debe ser ${expectedVersion}`);
  }
  if (
    !hasOnlyKeys(value, DOCUMENT_ROOT_FIELDS) ||
    typeof value.document_ref !== 'string' || !SURVEY_DOCUMENT_REF_PATTERN.test(value.document_ref) ||
    (value.revision !== undefined &&
      (typeof value.revision !== 'number' || !Number.isInteger(value.revision) || value.revision < 0)) ||
    typeof value.title !== 'string' ||
    !['opinion', 'votacion', 'sondeo', 'planificacion'].includes(String(value.survey_type)) ||
    !isRecord(value.schedule) ||
    !isRecord(value.policies) ||
    !isRecord(value.experience) ||
    !Array.isArray(value.questions) ||
    !hasValidReservedExtensions(value.extensions)
  ) {
    throw new SurveyDocumentError('invalid_document', `${expectedVersion} esta incompleto`);
  }
  const schedule = value.schedule;
  if (
    !hasOnlyKeys(schedule, DOCUMENT_SCHEDULE_FIELDS) ||
    !('starts_at' in schedule) ||
    !('ends_at' in schedule) ||
    (schedule.starts_at !== null && typeof schedule.starts_at !== 'string') ||
    (schedule.ends_at !== null && typeof schedule.ends_at !== 'string')
  ) {
    throw new SurveyDocumentError('invalid_document', 'schedule debe usar fechas string o null');
  }
  const policies = value.policies;
  if (
    !hasOnlyKeys(policies, DOCUMENT_POLICY_FIELDS) ||
    !['por_dni', 'por_phone', 'por_ip', 'por_cookie', 'por_usuario', 'libre'].includes(String(policies.uniqueness)) ||
    typeof policies.anonymous !== 'boolean' ||
    typeof policies.requires_contact_data !== 'boolean'
  ) {
    throw new SurveyDocumentError('invalid_document', 'policies contiene valores invalidos');
  }
  const experience = value.experience;
  if (
    !hasOnlyKeys(experience, DOCUMENT_EXPERIENCE_FIELDS) ||
    typeof experience.live_voting !== 'boolean' ||
    typeof experience.show_live_results !== 'boolean' ||
    typeof experience.allow_comments !== 'boolean' ||
    typeof experience.reward_points !== 'number' ||
    !Number.isFinite(experience.reward_points) ||
    !Number.isInteger(experience.reward_points) ||
    experience.reward_points < 0
  ) {
    throw new SurveyDocumentError('invalid_document', 'experience contiene valores invalidos');
  }
  const questions = value.questions as unknown as SurveyDocumentQuestion[];
  const questionOrders = new Set<number>();
  const allowedTypes = new Set<SurveyDocumentQuestionType>([
    'single_choice',
    'multiple_choice',
    'free_text',
    'emoji_rating',
    'quarantined',
  ]);
  for (const [questionIndex, question] of questions.entries()) {
    if (
      !isRecord(question) ||
      !hasOnlyKeys(question, DOCUMENT_QUESTION_FIELDS) ||
      typeof question.question_ref !== 'string' || !SURVEY_DOCUMENT_REF_PATTERN.test(question.question_ref) ||
      typeof question.order !== 'number' || !Number.isInteger(question.order) || question.order <= 0 ||
      questionOrders.has(question.order) ||
      (question.persisted_id !== undefined &&
        (typeof question.persisted_id !== 'number' || !Number.isInteger(question.persisted_id))) ||
      !allowedTypes.has(question.type) ||
      typeof question.prompt !== 'string' ||
      typeof question.required !== 'boolean' ||
      !isRecord(question.selection) ||
      !Array.isArray(question.options) ||
      !hasValidReservedExtensions(question.extensions)
    ) {
      throw new SurveyDocumentError('invalid_document', `${expectedVersion} contiene una pregunta invalida`);
    }
    questionOrders.add(question.order);
    const min = question.selection.min;
    const max = question.selection.max;
    if (
      !hasOnlyKeys(question.selection, DOCUMENT_SELECTION_FIELDS) ||
      (min !== null && (typeof min !== 'number' || !Number.isInteger(min) || min < 0)) ||
      (max !== null && (typeof max !== 'number' || !Number.isInteger(max) || max < 0)) ||
      (min !== null && max !== null && min > max) ||
      (['single_choice', 'emoji_rating'].includes(question.type) &&
        ((min !== null && min > 1) || (max !== null && max > 1)))
    ) {
      throw new SurveyDocumentError('invalid_document', `selection invalida en ${question.question_ref}`);
    }
    if (question.type === 'quarantined') {
      if (
        !isRecord(question.quarantine) ||
        !hasOnlyKeys(question.quarantine, DOCUMENT_QUARANTINE_FIELDS) ||
        !['unsupported_question_type', 'invalid_materialization_shape'].includes(String(question.quarantine.reason)) ||
        !['admin', 'durable_builder'].includes(String(question.quarantine.source)) ||
        typeof question.quarantine.source_type !== 'string' || !question.quarantine.source_type.trim() ||
        question.quarantine.materializable !== false
      ) {
        throw new SurveyDocumentError('invalid_document', `cuarentena invalida en ${question.question_ref}`);
      }
    } else if (question.quarantine !== undefined) {
      throw new SurveyDocumentError('invalid_document', `una pregunta materializable no puede declarar quarantine`);
    }
    const optionOrders = new Set<number>();
    for (const option of question.options) {
      if (
        !isRecord(option) ||
        !hasOnlyKeys(option, DOCUMENT_OPTION_FIELDS) ||
        typeof option.option_ref !== 'string' || !SURVEY_DOCUMENT_REF_PATTERN.test(option.option_ref) ||
        typeof option.order !== 'number' || !Number.isInteger(option.order) || option.order <= 0 ||
        optionOrders.has(option.order) ||
        (option.persisted_id !== undefined &&
          typeof option.persisted_id !== 'string' &&
          typeof option.persisted_id !== 'number') ||
        typeof option.label !== 'string' ||
        (option.value !== undefined && typeof option.value !== 'string' && typeof option.value !== 'number') ||
        !hasValidReservedExtensions(option.extensions)
      ) {
        throw new SurveyDocumentError('invalid_document', `opcion invalida en ${question.question_ref}`);
      }
      optionOrders.add(option.order);
    }
    if (
      ['single_choice', 'multiple_choice', 'emoji_rating'].includes(question.type) &&
      (!question.options.length || question.options.some((option) => !option.label.trim()))
    ) {
      throw new SurveyDocumentError('invalid_document', `${question.question_ref} requiere opciones con etiqueta`);
    }
    if (
      question.type === 'multiple_choice' &&
      ((min !== null && min > question.options.length) || (max !== null && max > question.options.length))
    ) {
      throw new SurveyDocumentError('invalid_document', `selection supera las opciones de ${question.question_ref}`);
    }
    if (question.visibility !== null && expectedVersion === SURVEY_DOCUMENT_SCHEMA_VERSION_V1) {
      const visibility = question.visibility as SurveyDocumentQuestionV1['visibility'];
      if (
        !isRecord(visibility) ||
        !hasOnlyKeys(visibility, DOCUMENT_VISIBILITY_V1_FIELDS) ||
        visibility.kind !== 'option_selected' ||
        typeof visibility.question_ref !== 'string' ||
        !SURVEY_DOCUMENT_REF_PATTERN.test(visibility.question_ref) ||
        typeof visibility.option_ref !== 'string' ||
        !SURVEY_DOCUMENT_REF_PATTERN.test(visibility.option_ref)
      ) {
        throw new SurveyDocumentError('invalid_document', `visibility invalida en ${question.question_ref}`);
      }
      legacyLogicFromVisibility(visibility, questions as SurveyDocumentQuestionV1[], questionIndex);
      const source = questions.find((candidate) => candidate.question_ref === visibility.question_ref);
      if (!source || !['single_choice', 'multiple_choice'].includes(source.type)) {
        throw new SurveyDocumentError('invalid_document', `visibility usa una fuente no seleccionable en ${question.question_ref}`);
      }
    } else if (question.visibility !== null) {
      const visibility = question.visibility as SurveyDocumentQuestionV2['visibility'];
      if (
        !isRecord(visibility)
        || !hasOnlyKeys(visibility, DOCUMENT_VISIBILITY_V2_FIELDS)
        || visibility.version !== 2
      ) {
        throw new SurveyDocumentError('invalid_document', `visibility v2 invalida en ${question.question_ref}`);
      }
      const parsed = parseSurveyConditionalLogic({ version: 2, show_if: visibility.root });
      if (!parsed || parsed.version !== 2) {
        throw new SurveyDocumentError('invalid_document', `visibility v2 invalida en ${question.question_ref}`);
      }
      for (const node of conditionalLeavesV2(parsed.show_if)) {
        if (node.kind !== 'option_selected') {
          throw new SurveyDocumentError('invalid_document', `visibility v2 invalida en ${question.question_ref}`);
        }
        const sourceMatches = questions.filter((candidate) => candidate.question_ref === node.question_ref);
        const source = sourceMatches.length === 1 ? sourceMatches[0] : undefined;
        const optionMatches = source?.options.filter((candidate) => candidate.option_ref === node.option_ref) ?? [];
        if (
          !source
          || source.order >= question.order
          || !['single_choice', 'multiple_choice'].includes(source.type)
          || optionMatches.length !== 1
        ) {
          throw new SurveyDocumentError(
            'invalid_conditional_reference',
            `visibility v2 de ${question.question_ref} apunta a referencias inexistentes, posteriores o no seleccionables`,
          );
        }
      }
      assertSatisfiableSingleChoiceConjunctions(parsed.show_if, questions, question.question_ref);
    }
  }
  ensureUniqueReferences(questions);
}

export function assertSurveyDocumentV1(value: unknown): asserts value is SurveyDocumentV1 {
  assertSurveyDocumentVersion(value, SURVEY_DOCUMENT_SCHEMA_VERSION_V1);
}

export function assertSurveyDocumentV2(value: unknown): asserts value is SurveyDocumentV2 {
  assertSurveyDocumentVersion(value, SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
}

export function assertSurveyDocument(value: unknown): asserts value is SurveyDocument {
  if (!isRecord(value)) {
    throw new SurveyDocumentError('invalid_document', 'survey-document debe ser un objeto');
  }
  if (value.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V1) {
    assertSurveyDocumentV1(value);
    return;
  }
  if (value.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2) {
    assertSurveyDocumentV2(value);
    return;
  }
  throw new SurveyDocumentError(
    'invalid_document',
    `schema_version debe ser ${SURVEY_DOCUMENT_SCHEMA_VERSION_V1} o ${SURVEY_DOCUMENT_SCHEMA_VERSION_V2}`,
  );
}

export const isSurveyDocumentV1 = (value: unknown): value is SurveyDocumentV1 => {
  try {
    assertSurveyDocumentV1(value);
    return true;
  } catch {
    return false;
  }
};

export const isSurveyDocumentV2 = (value: unknown): value is SurveyDocumentV2 => {
  try {
    assertSurveyDocumentV2(value);
    return true;
  } catch {
    return false;
  }
};

export const isSurveyDocument = (value: unknown): value is SurveyDocument => {
  try {
    assertSurveyDocument(value);
    return true;
  } catch {
    return false;
  }
};
