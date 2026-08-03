import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  SurveyGovernanceRelease,
  SurveyGovernanceReleaseCreatePayload,
  SurveyGovernanceReleaseList,
} from '@/types/encuestas';

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  publish: vi.fn(),
  close: vi.fn(),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

vi.mock('@/api/encuestas', () => ({
  adminListSurveyGovernanceReleases: apiMocks.list,
  adminCreateSurveyGovernanceRelease: apiMocks.create,
  adminPublishSurveyGovernanceRelease: apiMocks.publish,
  adminCloseSurveyGovernanceRelease: apiMocks.close,
}));

import {
  isSurveyGovernanceMutationAck,
  SurveyGovernanceContractError,
  SurveyGovernancePanel,
  validateSurveyGovernanceReleaseList,
} from './SurveyGovernancePanel';

const CONSENT_TEXT = 'Autorizo el uso de mi respuesta para esta consulta.';
const CONSENT_SHA256 = '39d6d8a64504d167149b2efbce72b2a620124729d693c25018e10bf3ae2c458e';
const UPDATED_CONSENT_TEXT = 'Consentimiento institucional aprobado.';
const UPDATED_CONSENT_SHA256 = 'a25ed78ebe6540dbfa2df96de1fc90b06372a78eca0e9c6646b61ffe2c3583c1';
const REVIEW_REFERENCE = 'acta:comite-001';
const REVIEW_REFERENCE_SHA256 = '820ae2c1e885ab1e9c826e860221b23b093d2862e3dfed79f85b72d3eda32e2f';
const DEFAULT_CREATE_PAYLOAD: SurveyGovernanceReleaseCreatePayload = {
  eligibility_policy: {
    policy_version: 'eligibility-v1',
    mode: 'open',
    declarations: [],
    human_review_required: true,
    automated_decision: false,
  },
  consent_policy: {
    policy_version: 'consent-v1',
    public_text: CONSENT_TEXT,
    text_sha256: CONSENT_SHA256,
    required: true,
  },
  decision_rules: {
    quorum: { type: 'none', value: null },
    tie: { procedure: 'human_review' },
    challenge: { enabled: false, window_hours: null, procedure: 'human_review' },
    human_review_required: true,
    declarative_only: true,
  },
};

const release: SurveyGovernanceRelease = {
  ok: true,
  contract_version: 'surveys.governance_release.v1',
  release_id: 5,
  survey_id: 42,
  version_number: 1,
  status: 'published',
  snapshot_sha256: 'a'.repeat(64),
  policy_sha256: 'b'.repeat(64),
  published_at: '2026-07-30T12:00:00Z',
  closed_at: null,
  capabilities: { can_publish: false, can_close: false },
  governance: {
    eligibility: {
      contract_version: 'surveys.eligibility_policy.v1',
      policy_version: 'eligibility-2026.1',
      mode: 'self_attested',
      declarations: ['resident_attested'],
      human_review_required: true,
      automated_decision: false,
      stores_roster_or_pii: false,
      decision_state: 'not_evaluated',
    },
    consent: {
      contract_version: 'surveys.consent_policy.v1',
      policy_version: 'consent-2026.1',
      public_text: CONSENT_TEXT,
      text_sha256: CONSENT_SHA256,
      content_format: 'plain_text',
      normalization: 'unicode_nfc_lf_trim_v1',
      required: true,
      stores_public_text: true,
      records_participant_input: false,
    },
    decision_rules: {
      contract_version: 'surveys.decision_rules.v1',
      quorum: { type: 'minimum_responses', value: 10 },
      tie: { procedure: 'human_review' },
      challenge: { enabled: false, window_hours: null, procedure: 'human_review' },
      human_review_required: true,
      declarative_only: true,
      computed_outcome: null,
    },
  },
  completeness: {
    public_consent: {
      complete: true,
      reason_code: null,
      content_format: 'plain_text',
      normalization: 'unicode_nfc_lf_trim_v1',
    },
  },
  idempotency: { persisted: true, replayed: false, disposition: 'accepted' },
  assurance: {
    scope: 'instrument_and_policy_integrity',
    regulated_election_certified: false,
    result_certified: false,
    external_verification: 'not_performed',
  },
};

const listContract = (
  overrides: Partial<SurveyGovernanceReleaseList> = {},
): SurveyGovernanceReleaseList => ({
  ok: true,
  contract_version: 'surveys.governance_releases.v1',
  tenant: { id: 7, slug: 'junin' },
  survey_id: 42,
  survey_state: 'publicada',
  active_release_id: 5,
  latest_release_id: 5,
  capabilities: {
    read: true,
    manage: true,
    plan_allows_write: true,
    create_release: false,
    required_for_mutation: 'survey.governance.manage',
  },
  items: [release],
  total: 1,
  ...overrides,
});

const createEnabledContract = () =>
  listContract({
    survey_state: 'borrador',
    active_release_id: null,
    latest_release_id: null,
    capabilities: {
      read: true,
      manage: true,
      plan_allows_write: true,
      create_release: true,
      required_for_mutation: 'survey.governance.manage',
    },
    items: [],
    total: 0,
  });

const draftAck = (): SurveyGovernanceRelease => ({
  ...release,
  release_id: 9,
  status: 'draft',
  published_at: null,
  capabilities: { can_publish: true, can_close: false },
  governance: {
    eligibility: {
      contract_version: 'surveys.eligibility_policy.v1',
      policy_version: 'eligibility-v1',
      mode: 'open',
      declarations: [],
      human_review_required: true,
      automated_decision: false,
      stores_roster_or_pii: false,
      decision_state: 'not_evaluated',
    },
    consent: {
      contract_version: 'surveys.consent_policy.v1',
      policy_version: 'consent-v1',
      public_text: CONSENT_TEXT,
      text_sha256: CONSENT_SHA256,
      content_format: 'plain_text',
      normalization: 'unicode_nfc_lf_trim_v1',
      required: true,
      stores_public_text: true,
      records_participant_input: false,
    },
    decision_rules: {
      contract_version: 'surveys.decision_rules.v1',
      quorum: { type: 'none', value: null },
      tie: { procedure: 'human_review' },
      challenge: { enabled: false, window_hours: null, procedure: 'human_review' },
      human_review_required: true,
      declarative_only: true,
      computed_outcome: null,
    },
  },
  idempotency: { persisted: true, replayed: false, disposition: 'accepted' },
});

const closedAck = (): SurveyGovernanceRelease => ({
  ...release,
  status: 'closed',
  closed_at: '2026-07-30T13:00:00Z',
  capabilities: { can_publish: false, can_close: false },
  closure: {
    manifest_sha256: 'c'.repeat(64),
    manifest: {
      contract_version: 'surveys.closure_manifest.v1',
      tenant_id: 7,
      survey_id: 42,
      release_id: 5,
      release_version: 1,
      snapshot_sha256: 'a'.repeat(64),
      policy_sha256: 'b'.repeat(64),
      response_count: 0,
      response_set_sha256: 'd'.repeat(64),
      human_review_reference_sha256: REVIEW_REFERENCE_SHA256,
      closed_at: '2026-07-30T13:00:00Z',
      assurance: {
        scope: 'local_database_closure_integrity',
        regulated_election_certified: false,
        result_certified: false,
        external_anchor_verified: false,
      },
    },
  },
  idempotency: { persisted: true, replayed: false, disposition: 'accepted' },
});

describe('survey governance contract validation', () => {
  const expected = { surveyId: 42, tenantSlug: 'junin' };

  it('distinguishes an absent versioned contract from a malformed one', () => {
    expect(() => validateSurveyGovernanceReleaseList({}, expected)).toThrow(
      /no expuso el contrato versionado/i,
    );

    try {
      validateSurveyGovernanceReleaseList(
        listContract({ contract_version: 'surveys.governance_releases.v0' }),
        expected,
      );
      throw new Error('Expected malformed governance contract');
    } catch (error) {
      expect(error).toBeInstanceOf(SurveyGovernanceContractError);
      expect(error).toMatchObject({ kind: 'malformed' });
    }
  });

  it('reconciles tenant, survey, totals, ordering, active and latest release identities', () => {
    const latestPublished = {
      ...release,
      release_id: 7,
      version_number: 3,
      capabilities: { can_publish: false, can_close: true },
    };
    const olderClosed = {
      ...release,
      release_id: 6,
      version_number: 2,
      status: 'closed' as const,
      capabilities: { can_publish: false, can_close: false },
    };
    const oldestClosed = {
      ...olderClosed,
      release_id: 5,
      version_number: 1,
    };
    const valid = listContract({
      active_release_id: 7,
      latest_release_id: 7,
      items: [latestPublished, olderClosed, oldestClosed],
      total: 3,
    });

    expect(validateSurveyGovernanceReleaseList(valid, expected)).toBe(valid);

    const invalidContracts = [
      listContract({ tenant: { id: 8, slug: 'mendoza' } }),
      listContract({ survey_id: 43 }),
      listContract({ total: 2 }),
      listContract({ active_release_id: null }),
      listContract({ latest_release_id: 99 }),
      listContract({
        active_release_id: 7,
        latest_release_id: 7,
        items: [latestPublished, { ...olderClosed, status: 'published' as const }],
        total: 2,
      }),
      listContract({
        active_release_id: 7,
        latest_release_id: 6,
        items: [olderClosed, latestPublished],
        total: 2,
      }),
    ];
    for (const invalid of invalidContracts) {
      expect(() => validateSurveyGovernanceReleaseList(invalid, expected)).toThrow(
        /contrato de gobernanza inconsistente/i,
      );
    }
  });

  it('accepts only ACKs bound to the requested hashes and persisted human review', () => {
    expect(
      isSurveyGovernanceMutationAck(draftAck(), {
        surveyId: 42,
        status: 'draft',
        requirePublicConsent: true,
        createPayload: DEFAULT_CREATE_PAYLOAD,
      }),
    ).toBe(true);
    expect(
      isSurveyGovernanceMutationAck(
        {
          ...draftAck(),
          governance: {
            ...draftAck().governance,
            eligibility: {
              ...draftAck().governance?.eligibility,
              mode: 'self_attested',
            } as NonNullable<SurveyGovernanceRelease['governance']>['eligibility'],
          },
        },
        {
          surveyId: 42,
          status: 'draft',
          requirePublicConsent: true,
          createPayload: DEFAULT_CREATE_PAYLOAD,
        },
      ),
    ).toBe(false);
    expect(
      isSurveyGovernanceMutationAck(release, {
        surveyId: 42,
        releaseId: 5,
        versionNumber: 1,
        status: 'published',
        snapshotSha256: 'a'.repeat(64),
        policySha256: 'b'.repeat(64),
      }),
    ).toBe(true);
    expect(
      isSurveyGovernanceMutationAck(release, {
        surveyId: 42,
        releaseId: 5,
        versionNumber: 1,
        status: 'published',
        snapshotSha256: 'f'.repeat(64),
        policySha256: 'b'.repeat(64),
      }),
    ).toBe(false);
    expect(
      isSurveyGovernanceMutationAck(closedAck(), {
        surveyId: 42,
        releaseId: 5,
        versionNumber: 1,
        status: 'closed',
        snapshotSha256: 'a'.repeat(64),
        policySha256: 'b'.repeat(64),
        humanReviewReferenceSha256: REVIEW_REFERENCE_SHA256,
      }),
    ).toBe(true);
    expect(
      isSurveyGovernanceMutationAck({ ...closedAck(), closure: null }, {
        surveyId: 42,
        releaseId: 5,
        versionNumber: 1,
        status: 'closed',
        snapshotSha256: 'a'.repeat(64),
        policySha256: 'b'.repeat(64),
        humanReviewReferenceSha256: REVIEW_REFERENCE_SHA256,
      }),
    ).toBe(false);
  });
});

describe('SurveyGovernancePanel', () => {
  beforeEach(() => {
    apiMocks.list.mockReset();
    apiMocks.create.mockReset();
    apiMocks.publish.mockReset();
    apiMocks.close.mockReset();
  });

  it('fails closed without an explicit tenant scope and does not call the API', async () => {
    render(<SurveyGovernancePanel surveyId={42} tenantSlug={null} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/verificar el tenant de gobernanza/i);
    expect(apiMocks.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Crear release borrador/i })).not.toBeInTheDocument();
  });

  it('renders lifecycle, active/latest, policy hashes and honest assurance', async () => {
    apiMocks.list.mockResolvedValueOnce(listContract());

    render(<SurveyGovernancePanel surveyId={42} tenantSlug="junin" />);

    expect(await screen.findByText('Release v1')).toBeInTheDocument();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Más reciente')).toBeInTheDocument();
    expect(screen.getByText(/eligibility-2026\.1 · Autodeclarada/i)).toBeInTheDocument();
    expect(screen.getByText('consent-2026.1')).toBeInTheDocument();
    expect(screen.getByTestId('survey-governance-consent-text-5')).toHaveTextContent(CONSENT_TEXT);
    expect(screen.getByText(/Decisión declarativa con revisión humana/i)).toBeInTheDocument();
    expect(screen.getByText(/NO certifica una elección regulada ni sus resultados/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publicar snapshot/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cerrar release/i })).not.toBeInTheDocument();
    expect(apiMocks.list).toHaveBeenCalledWith(42, { tenantSlug: 'junin' });
  });

  it('fails closed when the backend omits explicit manage authority', async () => {
    apiMocks.list.mockResolvedValueOnce(
      listContract({
        capabilities: {
          read: true,
          manage: false,
          plan_allows_write: true,
          create_release: true,
          required_for_mutation: 'survey.governance.manage',
        },
        items: [],
        total: 0,
      }),
    );

    render(<SurveyGovernancePanel surveyId={42} tenantSlug="junin" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/contrato de gobernanza inconsistente/i);
    expect(screen.queryByRole('button', { name: /Crear release borrador/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publicar snapshot/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cerrar release/i })).not.toBeInTheDocument();
  });

  it('does not trust an action boolean attached to a malformed release receipt', async () => {
    apiMocks.list.mockResolvedValueOnce(
      listContract({
        active_release_id: null,
        items: [
          {
            ...release,
            status: 'draft',
            snapshot_sha256: 'not-a-sha256',
            capabilities: { can_publish: true, can_close: false },
          },
        ],
      }),
    );

    render(<SurveyGovernancePanel surveyId={42} tenantSlug="junin" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/contrato de gobernanza inconsistente/i);
    expect(screen.queryByRole('button', { name: /Publicar snapshot/i })).not.toBeInTheDocument();
    expect(apiMocks.publish).not.toHaveBeenCalled();
  });

  it('reuses a cryptographic idempotency key after ambiguous ACK and rotates it after ACK', async () => {
    apiMocks.list.mockResolvedValue(createEnabledContract());
    apiMocks.create
      .mockResolvedValueOnce({ ...draftAck(), idempotency: { persisted: false, disposition: 'unknown' } })
      .mockResolvedValueOnce(draftAck())
      .mockResolvedValueOnce(draftAck());

    render(<SurveyGovernancePanel surveyId={42} tenantSlug="junin" />);
    fireEvent.change(await screen.findByLabelText('Texto público aprobado'), {
      target: { value: CONSENT_TEXT },
    });

    await waitFor(() =>
      expect(screen.getByLabelText('SHA-256 calculado con Web Crypto')).toHaveValue(CONSENT_SHA256),
    );

    fireEvent.click(screen.getByRole('button', { name: /Crear release borrador/i }));
    await waitFor(() => expect(apiMocks.create).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no confirmó persistencia e idempotencia/i);

    fireEvent.click(screen.getByRole('button', { name: /Crear release borrador/i }));
    await waitFor(() => expect(apiMocks.create).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Release borrador confirmado por el backend/i)).toBeInTheDocument();

    const firstKey = apiMocks.create.mock.calls[0][2] as string;
    const retryKey = apiMocks.create.mock.calls[1][2] as string;
    expect(firstKey).toMatch(/^survey-governance:create:42:/);
    expect(retryKey).toBe(firstKey);
    expect(apiMocks.create.mock.calls[1][1]).toEqual({
      eligibility_policy: {
        policy_version: 'eligibility-v1',
        mode: 'open',
        declarations: [],
        human_review_required: true,
        automated_decision: false,
      },
      consent_policy: {
        policy_version: 'consent-v1',
        public_text: CONSENT_TEXT,
        text_sha256: CONSENT_SHA256,
        required: true,
      },
      decision_rules: {
        quorum: { type: 'none', value: null },
        tie: { procedure: 'human_review' },
        challenge: { enabled: false, window_hours: null, procedure: 'human_review' },
        human_review_required: true,
        declarative_only: true,
      },
    });
    expect(apiMocks.create.mock.calls[1][3]).toEqual({ tenantSlug: 'junin' });

    fireEvent.click(screen.getByRole('button', { name: /Crear release borrador/i }));
    await waitFor(() => expect(apiMocks.create).toHaveBeenCalledTimes(3));
    expect(apiMocks.create.mock.calls[2][2]).not.toBe(firstKey);
  });

  it('rotates the pending key when the payload changes after a failure', async () => {
    apiMocks.list.mockResolvedValue(createEnabledContract());
    apiMocks.create.mockRejectedValue(new Error('conexión interrumpida'));

    render(<SurveyGovernancePanel surveyId={42} tenantSlug="junin" />);
    fireEvent.change(await screen.findByLabelText('Texto público aprobado'), {
      target: { value: CONSENT_TEXT },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('SHA-256 calculado con Web Crypto')).toHaveValue(CONSENT_SHA256),
    );
    fireEvent.click(screen.getByRole('button', { name: /Crear release borrador/i }));
    await waitFor(() => expect(apiMocks.create).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Texto público aprobado'), {
      target: { value: UPDATED_CONSENT_TEXT },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('SHA-256 calculado con Web Crypto')).toHaveValue(
        UPDATED_CONSENT_SHA256,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /Crear release borrador/i }));
    await waitFor(() => expect(apiMocks.create).toHaveBeenCalledTimes(2));

    expect(apiMocks.create.mock.calls[1][2]).not.toBe(apiMocks.create.mock.calls[0][2]);
    expect(apiMocks.create.mock.calls[1][1].consent_policy).toEqual({
      policy_version: 'consent-v1',
      public_text: UPDATED_CONSENT_TEXT,
      text_sha256: UPDATED_CONSENT_SHA256,
      required: true,
    });
  });

  it('guards a mutation synchronously against double submit before React state commits', async () => {
    const request = deferred<SurveyGovernanceRelease>();
    apiMocks.list.mockResolvedValue(createEnabledContract());
    apiMocks.create.mockReturnValueOnce(request.promise);

    render(<SurveyGovernancePanel surveyId={42} tenantSlug="junin" />);
    fireEvent.change(await screen.findByLabelText('Texto público aprobado'), {
      target: { value: CONSENT_TEXT },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('SHA-256 calculado con Web Crypto')).toHaveValue(CONSENT_SHA256),
    );

    const createButton = screen.getByRole('button', { name: /Crear release borrador/i });
    await act(async () => {
      createButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      createButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(apiMocks.create).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve(draftAck());
      await request.promise;
    });
    expect(await screen.findByText(/Release borrador confirmado por el backend/i)).toBeInTheDocument();
  });

  it('publishes and closes only when each release action is explicitly authorized', async () => {
    const draft = {
      ...release,
      status: 'draft' as const,
      published_at: null,
      capabilities: { can_publish: true, can_close: false },
    };
    const published = {
      ...release,
      capabilities: { can_publish: false, can_close: true },
    };
    const closed = {
      ...release,
      status: 'closed' as const,
      closed_at: '2026-07-30T13:00:00Z',
      capabilities: { can_publish: false, can_close: false },
    };
    apiMocks.list
      .mockResolvedValueOnce(
        listContract({
          survey_state: 'borrador',
          active_release_id: null,
          items: [draft],
        }),
      )
      .mockResolvedValueOnce(
        listContract({
          items: [published],
          active_release_id: published.release_id,
        }),
      )
      .mockResolvedValueOnce(
        listContract({
          survey_state: 'cerrada',
          items: [closed],
          active_release_id: null,
        }),
      );
    apiMocks.publish.mockResolvedValueOnce({
      ...published,
      idempotency: { persisted: true, replayed: false, disposition: 'accepted' },
    });
    apiMocks.close.mockResolvedValueOnce(closedAck());

    render(<SurveyGovernancePanel surveyId={42} tenantSlug="junin" />);
    fireEvent.click(await screen.findByRole('button', { name: /Publicar snapshot verificado/i }));
    await waitFor(() => expect(apiMocks.publish).toHaveBeenCalledTimes(1));
    expect(apiMocks.publish.mock.calls[0]).toEqual([
      42,
      5,
      'a'.repeat(64),
      expect.stringMatching(/^survey-governance:publish:42:/),
      { tenantSlug: 'junin' },
    ]);

    fireEvent.change(await screen.findByLabelText('Referencia de revisión humana'), {
      target: { value: REVIEW_REFERENCE },
    });
    fireEvent.click(screen.getByRole('button', { name: /Cerrar release/i }));
    expect(apiMocks.close).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: /Cerrar definitivamente el release v1/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cierre irreversible/i }));
    await waitFor(() => expect(apiMocks.close).toHaveBeenCalledTimes(1));
    expect(apiMocks.close.mock.calls[0]).toEqual([
      42,
      5,
      REVIEW_REFERENCE,
      expect.stringMatching(/^survey-governance:close:42:/),
      { tenantSlug: 'junin' },
    ]);
    expect(await screen.findByText('Cerrado')).toBeInTheDocument();
  });

  it('discards a governance contract returned after the tenant changed', async () => {
    const juninResponse = deferred<SurveyGovernanceReleaseList>();
    const mendozaRelease = { ...release, release_id: 7, version_number: 7 };
    const mendozaContract = listContract({
      tenant: { id: 8, slug: 'mendoza' },
      active_release_id: 7,
      latest_release_id: 7,
      items: [mendozaRelease],
    });
    apiMocks.list.mockImplementation((_surveyId, options) =>
      options?.tenantSlug === 'junin' ? juninResponse.promise : Promise.resolve(mendozaContract),
    );

    const { rerender } = render(<SurveyGovernancePanel surveyId={42} tenantSlug="junin" />);
    await waitFor(() => expect(apiMocks.list).toHaveBeenCalledTimes(1));
    rerender(<SurveyGovernancePanel surveyId={42} tenantSlug="mendoza" />);

    expect(await screen.findByText('Release v7')).toBeInTheDocument();
    await act(async () => {
      juninResponse.resolve(listContract());
      await juninResponse.promise;
    });

    expect(screen.getByText('Release v7')).toBeInTheDocument();
    expect(screen.queryByText('Release v1')).not.toBeInTheDocument();
  });
});
