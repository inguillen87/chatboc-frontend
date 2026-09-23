import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SurveyResultEvidenceAssessment } from '@/utils/surveyGovernanceContract';

import { SurveyResultEvidencePanel } from './SurveyResultEvidencePanel';

const reconciledAssessment = (): SurveyResultEvidenceAssessment => ({
  status: 'reconciled',
  reasonCode: null,
  reason: 'El release, el manifiesto y el conteo clasificado de analytics coinciden.',
  release: {
    tenantId: 7,
    tenantSlug: 'junin',
    surveyId: 42,
    releaseId: 5,
    versionNumber: 3,
    closedAt: '2026-09-04T12:00:00Z',
    manifestSha256: 'c'.repeat(64),
    snapshotSha256: 'a'.repeat(64),
    policySha256: 'b'.repeat(64),
    responseSetSha256: 'd'.repeat(64),
    humanReviewReferenceSha256: 'f'.repeat(64),
    eligibilityPolicyVersion: 'eligibility-2026.1',
    consentPolicyVersion: 'consent-2026.1',
  },
  counts: {
    manifest: 12,
    analytics: 8,
    real: 8,
    synthetic: 3,
    unverified: 1,
    classifiedClosureSet: 12,
  },
  canExportReconciledCountReceipt: true,
  assurance: {
    scope: 'count_reconciliation_only',
    resultCertified: false,
    regulatedElectionCertified: false,
    externalAnchorVerified: false,
  },
});

describe('SurveyResultEvidencePanel', () => {
  it('shows the reconciled local closure, full evidence hashes and privacy-safe provenance', () => {
    render(<SurveyResultEvidencePanel assessment={reconciledAssessment()} />);

    expect(screen.getByTestId('survey-result-evidence-status')).toHaveTextContent('Cierre conciliado por conteo');
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('eligibility-2026.1')).toBeInTheDocument();
    expect(screen.getByText('consent-2026.1')).toBeInTheDocument();
    expect(screen.getByText('a'.repeat(64))).toBeInTheDocument();
    expect(screen.getByText('d'.repeat(64))).toBeInTheDocument();
    expect(screen.getByText('f'.repeat(64))).toBeInTheDocument();
    expect(screen.getByText('Respuestas reales').parentElement).toHaveTextContent('8');
    expect(screen.getByText('Sintéticas separadas').parentElement).toHaveTextContent('<5');
    expect(screen.getByText('No verificadas separadas').parentElement).toHaveTextContent('<5');
    expect(screen.getByText(/no se calculan participación, abstención, quorum ni ganador/i)).toBeInTheDocument();
    expect(screen.getByText('Resultado no certificado')).toBeInTheDocument();
    expect(screen.getByText('Sin anclaje externo')).toBeInTheDocument();
    expect(screen.getByText(/hashes son referencias declaradas por el backend/i)).toBeInTheDocument();
    expect(screen.getByText(/no valida la distribución ni el contenido de las respuestas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar recibo de cierre/i })).toBeEnabled();
  });

  it('exports a whitelisted count receipt only after reconciliation', () => {
    const onExport = vi.fn();
    render(<SurveyResultEvidencePanel assessment={reconciledAssessment()} onExport={onExport} />);

    fireEvent.click(screen.getByRole('button', { name: /Descargar recibo de cierre/i }));

    expect(onExport).toHaveBeenCalledTimes(1);
    const [contents, filename] = onExport.mock.calls[0] as [string, string];
    expect(filename).toBe('recibo-cierre-encuesta-42-release-v3.json');
    expect(JSON.parse(contents)).toMatchObject({
      contract_version: 'surveys.closure_count_receipt.v1',
      status: 'closure_reconciled_by_count',
      declared_hash_references: {
        source: 'backend',
        client_verified: false,
      },
      reconciliation: {
        scope: 'count_only',
        validates_manifest_digest: false,
        validates_response_content: false,
        validates_result_distribution: false,
      },
      backend_declared_assurance: {
        client_verified: false,
        result_certified: false,
        regulated_election_certified: false,
        external_anchor_verified: false,
      },
      privacy: {
        pii_included: false,
        small_provenance_cells_suppressed: true,
      },
    });
  });

  it('labels a mismatch as not reconciled and blocks the act download', () => {
    const assessment: SurveyResultEvidenceAssessment = {
      ...reconciledAssessment(),
      status: 'not_reconciled',
      reasonCode: 'response_count_mismatch',
      reason: 'El total clasificado por analytics difiere del conteo sellado en el manifiesto.',
      counts: {
        ...reconciledAssessment().counts,
        classifiedClosureSet: 11,
      },
      canExportReconciledCountReceipt: false,
      assurance: {
        scope: null,
        resultCertified: false,
        regulatedElectionCertified: false,
        externalAnchorVerified: false,
      },
    };

    render(<SurveyResultEvidencePanel assessment={assessment} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Resultado no conciliado');
    expect(screen.queryByText('Cierre conciliado por conteo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar recibo de cierre/i })).toBeDisabled();
  });

  it('does not expose filtered cohort counts while asking for an unfiltered reconciliation', () => {
    const assessment: SurveyResultEvidenceAssessment = {
      ...reconciledAssessment(),
      status: 'not_reconciled',
      reasonCode: 'analytics_filtered',
      reason: 'Quitá los filtros para conciliar el conjunto completo sin exponer cohortes pequeñas.',
      canExportReconciledCountReceipt: false,
    };

    render(<SurveyResultEvidencePanel assessment={assessment} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Quitá los filtros/i);
    expect(screen.queryByText('Respuestas reales')).not.toBeInTheDocument();
    expect(screen.queryByText('Sintéticas separadas')).not.toBeInTheDocument();
  });

  it('uses a progress status while contracts are still loading', () => {
    render(<SurveyResultEvidencePanel loading />);

    expect(screen.getByRole('status')).toHaveTextContent(/Conciliando manifiesto/i);
    expect(screen.getByRole('button', { name: /Descargar recibo de cierre/i })).toBeDisabled();
  });

  it('fails closed when refreshing or when the latest manifest request errors', () => {
    const { rerender } = render(
      <SurveyResultEvidencePanel assessment={reconciledAssessment()} refreshing />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/Conciliando manifiesto/i);
    expect(screen.queryByText('Cierre conciliado por conteo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar recibo de cierre/i })).toBeDisabled();

    rerender(
      <SurveyResultEvidencePanel
        assessment={reconciledAssessment()}
        error="No se pudo consultar el manifiesto de cierre."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Resultado no conciliado');
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo consultar el manifiesto de cierre.');
    expect(screen.getByRole('button', { name: /Descargar recibo de cierre/i })).toBeDisabled();
  });
});
