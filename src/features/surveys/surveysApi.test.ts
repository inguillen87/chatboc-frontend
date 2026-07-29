import { beforeEach, describe, expect, it, vi } from 'vitest';

const panelGetMock = vi.fn();
const panelPostMock = vi.fn();
const panelPatchMock = vi.fn();
const publicGetMock = vi.fn();
const publicPostMock = vi.fn();
const postPublicResponseMock = vi.fn();

vi.mock('@/api/encuestas', () => ({
  postPublicResponse: (...args: unknown[]) => postPublicResponseMock(...args),
}));

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    get: (...args: unknown[]) => panelGetMock(...args),
    post: (...args: unknown[]) => panelPostMock(...args),
    patch: (...args: unknown[]) => panelPatchMock(...args),
  },
  publicApi: {
    get: (...args: unknown[]) => publicGetMock(...args),
    post: (...args: unknown[]) => publicPostMock(...args),
  },
}));

import {
  createSurveyMaterializationIdempotencyKey,
  getPublicSurveyLiveResultsV2,
  getSurveyDraftV2,
  isPersistedSurveyDraftAck,
  materializeSurveyDraftV2,
  normalizeSurveyDraftMaterializationAck,
  normalizeSurveyDraftPersistenceAck,
  respondPublicSurveyV2,
  saveSurveyDraftV2,
  stripSurveyDraftTransportProvenance,
} from './surveysApi';
import {
  SURVEY_DOCUMENT_SCHEMA_VERSION,
  SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
  durableBuilderDraftToSurveyDocument,
  surveyDocumentToDurableBuilderDraft,
} from './surveyDocument';

describe('surveysApi v2 public live results', () => {
  beforeEach(() => {
    panelGetMock.mockReset();
    panelPostMock.mockReset();
    panelPatchMock.mockReset();
    publicGetMock.mockReset();
    publicPostMock.mockReset();
    postPublicResponseMock.mockReset();
    panelGetMock.mockResolvedValue({});
    panelPostMock.mockResolvedValue({});
    panelPatchMock.mockResolvedValue({});
    publicGetMock.mockResolvedValue({});
    publicPostMock.mockResolvedValue({});
    postPublicResponseMock.mockResolvedValue({});
  });

  it('materializes a durable revision with a deterministic key in header and body', async () => {
    const payloadHash = 'a'.repeat(64);
    panelPostMock.mockResolvedValueOnce({
      contract_version: 'surveys.materialization.v1',
      ok: true,
      persisted: true,
      replayed: false,
      idempotency_key: createSurveyMaterializationIdempotencyKey('draft:participacion-2026', 3),
      receipt_id: 41,
      survey_id: 91,
      draft: {
        draft_id: 'draft:participacion-2026',
        revision: 3,
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
        document_ref: 'draft:participacion-2026',
        payload_hash: payloadHash,
      },
      survey: { id: 91, estado: 'borrador' },
    });

    const ack = await materializeSurveyDraftV2('draft:participacion-2026', { expectedRevision: 3 }, 'tenant-a');
    const expectedKey = createSurveyMaterializationIdempotencyKey('draft:participacion-2026', 3);

    expect(ack).toMatchObject({ survey_id: 91, receipt_id: 41, replayed: false });
    expect(panelPostMock).toHaveBeenCalledWith(
      '/api/v2/surveys/drafts/draft%3Aparticipacion-2026/materialize',
      { expected_revision: 3, idempotency_key: expectedKey },
      { tenantSlug: 'tenant-a', headers: { 'Idempotency-Key': expectedKey } },
    );
    expect(expectedKey).toMatch(/^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/);
    expect(createSurveyMaterializationIdempotencyKey('draft:participacion-2026', 3)).toBe(expectedKey);
    expect(createSurveyMaterializationIdempotencyKey('draft:participacion-2026', 4)).not.toBe(expectedKey);
  });

  it.each([
    ['idempotency key', { idempotency_key: 'survey-materialize-other-key' }],
    ['draft identity', { draft: { draft_id: 'draft-other', document_ref: 'draft-other' } }],
    ['revision', { draft: { revision: 4 } }],
  ] as const)('rejects a well-formed receipt bound to another %s', async (_label, override) => {
    const draftId = 'draft:receipt-binding';
    const expectedRevision = 3;
    const expectedKey = createSurveyMaterializationIdempotencyKey(draftId, expectedRevision);
    const base = {
      contract_version: 'surveys.materialization.v1',
      ok: true,
      persisted: true,
      replayed: false,
      idempotency_key: expectedKey,
      receipt_id: 41,
      survey_id: 91,
      draft: {
        draft_id: draftId,
        revision: expectedRevision,
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
        document_ref: draftId,
        payload_hash: 'a'.repeat(64),
      },
      survey: { id: 91 },
    };
    panelPostMock.mockResolvedValueOnce({
      ...base,
      ...override,
      draft: { ...base.draft, ...('draft' in override ? override.draft : {}) },
    });

    await expect(materializeSurveyDraftV2(draftId, { expectedRevision })).rejects.toThrow(
      /no coincide con la operacion/i,
    );
  });

  it('fails closed on an unconfirmed or cross-bound materialization receipt', () => {
    expect(() => normalizeSurveyDraftMaterializationAck({
      contract_version: 'surveys.materialization.v1',
      ok: true,
      persisted: false,
    })).toThrow(/no confirmo/i);

    expect(() => normalizeSurveyDraftMaterializationAck({
      contract_version: 'surveys.materialization.v1',
      ok: true,
      persisted: true,
      replayed: true,
      idempotency_key: 'materialize-valid-key',
      receipt_id: 1,
      survey_id: 2,
      draft: {
        draft_id: 'draft-a',
        revision: 1,
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
        document_ref: 'draft-b',
        payload_hash: 'b'.repeat(64),
      },
      survey: { id: 2 },
    })).toThrow(/identidad/i);
  });

  it('parses the explicit durable draft ack and sends revision plus idempotency identity', async () => {
    panelPostMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'surveys.draft.v2',
      persisted: true,
      draft_id: 'draft-1',
      revision: 3,
      created_at: '2026-07-28T10:00:00Z',
      updated_at: '2026-07-28T10:05:00Z',
      draft: {
        draft_id: 'draft-1',
        revision: 3,
        title: 'Encuesta barrial',
        description: 'Prioridades',
        questions: [
          {
            id: 'q-1',
            title: 'Que priorizamos?',
            type: 'single',
            options: [
              { id: 'o-1', label: 'Salud' },
              { id: 'o-2', label: 'Movilidad' },
            ],
          },
          {
            id: 'q-2',
            title: 'Por que?',
            type: 'text',
            conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 2 } },
          },
        ],
      },
    });

    const payload = {
      draft_id: 'draft-1',
      idempotency_key: 'save-3',
      revision: 2,
      title: 'Encuesta barrial',
      description: 'Prioridades',
      questions: [{ id: 'q-1', title: 'Que priorizamos?', type: 'single' as const }],
    };
    const ack = await saveSurveyDraftV2(payload, 'tenant-a');

    expect(panelPostMock).toHaveBeenCalledWith(
      '/api/v2/surveys/draft',
      expect.objectContaining({
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
        document_ref: 'draft-1',
        draft_id: 'draft-1',
        idempotency_key: 'save-3',
        revision: 2,
        title: 'Encuesta barrial',
        questions: [expect.objectContaining({ question_ref: 'q-1', prompt: 'Que priorizamos?' })],
      }),
      { tenantSlug: 'tenant-a' },
    );
    expect(isPersistedSurveyDraftAck(ack)).toBe(true);
    expect(ack).toMatchObject({
      persisted: true,
      contract_version: 'surveys.draft.v2',
      draft_id: 'draft-1',
      revision: 3,
      draft: { title: 'Encuesta barrial' },
    });
    expect(ack.draft?.questions[1].conditional_logic).toEqual({
      version: 1,
      show_if: { question_order: 1, option_order: 2 },
    });
  });

  it('keeps semantic draft content stable when save transport metadata rotates after an ACK', async () => {
    panelPostMock.mockResolvedValue({ persisted: false });
    const firstPayload = {
      draft_id: 'draft-stable-save',
      idempotency_key: 'save-operation-one',
      revision: 1,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      title: 'Contenido estable',
      description: '',
      questions: [{ id: 'q-1', title: 'Detalle', type: 'text' as const }],
      workspace_hint: 'municipal',
    };

    await saveSurveyDraftV2(firstPayload);
    const firstRequest = panelPostMock.mock.calls[0][1] as Record<string, unknown>;
    const {
      draft_id: _firstDraftId,
      idempotency_key: _firstIdempotencyKey,
      ...firstDocument
    } = firstRequest;

    await saveSurveyDraftV2({
      draft_id: 'draft-stable-save',
      idempotency_key: 'save-operation-two',
      revision: 1,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      document: firstDocument,
      title: 'Contenido estable',
      description: '',
      questions: [{ id: 'q-1', title: 'Detalle', type: 'text' }],
    });
    const secondRequest = panelPostMock.mock.calls[1][1] as Record<string, unknown>;
    const {
      draft_id: _secondDraftId,
      idempotency_key: _secondIdempotencyKey,
      ...secondDocument
    } = secondRequest;

    expect(secondDocument).toEqual(firstDocument);
    expect((firstDocument.extensions as Record<string, unknown>).durable_builder).toMatchObject({
      present_fields: ['title', 'description', 'questions', 'workspace_hint'],
      unknown_fields: { workspace_hint: 'municipal' },
    });
    expect(stripSurveyDraftTransportProvenance(firstDocument as never)).toEqual(firstDocument);
  });

  it('rejects a persisted save ACK bound to a different canonical document', async () => {
    const input = {
      draft_id: 'draft:save-bound',
      revision: 1,
      title: 'Original',
      questions: [{ id: 'q-1', title: 'Detalle', type: 'text' as const }],
    };
    const canonical = durableBuilderDraftToSurveyDocument(input);
    panelPostMock.mockResolvedValueOnce({
      ok: true,
      persisted: true,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      draft_id: input.draft_id,
      revision: 2,
      draft: { ...canonical, revision: 2, title: 'Alterada en transito' },
    });

    await expect(saveSurveyDraftV2(input)).rejects.toThrow(/survey-document enviado/i);
  });

  it('rejects a canonical save ACK that changes the requested schema', async () => {
    const input = {
      draft_id: 'draft:schema-save-bound',
      revision: 1,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      title: 'Schema v2',
      questions: [{ id: 'q-1', title: 'Detalle', type: 'text' as const }],
    };
    const canonicalV2 = durableBuilderDraftToSurveyDocument(input);
    panelPostMock.mockResolvedValueOnce({
      ok: true,
      persisted: true,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      draft_id: input.draft_id,
      revision: 2,
      draft: {
        ...canonicalV2,
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
        revision: 2,
      },
    });

    await expect(saveSurveyDraftV2(input)).rejects.toThrow(/schema_version solicitado/i);
  });

  it('rejects malformed conditional logic instead of making the question unconditional', async () => {
    panelGetMock.mockResolvedValueOnce({
      persisted: true,
      draft_id: 'draft-invalid-logic',
      revision: 1,
      draft: {
        draft_id: 'draft-invalid-logic',
        revision: 1,
        title: 'Invalida',
        questions: [
          {
            id: 'q-conditional',
            title: 'No debe abrirse',
            type: 'text',
            conditional_logic: { version: 1, show_if: { question_order: '1', option_order: 2 } },
          },
        ],
      },
    });

    await expect(getSurveyDraftV2('draft-invalid-logic')).rejects.toThrow(/conditional_logic invalida/i);
  });

  it('fails closed on an unknown legacy question type instead of defaulting it to single choice', async () => {
    panelGetMock.mockResolvedValueOnce({
      persisted: true,
      draft_id: 'draft-unknown-type',
      revision: 1,
      draft: {
        title: 'No degradar',
        questions: [{ id: 'q-future', title: 'Futura', type: 'semantic_matrix' }],
      },
    });

    await expect(getSurveyDraftV2('draft-unknown-type')).rejects.toThrow(/tipo de pregunta desconocido/i);
  });

  it('does not treat a resolved response without persisted=true as a durable ack', async () => {
    panelPostMock.mockResolvedValueOnce({ ok: true, draft_id: 'draft-unsafe', revision: 1 });

    const ack = await saveSurveyDraftV2({
      draft_id: 'draft-unsafe',
      title: 'No durable',
      questions: [],
    });

    expect(ack.persisted).toBe(false);
    expect(isPersistedSurveyDraftAck(ack)).toBe(false);
  });

  it('blocks malformed outgoing conditional logic before touching the network', async () => {
    await expect(
      saveSurveyDraftV2({
        draft_id: 'draft-invalid-outgoing',
        title: 'No enviar',
        questions: [
          {
            id: 'q-1',
            title: 'Invalida',
            type: 'text',
            conditional_logic: {
              version: 1,
              show_if: { question_order: 1, option_order: 1, negate: true },
            } as never,
          },
        ],
      }),
    ).rejects.toThrow(/no se envio/i);
    expect(panelPostMock).not.toHaveBeenCalled();
  });

  it('restores one draft directly without depending on a list endpoint', async () => {
    panelGetMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'surveys.draft.v2',
      persisted: true,
      draft_id: 'draft:restored',
      revision: 4,
      draft: {
        draft_id: 'draft:restored',
        revision: 4,
        title: 'Restaurada',
        description: '',
        questions: [],
      },
    });

    const ack = await getSurveyDraftV2('draft:restored', 'tenant-a');

    expect(panelGetMock).toHaveBeenCalledWith('/api/v2/surveys/draft/draft%3Arestored', {
      tenantSlug: 'tenant-a',
    });
    expect(isPersistedSurveyDraftAck(ack)).toBe(true);
    expect(ack.draft?.title).toBe('Restaurada');
  });

  it('rejects a direct draft lookup that returns another durable identity', async () => {
    panelGetMock.mockResolvedValueOnce({
      persisted: true,
      draft_id: 'draft:other',
      revision: 1,
      draft: {
        draft_id: 'draft:other',
        revision: 1,
        title: 'Otra',
        questions: [],
      },
    });

    await expect(getSurveyDraftV2('draft:requested')).rejects.toThrow(/draft_id solicitado/i);
  });

  it('reinjects and validates survey-document.v1 from the top-level ACK without dropping extensions', async () => {
    panelGetMock.mockResolvedValueOnce({
      ok: true,
      persisted: true,
      contract_version: 'surveys.draft.v2',
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      draft_id: 'draft-canonical',
      revision: 5,
      draft: {
        document_ref: 'draft-canonical',
        title: 'Canonica',
        survey_type: 'opinion',
        schedule: { starts_at: null, ends_at: null },
        policies: { uniqueness: 'libre', anonymous: true, requires_contact_data: false },
        experience: { live_voting: false, show_live_results: false, allow_comments: false, reward_points: 0 },
        questions: [],
        extensions: { future: { kept: true } },
      },
    });

    const ack = await getSurveyDraftV2('draft-canonical');

    expect(ack.document).toMatchObject({
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      revision: 5,
      extensions: { future: { kept: true } },
    });
  });

  it('fails closed when a canonical-shaped v2 ACK is structurally incomplete', async () => {
    panelGetMock.mockResolvedValueOnce({
      persisted: true,
      schema_version: 'survey-document.v2',
      draft_id: 'draft-future',
      revision: 1,
      draft: {
        document_ref: 'draft-future',
        title: 'Future',
        policies: {},
        questions: [],
      },
    });

    await expect(getSurveyDraftV2('draft-future')).rejects.toThrow(/survey-document\.v2 esta incompleto/i);
  });

  it.each([
    ['draft_id', { draft_id: 'draft:nested-other' }],
    ['revision', { revision: 3 }],
    ['schema_version', { schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2 }],
  ] as const)('rejects contradictory root and nested %s in a durable ACK', async (field, nestedOverride) => {
    panelGetMock.mockResolvedValueOnce({
      ok: true,
      persisted: true,
      contract_version: 'surveys.draft.v2',
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
      draft_id: 'draft:ack-consistency',
      revision: 2,
      draft: {
        draft_id: 'draft:ack-consistency',
        revision: 2,
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
        title: 'Consistente',
        questions: [],
        ...nestedOverride,
      },
    });

    await expect(getSurveyDraftV2('draft:ack-consistency')).rejects.toThrow(
      new RegExp(`${field} raiz y nested no coinciden`, 'i'),
    );
  });

  it('keeps an embedded canonical ACK idempotent and rejects a contradictory builder view', () => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft:embedded-canonical',
      revision: 2,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      title: 'Canon exacto',
      questions: [{ id: 'q-1', title: 'Detalle', type: 'text' }],
    });
    document.policies.uniqueness = 'por_dni';
    document.questions[0].persisted_id = 77;
    document.questions[0].extensions.admin = {
      present_fields: ['id'],
      unknown_fields: { analytics_key: 'preserved' },
    };
    const projectedDraft = surveyDocumentToDurableBuilderDraft(document);
    const response = {
      ok: true,
      persisted: true,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      draft_id: document.document_ref,
      revision: 2,
      draft: projectedDraft,
      document,
    };

    const normalized = normalizeSurveyDraftPersistenceAck(response);
    const normalizedAgain = normalizeSurveyDraftPersistenceAck(normalized);
    const documentOnly = normalizeSurveyDraftPersistenceAck({ ...response, draft: undefined });

    expect(normalized.document).toEqual(document);
    expect(normalizedAgain.document).toEqual(document);
    expect(documentOnly.draft).toMatchObject({
      title: 'Canon exacto',
      questions: [expect.objectContaining({ id: 'q-1', title: 'Detalle' })],
    });
    expect(() => normalizeSurveyDraftPersistenceAck({
      ...response,
      draft: { ...projectedDraft, title: 'Contenido contradictorio' },
    })).toThrow(/document embebido y draft contienen datos distintos/i);
    expect(() => normalizeSurveyDraftPersistenceAck({
      ...response,
      draft: undefined,
      schema_version: 'survey-document.v3',
    })).toThrow(/schema_version de survey-document no soportada/i);
  });

  it('saves and rehydrates a canonical v2 document without flattening nested visibility', async () => {
    const input = {
      draft_id: 'draft:v2-save',
      idempotency_key: 'save-v2-operation',
      revision: 1,
      title: 'Rutas v2',
      questions: [
        {
          id: 'q-channel',
          title: 'Canal',
          type: 'single' as const,
          options: [{ id: 'o-web', label: 'Web' }, { id: 'o-phone', label: 'Telefono' }],
        },
        {
          id: 'q-detail',
          title: 'Detalle',
          type: 'text' as const,
          conditional_logic: {
            version: 2 as const,
            show_if: {
              kind: 'group' as const,
              operator: 'or' as const,
              children: [
                { kind: 'option_selected' as const, question_ref: 'q-channel', option_ref: 'o-web' },
                {
                  kind: 'group' as const,
                  operator: 'and' as const,
                  children: [
                    { kind: 'option_selected' as const, question_ref: 'q-channel', option_ref: 'o-phone' },
                  ],
                },
              ],
            },
          },
        },
      ],
    };
    const canonical = durableBuilderDraftToSurveyDocument(input);
    panelPostMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'surveys.draft.v2',
      persisted: true,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      draft_id: input.draft_id,
      revision: 2,
      draft: { ...canonical, revision: 2 },
    });

    const saved = await saveSurveyDraftV2(input);
    const sent = panelPostMock.mock.calls[0][1] as Record<string, unknown>;

    expect(sent).toMatchObject({
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      document_ref: input.draft_id,
      draft_id: input.draft_id,
      questions: [
        expect.objectContaining({ visibility: null }),
        expect.objectContaining({
          visibility: { version: 2, root: input.questions[1].conditional_logic.show_if },
        }),
      ],
    });
    expect(saved.document?.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
    expect(saved.draft?.questions[1].conditional_logic).toEqual(input.questions[1].conditional_logic);

    panelGetMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'surveys.draft.v2',
      persisted: true,
      schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
      draft_id: input.draft_id,
      revision: 2,
      draft: { ...canonical, revision: 2 },
    });
    const reloaded = await getSurveyDraftV2(input.draft_id);

    expect(reloaded.document).toEqual(saved.document);
    expect(reloaded.draft?.questions[1].conditional_logic).toEqual(input.questions[1].conditional_logic);
  });

  it('accepts a materialization receipt bound to survey-document.v2', () => {
    const ack = normalizeSurveyDraftMaterializationAck({
      contract_version: 'surveys.materialization.v1',
      ok: true,
      persisted: true,
      replayed: false,
      idempotency_key: 'survey-materialize-valid-v2-key',
      receipt_id: 19,
      survey_id: 29,
      draft: {
        draft_id: 'draft:v2-materialized',
        revision: 4,
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
        document_ref: 'draft:v2-materialized',
        payload_hash: 'c'.repeat(64),
      },
      survey: { id: 29 },
    });

    expect(ack.draft.schema_version).toBe(SURVEY_DOCUMENT_SCHEMA_VERSION_V2);
  });

  it('rejects a materialization receipt whose schema differs from the requested document', async () => {
    const draftId = 'draft:schema-bound';
    const revision = 2;
    const idempotencyKey = createSurveyMaterializationIdempotencyKey(draftId, revision);
    panelPostMock.mockResolvedValueOnce({
      contract_version: 'surveys.materialization.v1',
      ok: true,
      persisted: true,
      replayed: false,
      idempotency_key: idempotencyKey,
      receipt_id: 51,
      survey_id: 61,
      draft: {
        draft_id: draftId,
        revision,
        schema_version: SURVEY_DOCUMENT_SCHEMA_VERSION,
        document_ref: draftId,
        payload_hash: 'e'.repeat(64),
      },
      survey: { id: 61 },
    });

    await expect(materializeSurveyDraftV2(draftId, {
      expectedRevision: revision,
      schemaVersion: SURVEY_DOCUMENT_SCHEMA_VERSION_V2,
    })).rejects.toThrow(/no coincide con la operacion/i);
  });

  it('posts public responses and accepts the enriched live-results ack contract', async () => {
    postPublicResponseMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'surveys.public_response.v2',
      response_id: 12,
      live_results_url: '/api/v2/public/surveys/token-1/live-results',
    });

    const response = await respondPublicSurveyV2(
      'token-1',
      {
        submission_id: '018f4c8e-1e56-4f38-a4df-83fd6839487d',
        respuestas: [{ pregunta_id: 1, opcion_ids: [2] }],
      },
      'junin',
    );

    expect(postPublicResponseMock).toHaveBeenCalledWith(
      'token-1',
      {
        submission_id: '018f4c8e-1e56-4f38-a4df-83fd6839487d',
        respuestas: [{ pregunta_id: 1, opcion_ids: [2] }],
      },
      'junin',
    );
    expect(response.live_results_url).toBe('/api/v2/public/surveys/token-1/live-results');
  });

  it('requests v2 live results with heatmap and momentum params', async () => {
    await getPublicSurveyLiveResultsV2(
      'token-1',
      'junin',
      { include_heatmap: false, max_points: 500, max_cells: 80, window_minutes: 15 },
    );

    expect(publicGetMock).toHaveBeenCalledWith(
      '/api/v2/public/surveys/token-1/live-results?include_heatmap=0&max_points=500&max_cells=80&window_minutes=15',
      { tenantSlug: 'junin' },
    );
  });
});
