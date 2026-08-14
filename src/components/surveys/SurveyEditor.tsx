import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Reorder } from 'framer-motion';
import { CalendarDays, Copy, GripVertical, MessageCircle, Plus, Trash2, UploadCloud } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { SurveyPreviewTester } from '@/components/surveys/SurveyPreviewTester';
import { SurveyLogicMap } from '@/components/surveys/SurveyLogicMap';
import type {
  PreguntaTipo,
  SurveyAdmin,
  SurveyConditionalLogic,
  SurveyConditionalLogicV1,
  SurveyConditionalLogicV2,
  SurveyConditionalNodeV2,
  SurveyConditionalOptionSelectedV2,
  SurveyDraftPayload,
  SurveyOptionId,
  SurveyTipo,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import {
  getPublicSurveyQrUrlFromRecord,
  getPublicSurveyUrlFromRecord,
  getPublicSurveyWhatsAppShareUrl,
} from '@/utils/publicSurveyUrl';
import { parseSurveyConditionalLogic } from '@/utils/surveyConditionalLogic';

interface SurveyEditorProps {
  survey?: SurveyAdmin;
  tenantSlug?: string | null;
  initialDraft?: SurveyDraftPayload;
  onSave: (payload: SurveyDraftPayload) => Promise<void>;
  onPublish?: () => Promise<void>;
  isSaving?: boolean;
  isPublishing?: boolean;
  structureLocked?: boolean;
}

interface LocalOption {
  localId: string;
  id?: SurveyOptionId;
  option_ref?: string | null;
  orden: number;
  texto: string;
  valor?: string;
}

interface LocalConditionalRule {
  sourceLocalId: string;
  sourceOptionLocalId: string;
}

interface LocalQuestion {
  localId: string;
  id?: number;
  question_ref?: string | null;
  logicalRefConflict?: boolean;
  orden: number;
  tipo: PreguntaTipo;
  texto: string;
  obligatoria: boolean;
  min_selecciones?: number | null;
  max_selecciones?: number | null;
  opciones?: LocalOption[];
  conditionalRule?: LocalConditionalRule;
  conditionalLogicV2?: SurveyConditionalLogicV2;
  conditionalLogicInvalid?: boolean;
}

type DemographicQuestionRole = 'general' | 'city' | 'province';

const DEMOGRAPHIC_QUESTION_REFS = {
  city: 'demographic:city',
  province: 'demographic:province',
} as const satisfies Record<Exclude<DemographicQuestionRole, 'general'>, string>;

const demographicRoleOptions: Array<{
  value: DemographicQuestionRole;
  label: string;
  description: string;
}> = [
  {
    value: 'general',
    label: 'Pregunta general',
    description: 'La respuesta se guarda solo dentro de la encuesta.',
  },
  {
    value: 'city',
    label: 'Ciudad o localidad',
    description: 'Habilita filtros, comparaciones y mapas agregados por ciudad.',
  },
  {
    value: 'province',
    label: 'Provincia',
    description: 'Habilita filtros y comparaciones agregadas por provincia.',
  },
];

const resolveQuestionRef = (question: {
  question_ref?: string | null;
  logical_ref?: string | null;
}) => {
  if (question.question_ref !== undefined && question.question_ref !== null && question.question_ref !== '') {
    return question.question_ref;
  }
  if (question.logical_ref !== undefined && question.logical_ref !== null && question.logical_ref !== '') {
    return question.logical_ref;
  }
  return question.question_ref ?? question.logical_ref ?? null;
};

const getDemographicQuestionRole = (
  questionRef?: string | null,
): DemographicQuestionRole => {
  if (questionRef === DEMOGRAPHIC_QUESTION_REFS.city) return 'city';
  if (questionRef === DEMOGRAPHIC_QUESTION_REFS.province) return 'province';
  return 'general';
};

const normalizeDemographicOptionValue = (value?: string) =>
  value?.trim().replace(/\s+/g, ' ') ?? '';

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createLocalOption = (index: number, partial?: Partial<LocalOption>): LocalOption => {
  const localId = generateId();
  return {
    localId,
    option_ref: `option:${localId}`,
    orden: index,
    texto: '',
    ...partial,
  };
};

const createLocalQuestion = (index: number, partial?: Partial<LocalQuestion>): LocalQuestion => {
  const localId = generateId();
  return {
    localId,
    question_ref: `question:${localId}`,
    orden: index,
    tipo: 'opcion_unica',
    texto: 'Nueva pregunta',
    obligatoria: true,
    opciones: [createLocalOption(1), createLocalOption(2)],
    ...partial,
  };
};

const mapQuestionsToLocal = (
  preguntas?: SurveyDraftPayload['preguntas'] | SurveyAdmin['preguntas'],
): LocalQuestion[] => {
  const sourceQuestions = preguntas ?? [];
  const localQuestions = sourceQuestions.map((pregunta) => {
    const questionRef = resolveQuestionRef(pregunta);
    const logicalRefConflict = Boolean(
      pregunta.question_ref !== undefined
      && pregunta.question_ref !== null
      && pregunta.question_ref !== ''
      && pregunta.logical_ref !== undefined
      && pregunta.logical_ref !== null
      && pregunta.logical_ref !== ''
      && pregunta.question_ref !== pregunta.logical_ref,
    );

    return {
      localId: generateId(),
      id: 'id' in pregunta ? pregunta.id : undefined,
      question_ref: questionRef,
      logicalRefConflict,
      orden: pregunta.orden,
      tipo: pregunta.tipo,
      texto: pregunta.texto,
      obligatoria: pregunta.obligatoria,
      min_selecciones: pregunta.min_selecciones ?? null,
      max_selecciones: pregunta.max_selecciones ?? null,
      opciones: pregunta.opciones?.map((opcion) => ({
        localId: generateId(),
        id: 'id' in opcion ? opcion.id : undefined,
        option_ref: opcion.option_ref,
        orden: opcion.orden,
        texto: opcion.texto,
        valor: opcion.valor,
      })),
    };
  });

  return localQuestions.map((question, questionIndex) => {
    const rawLogic = sourceQuestions[questionIndex]?.conditional_logic;
    const logic = parseSurveyConditionalLogic(rawLogic);
    if (!logic) {
      return rawLogic === undefined || rawLogic === null
        ? question
        : { ...question, conditionalLogicInvalid: true };
    }
    if (logic.version === 2) {
      return {
        ...question,
        conditionalLogicV2: logic,
        conditionalLogicInvalid: !isLocalV2ConditionalRuleValid(logic, localQuestions, questionIndex),
      };
    }

    const sourceIndexes = sourceQuestions.reduce<number[]>((matches, sourceQuestion, sourceIndex) => {
      if (sourceQuestion.orden === logic.show_if.question_order) matches.push(sourceIndex);
      return matches;
    }, []);
    if (sourceIndexes.length !== 1 || sourceIndexes[0] >= questionIndex) {
      return { ...question, conditionalLogicInvalid: true };
    }

    const sourceIndex = sourceIndexes[0];
    if (!['opcion_unica', 'multiple'].includes(sourceQuestions[sourceIndex].tipo)) {
      return { ...question, conditionalLogicInvalid: true };
    }
    const sourceOptionIndexes = (sourceQuestions[sourceIndex].opciones ?? []).reduce<number[]>(
      (matches, sourceOption, optionIndex) => {
        if (sourceOption.orden === logic.show_if.option_order) matches.push(optionIndex);
        return matches;
      },
      [],
    );
    if (sourceOptionIndexes.length !== 1) return { ...question, conditionalLogicInvalid: true };

    const sourceQuestion = localQuestions[sourceIndex];
    const sourceOption = sourceQuestion.opciones?.[sourceOptionIndexes[0]];
    if (!sourceOption) return { ...question, conditionalLogicInvalid: true };

    return {
      ...question,
      conditionalRule: {
        sourceLocalId: sourceQuestion.localId,
        sourceOptionLocalId: sourceOption.localId,
      },
    };
  });
};

const cloneConditionalLogic = (
  value: SurveyConditionalLogic | null | undefined,
): SurveyConditionalLogic | null | undefined => {
  if (value === undefined || value === null) return value;
  const parsed = parseSurveyConditionalLogic(value);
  if (!parsed) throw new Error('La encuesta contiene conditional_logic invalida.');
  return parsed;
};

const cloneDraft = (draft: SurveyDraftPayload): SurveyDraftPayload => ({
  ...draft,
  preguntas: draft.preguntas.map((pregunta) => ({
    ...pregunta,
    conditional_logic: cloneConditionalLogic(pregunta.conditional_logic),
    opciones: pregunta.opciones?.map((opcion) => ({ ...opcion })),
  })),
});

const buildDraftFromSurvey = (survey?: SurveyAdmin): SurveyDraftPayload => ({
  document_ref: survey?.document_ref,
  titulo: survey?.titulo ?? '',
  slug: survey?.slug ?? '',
  descripcion: survey?.descripcion ?? '',
  tipo: survey?.tipo ?? 'opinion',
  inicio_at: survey?.inicio_at ?? null,
  fin_at: survey?.fin_at ?? null,
  politica_unicidad: survey?.politica_unicidad ?? 'libre',
  anonimato: survey?.anonimato ?? false,
  requiere_datos_contacto:
    typeof survey?.requiere_datos_contacto === 'boolean'
      ? survey.requiere_datos_contacto
      : !(survey?.anonimato ?? false),
  es_votacion_envivo: survey?.es_votacion_envivo ?? false,
  mostrar_resultados_envivo: survey?.mostrar_resultados_envivo ?? false,
  permitir_comentarios: survey?.permitir_comentarios ?? false,
  puntos_recompensa: survey?.puntos_recompensa ?? undefined,
  preguntas:
    survey?.preguntas?.map((pregunta, index) => ({
      id: pregunta.id,
      question_ref: resolveQuestionRef(pregunta),
      logical_ref: resolveQuestionRef(pregunta),
      orden: typeof pregunta.orden === 'number' ? pregunta.orden : index + 1,
      tipo: pregunta.tipo,
      texto: pregunta.texto,
      obligatoria: pregunta.obligatoria,
      min_selecciones: pregunta.min_selecciones ?? null,
      max_selecciones: pregunta.max_selecciones ?? null,
      conditional_logic: cloneConditionalLogic(pregunta.conditional_logic),
      opciones: pregunta.opciones?.map((opcion, optIndex) => ({
        id: opcion.id,
        option_ref: opcion.option_ref,
        orden: typeof opcion.orden === 'number' ? opcion.orden : optIndex + 1,
        texto: opcion.texto,
        valor: opcion.valor,
      })),
    })) ?? [],
});

const tipoOptions: Array<{ value: SurveyTipo; label: string }> = [
  { value: 'opinion', label: 'Encuesta Clásica (Opinión)' },
  { value: 'votacion', label: 'Votación Pública (Elección única)' },
  { value: 'sondeo', label: 'Sondeo Rápido' },
  { value: 'planificacion', label: 'Planificación' },
];

const preguntaTipoOptions: Array<{ value: PreguntaTipo; label: string }> = [
  { value: 'opcion_unica', label: 'Opción única' },
  { value: 'multiple', label: 'Selección múltiple' },
  { value: 'abierta', label: 'Respuesta abierta' },
  { value: 'rating_emoji', label: 'Rating con emojis' },
];

const unicidadOptions = [
  { value: 'libre', label: 'Sin restricciones' },
  { value: 'por_cookie', label: 'Una respuesta por navegador' },
  { value: 'por_ip', label: 'Una respuesta por IP' },
  { value: 'por_phone', label: 'Validar por teléfono' },
  { value: 'por_dni', label: 'Validar por documento' },
];

const fallbackDraft: SurveyDraftPayload = {
  titulo: '',
  slug: '',
  descripcion: '',
  tipo: 'opinion',
  inicio_at: null,
  fin_at: null,
  politica_unicidad: 'libre',
  anonimato: false,
  requiere_datos_contacto: false,
  es_votacion_envivo: false,
  mostrar_resultados_envivo: false,
  permitir_comentarios: false,
  puntos_recompensa: undefined,
  preguntas: [],
};

const buildInitialDraft = (survey?: SurveyAdmin, initialDraft?: SurveyDraftPayload) => {
  if (survey) {
    return buildDraftFromSurvey(survey);
  }
  if (initialDraft) {
    return cloneDraft(initialDraft);
  }
  return { ...fallbackDraft };
};

const buildInitialQuestions = (survey?: SurveyAdmin, initialDraft?: SurveyDraftPayload) => {
  if (survey) {
    const mapped = mapQuestionsToLocal(survey.preguntas);
    return mapped.length ? mapped : [createLocalQuestion(1)];
  }
  if (initialDraft) {
    const mapped = mapQuestionsToLocal(initialDraft.preguntas);
    return mapped.length ? mapped : [createLocalQuestion(1)];
  }
  return [createLocalQuestion(1)];
};

const isCompatibleConditionalSource = (question: LocalQuestion) =>
  (question.tipo === 'opcion_unica' || question.tipo === 'multiple') && Boolean(question.opciones?.length);

const v2ConditionalLeaves = (node: SurveyConditionalNodeV2): SurveyConditionalOptionSelectedV2[] =>
  node.kind === 'option_selected' ? [node] : node.children.flatMap(v2ConditionalLeaves);

const v2MandatoryConditionalLeaves = (node: SurveyConditionalNodeV2): SurveyConditionalOptionSelectedV2[] => {
  if (node.kind === 'option_selected') return [node];
  return node.operator === 'and' ? node.children.flatMap(v2MandatoryConditionalLeaves) : [];
};

const ensureStableLocalRefs = (questions: LocalQuestion[]): LocalQuestion[] =>
  questions.map((question) => ({
    ...question,
    question_ref: question.question_ref || `question:${question.localId}`,
    opciones: question.opciones?.map((option) => ({
      ...option,
      option_ref: option.option_ref || `option:${option.localId}`,
    })),
  }));

const replaceV2ConditionalLeaf = (
  node: SurveyConditionalNodeV2,
  currentQuestionRef: string,
  currentOptionRef: string,
  replacement: Extract<SurveyConditionalNodeV2, { kind: 'option_selected' }>,
): SurveyConditionalNodeV2 => {
  if (node.kind === 'option_selected') {
    return node.question_ref === currentQuestionRef && node.option_ref === currentOptionRef
      ? replacement
      : node;
  }
  return {
    ...node,
    children: node.children.map((child) => replaceV2ConditionalLeaf(
      child,
      currentQuestionRef,
      currentOptionRef,
      replacement,
    )),
  };
};

const replaceQuestionRefInConditionalNode = (
  node: SurveyConditionalNodeV2,
  currentQuestionRef: string,
  nextQuestionRef: string,
): SurveyConditionalNodeV2 => {
  if (node.kind === 'option_selected') {
    return node.question_ref === currentQuestionRef
      ? { ...node, question_ref: nextQuestionRef }
      : node;
  }
  return {
    ...node,
    children: node.children.map((child) => replaceQuestionRefInConditionalNode(
      child,
      currentQuestionRef,
      nextQuestionRef,
    )),
  };
};

const getDemographicContractError = (questions: LocalQuestion[]): string | null => {
  const usedRefs = new Set<string>();

  for (const [questionIndex, question] of questions.entries()) {
    if (question.logicalRefConflict) {
      return `La pregunta ${questionIndex + 1} tiene referencias internas incompatibles.`;
    }

    const questionRef = question.question_ref ?? null;
    const role = getDemographicQuestionRole(questionRef);
    if (role === 'general' || !questionRef) continue;

    if (usedRefs.has(questionRef)) {
      const roleLabel = role === 'city' ? 'Ciudad o localidad' : 'Provincia';
      return `El uso “${roleLabel}” solo puede asignarse a una pregunta.`;
    }
    usedRefs.add(questionRef);

    if (question.tipo !== 'opcion_unica') {
      return `La pregunta ${questionIndex + 1} debe ser de opción única para segmentar por ubicación.`;
    }

    const options = question.opciones ?? [];
    if (options.some((option) => /[\u0000-\u001F\u007F]/.test(option.valor ?? ''))) {
      return `Los valores para informes de la pregunta ${questionIndex + 1} contienen caracteres no permitidos.`;
    }
    const normalizedValues = options.map((option) => normalizeDemographicOptionValue(option.valor));
    if (!options.length || normalizedValues.some((value) => !value)) {
      return `Completá el valor para informes de todas las opciones de la pregunta ${questionIndex + 1}.`;
    }
    if (normalizedValues.some((value) => value.length > 120)) {
      return `Los valores para informes de la pregunta ${questionIndex + 1} pueden tener hasta 120 caracteres.`;
    }
    const uniqueValues = new Set(normalizedValues.map((value) => value.toLocaleLowerCase('es-AR')));
    if (uniqueValues.size !== normalizedValues.length) {
      return `Los valores para informes de la pregunta ${questionIndex + 1} no pueden repetirse.`;
    }
  }

  return null;
};

const isLocalV2ConditionalRuleValid = (
  rule: SurveyConditionalLogicV2,
  questions: LocalQuestion[],
  targetIndex: number,
) => {
  const parsed = parseSurveyConditionalLogic(rule);
  if (!parsed || parsed.version !== 2) return false;
  const referencesAreValid = v2ConditionalLeaves(parsed.show_if).every((node) => {
  const sourceIndexes = questions.reduce<number[]>((indexes, candidate, index) => {
    if (candidate.question_ref === node.question_ref) indexes.push(index);
    return indexes;
  }, []);
  if (sourceIndexes.length !== 1 || sourceIndexes[0] >= targetIndex) return false;
  const source = questions[sourceIndexes[0]];
  return isCompatibleConditionalSource(source)
    && (source.opciones ?? []).filter((option) => option.option_ref === node.option_ref).length === 1;
  });
  if (!referencesAreValid) return false;

  const mandatorySingleChoiceOptions = new Map<string, string>();
  for (const leaf of v2MandatoryConditionalLeaves(parsed.show_if)) {
    const source = questions.find((question) => question.question_ref === leaf.question_ref);
    if (source?.tipo !== 'opcion_unica') continue;
    const previousOptionRef = mandatorySingleChoiceOptions.get(leaf.question_ref);
    if (previousOptionRef !== undefined && previousOptionRef !== leaf.option_ref) return false;
    mandatorySingleChoiceOptions.set(leaf.question_ref, leaf.option_ref);
  }
  return true;
};

const sanitizeLocalConditionalRules = (questions: LocalQuestion[]): LocalQuestion[] =>
  questions.map((question, questionIndex) => {
    if (question.conditionalLogicV2) {
      return {
        ...question,
        conditionalLogicInvalid: !isLocalV2ConditionalRuleValid(
          question.conditionalLogicV2,
          questions,
          questionIndex,
        ),
      };
    }
    const rule = question.conditionalRule;
    if (!rule) return question;

    const sourceIndex = questions.findIndex((candidate) => candidate.localId === rule.sourceLocalId);
    const sourceQuestion = sourceIndex >= 0 ? questions[sourceIndex] : undefined;
    const sourceOptionExists = sourceQuestion?.opciones?.some(
      (option) => option.localId === rule.sourceOptionLocalId,
    );
    if (
      sourceIndex < 0 ||
      sourceIndex >= questionIndex ||
      !sourceQuestion ||
      !isCompatibleConditionalSource(sourceQuestion) ||
      !sourceOptionExists
    ) {
      return { ...question, conditionalRule: undefined };
    }
    return question;
  });

const serializeConditionalRule = (
  question: LocalQuestion,
  questionIndex: number,
  questions: LocalQuestion[],
): SurveyConditionalLogic | null => {
  if (question.conditionalLogicV2) return question.conditionalLogicV2;
  const rule = question.conditionalRule;
  if (!rule) return null;

  const sourceIndex = questions.findIndex((candidate) => candidate.localId === rule.sourceLocalId);
  if (sourceIndex < 0 || sourceIndex >= questionIndex) return null;
  const sourceQuestion = questions[sourceIndex];
  if (!isCompatibleConditionalSource(sourceQuestion)) return null;
  const sourceOptionIndex = (sourceQuestion.opciones ?? []).findIndex(
    (option) => option.localId === rule.sourceOptionLocalId,
  );
  if (sourceOptionIndex < 0) return null;

  return {
    version: 1,
    show_if: {
      question_order: sourceIndex + 1,
      option_order: sourceOptionIndex + 1,
    },
  };
};

export const SurveyEditor = ({
  survey,
  tenantSlug,
  initialDraft,
  onSave,
  onPublish,
  isSaving,
  isPublishing,
  structureLocked = false,
}: SurveyEditorProps) => {
  const [formValues, setFormValues] = useState<SurveyDraftPayload>(() => buildInitialDraft(survey, initialDraft));
  const [questions, setQuestions] = useState<LocalQuestion[]>(() => buildInitialQuestions(survey, initialDraft));
  const [submissionAction, setSubmissionAction] = useState<'save' | 'publish' | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const submissionLockRef = useRef(false);

  useEffect(() => {
    if (survey) {
      setFormValues(buildDraftFromSurvey(survey));
      setQuestions(() => {
        const next = mapQuestionsToLocal(survey.preguntas);
        return next.length ? next : [createLocalQuestion(1)];
      });
      return;
    }

    if (initialDraft) {
      setFormValues(cloneDraft(initialDraft));
      setQuestions(() => {
        const next = mapQuestionsToLocal(initialDraft.preguntas);
        return next.length ? next : [createLocalQuestion(1)];
      });
      return;
    }

    setFormValues({ ...fallbackDraft });
    setQuestions((prev) => (prev.length ? prev : [createLocalQuestion(1)]));
  }, [survey, initialDraft]);

  useEffect(() => {
    if (!questions.length) {
      setQuestions([createLocalQuestion(1)]);
    }
  }, [questions.length]);

  const handleQuestionChange = (localId: string, partial: Partial<LocalQuestion>) => {
    setQuestions((prev) =>
      sanitizeLocalConditionalRules(
        prev.map((question) => (question.localId === localId ? { ...question, ...partial } : question)),
      ),
    );
  };

  const handleDemographicRoleChange = (
    localId: string,
    role: DemographicQuestionRole,
  ) => {
    const target = questions.find((question) => question.localId === localId);
    if (!target || target.id !== undefined || structureLocked) return;

    const currentQuestionRef = target.question_ref || `question:${target.localId}`;
    const nextQuestionRef = role === 'general'
      ? `question:${target.localId}`
      : DEMOGRAPHIC_QUESTION_REFS[role];

    const conflictingQuestion = questions.find(
      (question) => question.localId !== localId && question.question_ref === nextQuestionRef,
    );
    if (conflictingQuestion) {
      setSubmissionError('Ese uso de segmentación ya está asignado a otra pregunta.');
      toast({
        title: 'Uso de segmentación duplicado',
        description: 'Cada encuesta puede tener una sola pregunta de ciudad y una sola de provincia.',
        variant: 'destructive',
      });
      return;
    }

    setSubmissionError(null);
    setQuestions((previous) => sanitizeLocalConditionalRules(previous.map((question) => {
      const conditionalLogicV2 = question.conditionalLogicV2
        ? {
            ...question.conditionalLogicV2,
            show_if: replaceQuestionRefInConditionalNode(
              question.conditionalLogicV2.show_if,
              currentQuestionRef,
              nextQuestionRef,
            ) as SurveyConditionalLogicV2['show_if'],
          }
        : undefined;

      if (question.localId !== localId) {
        return conditionalLogicV2 ? { ...question, conditionalLogicV2 } : question;
      }

      const needsChoiceOptions = role !== 'general' && !(question.opciones?.length);
      return {
        ...question,
        question_ref: nextQuestionRef,
        logicalRefConflict: false,
        tipo: role === 'general' ? question.tipo : 'opcion_unica',
        opciones: needsChoiceOptions
          ? [createLocalOption(1), createLocalOption(2)]
          : question.opciones,
        conditionalLogicV2,
      };
    })));
  };

  const handleUpgradeConditionalRule = (localId: string) => {
    setQuestions((previous) => {
      const withRefs = ensureStableLocalRefs(previous);
      const targetIndex = withRefs.findIndex((question) => question.localId === localId);
      const target = withRefs[targetIndex];
      const simpleRule = target?.conditionalRule;
      if (!target || targetIndex <= 0 || !simpleRule) return previous;
      const source = withRefs.find((question) => question.localId === simpleRule.sourceLocalId);
      const option = source?.opciones?.find((candidate) => candidate.localId === simpleRule.sourceOptionLocalId);
      if (!source?.question_ref || !option?.option_ref) return previous;

      return sanitizeLocalConditionalRules(withRefs.map((question) => (
        question.localId === localId
          ? {
              ...question,
              conditionalRule: undefined,
              conditionalLogicInvalid: false,
              conditionalLogicV2: {
                version: 2,
                show_if: {
                  kind: 'group',
                  operator: 'and',
                  children: [{
                    kind: 'option_selected',
                    question_ref: source.question_ref,
                    option_ref: option.option_ref,
                  }],
                },
              },
            }
          : question
      )));
    });
  };

  const handleV2OperatorChange = (localId: string, operator: 'and' | 'or') => {
    setQuestions((previous) => sanitizeLocalConditionalRules(previous.map((question) => {
      if (question.localId !== localId || !question.conditionalLogicV2) return question;
      return {
        ...question,
        conditionalLogicV2: {
          ...question.conditionalLogicV2,
          show_if: { ...question.conditionalLogicV2.show_if, operator },
        },
      };
    })));
  };

  const handleAddV2Condition = (localId: string) => {
    const withRefs = ensureStableLocalRefs(questions);
    const targetIndex = withRefs.findIndex((question) => question.localId === localId);
    const target = withRefs[targetIndex];
    if (!target?.conditionalLogicV2 || target.conditionalLogicV2.show_if.children.length >= 16) return;

    const leaves = v2ConditionalLeaves(target.conditionalLogicV2.show_if);
    const existing = new Set(leaves.map((node) => `${node.question_ref}\u0000${node.option_ref}`));
    const usedQuestionRefs = new Set(leaves.map((node) => node.question_ref));
    let nextLeaf: SurveyConditionalOptionSelectedV2 | undefined;
    const compatibleSources = withRefs.slice(0, targetIndex).filter(isCompatibleConditionalSource);
    const orderedSources = [
      ...compatibleSources.filter((source) => !source.question_ref || !usedQuestionRefs.has(source.question_ref)),
      ...compatibleSources.filter((source) => source.question_ref && usedQuestionRefs.has(source.question_ref)),
    ];
    for (const source of orderedSources) {
      if (!source.question_ref) continue;
      if (
        target.conditionalLogicV2.show_if.operator === 'and'
        && source.tipo === 'opcion_unica'
        && usedQuestionRefs.has(source.question_ref)
      ) continue;
      for (const option of source.opciones ?? []) {
        if (!option.option_ref || existing.has(`${source.question_ref}\u0000${option.option_ref}`)) continue;
        nextLeaf = {
          kind: 'option_selected',
          question_ref: source.question_ref,
          option_ref: option.option_ref,
        };
        break;
      }
      if (nextLeaf) break;
    }
    if (!nextLeaf) {
      setSubmissionError('No hay otra combinacion previa disponible para agregar a esta ruta.');
      return;
    }
    setSubmissionError(null);
    setQuestions(sanitizeLocalConditionalRules(withRefs.map((question) => (
      question.localId === localId
        ? {
            ...question,
            conditionalLogicV2: {
              ...question.conditionalLogicV2!,
              show_if: {
                ...question.conditionalLogicV2!.show_if,
                children: [...question.conditionalLogicV2!.show_if.children, nextLeaf!],
              },
            },
          }
        : question
    ))));
  };

  const handleReplaceV2Leaf = (
    localId: string,
    currentQuestionRef: string,
    currentOptionRef: string,
    replacement: Extract<SurveyConditionalNodeV2, { kind: 'option_selected' }>,
  ) => {
    const target = questions.find((question) => question.localId === localId);
    const otherLeaves = target?.conditionalLogicV2
      ? v2ConditionalLeaves(target.conditionalLogicV2.show_if).filter(
          (leaf) => leaf.question_ref !== currentQuestionRef || leaf.option_ref !== currentOptionRef,
        )
      : [];
    if (otherLeaves.some(
      (leaf) => leaf.question_ref === replacement.question_ref && leaf.option_ref === replacement.option_ref,
    )) {
      setSubmissionError('La misma condicion no puede repetirse dentro de una ruta.');
      return;
    }
    const replacementSource = questions.find((question) => question.question_ref === replacement.question_ref);
    if (
      target?.conditionalLogicV2?.show_if.operator === 'and'
      && replacementSource?.tipo === 'opcion_unica'
      && otherLeaves.some((leaf) => leaf.question_ref === replacement.question_ref)
    ) {
      setSubmissionError('AND no puede exigir dos respuestas distintas de una pregunta de opcion unica.');
      return;
    }
    setSubmissionError(null);
    setQuestions((previous) => sanitizeLocalConditionalRules(previous.map((question) => {
      if (question.localId !== localId || !question.conditionalLogicV2) return question;
      return {
        ...question,
        conditionalLogicV2: {
          ...question.conditionalLogicV2,
          show_if: replaceV2ConditionalLeaf(
            question.conditionalLogicV2.show_if,
            currentQuestionRef,
            currentOptionRef,
            replacement,
          ) as SurveyConditionalLogicV2['show_if'],
        },
      };
    })));
  };

  const handleOptionChange = (questionId: string, optionId: string, partial: Partial<LocalOption>) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.localId !== questionId) return question;
        return {
          ...question,
          opciones: (question.opciones ?? []).map((option) =>
            option.localId === optionId ? { ...option, ...partial } : option,
          ),
        };
      }),
    );
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, createLocalQuestion(prev.length + 1)]);
  };

  const handleRemoveQuestion = (localId: string) => {
    setQuestions((prev) => sanitizeLocalConditionalRules(prev.filter((question) => question.localId !== localId)));
  };

  const handleAddOption = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.localId !== questionId) return question;
        const next = [...(question.opciones ?? []), createLocalOption((question.opciones?.length ?? 0) + 1)];
        return { ...question, opciones: next };
      }),
    );
  };

  const handleRemoveOption = (questionId: string, optionId: string) => {
    setQuestions((prev) =>
      sanitizeLocalConditionalRules(
        prev.map((question) => {
          if (question.localId !== questionId) return question;
          return { ...question, opciones: (question.opciones ?? []).filter((option) => option.localId !== optionId) };
        }),
      ),
    );
  };

  const handleQuestionsReorder = (nextQuestions: LocalQuestion[]) => {
    if (structureLocked) return;
    const sanitized = sanitizeLocalConditionalRules(nextQuestions);
    const wouldDropAdaptiveRule = nextQuestions.some(
      (question, index) => Boolean(question.conditionalRule) && !sanitized[index]?.conditionalRule,
    );
    const wouldInvalidateV2Rule = nextQuestions.some(
      (question, index) => Boolean(question.conditionalLogicV2) && sanitized[index]?.conditionalLogicInvalid,
    );
    if (wouldDropAdaptiveRule || wouldInvalidateV2Rule) {
      setSubmissionError(
        'No se puede mover una pregunta adaptativa antes de la pregunta que activa su ruta.',
      );
      return;
    }
    setSubmissionError(null);
    setQuestions(sanitized);
  };

  const normalizeDateValue = (value?: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return trimmed;
    }
    return parsed.toISOString();
  };

  const formatDateInputValue = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleDateChange = (key: 'inicio_at' | 'fin_at') => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setFormValues((prev) => ({
      ...prev,
      [key]: value ? new Date(value).toISOString() : null,
    }));
  };

  const preparedPayload = useMemo<SurveyDraftPayload>(() => ({
    ...formValues,
    slug: formValues.slug?.trim() || undefined,
    inicio_at: normalizeDateValue(formValues.inicio_at),
    fin_at: normalizeDateValue(formValues.fin_at),
    preguntas: questions.map((question, index) => ({
      id: question.id,
      question_ref: question.question_ref,
      logical_ref: question.question_ref,
      orden: index + 1,
      tipo: question.tipo,
      texto: question.texto.trim(),
      obligatoria: question.obligatoria,
      min_selecciones: question.tipo === 'multiple' ? question.min_selecciones ?? null : null,
      max_selecciones: question.tipo === 'multiple' ? question.max_selecciones ?? null : null,
      conditional_logic: serializeConditionalRule(question, index, questions),
      opciones:
        question.tipo === 'abierta'
          ? undefined
          : (question.opciones ?? []).map((option, optIndex) => ({
              id: option.id,
              option_ref: option.option_ref,
              orden: optIndex + 1,
              texto: option.texto,
              valor: getDemographicQuestionRole(question.question_ref) === 'general'
                ? option.valor
                : normalizeDemographicOptionValue(option.valor),
            })),
    })),
  }), [formValues, questions]);

  const runSubmission = async (
    action: 'save' | 'publish',
    submit: () => Promise<void>,
    fallbackError: string,
  ) => {
    if (submissionLockRef.current || isSaving || isPublishing) return;

    submissionLockRef.current = true;
    setSubmissionAction(action);
    setSubmissionError(null);

    try {
      await submit();
    } catch (error) {
      setSubmissionError(getErrorMessage(error, fallbackError));
    } finally {
      submissionLockRef.current = false;
      setSubmissionAction(null);
    }
  };

  const validatePayload = () => {
    if (!formValues.titulo.trim()) {
      setSubmissionError('El título es obligatorio.');
      toast({ title: 'El título es obligatorio', variant: 'destructive' });
      return false;
    }
    if (!preparedPayload.preguntas.length) {
      setSubmissionError('Agregá al menos una pregunta.');
      toast({ title: 'Agregá al menos una pregunta', variant: 'destructive' });
      return false;
    }
    if (questions.some((question) => question.conditionalLogicInvalid)) {
      setSubmissionError('Hay una ruta adaptativa invalida. Corregila o desactivala antes de guardar.');
      toast({ title: 'Revisa las rutas adaptativas', variant: 'destructive' });
      return false;
    }
    const demographicContractError = getDemographicContractError(questions);
    if (demographicContractError) {
      setSubmissionError(demographicContractError);
      toast({ title: 'Revisá la segmentación geográfica', variant: 'destructive' });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validatePayload()) return;

    await runSubmission('save', () => onSave(preparedPayload), 'No pudimos guardar la encuesta.');
  };

  const handlePublish = async () => {
    if (!onPublish || !validatePayload()) return;

    await runSubmission(
      'publish',
      async () => {
        await onSave(preparedPayload);
        await onPublish();
      },
      'No pudimos guardar y publicar la encuesta.',
    );
  };

  const isSubmissionPending = submissionAction !== null || Boolean(isSaving) || Boolean(isPublishing);

  const publicUrl = useMemo(
    () => getPublicSurveyUrlFromRecord(survey, { tenantSlug }),
    [survey, tenantSlug],
  );

  const whatsappShareUrl = useMemo(
    () => getPublicSurveyWhatsAppShareUrl(
      publicUrl,
      survey?.titulo
        ? `Participá de la encuesta “${survey.titulo}” y sumá tu voz a la toma de decisiones.`
        : 'Participá de esta encuesta y sumá tu voz a la toma de decisiones.',
    ),
    [publicUrl, survey?.titulo],
  );

  const qrUrl = getPublicSurveyQrUrlFromRecord(survey, { size: 512, tenantSlug });

  return (
    <fieldset
      className="min-w-0 space-y-6 border-0 p-0"
      disabled={isSubmissionPending}
      aria-busy={isSubmissionPending}
    >
      {structureLocked && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          Esta encuesta ya esta publicada. Podes corregir textos, fechas y configuracion, pero para agregar o quitar
          preguntas/opciones tenes que crear una nueva version editable.
        </div>
      )}
      <Card className={`transition-colors border-l-4 ${formValues.tipo === 'votacion' ? 'border-l-blue-500 bg-blue-50/10' : 'border-l-primary bg-primary/5'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
             Configuración general
             {formValues.tipo === 'votacion' && <span className="text-xs font-normal px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">Modo Votación Pública</span>}
          </CardTitle>
          <CardDescription>Definí los datos principales del instrumento y su política de participación.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {formValues.tipo === 'votacion' && (
             <div className="col-span-1 md:col-span-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800 leading-relaxed mb-2">
               <strong>Nota sobre votaciones:</strong> Las votaciones se distinguen de las encuestas en que suelen requerir verificación de identidad fuerte (DNI/Login), exhiben resultados en tiempo real y prohíben respuestas múltiples por usuario.
             </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="survey-title">Título</Label>
            <Input
              id="survey-title"
              value={formValues.titulo}
              onChange={(event) => setFormValues((prev) => ({ ...prev, titulo: event.target.value }))}
              placeholder="Título visible para las personas participantes"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="survey-slug">Slug público</Label>
            <Input
              id="survey-slug"
              value={formValues.slug ?? ''}
              onChange={(event) => setFormValues((prev) => ({ ...prev, slug: event.target.value }))}
              placeholder="Identificador en la URL (ej. plan-ambiental)"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="survey-description">Descripción</Label>
            <Textarea
              id="survey-description"
              value={formValues.descripcion ?? ''}
              onChange={(event) => setFormValues((prev) => ({ ...prev, descripcion: event.target.value }))}
              placeholder="Contá brevemente el objetivo de la encuesta"
              className="min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={formValues.tipo}
              onValueChange={(value: SurveyTipo) => setFormValues((prev) => ({ ...prev, tipo: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná un tipo" />
              </SelectTrigger>
              <SelectContent>
                {tipoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Política de unicidad</Label>
            <Select
              value={formValues.politica_unicidad}
              onValueChange={(value: SurveyDraftPayload['politica_unicidad']) =>
                setFormValues((prev) => ({ ...prev, politica_unicidad: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccioná una opción" />
              </SelectTrigger>
              <SelectContent>
                {unicidadOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inicio-at">Inicio</Label>
            <Input
              id="inicio-at"
              type="datetime-local"
              value={formatDateInputValue(formValues.inicio_at)}
              onChange={handleDateChange('inicio_at')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fin-at">Fin</Label>
            <Input
              id="fin-at"
              type="datetime-local"
              value={formatDateInputValue(formValues.fin_at)}
              onChange={handleDateChange('fin_at')}
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center justify-between">Anonimato</Label>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Encuesta anónima</p>
                <p className="text-xs text-muted-foreground">No se solicitarán datos personales.</p>
              </div>
              <Switch
                checked={formValues.anonimato}
                onCheckedChange={(checked) =>
                  setFormValues((prev) => ({ ...prev, anonimato: checked, requiere_datos_contacto: !checked }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center justify-between">Control de duplicados</Label>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Solicitar datos de contacto</p>
                <p className="text-xs text-muted-foreground">Usá DNI o teléfono para validar respuestas.</p>
              </div>
              <Switch
                checked={formValues.requiere_datos_contacto}
                onCheckedChange={(checked) => setFormValues((prev) => ({ ...prev, requiere_datos_contacto: checked }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Votación en vivo</CardTitle>
          <CardDescription>Configurá el comportamiento en tiempo real y los comentarios de la plantilla.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="flex items-center justify-between">Modo en vivo</Label>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Activar votación en vivo</p>
                <p className="text-xs text-muted-foreground">Habilita el layout estilo YouTube y resultados dinámicos.</p>
              </div>
              <Switch
                checked={Boolean(formValues.es_votacion_envivo)}
                onCheckedChange={(checked) => setFormValues((prev) => ({ ...prev, es_votacion_envivo: checked }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center justify-between">Resultados en tiempo real</Label>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Mostrar resultados en vivo</p>
                <p className="text-xs text-muted-foreground">Actualiza barras y porcentajes automáticamente.</p>
              </div>
              <Switch
                checked={Boolean(formValues.mostrar_resultados_envivo)}
                onCheckedChange={(checked) =>
                  setFormValues((prev) => ({ ...prev, mostrar_resultados_envivo: checked }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center justify-between">Comentarios</Label>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Permitir comentarios</p>
                <p className="text-xs text-muted-foreground">Agregá debate anónimo y login social.</p>
              </div>
              <Switch
                checked={Boolean(formValues.permitir_comentarios)}
                onCheckedChange={(checked) => setFormValues((prev) => ({ ...prev, permitir_comentarios: checked }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="survey-reward-points">Puntos de recompensa</Label>
            <Input
              id="survey-reward-points"
              type="number"
              inputMode="numeric"
              min={0}
              value={formValues.puntos_recompensa ?? ''}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  puntos_recompensa: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
              placeholder="Ej: 50"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preguntas</CardTitle>
          <CardDescription>Arrastrá para reordenar, editá las opciones y definí validaciones.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Reorder.Group axis="y" values={questions} onReorder={handleQuestionsReorder} className="space-y-4">
            {questions.map((question, questionIndex) => {
              const compatibleSources = questions
                .slice(0, questionIndex)
                .filter(isCompatibleConditionalSource);
              const selectedSource = compatibleSources.find(
                (sourceQuestion) => sourceQuestion.localId === question.conditionalRule?.sourceLocalId,
              );
              const v2Leaves = question.conditionalLogicV2
                ? v2ConditionalLeaves(question.conditionalLogicV2.show_if)
                : [];
              const demographicRole = getDemographicQuestionRole(question.question_ref);
              const demographicRoleDescription = demographicRoleOptions.find(
                (option) => option.value === demographicRole,
              )?.description;
              const demographicRoleLocked = structureLocked || question.id !== undefined;
              const cityRoleUsedByAnotherQuestion = questions.some(
                (candidate) => candidate.localId !== question.localId
                  && candidate.question_ref === DEMOGRAPHIC_QUESTION_REFS.city,
              );
              const provinceRoleUsedByAnotherQuestion = questions.some(
                (candidate) => candidate.localId !== question.localId
                  && candidate.question_ref === DEMOGRAPHIC_QUESTION_REFS.province,
              );

              return (
              <Reorder.Item
                key={question.localId}
                value={question}
                dragListener={!structureLocked}
                className="border border-border rounded-lg bg-card/60 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Input
                        value={question.texto}
                        onChange={(event) => handleQuestionChange(question.localId, { texto: event.target.value })}
                        placeholder="Enunciado de la pregunta"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tipo de pregunta</Label>
                        <Select
                          value={question.tipo}
                          disabled={structureLocked || demographicRole !== 'general'}
                          onValueChange={(value: PreguntaTipo) => {
                            handleQuestionChange(question.localId, {
                              tipo: value,
                              opciones:
                                value === 'abierta'
                                  ? []
                                  : question.opciones?.length
                                    ? question.opciones
                                    : [createLocalOption(1), createLocalOption(2)],
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccioná un tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            {preguntaTipoOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {demographicRole !== 'general' && (
                          <p className="text-xs text-muted-foreground">
                            La segmentación geográfica usa una sola opción por respuesta.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Obligatoria</Label>
                        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                          <span className="text-sm text-muted-foreground">Requerir respuesta</span>
                          <Switch
                            checked={question.obligatoria}
                            onCheckedChange={(checked) => handleQuestionChange(question.localId, { obligatoria: checked })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`demographic-role-${question.localId}`}>
                          Uso en segmentación e informes
                        </Label>
                        <Select
                          value={demographicRole}
                          disabled={demographicRoleLocked}
                          onValueChange={(value: DemographicQuestionRole) => {
                            handleDemographicRoleChange(question.localId, value);
                          }}
                        >
                          <SelectTrigger
                            id={`demographic-role-${question.localId}`}
                            aria-label={`Uso en segmentación de la pregunta ${questionIndex + 1}`}
                            aria-describedby={`demographic-role-help-${question.localId}`}
                          >
                            <SelectValue placeholder="Elegí cómo se usará la respuesta" />
                          </SelectTrigger>
                          <SelectContent>
                            {demographicRoleOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                                disabled={
                                  (option.value === 'city' && cityRoleUsedByAnotherQuestion)
                                  || (option.value === 'province' && provinceRoleUsedByAnotherQuestion)
                                }
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p
                          id={`demographic-role-help-${question.localId}`}
                          className="text-xs text-muted-foreground"
                        >
                          {demographicRoleDescription}
                          {demographicRoleLocked && question.id !== undefined
                            ? ' Para conservar el historial, el uso de una pregunta ya guardada no puede cambiarse; creá una nueva pregunta si necesitás otro.'
                            : ' La asignación es explícita: JUNI no la deduce del enunciado.'}
                        </p>
                      </div>
                      {question.tipo === 'multiple' && (
                        <>
                          <div className="space-y-2">
                            <Label>Mínimo de selecciones</Label>
                            <Input
                              type="number"
                              min={0}
                              value={question.min_selecciones ?? 0}
                              onChange={(event) =>
                                handleQuestionChange(question.localId, {
                                  min_selecciones: Number(event.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Máximo de selecciones</Label>
                            <Input
                              type="number"
                              min={0}
                              value={question.max_selecciones ?? 0}
                              onChange={(event) =>
                                handleQuestionChange(question.localId, {
                                  max_selecciones: Number(event.target.value),
                                })
                              }
                            />
                          </div>
                        </>
                      )}
                    </div>
                    {questionIndex > 0 ? (
                      <div className="space-y-3 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <Label htmlFor={`conditional-rule-${question.localId}`}>Ruta adaptativa</Label>
                            <p className="text-xs text-muted-foreground">
                              Mostrar esta pregunta solo cuando una respuesta previa coincida.
                            </p>
                          </div>
                          <Switch
                            id={`conditional-rule-${question.localId}`}
                            aria-label={`Activar ruta adaptativa para pregunta ${questionIndex + 1}`}
                            checked={Boolean(
                              question.conditionalRule || question.conditionalLogicV2 || question.conditionalLogicInvalid,
                            )}
                            disabled={
                              structureLocked
                              || (
                                compatibleSources.length === 0
                                && !question.conditionalRule
                                && !question.conditionalLogicV2
                                && !question.conditionalLogicInvalid
                              )
                            }
                            onCheckedChange={(checked) => {
                              if (!checked) {
                                handleQuestionChange(question.localId, {
                                  conditionalRule: undefined,
                                  conditionalLogicV2: undefined,
                                  conditionalLogicInvalid: false,
                                });
                                return;
                              }
                              if (question.conditionalLogicV2) return;
                              const firstSource = compatibleSources[0];
                              const firstOption = firstSource?.opciones?.[0];
                              if (!firstSource || !firstOption) return;
                              handleQuestionChange(question.localId, {
                                conditionalRule: {
                                  sourceLocalId: firstSource.localId,
                                  sourceOptionLocalId: firstOption.localId,
                                },
                              });
                            }}
                          />
                        </div>

                        {question.conditionalLogicV2 ? (
                          <div className="space-y-3 rounded-md border border-primary/20 bg-background p-3 text-sm">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                              <div className="space-y-1">
                                <Label htmlFor={`conditional-operator-${question.localId}`}>Combinar condiciones</Label>
                                <p className="text-xs text-muted-foreground">
                                  AND exige todas; OR muestra la pregunta cuando coincide al menos una.
                                </p>
                              </div>
                              <Select
                                value={question.conditionalLogicV2.show_if.operator}
                                disabled={structureLocked}
                                onValueChange={(value: 'and' | 'or') => handleV2OperatorChange(question.localId, value)}
                              >
                                <SelectTrigger id={`conditional-operator-${question.localId}`} className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="and">AND</SelectItem>
                                  <SelectItem value="or">OR</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-3">
                              {v2Leaves.map((leaf, leafIndex) => {
                                const leafSource = compatibleSources.find(
                                  (candidate) => candidate.question_ref === leaf.question_ref,
                                );
                                return (
                                  <div
                                    key={`${leaf.question_ref}:${leaf.option_ref}`}
                                    className="grid gap-3 rounded-md border border-border/70 bg-muted/20 p-3 md:grid-cols-2"
                                  >
                                    <div className="space-y-2">
                                      <Label htmlFor={`conditional-v2-source-${question.localId}-${leafIndex}`}>
                                        Condicion {leafIndex + 1}: pregunta
                                      </Label>
                                      <Select
                                        value={leaf.question_ref}
                                        disabled={structureLocked}
                                        onValueChange={(questionRef) => {
                                          const source = compatibleSources.find(
                                            (candidate) => candidate.question_ref === questionRef,
                                          );
                                          const firstOption = source?.opciones?.find((option) => Boolean(option.option_ref));
                                          if (!source?.question_ref || !firstOption?.option_ref) return;
                                          handleReplaceV2Leaf(
                                            question.localId,
                                            leaf.question_ref,
                                            leaf.option_ref,
                                            {
                                              kind: 'option_selected',
                                              question_ref: source.question_ref,
                                              option_ref: firstOption.option_ref,
                                            },
                                          );
                                        }}
                                      >
                                        <SelectTrigger id={`conditional-v2-source-${question.localId}-${leafIndex}`}>
                                          <SelectValue placeholder="Elegir pregunta previa" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {compatibleSources.filter((source) => Boolean(source.question_ref)).map((source) => (
                                            <SelectItem key={source.localId} value={source.question_ref!}>
                                              {questions.findIndex((candidate) => candidate.localId === source.localId) + 1}.{' '}
                                              {source.texto || 'Pregunta sin titulo'}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor={`conditional-v2-option-${question.localId}-${leafIndex}`}>
                                        Respuesta
                                      </Label>
                                      <Select
                                        value={leaf.option_ref}
                                        disabled={structureLocked || !leafSource}
                                        onValueChange={(optionRef) => handleReplaceV2Leaf(
                                          question.localId,
                                          leaf.question_ref,
                                          leaf.option_ref,
                                          { ...leaf, option_ref: optionRef },
                                        )}
                                      >
                                        <SelectTrigger id={`conditional-v2-option-${question.localId}-${leafIndex}`}>
                                          <SelectValue placeholder="Elegir respuesta" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {(leafSource?.opciones ?? []).filter((option) => Boolean(option.option_ref)).map((option, optionIndex) => (
                                            <SelectItem key={option.localId} value={option.option_ref!}>
                                              {option.texto || `Opcion ${optionIndex + 1}`}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                structureLocked
                                || v2Leaves.length >= 32
                                || question.conditionalLogicV2.show_if.children.length >= 16
                              }
                              onClick={() => handleAddV2Condition(question.localId)}
                            >
                              <Plus className="h-4 w-4" /> Agregar condicion
                            </Button>
                          </div>
                        ) : question.conditionalRule && selectedSource ? (
                          <div className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`conditional-source-${question.localId}`}>Pregunta previa</Label>
                              <Select
                                value={selectedSource.localId}
                                disabled={structureLocked}
                                onValueChange={(sourceLocalId) => {
                                  const sourceQuestion = compatibleSources.find(
                                    (candidate) => candidate.localId === sourceLocalId,
                                  );
                                  const firstOption = sourceQuestion?.opciones?.[0];
                                  if (!sourceQuestion || !firstOption) return;
                                  handleQuestionChange(question.localId, {
                                    conditionalRule: {
                                      sourceLocalId: sourceQuestion.localId,
                                      sourceOptionLocalId: firstOption.localId,
                                    },
                                  });
                                }}
                              >
                                <SelectTrigger id={`conditional-source-${question.localId}`}>
                                  <SelectValue placeholder="Elegir pregunta previa" />
                                </SelectTrigger>
                                <SelectContent>
                                  {compatibleSources.map((sourceQuestion) => (
                                    <SelectItem key={sourceQuestion.localId} value={sourceQuestion.localId}>
                                      {questions.findIndex((candidate) => candidate.localId === sourceQuestion.localId) + 1}.{' '}
                                      {sourceQuestion.texto || 'Pregunta sin titulo'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`conditional-option-${question.localId}`}>Respuesta que la activa</Label>
                              <Select
                                value={question.conditionalRule.sourceOptionLocalId}
                                disabled={structureLocked}
                                onValueChange={(sourceOptionLocalId) =>
                                  handleQuestionChange(question.localId, {
                                    conditionalRule: {
                                      sourceLocalId: selectedSource.localId,
                                      sourceOptionLocalId,
                                    },
                                  })
                                }
                              >
                                <SelectTrigger id={`conditional-option-${question.localId}`}>
                                  <SelectValue placeholder="Elegir respuesta" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(selectedSource.opciones ?? []).map((sourceOption, optionIndex) => (
                                    <SelectItem key={sourceOption.localId} value={sourceOption.localId}>
                                      {sourceOption.texto || `Opcion ${optionIndex + 1}`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={structureLocked}
                              onClick={() => handleUpgradeConditionalRule(question.localId)}
                            >
                              <Plus className="h-4 w-4" /> Combinar con AND/OR
                            </Button>
                          </div>
                        ) : compatibleSources.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Agrega una pregunta previa con opciones para habilitar esta ruta.
                          </p>
                        ) : null}
                        {question.conditionalLogicInvalid ? (
                          <p className="text-xs font-medium text-destructive" role="alert">
                            La ruta referencia una pregunta u opcion inexistente, posterior o no seleccionable.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {question.tipo !== 'abierta' && (
                      <div className="space-y-2">
                        <Label>Opciones</Label>
                        {demographicRole !== 'general' && (
                          <p className="text-xs text-muted-foreground">
                            El valor para informes es obligatorio y debe ser único. Ejemplos: ushuaia, rio-grande.
                          </p>
                        )}
                        <div className="flex flex-col gap-2">
                          {(question.opciones ?? []).map((option, optionIndex) => (
                            <div key={option.localId} className="flex items-center gap-2">
                              <Input
                                value={option.texto}
                                onChange={(event) =>
                                  handleOptionChange(question.localId, option.localId, { texto: event.target.value })
                                }
                                placeholder="Texto visible"
                              />
                              <Input
                                value={option.valor ?? ''}
                                maxLength={demographicRole === 'general' ? undefined : 120}
                                aria-label={
                                  demographicRole === 'general'
                                    ? `Valor interno de la opción ${optionIndex + 1} de la pregunta ${questionIndex + 1}`
                                    : `Valor para informes de la opción ${optionIndex + 1} de la pregunta ${questionIndex + 1}`
                                }
                                aria-required={demographicRole !== 'general'}
                                onChange={(event) =>
                                  handleOptionChange(question.localId, option.localId, { valor: event.target.value })
                                }
                                placeholder={
                                  demographicRole === 'general'
                                    ? 'Valor interno (opcional)'
                                    : 'Valor para informes (obligatorio)'
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={structureLocked}
                                onClick={() => handleRemoveOption(question.localId, option.localId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="inline-flex items-center gap-2 self-start"
                            disabled={structureLocked}
                            onClick={() => handleAddOption(question.localId)}
                          >
                            <Plus className="h-4 w-4" /> Agregar opción
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={structureLocked}
                    onClick={() => handleRemoveQuestion(question.localId)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </Reorder.Item>
              );
            })}
          </Reorder.Group>
          <Button type="button" variant="outline" onClick={handleAddQuestion} disabled={structureLocked} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Agregar pregunta
          </Button>
        </CardContent>
      </Card>

      <SurveyLogicMap questions={preparedPayload.preguntas} />

      <SurveyPreviewTester draft={preparedPayload} />

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleSave} disabled={isSubmissionPending} className="inline-flex items-center gap-2">
          <UploadCloud className="h-4 w-4" />{' '}
          {submissionAction === 'save' || (isSaving && submissionAction !== 'publish')
            ? 'Guardando...'
            : 'Guardar cambios'}
        </Button>
        {onPublish && (
          <Button type="button" variant="secondary" onClick={handlePublish} disabled={isSubmissionPending}>
            {submissionAction === 'publish'
              ? 'Guardando y publicando...'
              : isPublishing
                ? 'Publicando...'
                : 'Publicar'}
          </Button>
        )}
      </div>

      {submissionError && (
        <p role="alert" className="text-sm text-destructive">
          {submissionError}
        </p>
      )}

      {survey?.estado === 'publicada' && (
        <Card>
          <CardHeader>
            <CardTitle>Compartir encuesta</CardTitle>
            <CardDescription>Distribuí el enlace y el QR para sumar participación ciudadana.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>
                  {survey.fin_at
                    ? `Vigente hasta ${new Date(survey.fin_at).toLocaleString()}`
                    : 'Sin fecha de cierre'}
                </span>
              </div>
              {publicUrl && (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="max-w-full break-all rounded bg-muted px-3 py-1 text-sm">{publicUrl}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(publicUrl);
                        toast({ title: 'Link copiado' });
                      } catch (error) {
                        toast({
                          title: 'No se pudo copiar',
                          description: String((error as Error)?.message ?? error),
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {whatsappShareUrl && (
                    <Button variant="outline" asChild>
                      <a href={whatsappShareUrl} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" /> Compartir por WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
            {qrUrl && (
              <img src={qrUrl} alt="Código QR de la encuesta" className="h-48 w-48 rounded-md border border-border" />
            )}
          </CardContent>
        </Card>
      )}
    </fieldset>
  );
};
