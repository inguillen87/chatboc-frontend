import { useId, useMemo } from 'react';

import type {
  SurveyConditionalNodeV2,
  SurveyDraftPayload,
} from '@/types/encuestas';
import { cn } from '@/lib/utils';
import { parseSurveyConditionalLogic } from '@/utils/surveyConditionalLogic';

type DraftQuestion = SurveyDraftPayload['preguntas'][number];
type DraftOption = NonNullable<DraftQuestion['opciones']>[number];

interface SurveyLogicMapProps {
  questions: SurveyDraftPayload['preguntas'];
  className?: string;
}

interface LogicLeafView {
  kind: 'leaf';
  sourceLabel: string;
  optionLabel: string;
  referenceLabel: string;
  issue?: string;
}

interface LogicGroupView {
  kind: 'group';
  operator: 'and' | 'or';
  children: LogicExpressionView[];
}

type LogicExpressionView = LogicLeafView | LogicGroupView;

interface LogicQuestionView {
  key: string;
  question: DraftQuestion;
  logicVersion: 1 | 2 | null;
  expression?: LogicExpressionView;
  issues: string[];
}

interface LogicIndexes {
  byOrder: Map<number, DraftQuestion[]>;
  byRef: Map<string, DraftQuestion[]>;
}

const isSelectableSource = (question: DraftQuestion) =>
  question.tipo === 'opcion_unica' || question.tipo === 'multiple';

const questionLabel = (question: DraftQuestion) =>
  `P${question.orden} · ${question.texto.trim() || 'Pregunta sin texto'}`;

const optionLabel = (option: DraftOption) =>
  `O${option.orden} · ${option.texto.trim() || 'Opción sin texto'}`;

const makeInvalidLeaf = (
  referenceLabel: string,
  sourceLabel: string,
  optionLabelValue: string,
  issue: string,
): LogicLeafView => ({
  kind: 'leaf',
  referenceLabel,
  sourceLabel,
  optionLabel: optionLabelValue,
  issue,
});

const resolveV1Leaf = (
  target: DraftQuestion,
  sourceOrder: number,
  sourceOptionOrder: number,
  indexes: LogicIndexes,
): LogicLeafView => {
  const referenceLabel = `orden P${sourceOrder} / O${sourceOptionOrder}`;
  const rawSourceLabel = `Pregunta de orden ${sourceOrder}`;
  const rawOptionLabel = `Opción de orden ${sourceOptionOrder}`;
  const sourceCandidates = indexes.byOrder.get(sourceOrder) ?? [];

  if (sourceCandidates.length === 0) {
    return makeInvalidLeaf(
      referenceLabel,
      rawSourceLabel,
      rawOptionLabel,
      `No existe la pregunta fuente de orden ${sourceOrder}.`,
    );
  }
  if (sourceCandidates.length > 1) {
    return makeInvalidLeaf(
      referenceLabel,
      rawSourceLabel,
      rawOptionLabel,
      `El orden ${sourceOrder} es ambiguo: coincide con ${sourceCandidates.length} preguntas.`,
    );
  }

  const source = sourceCandidates[0];
  if (source.orden >= target.orden) {
    return makeInvalidLeaf(
      referenceLabel,
      questionLabel(source),
      rawOptionLabel,
      `La fuente P${source.orden} no es anterior a la pregunta P${target.orden}.`,
    );
  }
  if (!isSelectableSource(source)) {
    return makeInvalidLeaf(
      referenceLabel,
      questionLabel(source),
      rawOptionLabel,
      `La fuente P${source.orden} es ${source.tipo} y no admite opciones seleccionables.`,
    );
  }

  const optionCandidates = (source.opciones ?? []).filter(
    (option) => option.orden === sourceOptionOrder,
  );
  if (optionCandidates.length === 0) {
    return makeInvalidLeaf(
      referenceLabel,
      questionLabel(source),
      rawOptionLabel,
      `No existe la opción de orden ${sourceOptionOrder} en P${source.orden}.`,
    );
  }
  if (optionCandidates.length > 1) {
    return makeInvalidLeaf(
      referenceLabel,
      questionLabel(source),
      rawOptionLabel,
      `La opción de orden ${sourceOptionOrder} es ambigua en P${source.orden}.`,
    );
  }

  return {
    kind: 'leaf',
    referenceLabel,
    sourceLabel: questionLabel(source),
    optionLabel: optionLabel(optionCandidates[0]),
  };
};

const resolveV2Leaf = (
  target: DraftQuestion,
  node: Extract<SurveyConditionalNodeV2, { kind: 'option_selected' }>,
  indexes: LogicIndexes,
): LogicLeafView => {
  const referenceLabel = `${node.question_ref} / ${node.option_ref}`;
  const rawSourceLabel = `Pregunta ${node.question_ref}`;
  const rawOptionLabel = `Opción ${node.option_ref}`;
  const sourceCandidates = indexes.byRef.get(node.question_ref) ?? [];

  if (sourceCandidates.length === 0) {
    return makeInvalidLeaf(
      referenceLabel,
      rawSourceLabel,
      rawOptionLabel,
      `No existe la pregunta fuente con ref ${node.question_ref}.`,
    );
  }
  if (sourceCandidates.length > 1) {
    return makeInvalidLeaf(
      referenceLabel,
      rawSourceLabel,
      rawOptionLabel,
      `La ref ${node.question_ref} es ambigua: coincide con ${sourceCandidates.length} preguntas.`,
    );
  }

  const source = sourceCandidates[0];
  if (source.orden >= target.orden) {
    return makeInvalidLeaf(
      referenceLabel,
      questionLabel(source),
      rawOptionLabel,
      `La fuente P${source.orden} no es anterior a la pregunta P${target.orden}.`,
    );
  }
  if (!isSelectableSource(source)) {
    return makeInvalidLeaf(
      referenceLabel,
      questionLabel(source),
      rawOptionLabel,
      `La fuente P${source.orden} es ${source.tipo} y no admite opciones seleccionables.`,
    );
  }

  const optionCandidates = (source.opciones ?? []).filter(
    (option) => option.option_ref === node.option_ref,
  );
  if (optionCandidates.length === 0) {
    return makeInvalidLeaf(
      referenceLabel,
      questionLabel(source),
      rawOptionLabel,
      `No existe la opción con ref ${node.option_ref} en P${source.orden}.`,
    );
  }
  if (optionCandidates.length > 1) {
    return makeInvalidLeaf(
      referenceLabel,
      questionLabel(source),
      rawOptionLabel,
      `La ref de opción ${node.option_ref} es ambigua en P${source.orden}.`,
    );
  }

  return {
    kind: 'leaf',
    referenceLabel,
    sourceLabel: questionLabel(source),
    optionLabel: optionLabel(optionCandidates[0]),
  };
};

const resolveV2Expression = (
  target: DraftQuestion,
  node: SurveyConditionalNodeV2,
  indexes: LogicIndexes,
): LogicExpressionView => {
  if (node.kind === 'option_selected') return resolveV2Leaf(target, node, indexes);
  return {
    kind: 'group',
    operator: node.operator,
    children: node.children.map((child) => resolveV2Expression(target, child, indexes)),
  };
};

const collectIssues = (expression: LogicExpressionView): string[] => {
  if (expression.kind === 'leaf') return expression.issue ? [expression.issue] : [];
  return expression.children.flatMap(collectIssues);
};

const buildLogicMap = (questions: SurveyDraftPayload['preguntas']): LogicQuestionView[] => {
  const indexes: LogicIndexes = {
    byOrder: new Map<number, DraftQuestion[]>(),
    byRef: new Map<string, DraftQuestion[]>(),
  };

  questions.forEach((question) => {
    const sameOrder = indexes.byOrder.get(question.orden) ?? [];
    sameOrder.push(question);
    indexes.byOrder.set(question.orden, sameOrder);

    if (typeof question.question_ref === 'string') {
      const sameRef = indexes.byRef.get(question.question_ref) ?? [];
      sameRef.push(question);
      indexes.byRef.set(question.question_ref, sameRef);
    }
  });

  return questions
    .map((question, originalIndex) => ({ question, originalIndex }))
    .sort((left, right) => left.question.orden - right.question.orden || left.originalIndex - right.originalIndex)
    .map(({ question, originalIndex }) => {
      const rawLogic = question.conditional_logic;
      const key = `${question.question_ref ?? question.id ?? 'question'}:${question.orden}:${originalIndex}`;
      if (rawLogic === undefined || rawLogic === null) {
        return { key, question, logicVersion: null, issues: [] };
      }

      const parsed = parseSurveyConditionalLogic(rawLogic);
      if (!parsed) {
        return {
          key,
          question,
          logicVersion: null,
          issues: ['La estructura de conditional_logic es inválida.'],
        };
      }

      const expression = parsed.version === 1
        ? resolveV1Leaf(
            question,
            parsed.show_if.question_order,
            parsed.show_if.option_order,
            indexes,
          )
        : resolveV2Expression(question, parsed.show_if, indexes);
      return {
        key,
        question,
        logicVersion: parsed.version,
        expression,
        issues: [...new Set(collectIssues(expression))],
      };
    });
};

const LogicLeaf = ({ leaf }: { leaf: LogicLeafView }) => (
  <li
    className={cn(
      'rounded-lg border px-3 py-2 text-sm',
      leaf.issue
        ? 'border-destructive/40 bg-destructive/5'
        : 'border-border/70 bg-background',
    )}
  >
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium text-foreground">{leaf.sourceLabel}</span>
      <span aria-hidden="true" className="text-muted-foreground">→</span>
      <span className="sr-only">con respuesta</span>
      <span className="font-medium text-primary">{leaf.optionLabel}</span>
    </div>
    <p className="mt-1 break-all text-[11px] text-muted-foreground">Referencia: {leaf.referenceLabel}</p>
    {leaf.issue ? <p className="mt-1 text-xs font-medium text-destructive">{leaf.issue}</p> : null}
  </li>
);

const LogicExpression = ({ expression }: { expression: LogicExpressionView }) => {
  if (expression.kind === 'leaf') return <LogicLeaf leaf={expression} />;

  const operatorLabel = expression.operator === 'and' ? 'Todas (AND)' : 'Cualquiera (OR)';
  return (
    <li className="rounded-lg border border-border/70 bg-muted/20 p-2 sm:p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        {operatorLabel}
      </p>
      <ul
        className="space-y-2 border-l-2 border-primary/25 pl-2 sm:pl-3"
        aria-label={`Condiciones del grupo ${operatorLabel}`}
      >
        {expression.children.map((child, index) => (
          <LogicExpression
            key={`${child.kind}:${index}`}
            expression={child}
          />
        ))}
      </ul>
    </li>
  );
};

export const SurveyLogicMap = ({ questions, className }: SurveyLogicMapProps) => {
  const nodes = useMemo(() => buildLogicMap(questions), [questions]);
  const headingId = useId();

  return (
    <section
      className={cn('space-y-4 rounded-xl border border-border bg-card p-3 sm:p-4', className)}
      aria-labelledby={headingId}
    >
      <div className="space-y-1">
        <h2 id={headingId} className="text-lg font-semibold">
          Mapa de lógica
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada nodo explica cuándo entra una pregunta en la ruta de participación.
        </p>
      </div>

      {nodes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No hay preguntas para representar.
        </p>
      ) : (
        <ol className="space-y-3" aria-label="Preguntas y reglas de visibilidad">
          {nodes.map((node) => {
            const isRoot = node.logicVersion === null && node.issues.length === 0;
            return (
              <li
                key={node.key}
                className={cn(
                  'rounded-xl border p-3 sm:p-4',
                  node.issues.length
                    ? 'border-destructive/50 bg-destructive/[0.03]'
                    : 'border-border/80 bg-background',
                )}
                data-logic-status={node.issues.length ? 'invalid' : isRoot ? 'root' : 'valid'}
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pregunta {node.question.orden}
                    </p>
                    <h3 className="font-medium text-foreground">
                      {node.question.texto.trim() || 'Pregunta sin texto'}
                    </h3>
                  </div>
                  <span
                    className={cn(
                      'mt-1 w-fit rounded-full px-2.5 py-1 text-xs font-semibold sm:mt-0',
                      isRoot
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                        : node.issues.length
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary',
                    )}
                  >
                    {isRoot ? 'Siempre visible' : node.logicVersion ? `Lógica v${node.logicVersion}` : 'Regla inválida'}
                  </span>
                </div>

                {node.logicVersion === 1 ? (
                  <p className="mt-3 text-xs font-medium text-muted-foreground">Arista v1 por orden</p>
                ) : null}
                {node.logicVersion === 2 ? (
                  <p className="mt-3 text-xs font-medium text-muted-foreground">Árbol v2 por referencias</p>
                ) : null}
                {node.expression ? (
                  <ul className="mt-2 space-y-2" aria-label={`Lógica de la pregunta ${node.question.orden}`}>
                    <LogicExpression expression={node.expression} />
                  </ul>
                ) : null}

                {node.issues.length ? (
                  <div
                    className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
                    role="alert"
                  >
                    <p className="font-semibold">Regla bloqueada (fail-closed)</p>
                    <p className="mt-1">La pregunta se mantendrá oculta hasta corregir la lógica.</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {node.issues.map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export default SurveyLogicMap;
