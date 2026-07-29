import type {
  SurveyConditionalLogic,
  SurveyConditionalLogicV1,
  SurveyConditionalLogicV2,
  SurveyConditionalNodeV2,
  SurveyOptionId,
  SurveyPregunta,
} from '@/types/encuestas';

export interface SurveyConditionalAnswer {
  opcionIds?: readonly SurveyOptionId[];
  opcion_ids?: readonly SurveyOptionId[];
}

export type SurveyConditionalAnswers = Record<string | number, SurveyConditionalAnswer | undefined>;

export const SURVEY_CONDITIONAL_LOGIC_V2_LIMITS = {
  maxDepth: 4,
  maxNodes: 64,
  maxLeaves: 32,
  maxChildrenPerGroup: 16,
  maxRefLength: 160,
} as const;

const SURVEY_CONDITIONAL_REF_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._~:/%+!$&'()*,;=@-]{0,159}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]) => {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => keys.includes(key));
};

const isSurveyOptionId = (value: unknown): value is SurveyOptionId =>
  typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));

const isCanonicalConditionalRef = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= SURVEY_CONDITIONAL_LOGIC_V2_LIMITS.maxRefLength &&
  SURVEY_CONDITIONAL_REF_PATTERN.test(value);

const parseConditionalLogicV1 = (
  value: Record<string, unknown>,
): SurveyConditionalLogicV1 | null => {
  if (
    !hasExactKeys(value, ['version', 'show_if']) ||
    value.version !== 1 ||
    !isRecord(value.show_if) ||
    !hasExactKeys(value.show_if, ['question_order', 'option_order'])
  ) return null;

  const questionOrder = value.show_if.question_order;
  const optionOrder = value.show_if.option_order;
  if (!isPositiveInteger(questionOrder) || !isPositiveInteger(optionOrder)) return null;

  return {
    version: 1,
    show_if: {
      question_order: questionOrder,
      option_order: optionOrder,
    },
  };
};

interface ConditionalV2ParseState {
  nodes: number;
  leaves: number;
  leafKeys: Set<string>;
}

const parseConditionalNodeV2 = (
  value: unknown,
  depth: number,
  state: ConditionalV2ParseState,
): SurveyConditionalNodeV2 | null => {
  if (
    depth > SURVEY_CONDITIONAL_LOGIC_V2_LIMITS.maxDepth ||
    !isRecord(value)
  ) return null;

  state.nodes += 1;
  if (state.nodes > SURVEY_CONDITIONAL_LOGIC_V2_LIMITS.maxNodes) return null;

  if (value.kind === 'option_selected') {
    if (!hasExactKeys(value, ['kind', 'question_ref', 'option_ref'])) return null;
    if (
      !isCanonicalConditionalRef(value.question_ref) ||
      !isCanonicalConditionalRef(value.option_ref)
    ) return null;

    state.leaves += 1;
    if (state.leaves > SURVEY_CONDITIONAL_LOGIC_V2_LIMITS.maxLeaves) return null;
    const leafKey = JSON.stringify([value.question_ref, value.option_ref]);
    if (state.leafKeys.has(leafKey)) return null;
    state.leafKeys.add(leafKey);

    return {
      kind: 'option_selected',
      question_ref: value.question_ref,
      option_ref: value.option_ref,
    };
  }

  if (value.kind !== 'group' || !hasExactKeys(value, ['kind', 'operator', 'children'])) {
    return null;
  }
  if (value.operator !== 'and' && value.operator !== 'or') return null;
  if (
    !Array.isArray(value.children) ||
    value.children.length < 1 ||
    value.children.length > SURVEY_CONDITIONAL_LOGIC_V2_LIMITS.maxChildrenPerGroup
  ) return null;

  const children: SurveyConditionalNodeV2[] = [];
  for (const child of value.children) {
    const parsedChild = parseConditionalNodeV2(child, depth + 1, state);
    if (!parsedChild) return null;
    children.push(parsedChild);
  }

  return {
    kind: 'group',
    operator: value.operator,
    children,
  };
};

const parseConditionalLogicV2 = (
  value: Record<string, unknown>,
): SurveyConditionalLogicV2 | null => {
  if (
    !hasExactKeys(value, ['version', 'show_if']) ||
    value.version !== 2
  ) return null;

  const showIf = parseConditionalNodeV2(value.show_if, 1, {
    nodes: 0,
    leaves: 0,
    leafKeys: new Set<string>(),
  });
  return showIf?.kind === 'group' ? { version: 2, show_if: showIf } : null;
};

export const parseSurveyConditionalLogic = (value: unknown): SurveyConditionalLogic | null => {
  if (!isRecord(value)) return null;
  if (value.version === 1) return parseConditionalLogicV1(value);
  if (value.version === 2) return parseConditionalLogicV2(value);
  return null;
};

const optionIdsEqual = (left: SurveyOptionId, right: SurveyOptionId) => String(left) === String(right);

const selectedOptionIdsFor = (
  question: SurveyPregunta,
  answers: SurveyConditionalAnswers,
): SurveyOptionId[] => {
  const sourceAnswer = answers[question.id];
  const rawSelectedOptionIds = Array.isArray(sourceAnswer?.opcionIds)
    ? sourceAnswer.opcionIds
    : Array.isArray(sourceAnswer?.opcion_ids)
      ? sourceAnswer.opcion_ids
      : [];
  return rawSelectedOptionIds.filter(isSurveyOptionId);
};

interface ConditionalNodeEvaluation {
  valid: boolean;
  matches: boolean;
}

const INVALID_CONDITIONAL_NODE: ConditionalNodeEvaluation = {
  valid: false,
  matches: false,
};

interface ConditionalV2EvaluationContext {
  target: SurveyPregunta;
  questionsByRef: Map<string, SurveyPregunta[]>;
  visibilityByQuestion: Map<SurveyPregunta, boolean>;
  answers: SurveyConditionalAnswers;
}

const evaluateConditionalNodeV2 = (
  node: SurveyConditionalNodeV2,
  context: ConditionalV2EvaluationContext,
): ConditionalNodeEvaluation => {
  if (node.kind === 'group') {
    // Evaluate every child even for OR. A true sibling must never conceal an
    // invalid, ambiguous or forward reference elsewhere in the expression.
    const children = node.children.map((child) => evaluateConditionalNodeV2(child, context));
    if (children.some((child) => !child.valid)) return INVALID_CONDITIONAL_NODE;
    return {
      valid: true,
      matches: node.operator === 'and'
        ? children.every((child) => child.matches)
        : children.some((child) => child.matches),
    };
  }

  const sourceCandidates = context.questionsByRef.get(node.question_ref) ?? [];
  if (sourceCandidates.length !== 1) return INVALID_CONDITIONAL_NODE;

  const sourceQuestion = sourceCandidates[0];
  if (
    !isPositiveInteger(context.target.orden) ||
    !isPositiveInteger(sourceQuestion.orden) ||
    sourceQuestion.orden >= context.target.orden ||
    !['opcion_unica', 'multiple'].includes(sourceQuestion.tipo)
  ) return INVALID_CONDITIONAL_NODE;

  const optionCandidates = (sourceQuestion.opciones ?? []).filter(
    (option) => option.option_ref === node.option_ref,
  );
  if (optionCandidates.length !== 1 || !isSurveyOptionId(optionCandidates[0].id)) {
    return INVALID_CONDITIONAL_NODE;
  }

  if (context.visibilityByQuestion.get(sourceQuestion) !== true) {
    return { valid: true, matches: false };
  }

  const selectedOptionIds = selectedOptionIdsFor(sourceQuestion, context.answers);
  return {
    valid: true,
    matches: selectedOptionIds.some((optionId) => optionIdsEqual(optionId, optionCandidates[0].id)),
  };
};

/**
 * Resolves the adaptive path in question-order space while preserving the input order.
 * Conditional questions fail closed when their rule, source, option, or dependency is invalid.
 */
export const getVisibleSurveyQuestions = (
  questions: readonly SurveyPregunta[],
  answers: SurveyConditionalAnswers,
): SurveyPregunta[] => {
  const questionsByOrder = new Map<number, SurveyPregunta[]>();
  const questionsByRef = new Map<string, SurveyPregunta[]>();
  questions.forEach((question) => {
    const sameOrder = questionsByOrder.get(question.orden) ?? [];
    sameOrder.push(question);
    questionsByOrder.set(question.orden, sameOrder);

    if (typeof question.question_ref === 'string') {
      const sameRef = questionsByRef.get(question.question_ref) ?? [];
      sameRef.push(question);
      questionsByRef.set(question.question_ref, sameRef);
    }
  });

  const visibilityByQuestion = new Map<SurveyPregunta, boolean>();
  const orderedQuestions = [...questions].sort((left, right) => left.orden - right.orden);

  orderedQuestions.forEach((question) => {
    if (question.conditional_logic === undefined || question.conditional_logic === null) {
      visibilityByQuestion.set(question, true);
      return;
    }

    const rule = parseSurveyConditionalLogic(question.conditional_logic);
    if (!rule || !isPositiveInteger(question.orden)) {
      visibilityByQuestion.set(question, false);
      return;
    }

    if (rule.version === 2) {
      const evaluation = evaluateConditionalNodeV2(rule.show_if, {
        target: question,
        questionsByRef,
        visibilityByQuestion,
        answers,
      });
      visibilityByQuestion.set(question, evaluation.valid && evaluation.matches);
      return;
    }

    if (rule.show_if.question_order >= question.orden) {
      visibilityByQuestion.set(question, false);
      return;
    }

    const sourceCandidates = questionsByOrder.get(rule.show_if.question_order) ?? [];
    if (sourceCandidates.length !== 1) {
      visibilityByQuestion.set(question, false);
      return;
    }

    const sourceQuestion = sourceCandidates[0];
    if (
      visibilityByQuestion.get(sourceQuestion) !== true ||
      !['opcion_unica', 'multiple'].includes(sourceQuestion.tipo)
    ) {
      visibilityByQuestion.set(question, false);
      return;
    }

    const optionCandidates = (sourceQuestion.opciones ?? []).filter(
      (option) => option.orden === rule.show_if.option_order,
    );
    if (optionCandidates.length !== 1) {
      visibilityByQuestion.set(question, false);
      return;
    }

    const selectedOptionIds = selectedOptionIdsFor(sourceQuestion, answers);
    const expectedOptionId = optionCandidates[0].id;
    visibilityByQuestion.set(
      question,
      selectedOptionIds.some((optionId) => optionIdsEqual(optionId, expectedOptionId)),
    );
  });

  return questions.filter((question) => visibilityByQuestion.get(question) === true);
};
