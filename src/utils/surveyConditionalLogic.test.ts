import { describe, expect, it } from 'vitest';

import type {
  SurveyConditionalGroupV2,
  SurveyConditionalLogicV2,
  SurveyConditionalNodeV2,
  SurveyPregunta,
} from '@/types/encuestas';
import { getVisibleSurveyQuestions, parseSurveyConditionalLogic } from './surveyConditionalLogic';

const questions: SurveyPregunta[] = [
  {
    id: 10,
    orden: 1,
    tipo: 'opcion_unica',
    texto: 'Canal',
    obligatoria: true,
    opciones: [
      { id: 101, orden: 1, texto: 'Web' },
      { id: 102, orden: 2, texto: 'WhatsApp' },
    ],
  },
  {
    id: 20,
    orden: 2,
    tipo: 'opcion_unica',
    texto: 'Experiencia WhatsApp',
    obligatoria: true,
    conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 2 } },
    opciones: [
      { id: 201, orden: 1, texto: 'Buena' },
      { id: 202, orden: 2, texto: 'Mala' },
    ],
  },
  {
    id: 30,
    orden: 3,
    tipo: 'abierta',
    texto: 'Contanos el problema',
    obligatoria: true,
    conditional_logic: { version: 1, show_if: { question_order: 2, option_order: 2 } },
  },
];

describe('survey conditional logic v1', () => {
  it('keeps the exact v1 contract unchanged', () => {
    expect(parseSurveyConditionalLogic({
      version: 1,
      show_if: { question_order: 1, option_order: 2 },
    })).toEqual({
      version: 1,
      show_if: { question_order: 1, option_order: 2 },
    });
  });

  it('reveals a matching branch and cascades through visible dependencies', () => {
    expect(getVisibleSurveyQuestions(questions, {})).toEqual([questions[0]]);
    expect(getVisibleSurveyQuestions(questions, { 10: { opcionIds: [102] } })).toEqual(questions.slice(0, 2));
    expect(
      getVisibleSurveyQuestions(questions, {
        10: { opcionIds: ['102'] },
        20: { opcionIds: [202] },
      }),
    ).toEqual(questions);
  });

  it('hides descendants when their parent branch becomes invisible even with stale answers', () => {
    expect(
      getVisibleSurveyQuestions(questions, {
        10: { opcionIds: [101] },
        20: { opcionIds: [202] },
      }),
    ).toEqual([questions[0]]);
  });

  it.each([
    undefined,
    {},
    { version: 2, show_if: { question_order: 1, option_order: 2 } },
    { version: 1, show_if: { question_order: 0, option_order: 2 } },
    { version: 1, show_if: { question_order: 1, option_order: '2' } },
    { version: 1, show_if: { question_order: 1, option_order: 2 }, negate: true },
    { version: 1, show_if: { question_order: 1, option_order: 2, negate: true } },
  ])('rejects malformed logic safely (%j)', (value) => {
    expect(parseSurveyConditionalLogic(value)).toBeNull();
  });

  it('treats malformed local option arrays as unanswered instead of crashing', () => {
    expect(
      getVisibleSurveyQuestions(questions, {
        10: { opcionIds: '102' as unknown as number[] },
      }),
    ).toEqual([questions[0]]);
  });

  it('fails closed for invalid references and duplicate order identities', () => {
    const malformed: SurveyPregunta[] = [
      questions[0],
      { ...questions[0], id: 11 },
      {
        ...questions[1],
        conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 99 } },
      },
    ];

    expect(getVisibleSurveyQuestions(malformed, { 10: { opcionIds: [102] } })).toEqual(malformed.slice(0, 2));
  });

  it('rejects a rating source even when it has options and a matching answer', () => {
    const ratingSource: SurveyPregunta[] = [
      { ...questions[0], tipo: 'rating_emoji' },
      questions[1],
    ];

    expect(getVisibleSurveyQuestions(ratingSource, { 10: { opcionIds: [102] } })).toEqual([ratingSource[0]]);
  });
});

const optionSelected = (questionRef: string, optionRef: string) => ({
  kind: 'option_selected' as const,
  question_ref: questionRef,
  option_ref: optionRef,
});

const group = (
  operator: 'and' | 'or',
  children: SurveyConditionalNodeV2[],
): SurveyConditionalGroupV2 => ({
  kind: 'group' as const,
  operator,
  children,
});

const v2Questions: SurveyPregunta[] = [
  {
    id: 100,
    question_ref: 'question:channel',
    orden: 1,
    tipo: 'opcion_unica',
    texto: 'Canal',
    obligatoria: true,
    opciones: [
      { id: 1001, option_ref: 'option:web', orden: 1, texto: 'Web' },
      { id: 1002, option_ref: 'option:whatsapp', orden: 2, texto: 'WhatsApp' },
    ],
  },
  {
    id: 200,
    question_ref: 'question:device',
    orden: 2,
    tipo: 'multiple',
    texto: 'Dispositivo',
    obligatoria: true,
    opciones: [
      { id: '2001', option_ref: 'option:desktop', orden: 1, texto: 'Desktop' },
      { id: '2002', option_ref: 'option:mobile', orden: 2, texto: 'Mobile' },
    ],
  },
  {
    id: 300,
    question_ref: 'question:detail',
    orden: 3,
    tipo: 'abierta',
    texto: 'Detalle',
    obligatoria: false,
    conditional_logic: {
      version: 2,
      show_if: group('and', [
        optionSelected('question:channel', 'option:whatsapp'),
        optionSelected('question:device', 'option:mobile'),
      ]),
    },
  },
];

describe('survey conditional logic v2 parser', () => {
  it('accepts and clones exact nested AND/OR expressions at the depth boundary', () => {
    const value: SurveyConditionalLogicV2 = {
      version: 2,
      show_if: group('and', [
        optionSelected('question:channel', 'option:web'),
        group('or', [
          group('and', [optionSelected('question:device', 'option:mobile')]),
        ]),
      ]),
    };

    const parsed = parseSurveyConditionalLogic(value);

    expect(parsed).toEqual(value);
    expect(parsed).not.toBe(value);
    expect(parsed?.show_if).not.toBe(value.show_if);
  });

  it.each([
    { version: 2, show_if: optionSelected('question:channel', 'option:web'), extra: true },
    { version: 2, show_if: optionSelected('question:channel', 'option:web') },
    { version: 2, show_if: { ...optionSelected('question:channel', 'option:web'), extra: true } },
    { version: 2, show_if: { kind: 'option_selected', question_ref: '', option_ref: 'option:web' } },
    { version: 2, show_if: { kind: 'option_selected', question_ref: 'question with spaces', option_ref: 'option:web' } },
    { version: 2, show_if: { kind: 'group', operator: 'xor', children: [optionSelected('q:1', 'o:1')] } },
    { version: 2, show_if: group('and', []) },
    { version: 2, show_if: group('or', Array.from({ length: 17 }, (_, index) => optionSelected(`q:${index}`, `o:${index}`))) },
  ])('rejects non-exact nodes and invalid group bounds safely (%j)', (value) => {
    expect(parseSurveyConditionalLogic(value)).toBeNull();
  });

  it('enforces canonical reference length and accepts the 160-character boundary', () => {
    const maxRef = `q${'a'.repeat(159)}`;
    const tooLongRef = `q${'a'.repeat(160)}`;

    expect(parseSurveyConditionalLogic({
      version: 2,
      show_if: group('and', [optionSelected(maxRef, 'option:one')]),
    })).not.toBeNull();
    expect(parseSurveyConditionalLogic({
      version: 2,
      show_if: group('and', [optionSelected(tooLongRef, 'option:one')]),
    })).toBeNull();
  });

  it('rejects an exact duplicate leaf anywhere in the tree', () => {
    expect(parseSurveyConditionalLogic({
      version: 2,
      show_if: group('or', [
        optionSelected('question:channel', 'option:web'),
        group('and', [optionSelected('question:channel', 'option:web')]),
      ]),
    })).toBeNull();
  });

  it('enforces depth, leaf and total-node budgets independently', () => {
    const depthFive = group('and', [
      group('and', [
        group('and', [
          group('and', [optionSelected('q:deep', 'o:deep')]),
        ]),
      ]),
    ]);
    const thirtyThreeLeaves = group('and', Array.from({ length: 3 }, (_, branch) =>
      group('or', Array.from({ length: 11 }, (_, leaf) =>
        optionSelected(`q:leaf-${branch}-${leaf}`, `o:leaf-${branch}-${leaf}`))),
    ));
    // 1 root + 16 level-two groups + 16 level-three groups + 32 leaves = 65 nodes.
    const sixtyFiveNodes = group('and', Array.from({ length: 16 }, (_, branch) =>
      group('and', [
        group('or', [
          optionSelected(`q:node-${branch}-a`, `o:node-${branch}-a`),
          optionSelected(`q:node-${branch}-b`, `o:node-${branch}-b`),
        ]),
      ]),
    ));

    expect(parseSurveyConditionalLogic({ version: 2, show_if: depthFive })).toBeNull();
    expect(parseSurveyConditionalLogic({ version: 2, show_if: thirtyThreeLeaves })).toBeNull();
    expect(parseSurveyConditionalLogic({ version: 2, show_if: sixtyFiveNodes })).toBeNull();
  });
});

describe('survey conditional logic v2 visibility', () => {
  it('evaluates AND and accepts string/number option IDs without changing input order', () => {
    expect(getVisibleSurveyQuestions(v2Questions, {})).toEqual(v2Questions.slice(0, 2));
    expect(getVisibleSurveyQuestions(v2Questions, {
      100: { opcionIds: [1002] },
      200: { opcion_ids: [2002] },
    })).toEqual(v2Questions);

    const unsorted = [v2Questions[2], v2Questions[0], v2Questions[1]];
    expect(getVisibleSurveyQuestions(unsorted, {
      100: { opcionIds: ['1002'] },
      200: { opcionIds: [2002] },
    })).toEqual(unsorted);
  });

  it('evaluates OR and nested groups', () => {
    const target = {
      ...v2Questions[2],
      conditional_logic: {
        version: 2 as const,
        show_if: group('or', [
          optionSelected('question:channel', 'option:web'),
          group('and', [
            optionSelected('question:channel', 'option:whatsapp'),
            optionSelected('question:device', 'option:mobile'),
          ]),
        ]),
      },
    };
    const instrument = [...v2Questions.slice(0, 2), target];

    expect(getVisibleSurveyQuestions(instrument, { 100: { opcionIds: [1001] } })).toEqual(instrument);
    expect(getVisibleSurveyQuestions(instrument, {
      100: { opcionIds: [1002] },
      200: { opcionIds: ['2002'] },
    })).toEqual(instrument);
    expect(getVisibleSurveyQuestions(instrument, { 100: { opcionIds: [1002] } })).toEqual(instrument.slice(0, 2));
  });

  it('treats a hidden source as false even when a stale answer remains', () => {
    const conditionalSource: SurveyPregunta = {
      ...v2Questions[1],
      conditional_logic: {
        version: 2,
        show_if: group('and', [optionSelected('question:channel', 'option:whatsapp')]),
      },
    };
    const descendant: SurveyPregunta = {
      ...v2Questions[2],
      conditional_logic: {
        version: 2,
        show_if: group('and', [optionSelected('question:device', 'option:mobile')]),
      },
    };
    const instrument = [v2Questions[0], conditionalSource, descendant];

    expect(getVisibleSurveyQuestions(instrument, {
      100: { opcionIds: [1001] },
      200: { opcionIds: [2002] },
    })).toEqual([v2Questions[0]]);
  });

  it('fails the whole expression closed when one OR sibling has an invalid reference', () => {
    const target: SurveyPregunta = {
      ...v2Questions[2],
      conditional_logic: {
        version: 2,
        show_if: group('or', [
          optionSelected('question:channel', 'option:web'),
          optionSelected('question:missing', 'option:missing'),
        ]),
      },
    };
    const instrument = [...v2Questions.slice(0, 2), target];

    expect(getVisibleSurveyQuestions(instrument, { 100: { opcionIds: [1001] } })).toEqual(instrument.slice(0, 2));
  });

  it('fails closed for duplicate question refs and duplicate option refs', () => {
    const duplicateSource: SurveyPregunta = {
      ...v2Questions[0],
      id: 101,
      orden: 2,
    };
    const targetAfterDuplicate: SurveyPregunta = {
      ...v2Questions[2],
      orden: 4,
      conditional_logic: {
        version: 2,
        show_if: group('and', [optionSelected('question:channel', 'option:web')]),
      },
    };
    expect(getVisibleSurveyQuestions(
      [v2Questions[0], duplicateSource, targetAfterDuplicate],
      { 100: { opcionIds: [1001] } },
    )).toEqual([v2Questions[0], duplicateSource]);

    const sourceWithDuplicateOption: SurveyPregunta = {
      ...v2Questions[0],
      opciones: [
        ...(v2Questions[0].opciones ?? []),
        { id: 1003, option_ref: 'option:web', orden: 3, texto: 'Web duplicada' },
      ],
    };
    expect(getVisibleSurveyQuestions(
      [sourceWithDuplicateOption, v2Questions[2]],
      { 100: { opcionIds: [1001] } },
    )).toEqual([sourceWithDuplicateOption]);
  });

  it.each([
    {
      name: 'forward reference',
      source: { ...v2Questions[0], orden: 4 },
      target: v2Questions[2],
    },
    {
      name: 'same-order reference',
      source: { ...v2Questions[0], orden: 3 },
      target: v2Questions[2],
    },
    {
      name: 'non-selectable source',
      source: { ...v2Questions[0], tipo: 'abierta' as const },
      target: v2Questions[2],
    },
  ])('rejects $name', ({ source, target }) => {
    const directTarget: SurveyPregunta = {
      ...target,
      conditional_logic: {
        version: 2,
        show_if: group('and', [optionSelected('question:channel', 'option:whatsapp')]),
      },
    };
    expect(getVisibleSurveyQuestions(
      [source, directTarget],
      { 100: { opcionIds: [1002] } },
    )).toEqual([source]);
  });
});
