import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: Record<string, unknown>;
    requestId?: string;

    constructor(message: string, status = 500, body?: Record<string, unknown>, requestId?: string) {
      super(message);
      this.status = status;
      this.body = body;
      this.requestId = requestId;
    }
  },
}));

import { postPublicResponse } from '@/api/encuestas';
import type { PublicResponsePayload, PublicSurveySubmitOptions } from '@/types/encuestas';
import { AmbiguousSurveySubmissionError } from '@/utils/surveySubmissionErrors';
import { SURVEY_ELIGIBILITY_CREDENTIAL_HEADER } from '@/utils/surveyEligibility';

const submissionId = '018f4c8e-1e56-7f38-a4df-83fd68394910';
const credential = 'sec1_this-is-an-opaque-memory-only-credential';
const payload: PublicResponsePayload = {
  submission_id: submissionId,
  instrument_revision: 7,
  respuestas: [{ pregunta_id: 101, opcion_ids: [1] }],
  governance: {
    release_id: 51,
    snapshot_sha256: 'a'.repeat(64),
    eligibility_policy_version: 'eligibility-v1',
    consent_policy_version: 'consent-v1',
    consent_accepted: true,
    eligibility_acknowledged: true,
  },
};
const submitOptions: PublicSurveySubmitOptions = {
  eligibilityCredential: credential,
  eligibilityExpectation: {
    contractVersion: 'surveys.public_eligibility.v1',
    releaseId: 51,
    policyVersion: 'eligibility-v1',
    mode: 'institution_attested',
  },
};

const restrictedAck = (replayed: boolean) => {
  const responseId = 901;
  const eligibility = {
    contract_version: 'surveys.public_eligibility.v1',
    credential_required: true,
    gate_status: 'verified',
    decision: 'verified_by_opaque_grant',
    privacy_assurance: 'pseudonymous_internal_linkability',
    assurance_level: 'human_reviewed_opaque_grant',
    authority_binding: 'operator_attested_v1',
    subject_identifier_exposed: false,
    plaintext_credential_persisted: false,
    persist_client_side: false,
    ballot_secrecy_certified: false,
    eligible_population: null,
    participation_rate: null,
    abstentions: null,
    denominator_status: {
      available: false,
      reason_code: 'survey_eligible_population_not_sealed',
    },
    regulated_election_certified: false,
    result_certified: false,
    redemption: {
      contract_version: 'surveys.eligibility_redemption.v1',
      state: 'committed',
      persisted: true,
      response_id: responseId,
      release_id: 51,
      policy_version: 'eligibility-v1',
      redeemed_at: '2026-08-02T12:00:00+00:00',
    },
  };
  const governance = {
    contract_version: 'surveys.public_governance.v1',
    mode: 'governed_release',
    release_id: 51,
    snapshot_sha256: 'a'.repeat(64),
    eligibility_policy_version: 'eligibility-v1',
    consent_policy_version: 'consent-v1',
    eligibility_decision: 'verified_by_opaque_grant',
    eligibility,
    human_review_required: true,
    regulated_election_certified: false,
    result_certified: false,
  };
  return {
    contract_version: 'surveys.public_response.v2',
    ok: true,
    persisted: true,
    replayed,
    respuesta_id: responseId,
    response_id: responseId,
    instrument_revision: 7,
    governance,
    idempotency: {
      contract_version: 'surveys.response_receipt.v1',
      canonical_version: 'survey-response.v1',
      receipt_id: 1901,
      submission_id: submissionId,
      response_id: responseId,
      instrument_revision: 7,
      state: 'committed',
      disposition: replayed ? 'replayed' : 'accepted',
      persisted: true,
      replayed,
      governance,
    },
  };
};

describe('opaque public survey eligibility transport', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('sends the raw credential only in the dedicated header', async () => {
    apiFetchMock.mockResolvedValueOnce(restrictedAck(false));
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await postPublicResponse('consulta-institucional', payload, 'junin', submitOptions);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [, requestOptions] = apiFetchMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(requestOptions.headers).toEqual({
      'Idempotency-Key': submissionId,
      [SURVEY_ELIGIBILITY_CREDENTIAL_HEADER]: credential,
    });
    expect(requestOptions.body).toStrictEqual(payload);
    expect(JSON.stringify(requestOptions.body)).not.toContain(credential);
    expect(JSON.stringify(requestOptions.body)).not.toContain('eligibilityCredential');
    expect(localSet).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('fails closed on a 2xx without the exact durable redemption receipt', async () => {
    const malformed = restrictedAck(false);
    delete (malformed.governance.eligibility as Record<string, unknown>).redemption;
    apiFetchMock.mockResolvedValueOnce(malformed);

    await expect(
      postPublicResponse('consulta-institucional', payload, 'junin', submitOptions),
    ).rejects.toBeInstanceOf(AmbiguousSurveySubmissionError);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts an exact replay ACK bound to the same response, release, and policy', async () => {
    apiFetchMock.mockResolvedValueOnce(restrictedAck(true));

    await expect(
      postPublicResponse('consulta-institucional', payload, 'junin', submitOptions),
    ).resolves.toMatchObject({ response_id: 901, replayed: true, persisted: true });
  });

  it('refuses to send a credential without a matching non-secret expectation', () => {
    expect(() =>
      postPublicResponse('consulta-institucional', payload, 'junin', {
        eligibilityCredential: credential,
      }),
    ).toThrow(/no está vinculada/i);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('rejects credential-like JSON fields before issuing a request', () => {
    const pollutedPayload = {
      ...payload,
      metadata: {
        eligibility_credential: credential,
      },
    } as unknown as PublicResponsePayload;

    expect(() =>
      postPublicResponse('consulta-institucional', pollutedPayload, 'junin', submitOptions),
    ).toThrow(/encabezado seguro dedicado/i);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
