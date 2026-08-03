import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  SurveyEligibilityIssueReceipt,
  SurveyEligibilityReleaseScope,
  SurveyEligibilitySummary,
} from '@/types/surveyEligibilityAdmin';

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  summary: vi.fn(),
  issue: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('@/api/surveyEligibilityAdmin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/surveyEligibilityAdmin')>();
  return {
    ...actual,
    listSurveyEligibilityReleaseScopes: apiMocks.list,
    getSurveyEligibilitySummary: apiMocks.summary,
    issueSurveyEligibilityGrant: apiMocks.issue,
    revokeSurveyEligibilityGrant: apiMocks.revoke,
  };
});

import { SurveyEligibilityAdminPanel } from './SurveyEligibilityAdminPanel';

const SUBJECT_REF = `subj_${'S'.repeat(43)}`;
const REVIEW_REFERENCE = 'review:case-eligibility-0001';
const GRANT_REF = `seg1_${'G'.repeat(43)}`;
const CREDENTIAL = `sec1_${'C'.repeat(43)}`;

const release: SurveyEligibilityReleaseScope = {
  tenantId: 9,
  surveyId: 42,
  releaseId: 7,
  versionNumber: 3,
  status: 'published',
  policyVersion: 'eligibility-2026.1',
  mode: 'manual_review',
  active: true,
  planAllowsWrite: true,
};

const summary: SurveyEligibilitySummary = {
  contractVersion: 'surveys.eligibility_aggregate.v1',
  surveyId: 42,
  releaseId: 7,
  policyVersion: 'eligibility-2026.1',
  counts: { issued: 5, active: 2, redeemed: 1, revoked: 1, expired: 1 },
  eligiblePopulation: null,
  participationRate: null,
  abstentions: null,
  denominatorStatus: {
    available: false,
    reasonCode: 'survey_eligible_population_not_sealed',
  },
};

const issuedReceipt: SurveyEligibilityIssueReceipt = {
  contractVersion: 'surveys.eligibility_grant.v1',
  tenantId: 9,
  surveyId: 42,
  releaseId: 7,
  grantRef: GRANT_REF,
  state: 'active',
  generation: 1,
  mode: 'manual_review',
  policyVersion: 'eligibility-2026.1',
  expiresAt: '2026-09-01T12:00:00Z',
  credentialHeader: 'X-Survey-Eligibility-Credential',
  credential: CREDENTIAL,
  replayed: false,
};

describe('SurveyEligibilityAdminPanel', () => {
  beforeEach(() => {
    apiMocks.list.mockReset();
    apiMocks.summary.mockReset();
    apiMocks.issue.mockReset();
    apiMocks.revoke.mockReset();
    apiMocks.list.mockResolvedValue([release]);
    apiMocks.summary.mockResolvedValue(summary);
  });

  it('fails closed without an explicit tenant and never calls the API', async () => {
    render(<SurveyEligibilityAdminPanel surveyId={42} tenantSlug={null} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/tenant y la encuesta/i);
    expect(apiMocks.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Emitir con revisión humana/i })).not.toBeInTheDocument();
  });

  it('authorizes through the exact summary scope and renders only source-backed counts', async () => {
    render(<SurveyEligibilityAdminPanel surveyId={42} tenantSlug="junin" />);

    expect(await screen.findByText('Scope y capability confirmados')).toBeInTheDocument();
    expect(apiMocks.list).toHaveBeenCalledWith(42, 'junin');
    expect(apiMocks.summary).toHaveBeenCalledWith(release, 'junin');
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/no se inventan denominadores/i)).toBeInTheDocument();
    expect(screen.queryByText('20%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Emitir con revisión humana/i })).toBeEnabled();
  });

  it('keeps the raw credential only in component memory with copy, reveal and explicit erase', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    const localStorageWrite = vi.spyOn(Storage.prototype, 'setItem');
    apiMocks.issue.mockResolvedValue(issuedReceipt);

    render(<SurveyEligibilityAdminPanel surveyId={42} tenantSlug="junin" />);
    expect(screen.getByText(/No persiste padrón, DNI, email ni credenciales en storage, caché, URL o logs/i)).toBeInTheDocument();
    await screen.findByText('Scope y capability confirmados');
    fireEvent.change(screen.getByLabelText('subject_ref opaco'), { target: { value: SUBJECT_REF } });
    fireEvent.change(screen.getByLabelText('Referencia de revisión'), { target: { value: REVIEW_REFERENCE } });
    fireEvent.click(screen.getByRole('button', { name: /Emitir con revisión humana/i }));

    const credentialInput = await screen.findByLabelText('Credencial de elegibilidad emitida');
    expect(credentialInput).toHaveAttribute('type', 'password');
    expect(credentialInput).toHaveAttribute('autocomplete', 'one-time-code');
    expect(credentialInput).toHaveValue(CREDENTIAL);
    expect(apiMocks.issue).toHaveBeenCalledWith(
      release,
      { subjectRef: SUBJECT_REF, reviewReference: REVIEW_REFERENCE, expiresAt: undefined },
      expect.stringMatching(/^survey-eligibility:issue:42:7:/),
      'junin',
    );
    expect(localStorageWrite).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(credentialInput).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(CREDENTIAL));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar credencial' }));
    expect(screen.queryByLabelText('Credencial de elegibilidad emitida')).not.toBeInTheDocument();
    expect(screen.getByText(/Credencial borrada de esta pantalla/i)).toBeInTheDocument();
    localStorageWrite.mockRestore();
  });

  it('blocks all mutations when summary capability cannot be confirmed', async () => {
    apiMocks.summary.mockRejectedValue(new Error('survey_eligibility_manage_capability_required'));
    render(<SurveyEligibilityAdminPanel surveyId={42} tenantSlug="junin" />);

    expect(await screen.findByText('Capability no confirmada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Emitir con revisión humana/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revocar credencial/i })).not.toBeInTheDocument();
  });

  it('keeps mutations blocked when the tenant plan contract is read-only', async () => {
    apiMocks.list.mockResolvedValue([{ ...release, planAllowsWrite: false }]);
    render(<SurveyEligibilityAdminPanel surveyId={42} tenantSlug="junin" />);

    expect(await screen.findByText('Plan sin escritura habilitada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Emitir con revisión humana/i })).not.toBeInTheDocument();
    expect(apiMocks.issue).not.toHaveBeenCalled();
    expect(apiMocks.revoke).not.toHaveBeenCalled();
  });

  it('confirms revocation and reuses the idempotency key after an ambiguous failure', async () => {
    apiMocks.revoke
      .mockRejectedValueOnce(new Error('conexión interrumpida'))
      .mockResolvedValueOnce({
        contractVersion: 'surveys.eligibility_grant.v1',
        tenantId: 9,
        surveyId: 42,
        releaseId: 7,
        grantRef: GRANT_REF,
        state: 'revoked',
        reasonCode: 'administrative_revocation',
        policyVersion: 'eligibility-2026.1',
        replayed: true,
      });
    render(<SurveyEligibilityAdminPanel surveyId={42} tenantSlug="junin" />);
    await screen.findByText('Scope y capability confirmados');
    fireEvent.change(screen.getByLabelText('grant_ref'), { target: { value: GRANT_REF } });

    fireEvent.click(screen.getByRole('button', { name: 'Revocar credencial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar revocación' }));
    expect(await screen.findByText(/misma solicitud conservará su clave idempotente/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revocar credencial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar revocación' }));
    expect(await screen.findByText(/recuperada de forma idempotente/i)).toBeInTheDocument();
    expect(apiMocks.revoke).toHaveBeenCalledTimes(2);
    expect(apiMocks.revoke.mock.calls[1][3]).toBe(apiMocks.revoke.mock.calls[0][3]);
    expect(apiMocks.revoke.mock.calls[0]).toEqual([
      release,
      GRANT_REF,
      'administrative_revocation',
      expect.stringMatching(/^survey-eligibility:revoke:42:7:/),
      'junin',
    ]);
  });
});
