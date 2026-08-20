import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  parseSurveyResponseProvenance,
  SurveyResponseProvenanceBadge,
} from './SurveyResponseProvenanceBadge';

const realProvenance = (syntheticExcluded = 0) => ({
  contract_version: 'surveys.response_provenance.v1',
  mode: 'real',
  server_trusted_classification: true,
  contains_synthetic: false,
  real_responses_included: 72,
  synthetic_responses_included: 0,
  synthetic_responses_excluded: syntheticExcluded,
  synthetic_marker_contract: 'surveys.demo_seeding.v1',
});

describe('SurveyResponseProvenanceBadge', () => {
  it('shows citizen results and the exact excluded simulation count', () => {
    render(
      <SurveyResponseProvenanceBadge
        sources={[{ data_provenance: realProvenance(100) }]}
      />,
    );

    const status = screen.getByRole('status', { name: /resultados ciudadanos/i });
    expect(status).toHaveTextContent('Resultados ciudadanos');
    expect(status).toHaveTextContent('Simulación excluida del cálculo · 100 respuestas excluidas');
  });

  it('labels explicit synthetic mode as non-citizen participation', () => {
    render(
      <SurveyResponseProvenanceBadge
        sources={[
          {
            response_provenance: {
              ...realProvenance(),
              mode: 'synthetic',
              contains_synthetic: true,
              real_responses_included: 0,
              synthetic_responses_included: 45,
            },
          },
        ]}
      />,
    );

    const status = screen.getByRole('status', { name: /escenario sintético/i });
    expect(status).toHaveTextContent('No representa participación ciudadana');
    expect(status).toHaveTextContent('45 respuestas sintéticas');
  });

  it('renders nothing when the contract is missing or malformed', () => {
    const { container, rerender } = render(
      <SurveyResponseProvenanceBadge sources={[{ total_respuestas: 72 }]} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <SurveyResponseProvenanceBadge
        sources={[
          {
            data_provenance: {
              ...realProvenance(),
              server_trusted_classification: false,
            },
          },
        ]}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('rejects internally inconsistent trusted-looking payloads', () => {
    expect(
      parseSurveyResponseProvenance({
        ...realProvenance(),
        contains_synthetic: true,
        synthetic_responses_included: 0,
      }),
    ).toBeNull();
  });
});
