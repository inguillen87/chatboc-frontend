import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveSurveyPublicGovernance, SurveyForm } from './SurveyForm';
import type { SurveyPublic, SurveyPublicEligibilityContract } from '@/types/encuestas';
import { ApiError, NetworkError } from '@/utils/api';
import {
  AmbiguousSurveySubmissionError,
  SURVEY_RESPONSE_DUPLICATE_MESSAGE,
} from '@/utils/surveySubmissionErrors';
import { runBootstrapPrivacyMigrations } from '@/utils/bootstrapPrivacy';

const envMock = vi.hoisted(() => ({ turnstileSiteKey: '' }));
const requestLocationMock = vi.hoisted(() => vi.fn());
const userMock = vi.hoisted(() => ({ user: null as null | { id: number }, loading: false }));
const analyticsMocks = vi.hoisted(() => ({
  answerSelected: vi.fn(),
  submitError: vi.fn(),
}));

vi.mock('@/env', () => ({
  CLERK_PUBLISHABLE_KEY: '',
  get CLOUDFLARE_TURNSTILE_SITE_KEY() {
    return envMock.turnstileSiteKey;
  },
}));

vi.mock('@/utils/geolocation', () => ({
  requestLocation: (...args: unknown[]) => requestLocationMock(...args),
}));

vi.mock('@/utils/surveyAnalytics', () => ({
  trackSurveyAnswerSelected: (...args: unknown[]) => analyticsMocks.answerSelected(...args),
  trackSurveySubmitError: (...args: unknown[]) => analyticsMocks.submitError(...args),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => ({
    user: userMock.user,
    loading: userMock.loading,
    setUser: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

const baseSurvey: SurveyPublic = {
  slug: 'consulta-barrial',
  instrument_revision: 7,
  titulo: 'Consulta barrial',
  descripcion: 'Prioridades del barrio',
  tipo: 'votacion',
  inicio_at: '2026-06-01',
  fin_at: '2026-06-30',
  politica_unicidad: 'libre',
  preguntas: [
    {
      id: 101,
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Que prioridad elegis?',
      obligatoria: true,
      opciones: [
        { id: 1, orden: 1, texto: 'Luminaria' },
        { id: 2, orden: 2, texto: 'Arbolado' },
      ],
    },
  ],
};

const securedSurvey: SurveyPublic = {
  ...baseSurvey,
  security: {
    contract_version: 'cloudflare.turnstile.public_intake.v1',
    provider: 'cloudflare_turnstile',
    surface: 'survey_public_response',
    required: true,
    enforced: true,
    status: 'required',
  },
  frontend_contract: {
    contract_version: 'surveys.public_frontend.v2',
    turnstile: {
      enabled: true,
      required: true,
      token_header: 'X-Turnstile-Token',
      token_fields: ['turnstile_token'],
    },
  },
};

const liveSurvey: SurveyPublic = {
  ...baseSurvey,
  es_votacion_envivo: true,
  realtime: {
    enabled: true,
  },
};

const adaptiveSurvey: SurveyPublic = {
  ...baseSurvey,
  slug: 'entrevista-adaptativa',
  titulo: 'Entrevista adaptativa',
  preguntas: [
    {
      id: 301,
      orden: 1,
      tipo: 'opcion_unica',
      texto: 'Usaste WhatsApp?',
      obligatoria: true,
      opciones: [
        { id: 3011, orden: 1, texto: 'Si' },
        { id: 3012, orden: 2, texto: 'No' },
      ],
    },
    {
      id: 302,
      orden: 2,
      tipo: 'opcion_unica',
      texto: 'Como fue la experiencia?',
      obligatoria: true,
      conditional_logic: { version: 1, show_if: { question_order: 1, option_order: 1 } },
      opciones: [
        { id: 3021, orden: 1, texto: 'Buena' },
        { id: 3022, orden: 2, texto: 'Mala' },
      ],
    },
    {
      id: 303,
      orden: 3,
      tipo: 'abierta',
      texto: 'Que deberiamos mejorar?',
      obligatoria: true,
      conditional_logic: { version: 1, show_if: { question_order: 2, option_order: 2 } },
    },
  ],
};

const authenticatedSurvey: SurveyPublic = {
  ...baseSurvey,
  politica_unicidad: 'por_usuario',
  auth_mode: 'required',
  anonimo_permitido: false,
};

const CONSENT_TEXT_V1 = 'Texto de consentimiento público v1.';
const CONSENT_TEXT_V2 = 'Texto de consentimiento público v2.';
const CONSENT_SHA256_V1 = '6d249815b4c57b0090d95e1ddd777f4514938a5bc6229ad6b2875bdef32c571e';
const CONSENT_SHA256_V2 = '93e9006dfb83b0fea211db316335112660961f3fe5de66bcab34c19b9ef15358';

const selfAttestedEligibilityContract = (
  policyVersion: string,
): SurveyPublicEligibilityContract => ({
  contract_version: 'surveys.public_eligibility.v1',
  policy_version: policyVersion,
  mode: 'self_attested',
  credential_required: false,
  gate_status: 'attestation_only',
  intake_available: true,
  decision: 'not_evaluated',
  transport: null,
  blocked_reason_code: null,
  eligible_population: null,
  participation_rate: null,
  abstentions: null,
  denominator_status: {
    available: false,
    reason_code: 'survey_eligible_population_not_sealed',
  },
  privacy_assurance: 'attestation_only',
  assurance_level: 'attestation_only',
  authority_binding: null,
  subject_identifier_exposed: false,
  plaintext_credential_persisted: false,
  persist_client_side: false,
  ballot_secrecy_certified: false,
  regulated_election_certified: false,
  result_certified: false,
});

const governedSurvey = (releaseId = 51): SurveyPublic => ({
  ...baseSurvey,
  frontend_contract: {
    eligibility: selfAttestedEligibilityContract(
      releaseId === 51 ? 'eligibility-v1' : 'eligibility-v2',
    ),
  },
  governance: {
    contract_version: 'surveys.public_governance.v1',
    mode: 'governed_release',
    release_required: true,
    accepting_responses: true,
    eligibility: selfAttestedEligibilityContract(
      releaseId === 51 ? 'eligibility-v1' : 'eligibility-v2',
    ),
    regulated_election_certified: false,
    result_certified: false,
    active_release: {
      contract_version: 'surveys.governance_release.v1',
      release_id: releaseId,
      survey_id: 42,
      version_number: releaseId === 51 ? 1 : 2,
      status: 'published',
      snapshot_sha256: (releaseId === 51 ? 'a' : 'b').repeat(64),
      policy_sha256: (releaseId === 51 ? 'c' : 'd').repeat(64),
      published_at: '2026-07-30T12:00:00Z',
      completeness: {
        public_consent: {
          complete: true,
          reason_code: null,
          content_format: 'plain_text',
          normalization: 'unicode_nfc_lf_trim_v1',
        },
      },
      governance: {
        eligibility: {
          policy_version: releaseId === 51 ? 'eligibility-v1' : 'eligibility-v2',
          mode: 'self_attested',
          declarations: ['resident_attested'],
          human_review_required: true,
          automated_decision: false,
        },
        consent: {
          policy_version: releaseId === 51 ? 'consent-v1' : 'consent-v2',
          public_text: releaseId === 51 ? CONSENT_TEXT_V1 : CONSENT_TEXT_V2,
          text_sha256: releaseId === 51 ? CONSENT_SHA256_V1 : CONSENT_SHA256_V2,
          content_format: 'plain_text',
          normalization: 'unicode_nfc_lf_trim_v1',
          required: true,
          stores_public_text: true,
          records_participant_input: false,
        },
        decision_rules: {
          quorum: { type: 'none', value: null },
          tie: { procedure: 'human_review' },
          challenge: { enabled: false, window_hours: null, procedure: 'human_review' },
          human_review_required: true,
          declarative_only: true,
        },
      },
      assurance: {
        regulated_election_certified: false,
        result_certified: false,
        external_verification: 'not_performed',
      },
    },
    latest_release: null,
  },
});

const restrictedEligibilityContract = (
  gateStatus: 'ready' | 'unavailable' = 'ready',
): SurveyPublicEligibilityContract => ({
  contract_version: 'surveys.public_eligibility.v1',
  policy_version: 'eligibility-v1',
  mode: 'institution_attested',
  credential_required: true,
  gate_status: gateStatus,
  intake_available: gateStatus === 'ready',
  decision: gateStatus === 'ready' ? 'credential_pending' : 'unavailable',
  transport: {
    kind: 'http_header',
    header_name: 'X-Survey-Eligibility-Credential',
    meta_flow_supported: false,
  },
  blocked_reason_code: gateStatus === 'ready' ? null : 'survey_eligibility_gate_unavailable',
  eligible_population: null,
  participation_rate: null,
  abstentions: null,
  denominator_status: {
    available: false,
    reason_code: 'survey_eligible_population_not_sealed',
  },
  privacy_assurance: 'pseudonymous_internal_linkability',
  assurance_level: 'human_reviewed_opaque_grant',
  authority_binding: 'operator_attested_v1',
  subject_identifier_exposed: false,
  plaintext_credential_persisted: false,
  persist_client_side: false,
  ballot_secrecy_certified: false,
  regulated_election_certified: false,
  result_certified: false,
});

const restrictedSurvey = (gateStatus: 'ready' | 'unavailable' = 'ready'): SurveyPublic => {
  const survey = governedSurvey();
  const eligibility = restrictedEligibilityContract(gateStatus);
  const activeRelease = survey.governance?.active_release;
  if (activeRelease?.governance?.eligibility) {
    activeRelease.governance.eligibility = {
      ...activeRelease.governance.eligibility,
      mode: 'institution_attested',
    };
  }
  survey.governance = {
    ...survey.governance,
    eligibility,
    accepting_responses: gateStatus === 'ready',
  };
  survey.frontend_contract = {
    contract_version: 'surveys.public_frontend.v2',
    eligibility: { ...eligibility },
  };
  return survey;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SurveyForm security contract', () => {
  beforeEach(() => {
    envMock.turnstileSiteKey = '';
    userMock.user = null;
    userMock.loading = false;
    requestLocationMock.mockReset();
    analyticsMocks.answerSelected.mockReset();
    analyticsMocks.submitError.mockReset();
    delete (window as any).turnstile;
    document.getElementById('chatboc-cloudflare-turnstile')?.remove();
    window.localStorage.clear();
  });

  it('describes an open-ended survey without rendering the Unix epoch as its closing date', () => {
    render(<SurveyForm survey={{ ...baseSurvey, fin_at: null }} onSubmit={vi.fn()} />);

    expect(screen.getByText(/Sin fecha de cierre/i)).toBeInTheDocument();
    expect(screen.queryByText(/1\/1\/1970|1970/)).not.toBeInTheDocument();
  });

  it('gates one-person voting behind account authentication', () => {
    render(<SurveyForm survey={authenticatedSurvey} onSubmit={vi.fn()} />);

    expect(screen.getByTestId('survey-auth-gate')).toHaveTextContent('Identifica tu participacion');
    expect(screen.getByRole('link', { name: /iniciar sesion para participar/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/login?return_to='),
    );
    expect(screen.queryByLabelText('Luminaria')).not.toBeInTheDocument();
  });

  it('submits an authenticated vote without copying user identifiers into the payload', async () => {
    userMock.user = { id: 77 };
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SurveyForm survey={authenticatedSurvey} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.instrument_revision).toBe(7);
    expect(payload).not.toHaveProperty('user_id');
    expect(payload).not.toHaveProperty('userId');
    expect(payload.respuestas).toEqual([{ pregunta_id: 101, opcion_ids: [1] }]);
  });

  it('requires two explicit governance acknowledgments and submits the pinned release contract', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SurveyForm survey={governedSurvey()} onSubmit={onSubmit} />);

    expect(screen.getByTestId('survey-governance-ack')).toHaveTextContent('eligibility-v1');
    expect(screen.getByTestId('survey-governance-ack')).toHaveTextContent('consent-v1');
    expect(screen.getByTestId('survey-public-consent-text')).toHaveTextContent(CONSENT_TEXT_V1);
    expect(screen.getByText(/verificando localmente|texto público íntegro/i)).toBeInTheDocument();
    expect(screen.getByText(/no certifica una elección regulada ni sus resultados/i)).toBeInTheDocument();

    const consent = await screen.findByLabelText(/acepto la política de consentimiento versión consent-v1/i);
    const eligibility = screen.getByLabelText(/reconozco la política de elegibilidad versión eligibility-v1/i);
    const submit = screen.getByRole('button', { name: /enviar/i });
    expect(consent).not.toBeChecked();
    expect(eligibility).not.toBeChecked();
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(consent);
    expect(submit).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(eligibility);
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        governance: {
          release_id: 51,
          snapshot_sha256: 'a'.repeat(64),
          eligibility_policy_version: 'eligibility-v1',
          consent_policy_version: 'consent-v1',
          consent_accepted: true,
          eligibility_acknowledged: true,
        },
        respuestas: [{ pregunta_id: 101, opcion_ids: [1] }],
      }),
    );
  });

  it('blocks a restricted survey when the backend eligibility gate is unavailable', async () => {
    const onSubmit = vi.fn();
    render(<SurveyForm survey={restrictedSurvey('unavailable')} onSubmit={onSubmit} />);

    expect(screen.getByTestId('survey-eligibility-unavailable')).toHaveTextContent(
      /temporalmente fuera de servicio/i,
    );
    expect(screen.queryByLabelText(/credencial de elegibilidad/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps an opaque credential only in memory across an ambiguous retry and clears it after success', async () => {
    const credential = 'sec1_memory-only-retry';
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new NetworkError('Network unavailable'))
      .mockResolvedValueOnce(undefined);
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<SurveyForm survey={restrictedSurvey()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(
      await screen.findByLabelText(/acepto la política de consentimiento versión consent-v1/i),
    );
    fireEvent.click(screen.getByLabelText(/reconozco la política de elegibilidad versión eligibility-v1/i));
    const input = screen.getByLabelText(/credencial de elegibilidad/i) as HTMLInputElement;
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    fireEvent.input(input, { target: { value: credential } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const firstPayload = onSubmit.mock.calls[0][0];
    expect(JSON.stringify(firstPayload)).not.toContain(credential);
    expect(onSubmit.mock.calls[0][1]).toEqual({
      eligibilityCredential: credential,
      eligibilityExpectation: {
        contractVersion: 'surveys.public_eligibility.v1',
        releaseId: 51,
        policyVersion: 'eligibility-v1',
        mode: 'institution_attested',
      },
    });
    expect(input).toHaveValue(credential);
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0].submission_id).toBe(firstPayload.submission_id);
    expect(onSubmit.mock.calls[1][1].eligibilityCredential).toBe(credential);
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('clears a terminal invalid credential and requires a new one', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(
      new ApiError('Credencial inválida', 403, {
        reason_code: 'survey_eligibility_credential_invalid',
      }),
    );
    render(<SurveyForm survey={restrictedSurvey()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(
      await screen.findByLabelText(/acepto la política de consentimiento versión consent-v1/i),
    );
    fireEvent.click(screen.getByLabelText(/reconozco la política de elegibilidad versión eligibility-v1/i));
    const input = screen.getByLabelText(/credencial de elegibilidad/i) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'sec1_terminal-invalid' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(screen.getByText(/ingresá la credencial para habilitar/i)).toBeInTheDocument();
  });

  it('clears a preserved credential and rotates the attempt when the response is edited', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new AmbiguousSurveySubmissionError('ACK incompleto'));
    render(<SurveyForm survey={restrictedSurvey()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(
      await screen.findByLabelText(/acepto la política de consentimiento versión consent-v1/i),
    );
    fireEvent.click(screen.getByLabelText(/reconozco la política de elegibilidad versión eligibility-v1/i));
    const input = screen.getByLabelText(/credencial de elegibilidad/i) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'sec1_clear-on-edit' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const firstSubmissionId = onSubmit.mock.calls[0][0].submission_id;
    expect(input).toHaveValue('sec1_clear-on-edit');

    fireEvent.click(screen.getByLabelText('Arbolado'));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();

    fireEvent.input(input, { target: { value: 'sec1_replacement' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0].submission_id).not.toBe(firstSubmissionId);
  });

  it('fails closed when a governed public contract is incomplete', () => {
    const onSubmit = vi.fn();
    const malformed: SurveyPublic = {
      ...governedSurvey(),
      governance: {
        ...governedSurvey().governance,
        active_release: null,
      },
    };

    render(<SurveyForm survey={malformed} onSubmit={onSubmit} />);

    expect(screen.getByTestId('survey-governance-invalid')).toHaveTextContent(/quedó bloqueada/i);
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(screen.queryByLabelText(/acepto la política de consentimiento/i)).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('recomputes the public consent hash and blocks a mismatched backend contract', async () => {
    const onSubmit = vi.fn();
    const mismatched = governedSurvey();
    if (mismatched.governance?.active_release?.governance?.consent) {
      mismatched.governance.active_release.governance.consent.text_sha256 = '0'.repeat(64);
    }

    render(<SurveyForm survey={mismatched} onSubmit={onSubmit} />);

    expect(screen.getByTestId('survey-public-consent-text')).toHaveTextContent(CONSENT_TEXT_V1);
    expect(await screen.findByText(/huella SHA-256 no coincide/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/acepto la política de consentimiento/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders the immutable consent as plain text without HTML or implicit links', async () => {
    const literalText = 'Autorizo <strong>sin HTML</strong>. Referencia: https://example.test';
    const literalHash = 'df1f87093d72a09fd97be7f00de0ff44fc364889a4298f521aecacc8f17927a3';
    const survey = governedSurvey();
    const consent = survey.governance?.active_release?.governance?.consent;
    if (consent) {
      consent.public_text = literalText;
      consent.text_sha256 = literalHash;
    }

    render(<SurveyForm survey={survey} onSubmit={vi.fn()} />);

    const renderedText = screen.getByTestId('survey-public-consent-text');
    expect(renderedText).toHaveTextContent(literalText);
    expect(renderedText.querySelector('strong')).toBeNull();
    expect(renderedText.querySelector('a')).toBeNull();
    expect(
      await screen.findByLabelText(/acepto la política de consentimiento versión consent-v1/i),
    ).toBeInTheDocument();
  });

  it('clears both acknowledgments when the active release changes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<SurveyForm survey={governedSurvey(51)} onSubmit={onSubmit} />);

    fireEvent.click(await screen.findByLabelText(/acepto la política de consentimiento versión consent-v1/i));
    fireEvent.click(screen.getByLabelText(/reconozco la política de elegibilidad versión eligibility-v1/i));
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();

    rerender(<SurveyForm survey={governedSurvey(52)} onSubmit={onSubmit} />);

    const nextConsent = await screen.findByLabelText(/acepto la política de consentimiento versión consent-v2/i);
    const nextEligibility = screen.getByLabelText(/reconozco la política de elegibilidad versión eligibility-v2/i);
    await waitFor(() => expect(nextConsent).not.toBeChecked());
    expect(nextEligibility).not.toBeChecked();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('invalidates verified text immediately even when the declared hash identity stays unchanged', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const original = governedSurvey();
    const changedText = governedSurvey();
    const consent = changedText.governance?.active_release?.governance?.consent;
    if (consent) consent.public_text = 'Texto alterado que conserva indebidamente el hash declarado.';
    expect(resolveSurveyPublicGovernance(changedText).scopeKey).toBe(
      resolveSurveyPublicGovernance(original).scopeKey,
    );

    const { rerender } = render(<SurveyForm survey={original} onSubmit={onSubmit} />);
    fireEvent.click(
      await screen.findByLabelText(/acepto la política de consentimiento versión consent-v1/i),
    );
    fireEvent.click(screen.getByLabelText(/reconozco la política de elegibilidad versión eligibility-v1/i));
    expect(screen.getByRole('button', { name: /enviar/i })).toBeEnabled();

    rerender(<SurveyForm survey={changedText} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
    expect(screen.queryByLabelText(/acepto la política de consentimiento/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/huella SHA-256 no coincide/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders Turnstile and submits the token when the public survey requires it', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    const renderTurnstile = vi.fn((container: HTMLElement, options: { callback?: (token: string) => void }) => {
      container.setAttribute('data-rendered-turnstile', 'true');
      options.callback?.('survey-turnstile-token');
      return 'survey-widget-1';
    });
    (window as any).turnstile = {
      render: renderTurnstile,
      remove: vi.fn(),
    };
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SurveyForm survey={securedSurvey} onSubmit={onSubmit} />);

    expect(await screen.findByTestId('survey-turnstile-challenge')).toBeInTheDocument();
    await waitFor(() => expect(renderTurnstile).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        turnstile_token: 'survey-turnstile-token',
        respuestas: [{ pregunta_id: 101, opcion_ids: [1] }],
      }),
    );
  });

  it('resets Turnstile when backend response asks the frontend to reset it', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    const resetTurnstile = vi.fn();
    const renderTurnstile = vi.fn((container: HTMLElement, options: { callback?: (token: string) => void }) => {
      container.setAttribute('data-rendered-turnstile', 'true');
      options.callback?.('expired-token');
      return 'survey-widget-1';
    });
    (window as any).turnstile = {
      render: renderTurnstile,
      remove: vi.fn(),
      reset: resetTurnstile,
    };

    const { rerender } = render(<SurveyForm survey={securedSurvey} onSubmit={vi.fn()} />);

    expect(await screen.findByTestId('survey-turnstile-challenge')).toBeInTheDocument();
    rerender(
      <SurveyForm
        survey={securedSurvey}
        onSubmit={vi.fn()}
        submitErrorMessage="No pudimos validar la verificacion de seguridad."
        submitErrorStatus={400}
        submitErrorDetails={{
          frontend_contract: { reset_turnstile: true },
          security: { reset_required: true },
        }}
      />,
    );

    await waitFor(() => expect(resetTurnstile).toHaveBeenCalledWith('survey-widget-1'));
  });

  it('keeps optional territorial capture available for live voting and submits manual location metadata', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SurveyForm survey={liveSurvey} onSubmit={onSubmit} />);

    expect(screen.getByText(/datos demogr/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/provincia/i), { target: { value: 'Mendoza' } });
    fireEvent.change(screen.getByLabelText(/ciudad/i), { target: { value: 'Junin' } });
    fireEvent.change(screen.getByLabelText(/barrio/i), { target: { value: 'Centro' } });
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        respuestas: [{ pregunta_id: 101, opcion_ids: [1] }],
        metadata: expect.objectContaining({
          demographics: expect.objectContaining({
            ubicacion: expect.objectContaining({
              provincia: 'Mendoza',
              ciudad: 'Junin',
              barrio: 'Centro',
              precision: 'manual',
              origen: 'usuario',
            }),
          }),
        }),
      }),
    );
  });

  it('submits gps location metadata for live voting when the user shares current location', async () => {
    requestLocationMock.mockResolvedValueOnce({ latitud: -33.0861, longitud: -68.4712 });
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<SurveyForm survey={liveSurvey} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /usar mi ubicaci/i }));

    await waitFor(() => expect(requestLocationMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/coordenadas registradas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          demographics: expect.objectContaining({
            ubicacion: expect.objectContaining({
              lat: -33.0861,
              lng: -68.4712,
              precision: 'gps',
              origen: 'gps',
            }),
          }),
        }),
      }),
    );
  });

  it('renders only the active adaptive path and submits visible answers', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SurveyForm survey={adaptiveSurvey} onSubmit={onSubmit} />);

    expect(screen.getByText(/usaste whatsapp/i)).toBeInTheDocument();
    expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument();
    expect(screen.getByText('Pregunta 1 de 1')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Si'));
    expect(await screen.findByText(/como fue la experiencia/i)).toBeInTheDocument();
    expect(screen.getByText('Pregunta 2 de 2')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mala'));
    expect(await screen.findByText(/que deberiamos mejorar/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/escrib/i), {
      target: { value: 'Mas claridad' },
    });

    fireEvent.click(screen.getByLabelText('No'));
    await waitFor(() => expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/que deberiamos mejorar/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        respuestas: [{ pregunta_id: 301, opcion_ids: [3012] }],
        metadata: expect.objectContaining({ answeredQuestions: 1, totalQuestions: 1 }),
      }),
    );
  });

  it('clears hidden branch errors and stale descendant answers when the controller changes', async () => {
    render(<SurveyForm survey={adaptiveSurvey} onSubmit={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.click(screen.getByLabelText('Si'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    expect(await screen.findByText(/^seleccion.+una opci.n\.$/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('No'));
    await waitFor(() => expect(screen.queryByText(/^seleccion.+una opci.n\.$/i)).not.toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Si'));
    expect(await screen.findByText(/como fue la experiencia/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Mala')).not.toBeChecked();
    expect(screen.queryByText(/que deberiamos mejorar/i)).not.toBeInTheDocument();
  });

  it('shows every adaptive question in read-only aggregate results', () => {
    render(
      <SurveyForm
        survey={adaptiveSurvey}
        onSubmit={vi.fn()}
        readOnly
        showLiveResults
        liveResults={{ total_respuestas: 12, preguntas: {} }}
      />,
    );

    expect(screen.getByText(/usaste whatsapp/i)).toBeInTheDocument();
    expect(screen.getByText(/como fue la experiencia/i)).toBeInTheDocument();
    expect(screen.getByText(/que deberiamos mejorar/i)).toBeInTheDocument();
  });

  it('shows explicit synthetic provenance on public aggregate results', () => {
    render(
      <SurveyForm
        survey={adaptiveSurvey}
        onSubmit={vi.fn()}
        readOnly
        showLiveResults
        liveResults={{
          total_respuestas: 45,
          preguntas: {},
          data_provenance: {
            contract_version: 'surveys.response_provenance.v1',
            mode: 'synthetic',
            server_trusted_classification: true,
            contains_synthetic: true,
            real_responses_included: 0,
            synthetic_responses_included: 45,
            synthetic_responses_excluded: 0,
            synthetic_marker_contract: 'surveys.demo_seeding.v1',
          },
        }}
      />,
    );

    const provenance = screen.getByTestId('survey-response-provenance-synthetic');
    expect(provenance).toHaveTextContent('Escenario sintético');
    expect(provenance).toHaveTextContent('No representa participación ciudadana');
  });

  it('does not restore or rewrite response PII after the bootstrap privacy migration', async () => {
    window.localStorage.setItem(
      'chatboc:survey:draft:global:entrevista-adaptativa',
      JSON.stringify({
        updatedAt: Date.now(),
        answers: { 301: { opcionIds: [3011] } },
        dni: '12345678',
      }),
    );
    window.localStorage.setItem(
      'chatboc_offline_draft_queue',
      JSON.stringify([
        { id: 'legacy-response', type: 'survey_response', payload: { phone: '5491112345678' } },
        { id: 'ticket-draft', type: 'create_ticket_draft', payload: { title: 'Sin luz' } },
      ]),
    );
    window.localStorage.setItem('unrelated-key', 'preserved');
    runBootstrapPrivacyMigrations();

    render(<SurveyForm survey={adaptiveSurvey} onSubmit={vi.fn()} />);

    expect(screen.getByText(/usaste whatsapp/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument());
    await waitFor(() =>
      expect(window.localStorage.getItem('chatboc:survey:draft:global:entrevista-adaptativa')).toBeNull(),
    );
    expect(JSON.parse(window.localStorage.getItem('chatboc_offline_draft_queue') ?? '[]')).toEqual([
      { id: 'ticket-draft', type: 'create_ticket_draft', payload: { title: 'Sin luz' } },
    ]);
    expect(window.localStorage.getItem('unrelated-key')).toBe('preserved');

    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.click(screen.getByLabelText('Si'));
    expect(storageSetSpy).not.toHaveBeenCalled();
  });

  it('reuses one UUID and submittedAt after ambiguous failures, then rotates them after edits and ACK', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new AmbiguousSurveySubmissionError('Incomplete durable ack'))
      .mockRejectedValueOnce(new NetworkError('Network unavailable'))
      .mockResolvedValue(undefined);
    const isoSpy = vi
      .spyOn(Date.prototype, 'toISOString')
      .mockReturnValueOnce('2026-07-28T12:00:00.000Z')
      .mockReturnValueOnce('2026-07-28T12:01:00.000Z')
      .mockReturnValueOnce('2026-07-28T12:02:00.000Z');

    render(<SurveyForm survey={baseSurvey} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    const firstAttempt = onSubmit.mock.calls[0][0];
    expect(firstAttempt.submission_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(firstAttempt.metadata?.submittedAt).toBe('2026-07-28T12:00:00.000Z');
    expect(screen.getByLabelText('Luminaria')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    const retryAttempt = onSubmit.mock.calls[1][0];
    expect(retryAttempt.submission_id).toBe(firstAttempt.submission_id);
    expect(retryAttempt.metadata?.submittedAt).toBe(firstAttempt.metadata?.submittedAt);
    expect(isoSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Arbolado'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3));
    const editedAttempt = onSubmit.mock.calls[2][0];
    expect(editedAttempt.submission_id).not.toBe(firstAttempt.submission_id);
    expect(editedAttempt.metadata?.submittedAt).toBe('2026-07-28T12:01:00.000Z');
    await waitFor(() => expect(screen.getByLabelText('Arbolado')).not.toBeChecked());

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(4));
    const postAckAttempt = onSubmit.mock.calls[3][0];
    expect(postAckAttempt.submission_id).not.toBe(editedAttempt.submission_id);
    expect(postAckAttempt.metadata?.submittedAt).toBe('2026-07-28T12:02:00.000Z');
  });

  it('keeps answers but rotates the attempt after a submission id conflict', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Submission id conflict', 409, {
        reason_code: 'survey_submission_id_conflict',
      }))
      .mockResolvedValue(undefined);

    render(<SurveyForm survey={baseSurvey} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const conflictedAttempt = onSubmit.mock.calls[0][0];

    expect(screen.getByLabelText('Luminaria')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    expect(onSubmit.mock.calls[1][0].submission_id).not.toBe(conflictedAttempt.submission_id);
  });

  it.each([400, 429])('keeps one submission id when the unchanged payload is retried after HTTP %s', async (status) => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('Retry without changing the response', status))
      .mockResolvedValueOnce(undefined);

    render(<SurveyForm survey={baseSurvey} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));

    expect(onSubmit.mock.calls[1][0].submission_id).toBe(onSubmit.mock.calls[0][0].submission_id);
  });

  it('clears in-memory answers and identity after an explicit terminal duplicate', async () => {
    const technicalMessage = 'duplicate key value violates unique constraint survey_response_identity';
    const onSubmit = vi.fn().mockRejectedValueOnce(new ApiError(technicalMessage, 409, {
      reason_code: 'survey_response_duplicate',
      duplicate: true,
    }));
    render(
      <SurveyForm
        survey={{ ...baseSurvey, requiere_datos_contacto: true }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('Documento'), { target: { value: '12345678' } });
    fireEvent.change(screen.getByLabelText(/tel.fono/i), { target: { value: '5491112345678' } });
    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    await waitFor(() => expect(screen.getByLabelText('Luminaria')).not.toBeChecked());
    expect(screen.getByLabelText('Documento')).toHaveValue('');
    expect(screen.getByLabelText(/tel.fono/i)).toHaveValue('');
    expect(screen.getByText(SURVEY_RESPONSE_DUPLICATE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(technicalMessage)).not.toBeInTheDocument();
  });

  it('labels only an explicit duplicate reason as a duplicate, not every 409', async () => {
    const { rerender } = render(
      <SurveyForm
        survey={baseSurvey}
        onSubmit={vi.fn()}
        submitErrorMessage="La encuesta cambio de revision."
        submitErrorStatus={409}
        submitReasonCode="survey_instrument_revision_conflict"
      />,
    );

    expect(await screen.findByText('No pudimos enviar tu respuesta')).toBeInTheDocument();
    expect(screen.queryByText(/ya registramos tu opini.n/i)).not.toBeInTheDocument();

    rerender(
      <SurveyForm
        survey={baseSurvey}
        onSubmit={vi.fn()}
        submitErrorMessage="duplicate key value violates unique constraint survey_response_identity"
        submitErrorStatus={409}
        submitReasonCode="survey_response_duplicate"
      />,
    );

    expect(await screen.findByText(/ya registramos tu opini.n/i)).toBeInTheDocument();
    expect(screen.getByText(SURVEY_RESPONSE_DUPLICATE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/unique constraint/i)).not.toBeInTheDocument();
  });

  it('invalidates a failed submission attempt when slug, revision, or signed-in user changes', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Ack unavailable'));
    const { rerender } = render(<SurveyForm survey={baseSurvey} onSubmit={onSubmit} />);

    const submitCurrentForm = async () => {
      fireEvent.click(screen.getByLabelText('Luminaria'));
      fireEvent.click(screen.getByRole('button', { name: /enviar/i }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      return onSubmit.mock.calls.at(-1)?.[0];
    };

    const initialAttempt = await submitCurrentForm();

    const otherSlugSurvey = { ...baseSurvey, slug: 'consulta-barrial-2' };
    rerender(<SurveyForm survey={otherSlugSurvey} onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.getByLabelText('Luminaria')).not.toBeChecked());
    const slugAttempt = await submitCurrentForm();

    const nextRevisionSurvey = { ...otherSlugSurvey, instrument_revision: 8 };
    rerender(<SurveyForm survey={nextRevisionSurvey} onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.getByLabelText('Luminaria')).not.toBeChecked());
    const revisionAttempt = await submitCurrentForm();

    userMock.user = { id: 42 };
    rerender(<SurveyForm survey={nextRevisionSurvey} onSubmit={onSubmit} />);
    await waitFor(() => expect(screen.getByLabelText('Luminaria')).not.toBeChecked());
    const userAttempt = await submitCurrentForm();

    expect(new Set([
      initialAttempt?.submission_id,
      slugAttempt?.submission_id,
      revisionAttempt?.submission_id,
      userAttempt?.submission_id,
    ]).size).toBe(4);
  });

  it('keeps preview simulation isolated from auth, PII, Turnstile, storage, analytics, and submit', async () => {
    envMock.turnstileSiteKey = 'site-key-public';
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const storageGetSpy = vi.spyOn(Storage.prototype, 'getItem');
    const storageSetSpy = vi.spyOn(Storage.prototype, 'setItem');
    const storageRemoveSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const protectedPreviewSurvey: SurveyPublic = {
      ...securedSurvey,
      politica_unicidad: 'por_usuario',
      auth_mode: 'required',
      anonimo_permitido: false,
      requiere_datos_contacto: true,
    };

    render(<SurveyForm survey={protectedPreviewSurvey} onSubmit={onSubmit} previewMode />);

    expect(screen.queryByTestId('survey-auth-gate')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/documento/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tel.fono/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/datos demogr.ficos/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('survey-turnstile-challenge')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Luminaria'));
    fireEvent.click(screen.getByRole('button', { name: /validar esta ruta/i }));

    expect(await screen.findByText(/ruta visible est. completa/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(analyticsMocks.answerSelected).not.toHaveBeenCalled();
    expect(analyticsMocks.submitError).not.toHaveBeenCalled();
    expect(requestLocationMock).not.toHaveBeenCalled();
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(storageRemoveSpy).not.toHaveBeenCalled();
    expect(window.localStorage).toHaveLength(0);
  });

  it('shows the active adaptive route and resets every in-memory answer', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SurveyForm survey={adaptiveSurvey} onSubmit={onSubmit} previewMode />);

    expect(screen.getByText(/1 de 3 preguntas visibles/i)).toBeInTheDocument();
    expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Si'));
    expect(await screen.findByText(/2 de 3 preguntas visibles/i)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mala'));
    expect(await screen.findByText(/3 de 3 preguntas visibles/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/escrib/i), { target: { value: 'Mas claridad' } });
    fireEvent.click(screen.getByRole('button', { name: /validar esta ruta/i }));

    expect(await screen.findByText('Ruta validada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /reiniciar prueba/i }));

    await waitFor(() => expect(screen.getByText(/1 de 3 preguntas visibles/i)).toBeInTheDocument());
    expect(screen.getByLabelText('Si')).not.toBeChecked();
    expect(screen.queryByText(/como fue la experiencia/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/que deberiamos mejorar/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Ruta validada')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(analyticsMocks.answerSelected).not.toHaveBeenCalled();
  });
});
