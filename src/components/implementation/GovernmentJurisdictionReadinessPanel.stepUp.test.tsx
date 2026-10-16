import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClerkRuntimeProvider } from '@/components/auth/ClerkRuntimeContext';
import GovernmentJurisdictionReadinessPanel from '@/components/implementation/GovernmentJurisdictionReadinessPanel';
import { ApiError } from '@/utils/api';

const clerkState = vi.hoisted(() => ({
  mode: 'complete' as 'complete' | 'cancel',
  promptCount: 0,
  getToken: vi.fn(),
  user: {
    id: 'user_clerk_platform_reviewer',
    firstName: 'Revisor',
    lastName: 'Plataforma',
    emailAddresses: [],
    phoneNumbers: [],
    externalAccounts: [],
  },
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: clerkState.getToken,
    isLoaded: true,
    isSignedIn: true,
    userId: clerkState.user.id,
  }),
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: clerkState.user }),
  useReverification: (fetcher: (...args: any[]) => Promise<any>) => async (...args: any[]) => {
    const firstResult = await fetcher(...args);
    if (firstResult?.clerk_error?.reason !== 'reverification-error') return firstResult;
    clerkState.promptCount += 1;
    if (clerkState.mode === 'cancel') {
      throw { code: 'reverification_cancelled', clerkRuntimeError: true };
    }
    return fetcher(...args);
  },
}));

vi.mock('@clerk/clerk-react/errors', () => ({
  isReverificationCancelledError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'reverification_cancelled'),
}));

const jurisdictionApi = vi.hoisted(() => ({
  getGovernmentJurisdictionReadiness: vi.fn(),
  submitGovernmentJurisdictionEvidence: vi.fn(),
  reviewGovernmentJurisdictionEvidence: vi.fn(),
}));

vi.mock('@/api/v2/governmentJurisdiction', () => jurisdictionApi);

const clerkApi = vi.hoisted(() => ({ syncClerkSession: vi.fn() }));
vi.mock('@/api/clerkAuth', () => ({ syncClerkSession: clerkApi.syncClerkSession }));

const sessionHelpers = vi.hoisted(() => ({
  buildClerkProfile: vi.fn((user: any) => ({ id: user.id })),
  persistChatbocSession: vi.fn(),
}));
vi.mock('@/utils/clerkSession', () => sessionHelpers);

const documentSha256 = 'a'.repeat(64);
const submissionSha256 = 'b'.repeat(64);
const pendingReadiness = {
  contract_version: 'government.jurisdiction.readiness.v1',
  tenant: { id: 41, slug: 'gobierno-demo', type: 'municipio' },
  state: 'evidence_submitted',
  ready_to_publish: false,
  next_action: 'await_platform_jurisdiction_review',
  publication_guard: {
    government_evidence_required: true,
    allowed_to_publish: false,
    reason_code: 'survey_tenant_jurisdiction_unverified',
    guard_preserved: true,
  },
  jurisdiction: {
    status: 'unverified',
    reference: 'jurisdiccion:organismo:alcance',
    evidence: {
      reference: 'evidencia:expediente:0001',
      document_sha256: documentSha256,
      submission_sha256: submissionSha256,
      raw_content_stored: false,
      credentials_stored: false,
    },
    verified_by_user_id: null,
    verified_at: null,
  },
  workflow: {
    submission: {
      id: 81,
      event_type: 'tenant_jurisdiction_evidence_submitted',
      actor_user_id: 7,
      decision: 'submitted',
      submission_sha256: submissionSha256,
      reason_code: null,
      created_at: '2026-09-05T14:00:00+00:00',
    },
    review: null,
    review_matches_submission: false,
    separation_of_duties_enforced: true,
  },
};
const verifiedReadiness = {
  ...pendingReadiness,
  state: 'verified',
  ready_to_publish: true,
  next_action: 'review_survey_content',
  publication_guard: {
    ...pendingReadiness.publication_guard,
    allowed_to_publish: true,
    reason_code: null,
  },
  jurisdiction: {
    ...pendingReadiness.jurisdiction,
    status: 'verified',
    verified_by_user_id: 99,
    verified_at: '2026-09-05T15:00:00+00:00',
  },
  workflow: {
    ...pendingReadiness.workflow,
    review: {
      id: 82,
      event_type: 'tenant_jurisdiction_verified',
      actor_user_id: 99,
      decision: 'verify',
      submission_sha256: submissionSha256,
      reason_code: 'jurisdiction_evidence_verified',
      created_at: '2026-09-05T15:00:00+00:00',
    },
    review_matches_submission: true,
  },
};
const reviewResult = {
  contract_version: 'government.jurisdiction.review.v1',
  decision: 'verify',
  replayed: false,
  write_performed: true,
  readiness: verifiedReadiness,
};
const runtime = {
  enabled: true,
  loading: false,
  publishableKey: 'pk_test_step_up',
  source: 'env' as const,
  environment: 'development',
  productionReady: false,
  socialProviders: ['google'],
  readyForSessionSync: true,
};

const stepUpError = () => new ApiError(
  'Reverification required',
  403,
  {
    contract_version: 'auth.assurance.error.v1',
    status_code: 403,
    reason_code: 'step_up_required',
    retryable: false,
    error: { code: 403, message: 'Esta acción requiere verificación reciente.' },
    clerk_error: {
      type: 'forbidden',
      reason: 'reverification-error',
      metadata: { reverification: 'strict_mfa' },
    },
  },
);

const renderPanel = () => render(
  <ClerkRuntimeProvider value={runtime}>
    <GovernmentJurisdictionReadinessPanel
      tenantSlug="gobierno-demo"
      canSubmitEvidence={false}
      canReview
    />
  </ClerkRuntimeProvider>,
);

const verifyEvidence = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /verificar evidencia/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirmar verificación/i }));
};

describe('GovernmentJurisdictionReadinessPanel Clerk step-up', () => {
  beforeEach(() => {
    clerkState.mode = 'complete';
    clerkState.promptCount = 0;
    clerkState.getToken.mockReset().mockResolvedValue('fresh-clerk-token');
    jurisdictionApi.getGovernmentJurisdictionReadiness.mockReset().mockResolvedValue(pendingReadiness);
    jurisdictionApi.submitGovernmentJurisdictionEvidence.mockReset();
    jurisdictionApi.reviewGovernmentJurisdictionEvidence.mockReset().mockResolvedValue(reviewResult);
    clerkApi.syncClerkSession.mockReset().mockResolvedValue({
      contract_version: 'auth.clerk.v1',
      auth_provider: 'clerk',
      auth_intent: 'tenant_owner',
      session_transport: 'cookie',
      user: { id: 99, rol: 'superadmin', tenant_slug: 'platform' },
      tenant: { id: 1, slug: 'platform' },
      onboarding: { required: false },
    });
    sessionHelpers.buildClerkProfile.mockClear();
    sessionHelpers.persistChatbocSession.mockClear();
  });

  it('reverifies and retries exactly once with the same decision, digest and idempotency key', async () => {
    jurisdictionApi.reviewGovernmentJurisdictionEvidence
      .mockRejectedValueOnce(stepUpError())
      .mockResolvedValueOnce(reviewResult);
    renderPanel();
    await verifyEvidence();

    expect(await screen.findByText(/revisión independiente confirmada/i)).toBeInTheDocument();
    expect(clerkState.promptCount).toBe(1);
    expect(clerkState.getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(clerkApi.syncClerkSession).toHaveBeenCalledWith(
      'fresh-clerk-token',
      { id: clerkState.user.id },
      { intent: 'tenant_owner' },
    );
    expect(jurisdictionApi.reviewGovernmentJurisdictionEvidence).toHaveBeenCalledTimes(2);
    const firstInput = jurisdictionApi.reviewGovernmentJurisdictionEvidence.mock.calls[0][0];
    const secondInput = jurisdictionApi.reviewGovernmentJurisdictionEvidence.mock.calls[1][0];
    expect(secondInput).toBe(firstInput);
    expect(secondInput.expectedSubmissionSha256).toBe(submissionSha256);
    expect(secondInput.idempotencyKey).toBe(firstInput.idempotencyKey);
  });

  it('does not retry or claim verification when the operator cancels step-up', async () => {
    clerkState.mode = 'cancel';
    jurisdictionApi.reviewGovernmentJurisdictionEvidence.mockRejectedValueOnce(stepUpError());
    renderPanel();
    await verifyEvidence();

    expect(await screen.findByRole('alert')).toHaveTextContent(/verificación adicional fue cancelada/i);
    expect(jurisdictionApi.reviewGovernmentJurisdictionEvidence).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/revisión independiente confirmada/i)).not.toBeInTheDocument();
  });
});
