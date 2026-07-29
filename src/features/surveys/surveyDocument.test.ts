import { describe, expect, it } from 'vitest';

import type { SurveyDraftPayload } from '@/types/encuestas';

import {
  SURVEY_DOCUMENT_SCHEMA_VERSION,
  SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
  SurveyDocumentError,
  adminPayloadToSurveyDocument,
  assertSurveyDocumentV1,
  assertSurveyDocumentV2,
  downgradeSurveyConditionalLogicV2ToV1,
  durableBuilderDraftToSurveyDocument,
  surveyDocumentToAdminPayload,
  surveyDocumentToDurableBuilderDraft,
} from './surveyDocument';
import type { SurveyDocumentV2 } from './surveyDocument';
import type { SurveyDraftSaveInput } from './surveyTypes';

describe('survey-document.v1 canonical adapters', () => {
  it('round-trips the complete admin payload and unknown extensions without loss', () => {
    const admin = {
      document_ref: 'survey:municipio:prioridades-2027',
      expected_structure_revision: 7,
      titulo: 'Prioridades 2027',
      slug: 'prioridades-2027',
      descripcion: 'Golden fixture',
      tipo: 'votacion',
      inicio_at: '2026-08-01T10:00:00Z',
      fin_at: null,
      politica_unicidad: 'por_dni',
      anonimato: false,
      requiere_datos_contacto: true,
      preguntas: [
        {
          question_ref: 'question-priority-axis',
          id: 101,
          orden: 10,
          tipo: 'opcion_unica',
          texto: 'Elegi un eje',
          obligatoria: true,
          min_selecciones: 1,
          max_selecciones: 1,
          opciones: [
            { option_ref: 'option-mobility', id: 1001, orden: 5, texto: 'Movilidad', valor: 'mobility', color: '#123456' },
            { option_ref: 'option-health', id: 'legacy-1002', orden: 9, texto: 'Salud', valor: 'health' },
          ],
          analytics_key: 'priority_axis',
        },
        {
          question_ref: 'question-reason',
          orden: 20,
          tipo: 'abierta',
          texto: 'Contanos por que',
          obligatoria: false,
          conditional_logic: { version: 1, show_if: { question_order: 10, option_order: 9 } },
          moderation: { enabled: true },
        },
      ],
      es_votacion_envivo: true,
      mostrar_resultados_envivo: true,
      permitir_comentarios: false,
      puntos_recompensa: 12,
      future_root: { owner: 'participacion' },
    } satisfies SurveyDraftPayload & Record<string, unknown>;

    const document = adminPayloadToSurveyDocument(admin);

    expect(document).toMatchObject({
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      document_ref: 'survey:municipio:prioridades-2027',
      revision: 7,
      policies: { uniqueness: 'por_dni', anonymous: false, requires_contact_data: true },
      experience: { live_voting: true, show_live_results: true, allow_comments: false, reward_points: 12 },
    });
    expect(document.questions[0].question_ref).toBe('question-priority-axis');
    expect(document.questions[0].options[0].option_ref).toBe('option-mobility');
    expect(document.questions[1].question_ref).toBe('question-reason');
    expect(document.questions[1].visibility).toEqual({
      kind: 'option_selected',
      question_ref: 'question-priority-axis',
      option_ref: 'option-health',
    });
    expect(surveyDocumentToAdminPayload(document)).toEqual(admin);
  });

  it('uses durable local IDs as stable refs and round-trips unknown fields exactly', () => {
    const durable = {
      draft_id: 'draft-golden',
      idempotency_key: 'save-golden-1',
      revision: 4,
      schema_version: 'survey-builder.v2',
      title: 'Draft durable',
      description: '',
      questions: [
        {
          id: 'q-local-1',
          title: 'Canal',
          type: 'multi',
          required: true,
          min_selections: 1,
          max_selections: 2,
          options: [
            { id: 'o-local-1', label: 'Web', value: 'web', score: 3 },
            { id: 'o-local-2', label: 'WhatsApp', value: 2 },
          ],
          ui: { collapsed: false },
        },
        {
          id: 'q-local-2',
          title: 'Detalle',
          type: 'text',
          conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 2 } },
        },
      ],
      workspace_hint: 'municipal',
    } satisfies SurveyDraftSaveInput;

    const document = durableBuilderDraftToSurveyDocument(durable);

    expect(document.document_ref).toBe('draft-golden');
    expect(document.questions[0].question_ref).toBe('q-local-1');
    expect(document.questions[0].options.map((option) => option.option_ref)).toEqual(['o-local-1', 'o-local-2']);
    expect(document.questions[1].visibility).toEqual({
      kind: 'option_selected',
      question_ref: 'q-local-1',
      option_ref: 'o-local-2',
    });
    expect(surveyDocumentToDurableBuilderDraft(document)).toEqual(durable);
  });

  it('resolves conditional references by numeric order even when the array is unsorted', () => {
    const admin: SurveyDraftPayload = {
      document_ref: 'survey:admin:new',
      titulo: 'Orden semantico',
      tipo: 'opinion',
      politica_unicidad: 'libre',
      anonimato: true,
      requiere_datos_contacto: false,
      preguntas: [
        {
          question_ref: 'q-target',
          orden: 20,
          tipo: 'abierta',
          texto: 'Detalle',
          obligatoria: false,
          conditional_logic: { version: 1, show_if: { question_order: 10, option_order: 5 } },
        },
        {
          question_ref: 'q-source',
          orden: 10,
          tipo: 'opcion_unica',
          texto: 'Canal',
          obligatoria: true,
          opciones: [{ option_ref: 'o-source', orden: 5, texto: 'Web', valor: 'web' }],
        },
      ],
    };

    const document = adminPayloadToSurveyDocument(admin);

    expect(document.questions[0].visibility).toEqual({
      kind: 'option_selected',
      question_ref: 'q-source',
      option_ref: 'o-source',
    });
    expect(surveyDocumentToAdminPayload(document)).toEqual(admin);
  });

  it.each(['nps', 'ranking', 'location'] as const)(
    'quarantines %s without silently converting it and blocks admin materialization',
    (type) => {
      const durable: SurveyDraftSaveInput = {
        draft_id: `draft-${type}`,
        title: type,
        questions: [{ id: `q-${type}`, title: type, type, custom_scale: [0, 10] }],
      };

      const document = durableBuilderDraftToSurveyDocument(durable);

      expect(document.questions[0]).toMatchObject({
        type: 'quarantined',
        quarantine: { source_type: type, materializable: false },
      });
      expect(surveyDocumentToDurableBuilderDraft(document)).toEqual(durable);
      expect(() => surveyDocumentToAdminPayload(document)).toThrowError(
        expect.objectContaining<Partial<SurveyDocumentError>>({ code: 'quarantined_question' }),
      );
    },
  );

  it('fails closed on duplicate durable references', () => {
    expect(() =>
      durableBuilderDraftToSurveyDocument({
        title: 'Refs duplicadas',
        questions: [
          { id: 'same-id', title: 'A', type: 'text' },
          { id: 'same-id', title: 'B', type: 'text' },
        ],
      }),
    ).toThrowError(expect.objectContaining<Partial<SurveyDocumentError>>({ code: 'duplicate_reference' }));
  });

  it('allows the same option_ref in different questions because option identity is question-scoped', () => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft-scoped-options',
      title: 'Refs scoped',
      questions: [
        { id: 'q-a', title: 'A', type: 'single', options: [{ id: 'shared-option', label: 'Si' }] },
        { id: 'q-b', title: 'B', type: 'single', options: [{ id: 'shared-option', label: 'Tambien' }] },
      ],
    });

    expect(document.questions[0].options[0].option_ref).toBe('shared-option');
    expect(document.questions[1].options[0].option_ref).toBe('shared-option');
  });

  it('merges a durable edit by refs without losing persisted IDs or admin provenance', () => {
    const base = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft-merge',
      title: 'Base',
      questions: [{ id: 'q-1', title: 'Pregunta', type: 'single', options: [{ id: 'o-1', label: 'Antes' }] }],
    });
    base.questions[0].persisted_id = 70;
    base.questions[0].options[0].persisted_id = 700;
    base.questions[0].options[0].extensions.admin = {
      present_fields: ['id', 'option_ref'],
      unknown_fields: { color: 'azul' },
    };

    const merged = durableBuilderDraftToSurveyDocument(
      {
        draft_id: 'draft-merge',
        revision: 2,
        title: 'Editada',
        questions: [{ id: 'q-1', title: 'Pregunta editada', type: 'single', options: [{ id: 'o-1', label: 'Despues' }] }],
      },
      { baseDocument: base },
    );

    expect(merged.questions[0].persisted_id).toBe(70);
    expect(merged.questions[0].options[0]).toMatchObject({
      persisted_id: 700,
      label: 'Despues',
      extensions: { admin: { unknown_fields: { color: 'azul' } } },
    });
  });

  it('deep-merges durable root provenance while rotating transport controls', () => {
    const base = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft-root-provenance',
      idempotency_key: 'save-original',
      revision: 1,
      title: 'Base',
      questions: [{ id: 'q-1', title: 'Detalle', type: 'text' }],
      workspace_hint: 'municipal',
    });

    const merged = durableBuilderDraftToSurveyDocument(
      {
        draft_id: 'draft-root-provenance',
        idempotency_key: 'save-rotated',
        revision: 1,
        document: base,
        title: 'Editada',
        questions: [{ id: 'q-1', title: 'Detalle', type: 'text' }],
      },
      { baseDocument: base },
    );

    expect(merged.extensions.durable_builder).toMatchObject({
      unknown_fields: { workspace_hint: 'municipal' },
      source_values: { draft_id: 'draft-root-provenance', idempotency_key: 'save-rotated' },
    });
    expect(surveyDocumentToDurableBuilderDraft(merged)).toMatchObject({ workspace_hint: 'municipal' });
  });

  it('quarantines partially incomplete option work without dropping the draft values', () => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft-partial-option',
      title: 'Trabajo en curso',
      questions: [{
        id: 'q-1',
        title: 'Canal',
        type: 'single',
        options: [
          { id: 'o-1', label: 'Web', value: 'web' },
          { id: 'o-2', label: '', value: '' },
        ],
      }],
    });

    expect(document.questions[0]).toMatchObject({
      type: 'quarantined',
      quarantine: { reason: 'invalid_materialization_shape', source_type: 'single' },
      options: [{ label: 'Web', value: 'web' }, { label: '', value: '' }],
    });
    expect(surveyDocumentToDurableBuilderDraft(document).questions[0].options).toEqual([
      { id: 'o-1', label: 'Web', value: 'web' },
      { id: 'o-2', label: '', value: '' },
    ]);
  });

  it.each([
    ['unknown type', (document: ReturnType<typeof durableBuilderDraftToSurveyDocument>) => {
      document.questions[0].type = 'future_type' as never;
    }],
    ['invalid selection', (document: ReturnType<typeof durableBuilderDraftToSurveyDocument>) => {
      document.questions[0].selection.min = -1;
    }],
    ['null option', (document: ReturnType<typeof durableBuilderDraftToSurveyDocument>) => {
      document.questions[0].options = [null as never];
    }],
    ['whitespace-coerced ref', (document: ReturnType<typeof durableBuilderDraftToSurveyDocument>) => {
      document.questions[0].question_ref = ' q-1 ';
    }],
    ['unknown root field', (document: ReturnType<typeof durableBuilderDraftToSurveyDocument>) => {
      (document as unknown as Record<string, unknown>).future_root = true;
    }],
    ['unknown question field', (document: ReturnType<typeof durableBuilderDraftToSurveyDocument>) => {
      (document.questions[0] as unknown as Record<string, unknown>).future_question = true;
    }],
    ['unknown option field', (document: ReturnType<typeof durableBuilderDraftToSurveyDocument>) => {
      (document.questions[0].options[0] as unknown as Record<string, unknown>).future_option = true;
    }],
    ['malformed reserved extension', (document: ReturnType<typeof durableBuilderDraftToSurveyDocument>) => {
      document.extensions.durable_builder = {} as never;
    }],
  ] as const)('rejects adversarial canonical documents: %s', (_label, corrupt) => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft-adversarial',
      title: 'Adversarial',
      questions: [{ id: 'q-1', title: 'Q', type: 'single', options: [{ id: 'o-1', label: 'O' }] }],
    });
    corrupt(document);

    expect(() => assertSurveyDocumentV1(document)).toThrowError(
      expect.objectContaining<Partial<SurveyDocumentError>>({ code: 'invalid_document' }),
    );
  });

  it('validates the schema version explicitly', () => {
    expect(() => assertSurveyDocumentV1({ schema_version: 'survey-document.v2' })).toThrow(
      /schema_version debe ser survey-document\.v1/i,
    );
  });
});

describe('survey-document.v2 canonical adapters', () => {
  it('round-trips a nested v2 expression through the admin adapter without changing the tree', () => {
    const conditionalLogic = {
      version: 2 as const,
      show_if: {
        kind: 'group' as const,
        operator: 'and' as const,
        children: [
          { kind: 'option_selected' as const, question_ref: 'q-channel', option_ref: 'o-web' },
          {
            kind: 'group' as const,
            operator: 'or' as const,
            children: [
              { kind: 'option_selected' as const, question_ref: 'q-region', option_ref: 'o-north' },
              { kind: 'option_selected' as const, question_ref: 'q-region', option_ref: 'o-south' },
            ],
          },
        ],
      },
    };
    const admin: SurveyDraftPayload = {
      document_ref: 'survey:v2:nested',
      titulo: 'Rutas anidadas',
      tipo: 'opinion',
      politica_unicidad: 'libre',
      anonimato: true,
      requiere_datos_contacto: false,
      preguntas: [
        {
          question_ref: 'q-channel',
          orden: 1,
          tipo: 'opcion_unica',
          texto: 'Canal',
          obligatoria: true,
          opciones: [{ option_ref: 'o-web', orden: 1, texto: 'Web' }],
        },
        {
          question_ref: 'q-region',
          orden: 2,
          tipo: 'multiple',
          texto: 'Region',
          obligatoria: true,
          opciones: [
            { option_ref: 'o-north', orden: 1, texto: 'Norte' },
            { option_ref: 'o-south', orden: 2, texto: 'Sur' },
          ],
        },
        {
          question_ref: 'q-detail',
          orden: 3,
          tipo: 'abierta',
          texto: 'Detalle',
          obligatoria: false,
          conditional_logic: conditionalLogic,
        },
      ],
    };

    const document = adminPayloadToSurveyDocument(admin);

    expect(document.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
    expect(document.questions[2].visibility).toEqual({ version: 2, root: conditionalLogic.show_if });
    expect(surveyDocumentToAdminPayload(document)).toEqual({
      ...admin,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
    });
  });

  it('preserves an explicit v2 admin projection even when every visibility is null', () => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'survey:v2:no-visibility',
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      title: 'V2 sin condiciones',
      questions: [{ id: 'q-text', title: 'Detalle', type: 'text' }],
    });

    const admin = surveyDocumentToAdminPayload(document) as SurveyDraftPayload & { schema_version?: string };
    const restored = adminPayloadToSurveyDocument(admin);

    expect(admin.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
    expect(restored.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
    expect(restored.questions[0].visibility).toBeNull();
  });

  it('rejects an unknown canonical schema marker in the admin projection', () => {
    const admin = {
      schema_version: 'survey-document.v3',
      titulo: 'Futura',
      tipo: 'opinion',
      politica_unicidad: 'libre',
      anonimato: true,
      requiere_datos_contacto: false,
      preguntas: [],
    } as SurveyDraftPayload & Record<string, unknown>;

    expect(() => adminPayloadToSurveyDocument(admin)).toThrowError(
      expect.objectContaining<Partial<SurveyDocumentError>>({ code: 'invalid_document' }),
    );
  });

  it('upgrades every v1 rule to a single-leaf AND root when one question requires v2', () => {
    const durable: SurveyDraftSaveInput = {
      draft_id: 'draft:mixed-v2',
      title: 'Mixta',
      questions: [
        {
          id: 'q-source',
          title: 'Canal',
          type: 'single',
          options: [{ id: 'o-web', label: 'Web' }, { id: 'o-store', label: 'Local' }],
        },
        {
          id: 'q-v2',
          title: 'Detalle v2',
          type: 'text',
          conditional_logic: {
            version: 2,
            show_if: {
              kind: 'group',
              operator: 'or',
              children: [
                { kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-web' },
                { kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-store' },
              ],
            },
          },
        },
        {
          id: 'q-v1',
          title: 'Detalle v1',
          type: 'text',
          conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 2 } },
        },
      ],
    };

    const document = durableBuilderDraftToSurveyDocument(durable);

    expect(document.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
    expect(document.questions[2].visibility).toEqual({
      version: 2,
      root: {
        kind: 'group',
        operator: 'and',
        children: [{ kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-store' }],
      },
    });
    expect(surveyDocumentToDurableBuilderDraft(document)).toEqual({
      ...durable,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      questions: [
        {
          ...durable.questions[0],
          question_ref: 'q-source',
          options: durable.questions[0].options?.map((option) => ({
            ...option,
            option_ref: option.id,
          })),
        },
        { ...durable.questions[1], question_ref: 'q-v2' },
        {
          ...durable.questions[2],
          question_ref: 'q-v1',
          conditional_logic: {
            version: 2,
            show_if: {
              kind: 'group',
              operator: 'and',
              children: [{ kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-store' }],
            },
          },
        },
      ],
    });
  });

  it('keeps v2 explicit when a v1 base document receives a v2 edit', () => {
    const base = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft:upgrade-base',
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      title: 'Base v1',
      questions: [
        { id: 'q-source', title: 'Canal', type: 'single', options: [{ id: 'o-web', label: 'Web' }] },
        { id: 'q-target', title: 'Detalle', type: 'text' },
      ],
    });
    expect(base.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION);

    const upgraded = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft:upgrade-base',
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      document: base,
      title: 'Base v1',
      questions: [
        { id: 'q-source', title: 'Canal', type: 'single', options: [{ id: 'o-web', label: 'Web' }] },
        {
          id: 'q-target',
          title: 'Detalle',
          type: 'text',
          conditional_logic: {
            version: 2,
            show_if: {
              kind: 'group',
              operator: 'and',
              children: [{ kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-web' }],
            },
          },
        },
      ],
    }, { baseDocument: base });

    expect(upgraded.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
    expect(surveyDocumentToDurableBuilderDraft(upgraded)).toMatchObject({
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      questions: [
        expect.any(Object),
        expect.objectContaining({ conditional_logic: expect.objectContaining({ version: 2 }) }),
      ],
    });
  });

  it('honors an explicit v2 root without conditions and rejects unknown canonical schemas', () => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft:explicit-v2',
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      title: 'V2 explicita',
      questions: [{ id: 'q-text', title: 'Detalle', type: 'text' }],
    });

    expect(document.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
    expect(surveyDocumentToDurableBuilderDraft(document).schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
    expect(() => durableBuilderDraftToSurveyDocument({
      draft_id: 'draft:future',
      schema_version: 'survey-document.v3',
      title: 'Futura',
      questions: [],
    })).toThrowError(expect.objectContaining<Partial<SurveyDocumentError>>({ code: 'invalid_document' }));
  });

  it('only downgrades an explicit v2 tree when it contains exactly one leaf', () => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft:downgrade',
      title: 'Downgrade',
      questions: [
        { id: 'q-source', title: 'Canal', type: 'single', options: [{ id: 'o-web', label: 'Web' }] },
        {
          id: 'q-target',
          title: 'Detalle',
          type: 'text',
          conditional_logic: {
            version: 2,
            show_if: {
              kind: 'group',
              operator: 'and',
              children: [{ kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-web' }],
            },
          },
        },
      ],
    }) as SurveyDocumentV2;
    const singleLeafLogic = surveyDocumentToDurableBuilderDraft(document).questions[1].conditional_logic;

    expect(downgradeSurveyConditionalLogicV2ToV1(singleLeafLogic as never, document.questions, 1)).toEqual({
      version: 1,
      show_if: { question_order: 1, option_order: 1 },
    });

    const multiLeaf = {
      version: 2 as const,
      show_if: {
        kind: 'group' as const,
        operator: 'or' as const,
        children: [
          { kind: 'option_selected' as const, question_ref: 'q-source', option_ref: 'o-web' },
          { kind: 'option_selected' as const, question_ref: 'q-source', option_ref: 'o-other' },
        ],
      },
    };
    expect(() => downgradeSurveyConditionalLogicV2ToV1(multiLeaf, document.questions, 1)).toThrowError(
      expect.objectContaining<Partial<SurveyDocumentError>>({ code: 'lossless_upgrade_required' }),
    );
  });

  it('rejects mutually exclusive single-choice leaves only when both are mandatory through AND', () => {
    const build = (operator: 'and' | 'or') => durableBuilderDraftToSurveyDocument({
      draft_id: `draft:${operator}-single-choice`,
      title: operator,
      questions: [
        {
          id: 'q-source',
          title: 'Canal',
          type: 'single',
          options: [{ id: 'o-web', label: 'Web' }, { id: 'o-phone', label: 'Telefono' }],
        },
        {
          id: 'q-target',
          title: 'Detalle',
          type: 'text',
          conditional_logic: {
            version: 2,
            show_if: {
              kind: 'group',
              operator,
              children: [
                { kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-web' },
                { kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-phone' },
              ],
            },
          },
        },
      ],
    });

    expect(() => build('and')).toThrowError(
      expect.objectContaining<Partial<SurveyDocumentError>>({ code: 'invalid_conditional_reference' }),
    );
    expect(build('or').schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
  });

  it.each([
    ['extra visibility field', (document: SurveyDocumentV2) => {
      (document.questions[1].visibility as unknown as Record<string, unknown>).future = true;
    }],
    ['leaf root', (document: SurveyDocumentV2) => {
      (document.questions[1].visibility as unknown as Record<string, unknown>).root = {
        kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-web',
      };
    }],
    ['forward reference', (document: SurveyDocumentV2) => {
      const leaf = (document.questions[1].visibility?.root.children[0] as Record<string, unknown>);
      leaf.question_ref = 'q-target';
      leaf.option_ref = 'o-web';
    }],
  ] as const)('strictly rejects invalid v2 documents: %s', (_label, corrupt) => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft:strict-v2',
      title: 'Strict',
      questions: [
        { id: 'q-source', title: 'Canal', type: 'single', options: [{ id: 'o-web', label: 'Web' }] },
        {
          id: 'q-target',
          title: 'Detalle',
          type: 'text',
          conditional_logic: {
            version: 2,
            show_if: {
              kind: 'group',
              operator: 'and',
              children: [{ kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-web' }],
            },
          },
        },
      ],
    }) as SurveyDocumentV2;
    corrupt(document);

    expect(() => assertSurveyDocumentV2(document)).toThrowError(SurveyDocumentError);
  });
});
