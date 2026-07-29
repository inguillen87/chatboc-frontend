import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { OfflineDraftQueue } from '@/services/pwa/OfflineDraftQueue';

const mocks = vi.hoisted(() => ({
  isOnline: true,
  getDraft: vi.fn(),
  materializeDraft: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: mocks.isOnline }),
}));

vi.mock('./surveysApi', () => ({
  getSurveyDraftV2: (...args: unknown[]) => mocks.getDraft(...args),
  materializeSurveyDraftV2: (...args: unknown[]) => mocks.materializeDraft(...args),
  saveSurveyDraftV2: (...args: unknown[]) => mocks.saveDraft(...args),
  normalizeSurveyDraftPersistenceAck: (response: unknown) => response,
  isPersistedSurveyDraftAck: (ack: Record<string, unknown>) =>
    ack?.persisted === true && typeof ack.draft_id === 'string' && typeof ack.revision === 'number',
}));

import SurveyBuilderPage, {
  getSurveyBuilderDraftQuarantineKey,
  getSurveyBuilderDraftStorageKey,
  reconcileSurveyConditionalLogic,
} from './SurveyBuilderPage';
import {
  durableBuilderDraftToSurveyDocument,
  surveyDocumentToDurableBuilderDraft,
} from './surveyDocument';
import type { SurveyQuestionDraft } from './surveyTypes';

const durableAck = (draftId: string, revision: number, title: string) => ({
  ok: true,
  contract_version: 'surveys.draft.v2',
  persisted: true,
  draft_id: draftId,
  revision,
  draft: {
    draft_id: draftId,
    revision,
    title,
    description: 'Descripcion durable',
    questions: [{ id: 'q-1', title: 'Pregunta durable', type: 'single' }],
  },
  raw: null,
});

describe('SurveyBuilderPage durable draft lifecycle', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    OfflineDraftQueue.clearQueue();
    safeLocalStorage.setItem('tenantSlug', 'tenant-default');
    safeLocalStorage.setItem('clerkUserId', 'operator-default');
    mocks.isOnline = true;
    mocks.getDraft.mockReset();
    mocks.materializeDraft.mockReset();
    mocks.saveDraft.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('scopes the recovery snapshot by tenant and operator identity', () => {
    safeLocalStorage.setItem('tenantSlug', 'municipio-demo');
    safeLocalStorage.setItem('clerkUserId', 'operator-a');
    const operatorAKey = getSurveyBuilderDraftStorageKey();
    safeLocalStorage.setItem('clerkUserId', 'operator-b');

    expect(getSurveyBuilderDraftStorageKey()).not.toBe(operatorAKey);
  });

  it('does not show a durable success when a resolved save lacks persisted=true', async () => {
    mocks.saveDraft.mockResolvedValue({
      ok: true,
      persisted: false,
      draft_id: 'draft-not-durable',
      revision: 1,
      raw: {},
    });
    render(<SurveyBuilderPage />);
    fireEvent.change(screen.getByLabelText('Titulo'), { target: { value: 'Encuesta sin ack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar draft' }));

    expect(await screen.findByText(/sin confirmar persistencia durable/i)).toBeInTheDocument();
    expect(screen.queryByText(/guardado de forma durable/i)).not.toBeInTheDocument();
    expect(mocks.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ schema_version: 'survey-document.v1' }),
      'tenant-default',
    );
  });

  it('does not erase local fields when a durable ACK omits its draft body', async () => {
    mocks.saveDraft.mockResolvedValue({
      ok: true,
      persisted: true,
      draft_id: 'draft-minimal-ack',
      revision: 1,
      schema_version: 'survey-document.v1',
      raw: { persisted: true },
    });

    render(<SurveyBuilderPage />);
    fireEvent.change(screen.getByLabelText('Titulo'), { target: { value: 'No borrar' } });
    fireEvent.change(screen.getByLabelText('Descripcion'), { target: { value: 'Conservar tambien' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar draft' }));

    expect(await screen.findByText(/guardado de forma durable/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('No borrar')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Conservar tambien')).toBeInTheDocument();
  });

  it('fails closed when another operator logs into the same tenant before saving', async () => {
    safeLocalStorage.setItem('tenantSlug', 'tenant-shared');
    safeLocalStorage.setItem('clerkUserId', 'operator-a');
    mocks.saveDraft.mockResolvedValue(durableAck('should-not-send', 1, 'No enviar'));

    render(<SurveyBuilderPage />);
    safeLocalStorage.setItem('clerkUserId', 'operator-b');
    fireEvent.change(screen.getByLabelText('Titulo'), { target: { value: 'Privado de A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar draft' }));

    expect(await screen.findByText(/contexto de tenant u operador cambio/i)).toBeInTheDocument();
    expect(mocks.saveDraft).not.toHaveBeenCalled();
  });

  it('restores the scoped draft after reload and refreshes it from the direct GET endpoint', async () => {
    safeLocalStorage.setItem('tenantSlug', 'municipio-demo');
    const storageKey = getSurveyBuilderDraftStorageKey();
    safeLocalStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 2,
        draft_id: 'draft-restored',
        idempotency_key: 'operation-restored',
        revision: 6,
        title: 'Version local',
        description: 'Local',
        questions: [{ id: 'q-local', title: 'Pregunta local', type: 'text' }],
        persisted: true,
        updated_at: '2026-07-28T10:00:00Z',
      }),
    );
    mocks.getDraft.mockResolvedValue(durableAck('draft-restored', 7, 'Version servidor'));

    render(<SurveyBuilderPage />);

    expect(screen.getByDisplayValue('Version local')).toBeInTheDocument();
    await waitFor(() => expect(mocks.getDraft).toHaveBeenCalledWith('draft-restored', 'municipio-demo'));
    expect(await screen.findByDisplayValue('Version servidor')).toBeInTheDocument();
    expect(screen.getByText('Revision 7')).toBeInTheDocument();
    await waitFor(() => {
      const stored = JSON.parse(safeLocalStorage.getItem(storageKey) || '{}');
      expect(stored).toMatchObject({ draft_id: 'draft-restored', revision: 7, persisted: true });
    });
  });

  it('does not roll a recovered durable draft back to an older server revision', async () => {
    const storageKey = getSurveyBuilderDraftStorageKey();
    safeLocalStorage.setItem(storageKey, JSON.stringify({
      version: 2,
      draft_id: 'draft-no-rollback',
      idempotency_key: 'operation-no-rollback',
      revision: 6,
      title: 'Revision local seis',
      description: '',
      questions: [{ id: 'q-local', title: 'Pregunta local', type: 'text' }],
      persisted: true,
      updated_at: '2026-07-28T10:00:00Z',
    }));
    mocks.getDraft.mockResolvedValue(durableAck('draft-no-rollback', 5, 'Revision vieja'));

    render(<SurveyBuilderPage />);

    await waitFor(() => expect(mocks.getDraft).toHaveBeenCalled());
    expect(await screen.findByText(/revision anterior.*conservo el borrador local/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Revision local seis')).toBeInTheDocument();
    expect(screen.getByText('Revision 6')).toBeInTheDocument();
  });

  it('flushes a queued draft when connectivity is available and marks it durable only after the ack', async () => {
    safeLocalStorage.setItem('tenantSlug', 'municipio-demo');
    safeLocalStorage.setItem('clerkUserId', 'operator-demo');
    const storageKey = getSurveyBuilderDraftStorageKey();
    safeLocalStorage.setItem(
      storageKey,
      JSON.stringify({
        version: 2,
        draft_id: 'draft-queued',
        idempotency_key: 'next-operation',
        revision: 2,
        title: 'Pendiente offline',
        description: '',
        questions: [{ id: 'q-1', title: 'Pregunta', type: 'single' }],
        persisted: false,
        updated_at: '2026-07-28T10:00:00Z',
      }),
    );
    OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'draft-queued',
      idempotency_key: 'queued-operation',
      revision: 2,
      title: 'Pendiente offline',
      description: '',
      questions: [{ id: 'q-1', title: 'Pregunta', type: 'single' }],
    }, { tenantScope: 'municipio-demo', scopeKey: storageKey });
    const canonicalAckDocument = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft-queued',
      revision: 3,
      schema_version: 'survey-document.v2',
      title: 'Pendiente offline',
      questions: [{ id: 'q-1', title: 'Pregunta', type: 'text' }],
    });
    canonicalAckDocument.schedule = {
      starts_at: '2026-08-01T10:00:00Z',
      ends_at: '2026-08-31T10:00:00Z',
    };
    canonicalAckDocument.policies.uniqueness = 'por_dni';
    canonicalAckDocument.experience.live_voting = true;
    canonicalAckDocument.experience.show_live_results = true;
    canonicalAckDocument.questions[0].persisted_id = 77;
    canonicalAckDocument.questions[0].extensions.admin = {
      present_fields: ['id'],
      unknown_fields: { analytics_key: 'offline-preserved' },
    };
    mocks.saveDraft.mockResolvedValue({
      ...durableAck('draft-queued', 3, 'Pendiente offline'),
      schema_version: 'survey-document.v2',
      document: canonicalAckDocument,
      raw: {
        contract_version: 'surveys.draft.v2',
        persisted: true,
        draft_id: 'draft-queued',
        idempotency_key: 'queued-operation',
        revision: 3,
        tenant: { id: 1, slug: 'municipio-demo' },
      },
    });

    render(<SurveyBuilderPage />);

    expect(await screen.findByText(/guardado de forma durable \(revision 3\)/i)).toBeInTheDocument();
    expect(OfflineDraftQueue.getQueue()).toEqual([]);
    expect(mocks.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ draft_id: 'draft-queued', idempotency_key: 'queued-operation', revision: 2 }),
      'municipio-demo',
    );
    await waitFor(() => {
      const stored = JSON.parse(safeLocalStorage.getItem(storageKey) || '{}');
      expect(stored.document).toEqual(canonicalAckDocument);
    });

    mocks.saveDraft.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar draft' }));
    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        schema_version: 'survey-document.v2',
        document: canonicalAckDocument,
      }),
      'municipio-demo',
    ));
  });

  it('applies the active draft ack when a later draft in the same scope fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    safeLocalStorage.setItem('tenantSlug', 'municipio-demo');
    safeLocalStorage.setItem('clerkUserId', 'operator-demo');
    const storageKey = getSurveyBuilderDraftStorageKey();
    safeLocalStorage.setItem(storageKey, JSON.stringify({
      version: 2,
      draft_id: 'draft-active',
      idempotency_key: 'next-active-operation',
      revision: 2,
      title: 'Borrador activo',
      description: '',
      questions: [{ id: 'q-active', title: 'Pregunta activa', type: 'text' }],
      persisted: false,
      updated_at: '2026-07-28T10:00:00Z',
    }));
    const activeAction = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'draft-active',
      idempotency_key: 'queued-active-operation',
      revision: 2,
      title: 'Borrador activo',
      description: '',
      questions: [{ id: 'q-active', title: 'Pregunta activa', type: 'text' }],
    }, { tenantScope: 'municipio-demo', scopeKey: storageKey });
    const laterFailedAction = OfflineDraftQueue.addAction('survey_draft', {
      draft_id: 'draft-later-failure',
      idempotency_key: 'queued-later-operation',
      revision: 1,
      title: 'Otro borrador',
      description: '',
      questions: [{ id: 'q-other', title: 'Otra pregunta', type: 'text' }],
    }, { tenantScope: 'municipio-demo', scopeKey: storageKey });
    const activeAck = {
      ...durableAck('draft-active', 3, 'Borrador activo'),
      raw: {
        contract_version: 'surveys.draft.v2',
        persisted: true,
        draft_id: 'draft-active',
        idempotency_key: 'queued-active-operation',
        revision: 3,
        tenant: { id: 1, slug: 'municipio-demo' },
      },
    };
    mocks.saveDraft.mockImplementation(async (payload: Record<string, unknown>) => {
      if (payload.draft_id === 'draft-active') return activeAck;
      throw new Error('fallo del segundo borrador');
    });

    render(<SurveyBuilderPage />);

    expect(await screen.findByText(/guardado de forma durable \(revision 3\)/i)).toBeInTheDocument();
    expect(mocks.saveDraft).toHaveBeenCalledTimes(2);
    expect(mocks.saveDraft).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ draft_id: 'draft-active', idempotency_key: 'queued-active-operation' }),
      'municipio-demo',
    );
    expect(OfflineDraftQueue.getQueue()).toEqual([laterFailedAction]);
    expect(OfflineDraftQueue.getQueue()).not.toContainEqual(activeAction);
    await waitFor(() => {
      expect(JSON.parse(safeLocalStorage.getItem(storageKey) || '{}')).toMatchObject({
        draft_id: 'draft-active',
        revision: 3,
        persisted: true,
      });
    });
  });

  it('rebases adaptive source orders when an earlier unrelated question is removed', () => {
    const previous: SurveyQuestionDraft[] = [
      { id: 'q-1', title: 'Introduccion', type: 'text' },
      {
        id: 'q-2',
        title: 'Canal',
        type: 'single',
        options: [{ id: 'o-1', label: 'Web' }, { id: 'o-2', label: 'WhatsApp' }],
      },
      {
        id: 'q-3',
        title: 'Detalle',
        type: 'text',
        conditional_logic: { version: 1, show_if: { question_order: 2, option_order: 2 } },
      },
    ];

    const result = reconcileSurveyConditionalLogic(previous, previous.slice(1));

    expect(result.invalidatedQuestionIds).toEqual([]);
    expect(result.questions[1].conditional_logic).toEqual({
      version: 1,
      show_if: { question_order: 1, option_order: 2 },
    });
  });

  it('invalidates a dependent rule when its source stops supporting options', () => {
    const previous: SurveyQuestionDraft[] = [
      {
        id: 'q-1',
        title: 'Canal',
        type: 'single',
        options: [{ id: 'o-1', label: 'Web' }],
      },
      {
        id: 'q-2',
        title: 'Detalle',
        type: 'text',
        conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 1 } },
      },
    ];
    const next = [{ ...previous[0], type: 'text' as const }, previous[1]];

    const result = reconcileSurveyConditionalLogic(previous, next);

    expect(result.invalidatedQuestionIds).toEqual(['q-2']);
    expect(result.questions[1].conditional_logic).toBeNull();
  });

  it('keeps v2 ref rules stable for builder questions that only carry durable ids', () => {
    const questions: SurveyQuestionDraft[] = [
      {
        id: 'q-source',
        title: 'Canal',
        type: 'single',
        options: [{ id: 'o-web', label: 'Web' }],
      },
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
    ];

    const result = reconcileSurveyConditionalLogic(questions, questions.map((question) => ({ ...question })));

    expect(result.invalidatedQuestionIds).toEqual([]);
    expect(result.questions[1].conditional_logic).toEqual(questions[1].conditional_logic);
  });

  it('keeps generated canonical option refs explicit when a v2 document returns to the builder', () => {
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: 'draft:generated-option-ref',
      schema_version: 'survey-document.v2',
      title: 'Refs generadas',
      questions: [
        {
          id: 'q-source',
          title: 'Canal',
          type: 'single',
          options: [{ label: 'Web' }],
        },
        {
          id: 'q-target',
          title: 'Detalle',
          type: 'text',
          conditional_logic: {
            version: 2,
            show_if: {
              kind: 'group',
              operator: 'and',
              children: [{
                kind: 'option_selected',
                question_ref: 'q-source',
                option_ref: 'q-source/option:1',
              }],
            },
          },
        },
      ],
    });
    const builderView = surveyDocumentToDurableBuilderDraft(document);

    expect(builderView.questions[0]).toMatchObject({
      question_ref: 'q-source',
      options: [{ option_ref: 'q-source/option:1', label: 'Web' }],
    });
    const edited = builderView.questions.map((question) => (
      question.id === 'q-target' ? { ...question, title: 'Detalle editado' } : question
    ));
    const reconciled = reconcileSurveyConditionalLogic(builderView.questions, edited);

    expect(reconciled.invalidatedQuestionIds).toEqual([]);
    expect(reconciled.questions[1].conditional_logic).toEqual(builderView.questions[1].conditional_logic);
  });

  it('quarantines a local draft with invalid conditional logic without overwriting the raw snapshot', async () => {
    const storageKey = getSurveyBuilderDraftStorageKey();
    const rawSnapshot = JSON.stringify({
      version: 2,
      draft_id: 'draft-corrupt',
      title: 'No abrir',
      questions: [
        {
          id: 'q-1',
          title: 'Condicion corrupta',
          type: 'text',
          conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 1, negate: true } },
        },
      ],
    });
    safeLocalStorage.setItem(storageKey, rawSnapshot);

    render(<SurveyBuilderPage />);

    expect(await screen.findByText(/estructura invalida y fue resguardado/i)).toBeInTheDocument();
    expect(safeLocalStorage.getItem(getSurveyBuilderDraftQuarantineKey(storageKey))).toBe(rawSnapshot);
  });

  it('materializes only the confirmed canonical revision and keeps the durable draft plus an admin link', async () => {
    const draftId = 'draft-materializable';
    const storedQuestions: SurveyQuestionDraft[] = [{
      id: 'q-1',
      title: 'Que priorizamos?',
      type: 'single',
      required: true,
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: 'o-1', label: 'Salud', value: 'salud' },
        { id: 'o-2', label: 'Movilidad', value: 'movilidad' },
      ],
    }];
    const document = {
      schema_version: 'survey-document.v1' as const,
      document_ref: draftId,
      revision: 1,
      title: 'Participacion barrial',
      survey_type: 'opinion' as const,
      schedule: { starts_at: null, ends_at: null },
      policies: { uniqueness: 'libre' as const, anonymous: true, requires_contact_data: false },
      experience: { live_voting: false, show_live_results: false, allow_comments: false, reward_points: 0 },
      questions: [{
        question_ref: 'q-1',
        order: 1,
        type: 'single_choice' as const,
        prompt: 'Que priorizamos?',
        required: true,
        selection: { min: 1, max: 1 },
        visibility: null,
        options: [
          { option_ref: 'o-1', order: 1, label: 'Salud', value: 'salud', extensions: {} },
          { option_ref: 'o-2', order: 2, label: 'Movilidad', value: 'movilidad', extensions: {} },
        ],
        extensions: {},
      }],
      extensions: {},
    };
    safeLocalStorage.setItem(getSurveyBuilderDraftStorageKey(), JSON.stringify({
      version: 2,
      draft_id: draftId,
      idempotency_key: 'save-materializable-key',
      title: document.title,
      description: 'Descripcion durable',
      questions: storedQuestions,
      persisted: false,
      updated_at: '2026-07-28T12:00:00Z',
    }));
    mocks.saveDraft.mockResolvedValue({
      ...durableAck(draftId, 1, document.title),
      schema_version: 'survey-document.v1',
      document,
      draft: {
        draft_id: draftId,
        revision: 1,
        title: document.title,
        description: 'Descripcion durable',
        questions: storedQuestions,
      },
    });
    mocks.materializeDraft.mockResolvedValue({
      contract_version: 'surveys.materialization.v1',
      ok: true,
      persisted: true,
      replayed: false,
      idempotency_key: 'survey-materialize-valid-key',
      receipt_id: 17,
      survey_id: 88,
      draft: {
        draft_id: draftId,
        revision: 1,
        schema_version: 'survey-document.v1',
        document_ref: draftId,
        payload_hash: 'a'.repeat(64),
      },
      survey: { id: 88 },
      raw: {},
    });

    render(<SurveyBuilderPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar draft' }));
    await screen.findByText(/guardado de forma durable/i);

    const materializeButton = screen.getByRole('button', { name: 'Crear encuesta operativa' });
    expect(materializeButton).toBeEnabled();
    fireEvent.click(materializeButton);

    expect(await screen.findByText(/encuesta creada.*revision 1/i)).toBeInTheDocument();
    expect(mocks.materializeDraft).toHaveBeenCalledWith(
      draftId,
      { expectedRevision: 1, schemaVersion: 'survey-document.v1' },
      'tenant-default',
    );
    expect(screen.getByRole('link', { name: /abrir encuesta #88/i })).toHaveAttribute(
      'href',
      '/admin/encuestas/88',
    );
    expect(safeLocalStorage.getItem(getSurveyBuilderDraftStorageKey())).toContain(draftId);

    fireEvent.change(screen.getByLabelText('Titulo'), { target: { value: 'Cambio posterior' } });
    expect(await screen.findByText(/hay cambios locales.*no estan incluidos/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir encuesta #88/i })).toHaveAttribute(
      'href',
      '/admin/encuestas/88',
    );
  });

  it('restores, saves and keeps a survey-document.v2 snapshot with nested conditional logic', async () => {
    const draftId = 'draft:builder-v2';
    const questions: SurveyQuestionDraft[] = [
      {
        id: 'q-source',
        question_ref: 'q-source',
        title: 'Canal',
        type: 'single',
        options: [
          { id: 'o-web', option_ref: 'o-web', label: 'Web' },
          { id: 'o-phone', option_ref: 'o-phone', label: 'Telefono' },
        ],
      },
      {
        id: 'q-target',
        question_ref: 'q-target',
        title: 'Detalle',
        type: 'text',
        conditional_logic: {
          version: 2,
          show_if: {
            kind: 'group',
            operator: 'or',
            children: [
              { kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-web' },
              {
                kind: 'group',
                operator: 'and',
                children: [
                  { kind: 'option_selected', question_ref: 'q-source', option_ref: 'o-phone' },
                ],
              },
            ],
          },
        },
      },
    ];
    const document = durableBuilderDraftToSurveyDocument({
      draft_id: draftId,
      revision: 1,
      title: 'Builder v2',
      questions,
    });
    const storageKey = getSurveyBuilderDraftStorageKey();
    safeLocalStorage.setItem(storageKey, JSON.stringify({
      version: 2,
      draft_id: draftId,
      idempotency_key: 'save-builder-v2',
      revision: 1,
      title: 'Builder v2',
      description: '',
      questions,
      document,
      persisted: false,
      updated_at: '2026-07-28T12:00:00Z',
    }));
    const confirmedDocument = { ...document, revision: 2 };
    mocks.saveDraft.mockResolvedValue({
      ok: true,
      persisted: true,
      schema_version: 'survey-document.v2',
      draft_id: draftId,
      revision: 2,
      document: confirmedDocument,
      draft: {
        draft_id: draftId,
        revision: 2,
        schema_version: 'survey-document.v2',
        title: 'Builder v2',
        description: '',
        questions,
      },
      raw: {},
    });
    mocks.materializeDraft.mockResolvedValue({
      contract_version: 'surveys.materialization.v1',
      ok: true,
      persisted: true,
      replayed: false,
      idempotency_key: 'survey-materialize-builder-v2',
      receipt_id: 31,
      survey_id: 41,
      draft: {
        draft_id: draftId,
        revision: 2,
        schema_version: 'survey-document.v2',
        document_ref: draftId,
        payload_hash: 'd'.repeat(64),
      },
      survey: { id: 41 },
      raw: {},
    });

    render(<SurveyBuilderPage />);
    expect(screen.getByDisplayValue('Builder v2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar draft' }));

    expect(await screen.findByText(/guardado de forma durable.*revision 2/i)).toBeInTheDocument();
    expect(mocks.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        schema_version: 'survey-document.v2',
        document: expect.objectContaining({ schema_version: 'survey-document.v2' }),
        questions: expect.arrayContaining([
          expect.objectContaining({ conditional_logic: questions[1].conditional_logic }),
        ]),
      }),
      'tenant-default',
    );
    await waitFor(() => {
      const stored = JSON.parse(safeLocalStorage.getItem(storageKey) || '{}');
      expect(stored.document).toMatchObject({ schema_version: 'survey-document.v2', revision: 2 });
      expect(stored.questions[1].conditional_logic).toEqual(questions[1].conditional_logic);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear encuesta operativa' }));
    await screen.findByText(/encuesta creada.*revision 2/i);
    expect(mocks.materializeDraft).toHaveBeenCalledWith(
      draftId,
      { expectedRevision: 2, schemaVersion: 'survey-document.v2' },
      'tenant-default',
    );
  });
});
