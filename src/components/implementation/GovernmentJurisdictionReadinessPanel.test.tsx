import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClerkRuntimeProvider, type ClerkRuntimeValue } from '@/components/auth/ClerkRuntimeContext';
import GovernmentJurisdictionReadinessPanel from '@/components/implementation/GovernmentJurisdictionReadinessPanel';
import { NetworkError } from '@/utils/api';

const jurisdictionApi = vi.hoisted(() => ({
  getGovernmentJurisdictionReadiness: vi.fn(),
  submitGovernmentJurisdictionEvidence: vi.fn(),
  reviewGovernmentJurisdictionEvidence: vi.fn(),
}));

vi.mock('@/api/v2/governmentJurisdiction', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/v2/governmentJurisdiction')>()),
  ...jurisdictionApi,
}));

const runtime: ClerkRuntimeValue = {
  enabled: false,
  loading: false,
  publishableKey: '',
  source: 'disabled',
  socialProviders: [],
  readyForSessionSync: false,
};
const documentSha256 = 'a'.repeat(64);
const submissionSha256 = 'b'.repeat(64);

const readiness = ({
  state = 'unverified',
  readyToPublish = false,
  tenantSlug = 'gobierno-demo',
}: {
  state?: 'unverified' | 'evidence_submitted' | 'rejected' | 'verified' | 'invalid_verified_record';
  readyToPublish?: boolean;
  tenantSlug?: string;
} = {}) => {
  const hasSubmission = ['evidence_submitted', 'rejected', 'verified'].includes(state);
  const hasReview = state === 'rejected' || state === 'verified';
  const nextAction = {
    unverified: 'submit_jurisdiction_evidence',
    evidence_submitted: 'await_platform_jurisdiction_review',
    rejected: 'resubmit_jurisdiction_evidence',
    verified: 'review_survey_content',
    invalid_verified_record: 'contact_platform_support',
  }[state];
  return {
    contract_version: 'government.jurisdiction.readiness.v1' as const,
    tenant: { id: 41, slug: tenantSlug, type: 'municipio' },
    state,
    ready_to_publish: readyToPublish,
    next_action: nextAction,
    publication_guard: {
      government_evidence_required: true,
      allowed_to_publish: readyToPublish,
      reason_code: readyToPublish ? null : 'survey_tenant_jurisdiction_unverified',
      guard_preserved: true as const,
    },
    jurisdiction: {
      status: state === 'verified' || state === 'invalid_verified_record' ? 'verified' : 'unverified',
      reference: hasSubmission ? 'jurisdiccion:organismo:alcance' : null,
      evidence: {
        reference: hasSubmission ? 'evidencia:expediente:0001' : null,
        document_sha256: hasSubmission ? documentSha256 : null,
        submission_sha256: hasSubmission ? submissionSha256 : null,
        raw_content_stored: false as const,
        credentials_stored: false as const,
      },
      verified_by_user_id: state === 'verified' ? 99 : null,
      verified_at: state === 'verified' ? '2026-09-05T15:00:00+00:00' : null,
    },
    workflow: {
      submission: hasSubmission ? {
        id: 81,
        event_type: 'tenant_jurisdiction_evidence_submitted' as const,
        actor_user_id: 7,
        decision: 'submitted' as const,
        submission_sha256: submissionSha256,
        reason_code: null,
        created_at: '2026-09-05T14:00:00+00:00',
      } : null,
      review: hasReview ? {
        id: 82,
        event_type: state === 'verified'
          ? 'tenant_jurisdiction_verified' as const
          : 'tenant_jurisdiction_rejected' as const,
        actor_user_id: 99,
        decision: state === 'verified' ? 'verify' as const : 'reject' as const,
        submission_sha256: submissionSha256,
        reason_code: state === 'verified' ? 'jurisdiction_evidence_verified' : 'documento_incompleto',
        created_at: '2026-09-05T15:00:00+00:00',
      } : null,
      review_matches_submission: hasReview,
      separation_of_duties_enforced: true as const,
    },
  };
};

const renderPanel = ({
  tenantSlug = 'gobierno-demo',
  canSubmitEvidence = true,
  canReview = false,
}: {
  tenantSlug?: string;
  canSubmitEvidence?: boolean;
  canReview?: boolean;
} = {}) => render(
  <ClerkRuntimeProvider value={runtime}>
    <GovernmentJurisdictionReadinessPanel
      tenantSlug={tenantSlug}
      canSubmitEvidence={canSubmitEvidence}
      canReview={canReview}
    />
  </ClerkRuntimeProvider>,
);

const enterValidEvidence = () => {
  fireEvent.change(screen.getByLabelText(/referencia de jurisdicción/i), {
    target: { value: 'jurisdiccion:organismo:alcance' },
  });
  fireEvent.change(screen.getByLabelText(/referencia del respaldo/i), {
    target: { value: 'evidencia:expediente:0001' },
  });
  fireEvent.change(screen.getByLabelText(/huella sha-256/i), {
    target: { value: documentSha256 },
  });
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
};

describe('GovernmentJurisdictionReadinessPanel', () => {
  beforeEach(() => {
    jurisdictionApi.getGovernmentJurisdictionReadiness.mockReset().mockResolvedValue(readiness());
    jurisdictionApi.submitGovernmentJurisdictionEvidence.mockReset().mockResolvedValue({
      contract_version: 'government.jurisdiction.evidence_submission.v1',
      replayed: false,
      write_performed: true,
      verification_granted: false,
      readiness: readiness({ state: 'evidence_submitted' }),
    });
    jurisdictionApi.reviewGovernmentJurisdictionEvidence.mockReset().mockResolvedValue({
      contract_version: 'government.jurisdiction.review.v1',
      decision: 'verify',
      replayed: false,
      write_performed: true,
      readiness: readiness({ state: 'verified', readyToPublish: true }),
    });
  });

  it('loads the server-owned state and keeps publication protected without inferring readiness', async () => {
    renderPanel();

    expect(await screen.findByText('Acreditar el alcance institucional')).toBeInTheDocument();
    expect(screen.getByText('Publicación protegida')).toBeInTheDocument();
    expect(screen.getByText(/presentar el respaldo institucional/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /presentar para revisión/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verificar evidencia/i })).not.toBeInTheDocument();
    expect(jurisdictionApi.submitGovernmentJurisdictionEvidence).not.toHaveBeenCalled();
    expect(jurisdictionApi.reviewGovernmentJurisdictionEvidence).not.toHaveBeenCalled();
  });

  it('validates opaque references and the document digest before opening confirmation', async () => {
    renderPanel();
    await screen.findByText('Acreditar el alcance institucional');

    fireEvent.change(screen.getByLabelText(/referencia del respaldo/i), {
      target: { value: 'https://storage.example/private?token=secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /presentar para revisión/i }));

    expect(screen.getByText(/no pegues una url/i)).toBeInTheDocument();
    expect(screen.getByText(/huella sha-256 válida/i)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(jurisdictionApi.submitGovernmentJurisdictionEvidence).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation and records a tenant submission without auto-verification', async () => {
    renderPanel();
    await screen.findByText('Acreditar el alcance institucional');
    enterValidEvidence();
    fireEvent.click(screen.getByRole('button', { name: /presentar para revisión/i }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/no concede verificación/i);
    expect(jurisdictionApi.submitGovernmentJurisdictionEvidence).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirmar presentación/i }));

    expect(await screen.findByText(/verificación sigue pendiente/i)).toBeInTheDocument();
    expect(screen.getByText('Evidencia presentada')).toBeInTheDocument();
    expect(jurisdictionApi.submitGovernmentJurisdictionEvidence).toHaveBeenCalledWith({
      tenantSlug: 'gobierno-demo',
      jurisdictionRef: 'jurisdiccion:organismo:alcance',
      evidenceRef: 'evidencia:expediente:0001',
      evidenceSha256: documentSha256,
      idempotencyKey: expect.stringMatching(/^jurisdiction-evidence:/),
    });
    expect(jurisdictionApi.reviewGovernmentJurisdictionEvidence).not.toHaveBeenCalled();
  });

  it('reuses the same submission identity after an uncertain response', async () => {
    jurisdictionApi.submitGovernmentJurisdictionEvidence
      .mockRejectedValueOnce(new NetworkError('connection closed'))
      .mockResolvedValueOnce({
        contract_version: 'government.jurisdiction.evidence_submission.v1',
        replayed: true,
        write_performed: false,
        verification_granted: false,
        readiness: readiness({ state: 'evidence_submitted' }),
      });
    renderPanel();
    await screen.findByText('Acreditar el alcance institucional');
    enterValidEvidence();
    fireEvent.click(screen.getByRole('button', { name: /presentar para revisión/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar presentación/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/misma operación sin duplicarla/i);
    fireEvent.click(screen.getByRole('button', { name: /presentar para revisión/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar presentación/i }));

    await waitFor(() => expect(jurisdictionApi.submitGovernmentJurisdictionEvidence).toHaveBeenCalledTimes(2));
    expect(jurisdictionApi.submitGovernmentJurisdictionEvidence.mock.calls[1][0].idempotencyKey)
      .toBe(jurisdictionApi.submitGovernmentJurisdictionEvidence.mock.calls[0][0].idempotencyKey);
  });

  it('shows an awaiting state to tenant admins without exposing platform review controls', async () => {
    jurisdictionApi.getGovernmentJurisdictionReadiness.mockResolvedValueOnce(
      readiness({ state: 'evidence_submitted' }),
    );
    renderPanel();

    expect(await screen.findByText('Evidencia presentada')).toBeInTheDocument();
    expect(screen.getByText(/revisión asignada a la plataforma/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /presentar para revisión/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verificar evidencia/i })).not.toBeInTheDocument();
  });

  it('exposes review only to a platform role and binds verification to the exact submission', async () => {
    jurisdictionApi.getGovernmentJurisdictionReadiness.mockResolvedValueOnce(
      readiness({ state: 'evidence_submitted' }),
    );
    renderPanel({ canSubmitEvidence: false, canReview: true });

    expect(await screen.findByTestId('government-jurisdiction-platform-review')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /presentar para revisión/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /verificar evidencia/i }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/identidad reforzada/i);
    expect(jurisdictionApi.reviewGovernmentJurisdictionEvidence).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirmar verificación/i }));

    expect(await screen.findByText(/revisión independiente confirmada/i)).toBeInTheDocument();
    expect(jurisdictionApi.reviewGovernmentJurisdictionEvidence).toHaveBeenCalledWith({
      tenantSlug: 'gobierno-demo',
      decision: 'verify',
      expectedSubmissionSha256: submissionSha256,
      idempotencyKey: expect.stringMatching(/^jurisdiction-review:/),
    });
  });

  it('requires a bounded reason code before a platform rejection', async () => {
    jurisdictionApi.getGovernmentJurisdictionReadiness.mockResolvedValueOnce(
      readiness({ state: 'evidence_submitted' }),
    );
    jurisdictionApi.reviewGovernmentJurisdictionEvidence.mockResolvedValueOnce({
      contract_version: 'government.jurisdiction.review.v1',
      decision: 'reject',
      replayed: false,
      write_performed: true,
      readiness: readiness({ state: 'rejected' }),
    });
    renderPanel({ canSubmitEvidence: false, canReview: true });
    await screen.findByTestId('government-jurisdiction-platform-review');

    fireEvent.click(screen.getByRole('button', { name: /observar evidencia/i }));
    expect(screen.getByText(/código breve/i)).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/código de observación/i), {
      target: { value: 'Documento_Incompleto' },
    });
    fireEvent.click(screen.getByRole('button', { name: /observar evidencia/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar observación/i }));

    await waitFor(() => expect(jurisdictionApi.reviewGovernmentJurisdictionEvidence).toHaveBeenCalledWith({
      tenantSlug: 'gobierno-demo',
      decision: 'reject',
      expectedSubmissionSha256: submissionSha256,
      reasonCode: 'documento_incompleto',
      idempotencyKey: expect.stringMatching(/^jurisdiction-review:/),
    }));
  });

  it('keeps an invalid verified record fail-closed and directs it to support', async () => {
    jurisdictionApi.getGovernmentJurisdictionReadiness.mockResolvedValueOnce(
      readiness({ state: 'invalid_verified_record' }),
    );
    renderPanel();

    expect(await screen.findByText('La verificación necesita soporte')).toBeInTheDocument();
    expect(screen.getByText('Publicación protegida')).toBeInTheDocument();
    expect(screen.getByText(/solicitar corrección a soporte/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /presentar para revisión/i })).not.toBeInTheDocument();
  });

  it('discards a response resolved after a tenant switch', async () => {
    const delayed = deferred<ReturnType<typeof readiness>>();
    jurisdictionApi.getGovernmentJurisdictionReadiness
      .mockReturnValueOnce(delayed.promise)
      .mockResolvedValueOnce(readiness({ tenantSlug: 'organizacion-b' }));
    const view = renderPanel({ tenantSlug: 'organizacion-a' });

    view.rerender(
      <ClerkRuntimeProvider value={runtime}>
        <GovernmentJurisdictionReadinessPanel
          tenantSlug="organizacion-b"
          canSubmitEvidence
          canReview={false}
        />
      </ClerkRuntimeProvider>,
    );
    expect(await screen.findByText('Acreditar el alcance institucional')).toBeInTheDocument();
    await act(async () => { delayed.resolve(readiness({ tenantSlug: 'organizacion-a' })); });

    expect(jurisdictionApi.getGovernmentJurisdictionReadiness).toHaveBeenLastCalledWith('organizacion-b');
    expect(screen.getByTestId('government-jurisdiction-readiness')).toHaveAttribute('data-state', 'unverified');
  });
});
