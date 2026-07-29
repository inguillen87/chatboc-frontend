import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, ExternalLink, Plus, Rocket, Save } from 'lucide-react';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { OfflineDraftQueue, OfflineDraftQueueSyncError } from '@/services/pwa/OfflineDraftQueue';
import type { SyncedQueuedAction } from '@/services/pwa/OfflineDraftQueue';
import { getErrorMessage } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { parseSurveyConditionalLogic } from '@/utils/surveyConditionalLogic';
import type { SurveyConditionalLogicV2, SurveyConditionalNodeV2 } from '@/types/encuestas';

import SurveyPreview from './SurveyPreview';
import SurveyQuestionEditor from './SurveyQuestionEditor';
import {
  SURVEY_DOCUMENT_SCHEMA_VERSION,
  SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
  isSurveyDocument,
} from './surveyDocument';
import {
  getSurveyDraftV2,
  isPersistedSurveyDraftAck,
  materializeSurveyDraftV2,
  saveSurveyDraftV2,
} from './surveysApi';
import type { SurveyDocument } from './surveyDocument';
import type { SurveyDraftPersistenceAck, SurveyDraftSaveInput, SurveyQuestionDraft } from './surveyTypes';

const QUESTION_TYPES: Array<{ type: SurveyQuestionDraft['type']; label: string }> = [
  { type: 'single', label: 'Opcion unica' },
  { type: 'multi', label: 'Multiple' },
  { type: 'rating', label: 'Rating' },
  { type: 'text', label: 'Texto' },
  { type: 'nps', label: 'NPS (cuarentena)' },
  { type: 'ranking', label: 'Ranking (cuarentena)' },
  { type: 'location', label: 'Ubicacion (cuarentena)' },
];

const createQuestionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `question-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createOption = (label: string) => ({ id: createQuestionId(), label, value: label });

const createQuestion = (type: SurveyQuestionDraft['type'] = 'single'): SurveyQuestionDraft => {
  const selectionQuestion = type === 'single' || type === 'multi' || type === 'rating';
  const options = type === 'rating'
    ? ['1', '2', '3', '4', '5'].map(createOption)
    : selectionQuestion
      ? [createOption('Opcion 1'), createOption('Opcion 2')]
      : undefined;
  return {
    id: createQuestionId(),
    title: '',
    type,
    required: selectionQuestion,
    ...(type === 'multi' ? { min_selections: 1, max_selections: 2 } : {}),
    ...(type === 'single' || type === 'rating' ? { min_selections: 1, max_selections: 1 } : {}),
    ...(options ? { options } : {}),
  };
};

type SaveStatus = 'idle' | 'queued' | 'durable';

interface MaterializedSurveyState {
  surveyId: number;
  receiptId: number;
  draftRevision: number;
  replayed: boolean;
}

interface StoredSurveyBuilderDraft {
  version: 2;
  draft_id: string;
  idempotency_key: string;
  revision?: number;
  title: string;
  description: string;
  questions: SurveyQuestionDraft[];
  document?: SurveyDocument;
  persisted: boolean;
  updated_at: string;
}

interface InitialBuilderState extends StoredSurveyBuilderDraft {
  saveStatus: SaveStatus;
  saveMessage: string;
}

export const SURVEY_BUILDER_DRAFT_STORAGE_PREFIX = 'chatboc:survey-builder:draft:v2';

export const getSurveyBuilderDraftQuarantineKey = (storageKey: string) => `${storageKey}:quarantine`;

export const getSurveyBuilderTenantScope = () => safeLocalStorage.getItem('tenantSlug')?.trim() || '';

export const getSurveyBuilderOperatorScope = () => {
  let operatorScope = safeLocalStorage.getItem('clerkUserId')?.trim() || '';
  if (!operatorScope) {
    try {
      const storedUser: unknown = JSON.parse(safeLocalStorage.getItem('user') || 'null');
      if (storedUser && typeof storedUser === 'object' && !Array.isArray(storedUser)) {
        const user = storedUser as Record<string, unknown>;
        const candidate = user.id ?? user.user_id ?? user.usuario_id ?? user.contact_key;
        if (typeof candidate === 'string' || typeof candidate === 'number') operatorScope = String(candidate);
      }
    } catch {
      // Keep the anonymous browser scope when the session cache is malformed.
    }
  }
  return operatorScope;
};

export const getSurveyBuilderDraftStorageKey = (
  tenantScope = getSurveyBuilderTenantScope(),
  operatorScope = getSurveyBuilderOperatorScope(),
) => {
  return `${SURVEY_BUILDER_DRAFT_STORAGE_PREFIX}:${encodeURIComponent(tenantScope || 'unscoped')}:${encodeURIComponent(operatorScope || 'unscoped-operator')}`;
};

const isCurrentBuilderScope = (tenantScope: string, operatorScope: string, scopeKey: string) =>
  Boolean(tenantScope && operatorScope) &&
  getSurveyBuilderTenantScope() === tenantScope &&
  getSurveyBuilderOperatorScope() === operatorScope &&
  getSurveyBuilderDraftStorageKey(tenantScope, operatorScope) === scopeKey;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const createIdempotencyKey = (draftId: string) => `survey-draft-${draftId}-${createQuestionId()}`;

const isQuestionType = (value: unknown): value is SurveyQuestionDraft['type'] =>
  ['single', 'multi', 'rating', 'text', 'nps', 'ranking', 'location'].includes(String(value));

const normalizeStoredQuestions = (value: unknown): SurveyQuestionDraft[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((question) => {
      const conditionalLogicSource = question.conditional_logic ?? question.conditionalLogic;
      const conditionalLogic = parseSurveyConditionalLogic(conditionalLogicSource);
      if (conditionalLogicSource !== undefined && conditionalLogicSource !== null && !conditionalLogic) {
        throw new Error('El borrador contiene una regla conditional_logic invalida.');
      }
      if (!isQuestionType(question.type)) {
        throw new Error(`El borrador contiene un tipo de pregunta desconocido: ${String(question.type)}.`);
      }
      const minSelections = question.min_selections;
      const maxSelections = question.max_selections;
      const normalizedMinSelections: number | null | undefined =
        typeof minSelections === 'number' ? minSelections : minSelections === null ? null : undefined;
      const normalizedMaxSelections: number | null | undefined =
        typeof maxSelections === 'number' ? maxSelections : maxSelections === null ? null : undefined;
      return {
        ...question,
        id: nonEmptyString(question.id) ?? createQuestionId(),
        title: typeof question.title === 'string' ? question.title : '',
        type: question.type,
        required: typeof question.required === 'boolean' ? question.required : undefined,
        min_selections: normalizedMinSelections,
        max_selections: normalizedMaxSelections,
        options: Array.isArray(question.options)
          ? question.options.filter(isRecord).map((option) => ({
              ...option,
              id: nonEmptyString(option.id),
              label: typeof option.label === 'string' ? option.label : undefined,
              value:
                typeof option.value === 'string' || typeof option.value === 'number'
                  ? option.value
                  : undefined,
            }))
          : undefined,
        ...(conditionalLogic ? { conditional_logic: conditionalLogic } : {}),
      };
    });
};

const isAdaptiveSourceQuestion = (question: SurveyQuestionDraft) =>
  (question.type === 'single' || question.type === 'multi') && Boolean(question.options?.length);

const canonicalBuilderQuestionRef = (question: SurveyQuestionDraft) =>
  nonEmptyString(question.question_ref) ?? nonEmptyString(question.id);

const canonicalBuilderOptionRef = (option: NonNullable<SurveyQuestionDraft['options']>[number]) =>
  nonEmptyString(option.option_ref) ?? nonEmptyString(option.id);

const v2ConditionalLeaves = (node: SurveyConditionalNodeV2): SurveyConditionalNodeV2[] =>
  node.kind === 'option_selected'
    ? [node]
    : node.children.flatMap(v2ConditionalLeaves);

const isV2ConditionalRuleValid = (
  rule: SurveyConditionalLogicV2,
  questions: SurveyQuestionDraft[],
  targetIndex: number,
) => v2ConditionalLeaves(rule.show_if).every((node) => {
  if (node.kind !== 'option_selected') return false;
  const sourceMatches = questions.reduce<number[]>((indexes, candidate, index) => {
    if (canonicalBuilderQuestionRef(candidate) === node.question_ref) indexes.push(index);
    return indexes;
  }, []);
  if (sourceMatches.length !== 1 || sourceMatches[0] >= targetIndex) return false;
  const source = questions[sourceMatches[0]];
  if (!isAdaptiveSourceQuestion(source)) return false;
  return (source.options ?? []).filter((option) => canonicalBuilderOptionRef(option) === node.option_ref).length === 1;
});

export const reconcileSurveyConditionalLogic = (
  previous: SurveyQuestionDraft[],
  next: SurveyQuestionDraft[],
): { questions: SurveyQuestionDraft[]; invalidatedQuestionIds: string[] } => {
  const invalidatedQuestionIds: string[] = [];
  const questions = next.map((question, targetIndex) => {
    const rule = parseSurveyConditionalLogic(question.conditional_logic);
    if (!rule) return question;

    if (rule.version === 2) {
      if (!isV2ConditionalRuleValid(rule, next, targetIndex)) {
        invalidatedQuestionIds.push(question.id);
        return { ...question, conditional_logic: null };
      }
      return { ...question, conditional_logic: rule };
    }

    const previousSource = previous[rule.show_if.question_order - 1];
    const sourceIndex = previousSource
      ? next.findIndex((candidate) => candidate.id === previousSource.id)
      : -1;
    const nextSource = sourceIndex >= 0 ? next[sourceIndex] : undefined;
    const previousOption = previousSource?.options?.[rule.show_if.option_order - 1];
    const nextOptions = nextSource?.options ?? [];
    let nextOptionIndex = -1;
    if (previousOption?.id) {
      nextOptionIndex = nextOptions.findIndex((option) => option.id === previousOption.id);
    } else if (previousOption?.value !== undefined) {
      const matches = nextOptions.reduce<number[]>((indexes, option, index) => {
        if (option.value === previousOption.value) indexes.push(index);
        return indexes;
      }, []);
      if (matches.length === 1) nextOptionIndex = matches[0];
    } else if (previousOption?.label) {
      const matches = nextOptions.reduce<number[]>((indexes, option, index) => {
        if (option.label === previousOption.label) indexes.push(index);
        return indexes;
      }, []);
      if (matches.length === 1) nextOptionIndex = matches[0];
    }
    if (
      !previousSource ||
      !previousOption ||
      !nextSource ||
      sourceIndex >= targetIndex ||
      !isAdaptiveSourceQuestion(nextSource) ||
      nextOptionIndex < 0
    ) {
      invalidatedQuestionIds.push(question.id);
      return { ...question, conditional_logic: null };
    }

    return {
      ...question,
      conditional_logic: {
        version: 1 as const,
        show_if: {
          question_order: sourceIndex + 1,
          option_order: nextOptionIndex + 1,
        },
      },
    };
  });
  return { questions, invalidatedQuestionIds };
};

const createEmptyBuilderState = (): InitialBuilderState => {
  const draftId = createQuestionId();
  return {
    version: 2,
    draft_id: draftId,
    idempotency_key: createIdempotencyKey(draftId),
    title: '',
    description: '',
    questions: [createQuestion()],
    persisted: false,
    updated_at: new Date().toISOString(),
    saveStatus: 'idle',
    saveMessage: '',
  };
};

const readStoredBuilderState = (
  storageKey: string,
  tenantScope: string,
  operatorScope: string,
): InitialBuilderState => {
  if (!tenantScope || !operatorScope) return createEmptyBuilderState();
  let raw: string | null = null;
  try {
    raw = safeLocalStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (isRecord(parsed) && parsed.version === 2) {
      const draftId = nonEmptyString(parsed.draft_id);
      const questions = normalizeStoredQuestions(parsed.questions);
      const revision =
        typeof parsed.revision === 'number' && Number.isInteger(parsed.revision) && parsed.revision >= 0
          ? parsed.revision
          : undefined;
      if (draftId) {
        const document = parsed.document === undefined
          ? undefined
          : isSurveyDocument(parsed.document)
            ? parsed.document
            : (() => {
                throw new Error('El snapshot contiene un survey-document invalido.');
              })();
        const matchingActions = OfflineDraftQueue.getQueue().filter(
          (action) => action.type === 'survey_draft' && isRecord(action.payload) && action.payload.draft_id === draftId,
        );
        const queued = matchingActions.some(
          (action) =>
            Boolean(tenantScope) &&
            action.tenantScope === tenantScope &&
            action.scopeKey === storageKey,
        );
        const quarantinedLegacy = matchingActions.some((action) => !action.scopeKey);
        const pendingLocalAction = queued || quarantinedLegacy;
        const persisted = parsed.persisted === true && !pendingLocalAction;
        return {
          version: 2,
          draft_id: draftId,
          idempotency_key: nonEmptyString(parsed.idempotency_key) ?? createIdempotencyKey(draftId),
          revision,
          title: typeof parsed.title === 'string' ? parsed.title : '',
          description: typeof parsed.description === 'string' ? parsed.description : '',
          questions: questions.length ? questions : [createQuestion()],
          ...(document ? { document } : {}),
          persisted,
          updated_at: nonEmptyString(parsed.updated_at) ?? new Date().toISOString(),
          saveStatus: pendingLocalAction ? 'queued' : persisted ? 'durable' : 'idle',
          saveMessage: quarantinedLegacy
            ? 'Borrador local antiguo recuperado sin tenant. Queda retenido y no se enviara automaticamente.'
            : queued
              ? 'Borrador local recuperado. Sigue pendiente de confirmacion durable.'
            : persisted
              ? 'Borrador durable recuperado.'
              : 'Borrador local recuperado. Todavia no esta persistido en el backend.',
        };
      }
    }
  } catch {
    if (raw) {
      safeLocalStorage.setItem(getSurveyBuilderDraftQuarantineKey(storageKey), raw);
      safeLocalStorage.removeItem(storageKey);
      const emptyState = createEmptyBuilderState();
      emptyState.saveMessage =
        'El borrador local tenia una estructura invalida y fue resguardado sin sincronizar ni sobrescribirlo.';
      return emptyState;
    }
  }

  return createEmptyBuilderState();
};

const comparableDraftContent = (value: unknown) => {
  const record = isRecord(value) ? value : {};
  return JSON.stringify({
    title: typeof record.title === 'string' ? record.title : '',
    description: typeof record.description === 'string' ? record.description : '',
    questions: Array.isArray(record.questions) ? record.questions : [],
  });
};

const sameDraftContent = (left: unknown, right: unknown) =>
  comparableDraftContent(left) === comparableDraftContent(right);

export const getSurveyMaterializationBlockReason = (
  document: SurveyDocument | undefined,
  draftId: string,
  revision: number | undefined,
) => {
  if (!document || revision === undefined || revision <= 0) {
    return 'Primero guarda y confirma una revision durable del borrador.';
  }
  if (document.document_ref !== draftId || document.revision !== revision) {
    return 'La identidad o revision del documento no coincide con el borrador confirmado.';
  }
  if (!document.title.trim()) return 'El titulo es obligatorio para crear la encuesta operativa.';
  if (document.title !== document.title.trim() || document.title.length > 255) {
    return 'El titulo no puede tener espacios exteriores ni superar 255 caracteres.';
  }
  if (document.slug !== undefined && (!document.slug || document.slug !== document.slug.trim() || document.slug.length > 160)) {
    return 'El slug debe ser no vacio, sin espacios exteriores y de hasta 160 caracteres.';
  }
  for (const [field, value] of [
    ['inicio', document.schedule.starts_at],
    ['fin', document.schedule.ends_at],
  ] as const) {
    if (value !== null && (!value || value !== value.trim())) {
      return `La fecha de ${field} debe ser no vacia y no tener espacios exteriores.`;
    }
  }
  if (!document.questions.length) return 'Agrega al menos una pregunta antes de materializar.';

  for (const [index, question] of document.questions.entries()) {
    if (question.type === 'quarantined' || question.quarantine) {
      return `La pregunta ${index + 1} usa un tipo en cuarentena que el backend no puede ejecutar sin perdida.`;
    }
    if (question.persisted_id !== undefined) {
      return `La pregunta ${index + 1} conserva un ID de otra encuesta y no puede copiarse de forma ambigua.`;
    }
    if (!question.prompt.trim()) return `Completa el texto de la pregunta ${index + 1}.`;
    if (question.prompt !== question.prompt.trim()) {
      return `El texto de la pregunta ${index + 1} no puede tener espacios exteriores.`;
    }
    const selectable = question.type !== 'free_text';
    if (selectable && !question.options.length) return `Agrega opciones a la pregunta ${index + 1}.`;
    if (!selectable && question.options.length) return `La pregunta ${index + 1} de texto libre no admite opciones.`;
    for (const [optionIndex, option] of question.options.entries()) {
      if (option.persisted_id !== undefined) {
        return `La opcion ${optionIndex + 1} de la pregunta ${index + 1} conserva un ID ajeno.`;
      }
      if (!option.label.trim()) return `Completa la opcion ${optionIndex + 1} de la pregunta ${index + 1}.`;
      if (option.label !== option.label.trim()) {
        return `La opcion ${optionIndex + 1} de la pregunta ${index + 1} no puede tener espacios exteriores.`;
      }
      if (typeof option.value === 'number') {
        return `La opcion ${optionIndex + 1} de la pregunta ${index + 1} usa un valor numerico no materializable sin coercion.`;
      }
      if (typeof option.value === 'string' && option.value.length > 120) {
        return `El valor de la opcion ${optionIndex + 1} de la pregunta ${index + 1} supera 120 caracteres.`;
      }
    }
    if (
      question.type === 'multiple_choice'
      && question.selection.max !== null
      && question.selection.max > question.options.length
    ) {
      return `El maximo de selecciones de la pregunta ${index + 1} supera sus opciones.`;
    }
  }
  return null;
};

export default function SurveyBuilderPage() {
  const { isOnline } = useNetworkStatus();
  const tenantScope = useMemo(() => getSurveyBuilderTenantScope(), []);
  const operatorScope = useMemo(() => getSurveyBuilderOperatorScope(), []);
  const storageKey = useMemo(
    () => getSurveyBuilderDraftStorageKey(tenantScope, operatorScope),
    [operatorScope, tenantScope],
  );
  const [initialState] = useState(() => readStoredBuilderState(storageKey, tenantScope, operatorScope));
  const [draftId, setDraftId] = useState(initialState.draft_id);
  const [idempotencyKey, setIdempotencyKey] = useState(initialState.idempotency_key);
  const [revision, setRevision] = useState<number | undefined>(initialState.revision);
  const [title, setTitle] = useState(initialState.title);
  const [description, setDescription] = useState(initialState.description);
  const [questions, setQuestions] = useState<SurveyQuestionDraft[]>(initialState.questions);
  const [document, setDocument] = useState<SurveyDocument | undefined>(initialState.document);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialState.saveStatus);
  const [saveMessage, setSaveMessage] = useState(initialState.saveMessage);
  const [saveError, setSaveError] = useState('');
  const [isMaterializing, setIsMaterializing] = useState(false);
  const [materializationError, setMaterializationError] = useState('');
  const [materializedSurvey, setMaterializedSurvey] = useState<MaterializedSurveyState | null>(null);

  const draftSchemaVersion = useMemo(
    () => document?.schema_version === SURVEY_DOCUMENT_SCHEMA_VERSION_V2
      || questions.some((question) => parseSurveyConditionalLogic(question.conditional_logic)?.version === 2)
      ? SURVEY_DOCUMENT_SCHEMA_VERSION_V2
      : SURVEY_DOCUMENT_SCHEMA_VERSION,
    [document?.schema_version, questions],
  );

  const payload = useMemo<SurveyDraftSaveInput>(
    () => ({
      draft_id: draftId,
      idempotency_key: idempotencyKey,
      ...(revision !== undefined ? { revision } : {}),
      schema_version: draftSchemaVersion,
      ...(document ? { document } : {}),
      title: title.trim(),
      description: description.trim(),
      questions,
    }),
    [description, document, draftId, draftSchemaVersion, idempotencyKey, questions, revision, title],
  );

  const currentPayloadRef = useRef(payload);
  const draftIdRef = useRef(draftId);
  const saveStatusRef = useRef(saveStatus);
  currentPayloadRef.current = payload;
  draftIdRef.current = draftId;
  saveStatusRef.current = saveStatus;

  useEffect(() => {
    const snapshot: StoredSurveyBuilderDraft = {
      version: 2,
      draft_id: draftId,
      idempotency_key: idempotencyKey,
      ...(revision !== undefined ? { revision } : {}),
      title,
      description,
      questions,
      ...(document ? { document } : {}),
      persisted: saveStatus === 'durable',
      updated_at: new Date().toISOString(),
    };
    safeLocalStorage.setItem(storageKey, JSON.stringify(snapshot));
  }, [description, document, draftId, idempotencyKey, questions, revision, saveStatus, storageKey, title]);

  const applyDurableAck = useCallback((ack: SurveyDraftPersistenceAck, submittedPayload: unknown) => {
    if (!isPersistedSurveyDraftAck(ack)) return false;

    const confirmedDraftId = ack.draft_id;
    const currentRevision = currentPayloadRef.current.revision;
    if (
      confirmedDraftId === draftIdRef.current
      && currentRevision !== undefined
      && ack.revision < currentRevision
    ) {
      setSaveError('El backend devolvio una revision anterior; se conservo el borrador local mas reciente.');
      return false;
    }
    const currentMatchesAckedContent = sameDraftContent(currentPayloadRef.current, submittedPayload);
    setDraftId(confirmedDraftId);
    setRevision(ack.revision);
    setIdempotencyKey(createIdempotencyKey(confirmedDraftId));
    setSaveError('');
    if (ack.document) {
      setDocument(ack.document);
    }

    if (!currentMatchesAckedContent) {
      setSaveStatus('idle');
      setSaveMessage(`Revision ${ack.revision} persistida; hay cambios locales posteriores pendientes.`);
      return true;
    }

    if (ack.draft) {
      const rawAck = isRecord(ack.raw) && isRecord(ack.raw.draft) ? ack.raw.draft : null;
      if (!rawAck || typeof rawAck.title === 'string') setTitle(ack.draft.title);
      if (!rawAck || Object.prototype.hasOwnProperty.call(rawAck, 'description')) {
        setDescription(ack.draft.description ?? '');
      }
      if (!rawAck || Array.isArray(rawAck.questions)) setQuestions(ack.draft.questions);
    }
    setSaveStatus('durable');
    setSaveMessage(`Borrador guardado de forma durable (revision ${ack.revision}).`);
    return true;
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    if (!isCurrentBuilderScope(tenantScope, operatorScope, storageKey)) {
      setSaveError('El contexto de tenant u operador cambio o no esta disponible. El borrador local no se sincronizo.');
      return;
    }
    let active = true;
    const syncSurveyDraftRequest = (_path: string, options: { method: 'POST'; body: unknown }) =>
      saveSurveyDraftV2(options.body as SurveyDraftSaveInput, tenantScope);
    const applyMatchingResult = (results: readonly SyncedQueuedAction[]) => {
      const matchingResult = [...results]
        .reverse()
        .find(
          ({ action }) =>
            action.type === 'survey_draft' &&
            action.tenantScope === tenantScope &&
            action.scopeKey === storageKey &&
            isRecord(action.payload) &&
            action.payload.draft_id === draftIdRef.current,
        );
      if (!matchingResult) return false;
      return applyDurableAck(
        matchingResult.response as SurveyDraftPersistenceAck,
        matchingResult.action.payload,
      );
    };

    void OfflineDraftQueue.syncQueue(syncSurveyDraftRequest, {
      types: ['survey_draft'],
      tenantScope,
      scopeKey: storageKey,
    })
      .then((results) => {
        if (!active) return;
        applyMatchingResult(results);
      })
      .catch((error) => {
        if (!active || !(error instanceof OfflineDraftQueueSyncError)) return;
        const activeDraftWasConfirmed = applyMatchingResult(error.synced);
        const failedPayload = error.action.payload;
        if (
          !activeDraftWasConfirmed &&
          error.action.tenantScope === tenantScope &&
          error.action.scopeKey === storageKey &&
          isRecord(failedPayload) &&
          failedPayload.draft_id === draftIdRef.current
        ) {
          setSaveStatus('queued');
          setSaveMessage('El borrador sigue en la cola local y se reintentara; el backend aun no confirmo persistencia.');
          setSaveError(error.message);
        }
      });

    return () => {
      active = false;
    };
  }, [applyDurableAck, isOnline, operatorScope, storageKey, tenantScope]);

  useEffect(() => {
    if (!isOnline || saveStatusRef.current !== 'durable') return;
    if (!isCurrentBuilderScope(tenantScope, operatorScope, storageKey)) return;
    const restoredDraftId = draftIdRef.current;
    let active = true;

    void getSurveyDraftV2(restoredDraftId, tenantScope)
      .then((ack) => {
        if (!active || draftIdRef.current !== restoredDraftId || saveStatusRef.current !== 'durable') return;
        if (!isPersistedSurveyDraftAck(ack)) {
          setSaveStatus('idle');
          setSaveMessage('');
          setSaveError('El backend no pudo reconfirmar la persistencia durable del borrador recuperado.');
          return;
        }
        applyDurableAck(ack, currentPayloadRef.current);
      })
      .catch((error) => {
        if (!active) return;
        setSaveError(getErrorMessage(error, 'No se pudo actualizar el borrador durable recuperado.'));
      });

    return () => {
      active = false;
    };
  }, [applyDurableAck, isOnline, operatorScope, storageKey, tenantScope]);

  const completedQuestions = questions.filter((question) => question.title.trim()).length;
  const adaptiveQuestions = questions.filter((question) => Boolean(question.conditional_logic)).length;
  const documentMaterializationIssue = useMemo(
    () => getSurveyMaterializationBlockReason(document, draftId, revision),
    [document, draftId, revision],
  );
  const materializationBlockReason = !isOnline
    ? 'La materializacion requiere conexion para confirmar el recibo atomico.'
    : saveStatus !== 'durable'
      ? 'Primero guarda los cambios y espera la confirmacion durable.'
      : documentMaterializationIssue;
  const materializedSurveyIsCurrent = Boolean(
    materializedSurvey
    && saveStatus === 'durable'
    && materializedSurvey.draftRevision === revision
    && !documentMaterializationIssue,
  );

  const markDirty = () => {
    setSaveStatus('idle');
    setSaveMessage('');
    setSaveError('');
    setMaterializationError('');
  };

  const addQuestion = (type: SurveyQuestionDraft['type']) => {
    markDirty();
    setQuestions((prev) => [...prev, createQuestion(type)]);
  };

  const removeQuestion = (questionId: string) => {
    markDirty();
    const next = questions.filter((question) => question.id !== questionId);
    const reconciled = reconcileSurveyConditionalLogic(questions, next.length ? next : [createQuestion()]);
    if (reconciled.invalidatedQuestionIds.length) {
      setSaveMessage('Se desactivaron rutas adaptativas cuya pregunta fuente dejo de ser valida.');
    }
    setQuestions(reconciled.questions);
  };

  const updateQuestion = (questionId: string, nextQuestion: SurveyQuestionDraft) => {
    markDirty();
    const next = questions.map((question) => (question.id === questionId ? nextQuestion : question));
    const reconciled = reconcileSurveyConditionalLogic(questions, next);
    if (reconciled.invalidatedQuestionIds.length) {
      setSaveMessage('Se desactivaron rutas adaptativas porque la pregunta fuente ya no admite opciones.');
    }
    setQuestions(reconciled.questions);
  };

  const handleSave = async () => {
    setSaveMessage('');
    setSaveError('');

    if (!isCurrentBuilderScope(tenantScope, operatorScope, storageKey)) {
      setSaveStatus('idle');
      setSaveError('No se guardo el borrador porque el contexto de tenant u operador cambio o no esta disponible.');
      return;
    }

    if (!isOnline) {
      const action = OfflineDraftQueue.addAction('survey_draft', payload, {
        tenantScope,
        scopeKey: storageKey,
      });
      if (isRecord(action.payload)) {
        const queuedDraftId = nonEmptyString(action.payload.draft_id) ?? draftId;
        setDraftId(queuedDraftId);
        setIdempotencyKey(createIdempotencyKey(queuedDraftId));
      }
      setSaveStatus('queued');
      setSaveMessage('Borrador encolado localmente. Todavia no fue persistido por el backend.');
      return;
    }

    setIsSaving(true);
    try {
      const submittedPayload = currentPayloadRef.current;
      const ack = await saveSurveyDraftV2(submittedPayload, tenantScope);
      if (!applyDurableAck(ack, submittedPayload)) {
        throw new Error('El backend respondio sin confirmar persistencia durable del borrador.');
      }
    } catch (error) {
      setSaveStatus('idle');
      setSaveMessage('');
      setSaveError(getErrorMessage(error, 'No se pudo guardar el draft.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaterialize = async () => {
    setMaterializationError('');
    if (materializationBlockReason || revision === undefined || !document) {
      setMaterializationError(materializationBlockReason || 'La revision durable no esta disponible.');
      return;
    }
    if (!isCurrentBuilderScope(tenantScope, operatorScope, storageKey)) {
      setMaterializationError('El tenant u operador cambio. Recarga el borrador antes de crear la encuesta.');
      return;
    }

    const requestedDraftId = draftId;
    const requestedRevision = revision;
    setIsMaterializing(true);
    try {
      const ack = await materializeSurveyDraftV2(
        requestedDraftId,
        { expectedRevision: requestedRevision, schemaVersion: document.schema_version },
        tenantScope,
      );
      if (
        ack.draft.draft_id !== requestedDraftId
        || ack.draft.document_ref !== requestedDraftId
        || ack.draft.revision !== requestedRevision
        || ack.draft.schema_version !== document.schema_version
      ) {
        throw new Error('El recibo no coincide con la revision solicitada.');
      }
      setMaterializedSurvey({
        surveyId: ack.survey_id,
        receiptId: ack.receipt_id,
        draftRevision: requestedRevision,
        replayed: ack.replayed,
      });
    } catch (error) {
      setMaterializationError(getErrorMessage(error, 'No se pudo crear la encuesta operativa.'));
    } finally {
      setIsMaterializing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Surveys v2</p>
          <h1 className="text-2xl font-semibold tracking-tight">Constructor de encuestas</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Borrador mobile-first con revision durable, recuperacion local y sincronizacion confirmada por backend.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isOnline ? 'secondary' : 'destructive'}>
            {isOnline ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <CloudOff className="mr-1 h-3.5 w-3.5" />}
            {isOnline ? 'Online' : 'Offline queue'}
          </Badge>
          <Badge variant="outline">{questions.length} preguntas</Badge>
          <Badge variant="outline">{completedQuestions} completas</Badge>
          {adaptiveQuestions ? <Badge variant="outline">{adaptiveQuestions} rutas adaptativas</Badge> : null}
          {revision !== undefined ? <Badge variant="outline">Revision {revision}</Badge> : null}
        </div>
      </header>

      {!isOnline ? (
        <ViewState
          status="offline"
          description="Podes seguir armando el borrador. Al guardar quedara en cola local hasta que el backend confirme persistencia."
          className="min-h-[120px]"
        />
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos del draft</CardTitle>
              <CardDescription>Informacion editable antes de publicar o entregar al backend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="survey-draft-title">Titulo</Label>
                <Input
                  id="survey-draft-title"
                  value={title}
                  placeholder="Nombre interno de la encuesta"
                  onChange={(e) => {
                    markDirty();
                    setTitle(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-draft-description">Descripcion</Label>
                <Textarea
                  id="survey-draft-description"
                  className="min-h-28"
                  value={description}
                  placeholder="Contexto visible para operadores o plantilla backend"
                  onChange={(e) => {
                    markDirty();
                    setDescription(e.target.value);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div className="space-y-1.5">
                <CardTitle className="text-lg">Preguntas</CardTitle>
                <CardDescription>
                  Los tipos experimentales se conservan, pero quedan en cuarentena hasta tener ejecucion backend.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUESTION_TYPES.map((item) => (
                  <Button key={item.type} size="sm" type="button" variant="outline" onClick={() => addQuestion(item.type)}>
                    <Plus className="h-4 w-4" />
                    {item.label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => (
                <SurveyQuestionEditor
                  key={question.id}
                  canRemove={questions.length > 1}
                  index={index}
                  question={question}
                  onChange={(next) => updateQuestion(question.id, next)}
                  onRemove={() => removeQuestion(question.id)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>Validacion rapida de estructura antes de guardar.</CardDescription>
            </CardHeader>
            <CardContent>
              <SurveyPreview questions={questions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guardado</CardTitle>
              <CardDescription>Solo se considera durable cuando el endpoint v2 devuelve persisted=true.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" type="button" disabled={isSaving || isMaterializing} onClick={() => void handleSave()}>
                <Save className="h-4 w-4" />
                {isSaving ? 'Guardando...' : 'Guardar draft'}
              </Button>

              <Button
                className="w-full"
                type="button"
                variant="secondary"
                disabled={Boolean(materializationBlockReason) || isSaving || isMaterializing}
                onClick={() => void handleMaterialize()}
              >
                <Rocket className="h-4 w-4" />
                {isMaterializing ? 'Creando encuesta...' : 'Crear encuesta operativa'}
              </Button>
              {materializationBlockReason ? (
                <p className="text-xs text-muted-foreground">{materializationBlockReason}</p>
              ) : null}

              <Separator />

              {saveMessage && saveStatus === 'durable' ? (
                <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              ) : null}
              {saveMessage && saveStatus === 'queued' ? (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              ) : null}
              {saveMessage && saveStatus === 'idle' ? (
                <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              ) : null}
              {saveError ? (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              ) : null}
              {materializationError ? (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{materializationError}</span>
                </div>
              ) : null}
              {materializedSurvey ? (
                <div
                  className={`space-y-3 rounded-lg border p-3 text-sm ${
                    materializedSurveyIsCurrent
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                  role="status"
                >
                  <div className="flex gap-2">
                    {materializedSurveyIsCurrent
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <span>
                      {materializedSurveyIsCurrent ? (
                        <>
                          {materializedSurvey.replayed ? 'Encuesta ya confirmada' : 'Encuesta creada'} desde la revision{' '}
                          {materializedSurvey.draftRevision}. Recibo #{materializedSurvey.receiptId}.
                        </>
                      ) : (
                        <>
                          La encuesta fue creada desde la revision {materializedSurvey.draftRevision}, pero hay cambios locales o
                          una revision durable posterior que no estan incluidos. Recibo #{materializedSurvey.receiptId}.
                        </>
                      )}
                    </span>
                  </div>
                  <Button asChild className="w-full" size="sm" variant="outline">
                    <a href={`/admin/encuestas/${materializedSurvey.surveyId}`}>
                      <ExternalLink className="h-4 w-4" />
                      Abrir encuesta #{materializedSurvey.surveyId}
                    </a>
                  </Button>
                </div>
              ) : null}
              {!saveMessage && !saveError ? (
                <p className="text-sm text-muted-foreground">
                  Sin confirmacion durable. Guarda el borrador para persistir esta revision.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
