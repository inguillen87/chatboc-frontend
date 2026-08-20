import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, LogIn, RotateCcw, Route, ShieldCheck } from 'lucide-react';

import ClerkAuthButtons from '@/components/auth/ClerkAuthButtons';
import { useClerkRuntime } from '@/components/auth/ClerkRuntimeContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TurnstileChallenge } from '@/components/security/TurnstileChallenge';
import {
  type PublicResponsePayload,
  type PublicSurveySubmitOptions,
  type SurveyAnalyticsMetadata,
  type SurveyDemographicMetadata,
  type SurveyLocationMetadata,
  type SurveyPublic,
  type SurveyPregunta,
  type SurveyLiveResults,
  type SurveyOptionId,
} from '@/types/encuestas';
import { CLOUDFLARE_TURNSTILE_SITE_KEY } from '@/env';
import { requestLocation, type PositionCoords } from '@/utils/geolocation';
import {
  AGE_RANGE_OPTIONS,
  EDUCATION_LEVEL_OPTIONS,
  EMPLOYMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
} from '@/components/surveys/demographicOptions';
import { trackSurveyAnswerSelected, trackSurveySubmitError } from '@/utils/surveyAnalytics';
import { getVisibleSurveyQuestions } from '@/utils/surveyConditionalLogic';
import {
  SURVEY_RESPONSE_DUPLICATE_REASON_CODE,
  getSurveySubmissionReasonCode,
  isSurveySubmissionIdConflictError,
  shouldReuseSurveySubmissionAttempt,
} from '@/utils/surveySubmissionErrors';
import { createSecureSurveySubmissionId } from '@/utils/surveySubmissionIdentity';
import {
  prepareSurveyConsentPublicText,
  SURVEY_CONSENT_TEXT_CONTENT_FORMAT,
  SURVEY_CONSENT_TEXT_NORMALIZATION,
  validateSurveyConsentPublicText,
} from '@/utils/surveyGovernance';
import { useUser } from '@/hooks/useUser';
import {
  isTerminalSurveyEligibilityError,
  resolveSurveyPublicEligibility,
} from '@/utils/surveyEligibility';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readBool = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return null;
};

const getSurveyTurnstileConfig = (survey: SurveyPublic) => {
  const frontendContract = isRecord(survey.frontend_contract) ? survey.frontend_contract : {};
  const turnstile = isRecord(frontendContract.turnstile) ? frontendContract.turnstile : {};
  const security = isRecord(survey.security) ? survey.security : {};
  const provider = typeof security.provider === 'string' ? security.provider : frontendContract.security_provider;
  const required =
    readBool(turnstile.required) ??
    readBool(security.required) ??
    readBool(security.enforced) ??
    false;
  const explicitEnabled = readBool(turnstile.enabled);
  const enabled =
    explicitEnabled ??
    (
      required ||
      provider === 'cloudflare_turnstile' ||
      security.contract_version === 'cloudflare.turnstile.public_intake.v1'
    );

  return {
    enabled: Boolean(enabled),
    required: Boolean(required),
    status: typeof turnstile.status === 'string' ? turnstile.status : security.status,
  };
};

type SurveyAuthMode = 'anonymous' | 'optional' | 'required';

const getSurveyAuthMode = (survey: SurveyPublic): SurveyAuthMode => {
  const frontendContract = isRecord(survey.frontend_contract) ? survey.frontend_contract : {};
  const identity = isRecord(frontendContract.identity) ? frontendContract.identity : {};
  const explicitMode = [survey.auth_mode, frontendContract.auth_mode, identity.mode]
    .find((value) => typeof value === 'string')
    ?.trim()
    .toLowerCase();

  if (explicitMode === 'required' || explicitMode === 'optional' || explicitMode === 'anonymous') {
    return explicitMode;
  }
  if (survey.politica_unicidad === 'por_usuario' || readBool(survey.anonimo_permitido) === false) {
    return 'required';
  }
  return 'anonymous';
};

const PUBLIC_GOVERNANCE_CONTRACT = 'surveys.public_governance.v1';
const GOVERNANCE_RELEASE_CONTRACT = 'surveys.governance_release.v1';
const GOVERNANCE_SHA256_PATTERN = /^[a-f0-9]{64}$/i;

type ResolvedPublicGovernance = {
  required: boolean;
  valid: boolean;
  scopeKey: string;
  invalidReason?: string;
  releaseId?: number;
  versionNumber?: number;
  snapshotSha256?: string;
  policySha256?: string;
  eligibilityPolicyVersion?: string;
  eligibilityMode?: string;
  eligibilityDeclarations: string[];
  consentPolicyVersion?: string;
  consentPublicText?: string;
  consentTextSha256?: string;
  acknowledgment?: NonNullable<PublicResponsePayload['governance']>;
};

type PublicConsentIntegrityState = {
  status: 'pending' | 'verified' | 'invalid' | 'not_required';
  scopeKey: string;
  evaluatedPublicText?: string;
  error?: string;
};

const governanceText = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const resolveSurveyPublicGovernance = (survey: SurveyPublic): ResolvedPublicGovernance => {
  const raw = isRecord(survey.governance) ? survey.governance : null;
  if (!raw) {
    return { required: false, valid: true, scopeKey: 'legacy:no-contract', eligibilityDeclarations: [] };
  }
  const mode = governanceText(raw.mode)?.toLowerCase();
  const required = raw.release_required === true || mode === 'governed_release';
  if (!required) {
    return { required: false, valid: true, scopeKey: 'legacy:explicit', eligibilityDeclarations: [] };
  }

  const active = isRecord(raw.active_release) ? raw.active_release : null;
  const releaseId = typeof active?.release_id === 'number' && Number.isInteger(active.release_id)
    ? active.release_id
    : undefined;
  const snapshotSha256 = governanceText(active?.snapshot_sha256)?.toLowerCase();
  const policySha256 = governanceText(active?.policy_sha256)?.toLowerCase();
  const governance = isRecord(active?.governance) ? active.governance : {};
  const eligibility = isRecord(governance.eligibility) ? governance.eligibility : {};
  const consent = isRecord(governance.consent) ? governance.consent : {};
  const rules = isRecord(governance.decision_rules) ? governance.decision_rules : {};
  const assurance = isRecord(active?.assurance) ? active.assurance : {};
  const eligibilityPolicyVersion = governanceText(eligibility.policy_version);
  const consentPolicyVersion = governanceText(consent.policy_version);
  const consentPublicText = typeof consent.public_text === 'string' ? consent.public_text : undefined;
  const consentTextSha256 = governanceText(consent.text_sha256)?.toLowerCase();
  const completeness = isRecord(active?.completeness) ? active.completeness : {};
  const publicConsentCompleteness = isRecord(completeness.public_consent)
    ? completeness.public_consent
    : {};
  let canonicalConsentText: string | undefined;
  try {
    canonicalConsentText = typeof consentPublicText === 'string'
      ? validateSurveyConsentPublicText(consentPublicText)
      : undefined;
  } catch {
    canonicalConsentText = undefined;
  }
  const eligibilityDeclarations = Array.isArray(eligibility.declarations)
    ? eligibility.declarations.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];
  const scopeKey = [
    'governed',
    releaseId ?? 'missing-release',
    snapshotSha256 ?? 'missing-snapshot',
    policySha256 ?? 'missing-policy',
    eligibilityPolicyVersion ?? 'missing-eligibility',
    consentPolicyVersion ?? 'missing-consent',
    consentTextSha256 ?? 'missing-consent-hash',
  ].join(':');
  const valid =
    raw.contract_version === PUBLIC_GOVERNANCE_CONTRACT &&
    mode === 'governed_release' &&
    raw.accepting_responses === true &&
    active?.contract_version === GOVERNANCE_RELEASE_CONTRACT &&
    active?.status === 'published' &&
    typeof releaseId === 'number' &&
    releaseId > 0 &&
    typeof snapshotSha256 === 'string' &&
    GOVERNANCE_SHA256_PATTERN.test(snapshotSha256) &&
    typeof policySha256 === 'string' &&
    GOVERNANCE_SHA256_PATTERN.test(policySha256) &&
    Boolean(eligibilityPolicyVersion) &&
    eligibility.human_review_required === true &&
    eligibility.automated_decision === false &&
    Boolean(consentPolicyVersion) &&
    typeof consentPublicText === 'string' &&
    canonicalConsentText === consentPublicText &&
    typeof consentTextSha256 === 'string' &&
    GOVERNANCE_SHA256_PATTERN.test(consentTextSha256) &&
    consent.content_format === SURVEY_CONSENT_TEXT_CONTENT_FORMAT &&
    consent.normalization === SURVEY_CONSENT_TEXT_NORMALIZATION &&
    consent.required === true &&
    consent.stores_public_text === true &&
    consent.records_participant_input === false &&
    publicConsentCompleteness.complete === true &&
    rules.human_review_required === true &&
    rules.declarative_only === true &&
    assurance.regulated_election_certified === false &&
    assurance.result_certified === false &&
    raw.regulated_election_certified === false &&
    raw.result_certified === false;

  if (!valid) {
    return {
      required: true,
      valid: false,
      scopeKey,
      invalidReason:
        'El contrato público de gobernanza está incompleto o no coincide con un release activo. La participación quedó bloqueada para evitar un consentimiento o una respuesta sin versión.',
      releaseId,
      snapshotSha256,
      policySha256,
      eligibilityPolicyVersion,
      eligibilityMode: governanceText(eligibility.mode),
      eligibilityDeclarations,
      consentPolicyVersion,
      consentPublicText,
      consentTextSha256,
    };
  }

  return {
    required: true,
    valid: true,
    scopeKey,
    releaseId,
    versionNumber: typeof active?.version_number === 'number' ? active.version_number : undefined,
    snapshotSha256,
    policySha256,
    eligibilityPolicyVersion,
    eligibilityMode: governanceText(eligibility.mode),
    eligibilityDeclarations,
    consentPolicyVersion,
    consentPublicText,
    consentTextSha256,
    acknowledgment: {
      release_id: releaseId,
      snapshot_sha256: snapshotSha256,
      eligibility_policy_version: eligibilityPolicyVersion as string,
      consent_policy_version: consentPolicyVersion as string,
      consent_accepted: true,
      eligibility_acknowledged: true,
    },
  };
};

const shouldResetTurnstileFromError = (details?: Record<string, unknown> | null): boolean => {
  if (!details) return false;
  const frontendContract = isRecord(details.frontend_contract) ? details.frontend_contract : {};
  const turnstile = isRecord(frontendContract.turnstile) ? frontendContract.turnstile : {};
  const security = isRecord(details.security) ? details.security : {};
  return (
    readBool(frontendContract.reset_turnstile) === true ||
    readBool(turnstile.reset_required) === true ||
    readBool(security.reset_required) === true
  );
};

interface SurveyFormProps {
  survey: SurveyPublic;
  onSubmit: (payload: PublicResponsePayload, options?: PublicSurveySubmitOptions) => Promise<void>;
  loading?: boolean;
  defaultMetadata?: Pick<PublicResponsePayload, 'utm_campaign' | 'utm_source' | 'canal'>;
  submitErrorMessage?: string | null;
  submitErrorStatus?: number | null;
  submitErrorDetails?: Record<string, unknown> | null;
  submitReasonCode?: string | null;
  liveResults?: SurveyLiveResults;
  showLiveResults?: boolean;
  readOnly?: boolean;
  showHeader?: boolean;
  variant?: 'default' | 'votacion';
  submitLabel?: string;
  /**
   * Runs the participant experience as an isolated, in-memory simulation.
   * Preview mode never persists a draft, emits analytics, requests identity/location,
   * runs anti-bot challenges, or invokes onSubmit.
   */
  previewMode?: boolean;
}

interface AnswerState {
  opcionIds: SurveyOptionId[];
  texto?: string;
}

const normalizeOptionId = (value: SurveyOptionId): SurveyOptionId => {
  if (typeof value === 'number') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const numeric = Number(trimmed);
  return Number.isInteger(numeric) && String(numeric) === trimmed ? numeric : trimmed;
};

const optionIdsEqual = (left: SurveyOptionId, right: SurveyOptionId): boolean =>
  String(left) === String(right);

const uniqueOptionIds = (ids: SurveyOptionId[]): SurveyOptionId[] => {
  const seen = new Set<string>();
  const unique: SurveyOptionId[] = [];
  for (const id of ids) {
    const normalized = normalizeOptionId(id);
    if (normalized === '') {
      continue;
    }
    const key = String(normalized);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
};

interface SubmissionAttempt {
  submissionId: string;
  submittedAt: string;
}

export const SurveyForm = ({
  survey,
  onSubmit,
  loading,
  defaultMetadata,
  submitErrorMessage,
  submitErrorStatus,
  submitErrorDetails,
  submitReasonCode,
  liveResults,
  showLiveResults,
  readOnly = false,
  showHeader = true,
  variant = 'default',
  submitLabel,
  previewMode = false,
}: SurveyFormProps) => {
  const { user, loading: authLoading } = useUser();
  const clerkRuntime = useClerkRuntime();
  const isVotingVariant = variant === 'votacion';
  const authMode = useMemo(() => getSurveyAuthMode(survey), [survey]);
  const publicGovernance = useMemo(
    () => resolveSurveyPublicGovernance(survey),
    [survey],
  );
  const publicEligibility = useMemo(
    () => resolveSurveyPublicEligibility(survey),
    [survey],
  );
  const requiresAuthenticatedParticipant = authMode === 'required';
  const loginHref = useMemo(() => {
    if (typeof window === 'undefined') return '/login';
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return `/login?return_to=${encodeURIComponent(returnTo || '/')}`;
  }, []);
  const initialState = useMemo(() => {
    const state: Record<number, AnswerState> = {};
    survey.preguntas.forEach((pregunta) => {
      state[pregunta.id] = { opcionIds: [], texto: '' };
    });
    return state;
  }, [survey.preguntas]);

  const [answers, setAnswers] = useState<Record<number, AnswerState>>(initialState);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [dni, setDni] = useState('');
  const [phone, setPhone] = useState('');
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [demographics, setDemographics] = useState<SurveyDemographicMetadata>({});
  const [customGender, setCustomGender] = useState('');
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [submissionErrorTitle, setSubmissionErrorTitle] = useState<string | null>(null);
  const [submissionErrorDetails, setSubmissionErrorDetails] = useState<string | null>(null);
  const [dismissedErrorKey, setDismissedErrorKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [previewValidated, setPreviewValidated] = useState(false);
  const [governanceConsentAccepted, setGovernanceConsentAccepted] = useState(false);
  const [governanceEligibilityAcknowledged, setGovernanceEligibilityAcknowledged] = useState(false);
  const [eligibilityCredentialReady, setEligibilityCredentialReady] = useState(false);
  const [eligibilityStatus, setEligibilityStatus] = useState<
    'not_required' | 'required' | 'ready' | 'verifying' | 'eligible'
  >('not_required');
  const [publicConsentIntegrity, setPublicConsentIntegrity] = useState<PublicConsentIntegrityState>({
    status: 'pending',
    scopeKey: '',
  });
  const lastTrackedSubmitErrorKeyRef = useRef<string | null>(null);
  const submissionAttemptRef = useRef<SubmissionAttempt | null>(null);
  const submissionInFlightScopeRef = useRef<string | null>(null);
  const eligibilityCredentialInputRef = useRef<HTMLInputElement | null>(null);
  const isDuplicateSubmission = submitReasonCode === SURVEY_RESPONSE_DUPLICATE_REASON_CODE;
  const currentErrorKey = useMemo(
    () => (submitErrorMessage
      ? `${submitErrorStatus ?? 'na'}::${submitReasonCode ?? 'no_reason'}::${submitErrorMessage}`
      : null),
    [submitErrorMessage, submitErrorStatus, submitReasonCode],
  );
  const analyticsHost = typeof window !== 'undefined' ? window.location.host : null;
  const analyticsTenant =
    (typeof survey.municipio_slug === 'string' && survey.municipio_slug.trim().length > 0
      ? survey.municipio_slug.trim()
      : null) ??
    null;
  const turnstileConfig = useMemo(() => getSurveyTurnstileConfig(survey), [survey]);
  const turnstileSiteKey = !previewMode && turnstileConfig.enabled ? CLOUDFLARE_TURNSTILE_SITE_KEY : '';
  const turnstileRequired = !previewMode && turnstileConfig.required;
  const turnstileUnavailable = turnstileRequired && !turnstileSiteKey;
  const turnstileMissingToken = turnstileRequired && Boolean(turnstileSiteKey) && !turnstileToken.trim();
  const governanceAcknowledgmentMissing =
    publicGovernance.required &&
    publicGovernance.valid &&
    (!governanceConsentAccepted || !governanceEligibilityAcknowledged);
  const publicConsentIntegrityIsCurrent =
    publicConsentIntegrity.scopeKey === publicGovernance.scopeKey &&
    publicConsentIntegrity.evaluatedPublicText === publicGovernance.consentPublicText;
  const visiblePublicConsentIntegrityStatus = publicConsentIntegrityIsCurrent
    ? publicConsentIntegrity.status
    : 'pending';
  const publicConsentIntegrityVerified =
    !publicGovernance.required ||
    (
      publicConsentIntegrityIsCurrent &&
      publicConsentIntegrity.status === 'verified'
    );
  const governanceSubmissionBlocked =
    !previewMode &&
    publicGovernance.required &&
    (!publicGovernance.valid || !publicConsentIntegrityVerified || governanceAcknowledgmentMissing);
  const eligibilitySubmissionBlocked =
    !previewMode &&
    publicEligibility.required &&
    (!publicEligibility.valid || !publicEligibility.available || !eligibilityCredentialReady);
  const participantUserId = user?.id === undefined || user?.id === null ? 'anonymous' : String(user.id);
  const submissionScopeKey = `${survey.municipio_slug ?? 'global'}::${survey.slug ?? 'missing'}::${survey.instrument_revision ?? 'unversioned'}::${participantUserId}::${publicGovernance.scopeKey}::${publicEligibility.scopeKey}`;
  const activeSubmissionScopeRef = useRef(submissionScopeKey);
  activeSubmissionScopeRef.current = submissionScopeKey;

  type LocationStringField = 'pais' | 'provincia' | 'ciudad' | 'barrio' | 'codigoPostal';

  const requireDni = survey.politica_unicidad === 'por_dni';
  const requirePhone = survey.politica_unicidad === 'por_phone';
  const contactRequired = Boolean(survey.requiere_datos_contacto);
  const showDniField = requireDni || contactRequired;
  const showPhoneField = requirePhone || contactRequired;
  const showContactBlock = !previewMode && (showDniField || showPhoneField);
  const visibleQuestions = useMemo(
    () => (readOnly && showLiveResults ? survey.preguntas : getVisibleSurveyQuestions(survey.preguntas, answers)),
    [answers, readOnly, showLiveResults, survey.preguntas],
  );
  const visibleQuestionIds = useMemo(
    () => new Set(visibleQuestions.map((question) => question.id)),
    [visibleQuestions],
  );

  useEffect(() => {
    setAnswers(initialState);
    setErrors({});
    setSubmitting(false);
    setDni('');
    setPhone('');
    setIdentityError(null);
    setDemographics({});
    setCustomGender('');
    setGeoStatus('idle');
    setGeoMessage(null);
    setTurnstileToken('');
    setTurnstileResetSignal((value) => value + 1);
    setPreviewValidated(false);
    setGovernanceConsentAccepted(false);
    setGovernanceEligibilityAcknowledged(false);
    if (eligibilityCredentialInputRef.current) {
      eligibilityCredentialInputRef.current.value = '';
    }
    setEligibilityCredentialReady(false);
    setEligibilityStatus(publicEligibility.required ? 'required' : 'not_required');
    setSubmissionErrorTitle(null);
    setSubmissionErrorDetails(null);
    setDismissedErrorKey(null);
    lastTrackedSubmitErrorKeyRef.current = null;
    submissionAttemptRef.current = null;
    submissionInFlightScopeRef.current = null;
  }, [initialState, publicEligibility.required, submissionScopeKey]);

  useEffect(
    () => () => {
      if (eligibilityCredentialInputRef.current) {
        eligibilityCredentialInputRef.current.value = '';
      }
      eligibilityCredentialInputRef.current = null;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    setGovernanceConsentAccepted(false);
    setGovernanceEligibilityAcknowledged(false);
    submissionAttemptRef.current = null;
    if (!publicGovernance.required) {
      setPublicConsentIntegrity({ status: 'not_required', scopeKey: publicGovernance.scopeKey });
      return () => {
        active = false;
      };
    }
    if (
      !publicGovernance.valid ||
      !publicGovernance.consentPublicText ||
      !publicGovernance.consentTextSha256
    ) {
      setPublicConsentIntegrity({
        status: 'invalid',
        scopeKey: publicGovernance.scopeKey,
        evaluatedPublicText: publicGovernance.consentPublicText,
        error: publicGovernance.invalidReason || 'El consentimiento público está incompleto.',
      });
      return () => {
        active = false;
      };
    }
    setPublicConsentIntegrity({
      status: 'pending',
      scopeKey: publicGovernance.scopeKey,
      evaluatedPublicText: publicGovernance.consentPublicText,
    });
    void prepareSurveyConsentPublicText(publicGovernance.consentPublicText)
      .then((prepared) => {
        if (!active) return;
        if (prepared.textSha256 !== publicGovernance.consentTextSha256) {
          setPublicConsentIntegrity({
            status: 'invalid',
            scopeKey: publicGovernance.scopeKey,
            evaluatedPublicText: publicGovernance.consentPublicText,
            error:
              'La huella SHA-256 no coincide con el texto de consentimiento publicado. La participación quedó bloqueada.',
          });
          return;
        }
        setPublicConsentIntegrity({
          status: 'verified',
          scopeKey: publicGovernance.scopeKey,
          evaluatedPublicText: prepared.publicText,
        });
      })
      .catch((integrityError: unknown) => {
        if (!active) return;
        setPublicConsentIntegrity({
          status: 'invalid',
          scopeKey: publicGovernance.scopeKey,
          evaluatedPublicText: publicGovernance.consentPublicText,
          error:
            integrityError instanceof Error
              ? integrityError.message
              : 'No se pudo verificar la huella del consentimiento público.',
        });
      });
    return () => {
      active = false;
    };
  }, [
    publicGovernance.consentPublicText,
    publicGovernance.consentTextSha256,
    publicGovernance.invalidReason,
    publicGovernance.required,
    publicGovernance.scopeKey,
    publicGovernance.valid,
  ]);

  useEffect(() => {
    setAnswers((previous) => {
      let changed = false;
      const next = { ...previous };
      Object.keys(previous).forEach((questionId) => {
        if (!visibleQuestionIds.has(Number(questionId))) {
          delete next[Number(questionId)];
          changed = true;
        }
      });
      return changed ? next : previous;
    });
    setErrors((previous) => {
      let changed = false;
      const next = { ...previous };
      Object.keys(previous).forEach((questionId) => {
        if (!visibleQuestionIds.has(Number(questionId))) {
          delete next[Number(questionId)];
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [visibleQuestionIds]);

  useEffect(() => {
    submissionAttemptRef.current = null;
    if (eligibilityCredentialInputRef.current) {
      eligibilityCredentialInputRef.current.value = '';
    }
    setEligibilityCredentialReady(false);
    setEligibilityStatus(publicEligibility.required ? 'required' : 'not_required');
  }, [
    answers,
    customGender,
    defaultMetadata?.canal,
    defaultMetadata?.utm_campaign,
    defaultMetadata?.utm_source,
    demographics,
    dni,
    governanceConsentAccepted,
    governanceEligibilityAcknowledged,
    phone,
    publicEligibility.required,
    submissionScopeKey,
  ]);

  useEffect(() => {
    setIdentityError(null);
    if (!showDniField) {
      setDni('');
    }
    if (!showPhoneField) {
      setPhone('');
    }
  }, [showDniField, showPhoneField]);

  useEffect(() => {
    if (!submitErrorMessage || !currentErrorKey) {
      if (!submitting) {
        setSubmissionErrorTitle(null);
        setSubmissionErrorDetails(null);
      }
      return;
    }

    if (dismissedErrorKey && currentErrorKey === dismissedErrorKey) {
      return;
    }

    if (shouldResetTurnstileFromError(submitErrorDetails)) {
      setTurnstileToken('');
      setTurnstileResetSignal((value) => value + 1);
    }

    const normalized = submitErrorMessage.toLowerCase();
    const baseTitle =
      isDuplicateSubmission
        ? 'Ya registramos tu opinión'
        : 'No pudimos enviar tu respuesta';

    let extraHint: string | null = null;
    if (isDuplicateSubmission) {
      extraHint = 'La política de unicidad impide enviar más de una respuesta.';
    } else if (normalized.includes('cors') || normalized.includes('conexión')) {
      extraHint =
        'Revisá tu conexión o intentá nuevamente. Si el error persiste, compartí este mensaje con el equipo de soporte.';
    }

    const detail = extraHint ? `${submitErrorMessage} ${extraHint}` : submitErrorMessage;
    setSubmissionErrorTitle(baseTitle);
    setSubmissionErrorDetails(detail.trim());
  }, [
    submitErrorMessage,
    submitErrorStatus,
    isDuplicateSubmission,
    submitting,
    currentErrorKey,
    dismissedErrorKey,
    submitErrorDetails,
  ]);

  useEffect(() => {
    if (previewMode) return;
    if (!currentErrorKey || !submitErrorMessage) return;
    if (lastTrackedSubmitErrorKeyRef.current === currentErrorKey) return;

    const messageLower = submitErrorMessage.toLowerCase();
    const inferredReasonCode =
      messageLower.includes('not_published') || messageLower.includes('no está publicada')
        ? 'survey_not_published'
        : messageLower.includes('outside_active_window') || messageLower.includes('no está disponible')
          ? 'survey_outside_active_window'
          : submitErrorStatus && submitErrorStatus >= 500
            ? 'internal_error'
            : null;

    trackSurveySubmitError({
      slug: survey.slug ?? null,
      host: analyticsHost,
      tenant: analyticsTenant,
      statusCode: submitErrorStatus ?? null,
      reasonCode: inferredReasonCode,
      requestId: null,
      message: submitErrorMessage,
    });
    lastTrackedSubmitErrorKeyRef.current = currentErrorKey;
  }, [analyticsHost, analyticsTenant, currentErrorKey, previewMode, submitErrorMessage, submitErrorStatus, survey.slug]);

  const toDisplayText = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value && typeof value === 'object') {
      const candidate = (value as Record<string, unknown>).texto
        ?? (value as Record<string, unknown>).label
        ?? (value as Record<string, unknown>).nombre
        ?? (value as Record<string, unknown>).value;
      if (typeof candidate === 'string' || typeof candidate === 'number' || typeof candidate === 'boolean') {
        return String(candidate);
      }
      return '';
    }
    return '';
  };

  const normalizeString = (value?: string | null): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const hasLocationData = (location?: SurveyLocationMetadata | null): boolean => {
    if (!location) return false;
    return (
      Boolean(normalizeString(location.pais)) ||
      Boolean(normalizeString(location.provincia)) ||
      Boolean(normalizeString(location.ciudad)) ||
      Boolean(normalizeString(location.barrio)) ||
      Boolean(normalizeString(location.codigoPostal)) ||
      (typeof location.lat === 'number' && Number.isFinite(location.lat)) ||
      (typeof location.lng === 'number' && Number.isFinite(location.lng))
    );
  };

  const handleDemographicsChange = (
    field: keyof SurveyDemographicMetadata,
    rawValue?: string | null,
  ) => {
    const nextValue = normalizeString(rawValue ?? undefined);
    setDemographics((prev) => {
      const next: SurveyDemographicMetadata = { ...prev };
      if (nextValue) {
        (next as Record<string, unknown>)[field as string] = nextValue;
      } else {
        delete (next as Record<string, unknown>)[field as string];
      }

      if (field === 'genero' && nextValue !== 'self-described') {
        delete (next as Record<string, unknown>)['generoDescripcion'];
      }

      return next;
    });

    if (field === 'genero' && rawValue !== 'self-described') {
      setCustomGender('');
    }
  };

  const handleLocationFieldChange = (field: LocationStringField, rawValue: string) => {
    const normalized = normalizeString(rawValue);
    let hasData = false;

    setDemographics((prev) => {
      const currentLocation = prev.ubicacion ?? {};
      const nextLocation: SurveyLocationMetadata = { ...currentLocation };

      if (normalized) {
        nextLocation[field] = normalized;
        if (field !== 'codigoPostal' && nextLocation.precision !== 'gps') {
          nextLocation.precision = 'manual';
          nextLocation.origen = 'usuario';
        }
      } else {
        delete (nextLocation as Record<string, unknown>)[field as string];
        if (!hasLocationData(nextLocation)) {
          delete (nextLocation as Record<string, unknown>).precision;
          delete (nextLocation as Record<string, unknown>).origen;
        }
      }

      hasData = hasLocationData(nextLocation);

      return {
        ...prev,
        ubicacion: hasData ? nextLocation : undefined,
      };
    });

    if (hasData) {
      setGeoStatus((status) => (status === 'loading' ? status : 'success'));
      setGeoMessage('Registramos la ubicación que ingresaste manualmente.');
    } else {
      setGeoStatus((status) => (status === 'loading' ? status : 'idle'));
      setGeoMessage(null);
    }
  };

  const handleRequestLocation = async () => {
    setGeoStatus('loading');
    setGeoMessage('Solicitando tu ubicación para las métricas territoriales…');

    try {
      const coords: PositionCoords | null = await requestLocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60_000,
      });

      if (!coords) {
        setGeoStatus('error');
        setGeoMessage('No pudimos obtener tu ubicación automáticamente. Podés ingresarla manualmente.');
        return;
      }

      setGeoStatus('success');
      setGeoMessage('Registramos tu ubicación GPS para mapas de calor y distribución barrial.');
      setDemographics((prev) => ({
        ...prev,
        ubicacion: {
          ...(prev.ubicacion ?? {}),
          lat: coords.latitud,
          lng: coords.longitud,
          precision: 'gps',
          origen: 'gps',
        },
      }));
    } catch (error) {
      console.warn('[SurveyForm] No pudimos obtener la ubicación del dispositivo', error);
      setGeoStatus('error');
      setGeoMessage('No pudimos obtener tu ubicación automáticamente. Podés ingresarla manualmente.');
    }
  };

  const sanitizeDemographics = (): SurveyDemographicMetadata | undefined => {
    const sanitized: SurveyDemographicMetadata = {};

    const genero = normalizeString(demographics.genero);
    if (genero) {
      sanitized.genero = genero;
      if (genero === 'self-described') {
        const generoDescripcion = normalizeString(demographics.generoDescripcion ?? customGender);
        if (generoDescripcion) {
          sanitized.generoDescripcion = generoDescripcion;
        }
      }
    }

    const rangoEtario = normalizeString(demographics.rangoEtario);
    if (rangoEtario) {
      sanitized.rangoEtario = rangoEtario;
    }

    const nivelEducativo = normalizeString(demographics.nivelEducativo);
    if (nivelEducativo) {
      sanitized.nivelEducativo = nivelEducativo;
    }

    const situacionLaboral = normalizeString(demographics.situacionLaboral);
    if (situacionLaboral) {
      sanitized.situacionLaboral = situacionLaboral;
    }

    const ocupacion = normalizeString(demographics.ocupacion);
    if (ocupacion) {
      sanitized.ocupacion = ocupacion;
    }

    const tiempoResidencia = normalizeString(demographics.tiempoResidencia);
    if (tiempoResidencia) {
      sanitized.tiempoResidencia = tiempoResidencia;
    }

    const location = demographics.ubicacion;
    if (location) {
      const sanitizedLocation: SurveyLocationMetadata = {};
      const pais = normalizeString(location.pais);
      if (pais) sanitizedLocation.pais = pais;
      const provincia = normalizeString(location.provincia);
      if (provincia) sanitizedLocation.provincia = provincia;
      const ciudad = normalizeString(location.ciudad);
      if (ciudad) sanitizedLocation.ciudad = ciudad;
      const barrio = normalizeString(location.barrio);
      if (barrio) sanitizedLocation.barrio = barrio;
      const codigoPostal = normalizeString(location.codigoPostal);
      if (codigoPostal) sanitizedLocation.codigoPostal = codigoPostal;
      if (typeof location.lat === 'number' && Number.isFinite(location.lat)) {
        sanitizedLocation.lat = Number(location.lat);
      }
      if (typeof location.lng === 'number' && Number.isFinite(location.lng)) {
        sanitizedLocation.lng = Number(location.lng);
      }
      if (location.precision) {
        sanitizedLocation.precision = location.precision;
      }
      if (location.origen) {
        sanitizedLocation.origen = location.origen;
      }

      if (hasLocationData(sanitizedLocation)) {
        sanitized.ubicacion = sanitizedLocation;
      }
    }

    return Object.keys(sanitized).length ? sanitized : undefined;
  };

  const handleRadioChange = (pregunta: SurveyPregunta, value: string) => {
    const normalizedOptionId = normalizeOptionId(value);
    if (previewMode) setPreviewValidated(false);
    setAnswers((prev) => ({
      ...prev,
      [pregunta.id]: { ...prev[pregunta.id], opcionIds: normalizedOptionId === '' ? [] : [normalizedOptionId] },
    }));
    if (!previewMode) {
      trackSurveyAnswerSelected({
        slug: survey.slug ?? null,
        host: analyticsHost,
        tenant: analyticsTenant,
        questionId: pregunta.id,
        questionType: pregunta.tipo,
        optionId: normalizedOptionId === '' ? null : normalizedOptionId,
        selectionCount: normalizedOptionId === '' ? 0 : 1,
      });
    }
  };

  const handleCheckboxToggle = (pregunta: SurveyPregunta, optionId: SurveyOptionId, checked: boolean) => {
    if (previewMode) setPreviewValidated(false);
    setAnswers((prev) => {
      const current = prev[pregunta.id] ?? { opcionIds: [] };
      const normalizedOptionId = normalizeOptionId(optionId);
      const nextIds = checked
        ? uniqueOptionIds([...(current.opcionIds ?? []), normalizedOptionId])
        : (current.opcionIds ?? []).filter((id) => !optionIdsEqual(id, normalizedOptionId));
      if (!previewMode) {
        trackSurveyAnswerSelected({
          slug: survey.slug ?? null,
          host: analyticsHost,
          tenant: analyticsTenant,
          questionId: pregunta.id,
          questionType: pregunta.tipo,
          optionId: normalizedOptionId,
          selectionCount: nextIds.length,
        });
      }
      return { ...prev, [pregunta.id]: { ...current, opcionIds: nextIds } };
    });
  };

  const handleTextChange = (pregunta: SurveyPregunta, value: string) => {
    if (previewMode) setPreviewValidated(false);
    setAnswers((prev) => ({
      ...prev,
      [pregunta.id]: { ...prev[pregunta.id], texto: value },
    }));
    if (!previewMode) {
      trackSurveyAnswerSelected({
        slug: survey.slug ?? null,
        host: analyticsHost,
        tenant: analyticsTenant,
        questionId: pregunta.id,
        questionType: pregunta.tipo,
        optionId: null,
        selectionCount: value.trim().length > 0 ? 1 : 0,
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<number, string> = {};
    let newIdentityError: string | null = null;

    visibleQuestions.forEach((pregunta) => {
      const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
      if (pregunta.tipo === 'abierta') {
        if (pregunta.obligatoria && !answer.texto?.trim()) {
          newErrors[pregunta.id] = 'Este campo es obligatorio.';
        }
        return;
      }

      if (pregunta.tipo === 'opcion_unica' || pregunta.tipo === 'rating_emoji') {
        if (pregunta.obligatoria && (!answer.opcionIds || answer.opcionIds.length === 0)) {
          newErrors[pregunta.id] = 'Seleccioná una opción.';
        }
        return;
      }

      if (pregunta.tipo === 'multiple') {
        const selected = answer.opcionIds ?? [];
        const min = pregunta.min_selecciones ?? (pregunta.obligatoria ? 1 : 0);
        const max = pregunta.max_selecciones ?? selected.length;
        if (selected.length < min) {
          newErrors[pregunta.id] = `Seleccioná al menos ${min} opción(es).`;
        } else if (selected.length > max) {
          newErrors[pregunta.id] = `Seleccioná hasta ${max} opción(es).`;
        }
      }
    });

    const trimmedDni = dni.trim();
    const trimmedPhone = phone.trim();
    const normalizedDni = trimmedDni.replace(/\D+/g, '');
    const normalizedPhone = trimmedPhone.replace(/\D+/g, '');

    if (!previewMode && requireDni && !normalizedDni) {
      newIdentityError = 'Ingresá tu DNI para validar tu participación.';
    } else if (!previewMode && requirePhone && !normalizedPhone) {
      newIdentityError = 'Ingresá tu teléfono para validar tu participación.';
    } else if (!previewMode && contactRequired && !normalizedDni && !normalizedPhone) {
      newIdentityError = 'Ingresá tu DNI o teléfono para validar tu participación.';
    }

    setErrors(newErrors);
    setIdentityError(newIdentityError);
    return Object.keys(newErrors).length === 0 && !newIdentityError;
  };

  const answeredQuestionsCount = useMemo(
    () =>
      visibleQuestions.reduce((count, pregunta) => {
        const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
        if (pregunta.tipo === 'abierta') {
          return answer.texto?.trim() ? count + 1 : count;
        }
        return (answer.opcionIds?.length ?? 0) > 0 ? count + 1 : count;
      }, 0),
    [answers, visibleQuestions],
  );

  const totalQuestionsCount = visibleQuestions.length;
  const progressPercent = totalQuestionsCount
    ? Math.round((answeredQuestionsCount / totalQuestionsCount) * 100)
    : 0;
  const currentQuestionIndex = useMemo(() => {
    const firstPending = visibleQuestions.findIndex((pregunta) => {
      const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
      if (pregunta.tipo === 'abierta') return !answer.texto?.trim();
      return (answer.opcionIds?.length ?? 0) === 0;
    });
    if (firstPending >= 0) return firstPending + 1;
    return totalQuestionsCount;
  }, [answers, totalQuestionsCount, visibleQuestions]);

  const hiddenQuestionsCount = Math.max(0, survey.preguntas.length - visibleQuestions.length);

  const handleResetPreview = () => {
    if (!previewMode) return;
    setAnswers(initialState);
    setErrors({});
    setIdentityError(null);
    setSubmissionErrorTitle(null);
    setSubmissionErrorDetails(null);
    setDismissedErrorKey(null);
    setPreviewValidated(false);
    setDni('');
    setPhone('');
    setDemographics({});
    setCustomGender('');
    setGeoStatus('idle');
    setGeoMessage(null);
    setTurnstileToken('');
    setGovernanceConsentAccepted(false);
    setGovernanceEligibilityAcknowledged(false);
    if (eligibilityCredentialInputRef.current) {
      eligibilityCredentialInputRef.current.value = '';
    }
    setEligibilityCredentialReady(false);
    setEligibilityStatus(publicEligibility.required ? 'required' : 'not_required');
  };

  const clearParticipantResponseState = () => {
    setErrors({});
    setIdentityError(null);
    setDni('');
    setPhone('');
    setDemographics({});
    setCustomGender('');
    setGeoStatus('idle');
    setGeoMessage(null);
    setTurnstileToken('');
    setTurnstileResetSignal((value) => value + 1);
    setAnswers(initialState);
    setGovernanceConsentAccepted(false);
    setGovernanceEligibilityAcknowledged(false);
  };

  const handleSubmit = async () => {
    if (readOnly) return;
    if (submitting || submissionInFlightScopeRef.current) return;
    if (previewMode) {
      setSubmissionErrorTitle(null);
      setSubmissionErrorDetails(null);
      const isValidRoute = validate();
      setPreviewValidated(isValidRoute);
      return;
    }
    if (requiresAuthenticatedParticipant && !user) {
      setSubmissionErrorTitle('Necesitas identificarte para participar');
      setSubmissionErrorDetails('Inicia sesion con tu cuenta para que el voto quede asociado de forma segura.');
      return;
    }
    if (publicGovernance.required && !publicGovernance.valid) {
      setSubmissionErrorTitle('Participación gobernada no disponible');
      setSubmissionErrorDetails(publicGovernance.invalidReason || 'El contrato de gobernanza no es verificable.');
      return;
    }
    if (publicGovernance.required && !publicConsentIntegrityVerified) {
      setSubmissionErrorTitle('Consentimiento público no verificado');
      setSubmissionErrorDetails(
        (publicConsentIntegrityIsCurrent ? publicConsentIntegrity.error : undefined) ||
          'Esperá a que la huella SHA-256 del texto público quede verificada antes de participar.',
      );
      return;
    }
    if (
      publicGovernance.required &&
      (!governanceConsentAccepted || !governanceEligibilityAcknowledged)
    ) {
      setSubmissionErrorTitle('Faltan confirmaciones de participación');
      setSubmissionErrorDetails(
        'Aceptá la política de consentimiento versionada y reconocé la política de elegibilidad antes de enviar.',
      );
      return;
    }
    if (publicEligibility.required && !publicEligibility.valid) {
      setSubmissionErrorTitle('Validación de elegibilidad no disponible');
      setSubmissionErrorDetails(
        publicEligibility.invalidReason || 'El contrato de credenciales no es verificable.',
      );
      return;
    }
    if (publicEligibility.required && !publicEligibility.available) {
      setSubmissionErrorTitle('Validación de elegibilidad temporalmente fuera de servicio');
      setSubmissionErrorDetails(
        publicEligibility.invalidReason || 'Conservá tu credencial y volvé a intentar más tarde.',
      );
      return;
    }
    const eligibilityCredential = publicEligibility.required
      ? eligibilityCredentialInputRef.current?.value.trim() || ''
      : '';
    if (publicEligibility.required && (!eligibilityCredential || !publicEligibility.expectation)) {
      setSubmissionErrorTitle('Falta la credencial de elegibilidad');
      setSubmissionErrorDetails(
        'Ingresá la credencial entregada por la institución para validar esta participación.',
      );
      setEligibilityCredentialReady(false);
      setEligibilityStatus('required');
      return;
    }
    if (!validate()) return;
    if (turnstileUnavailable) {
      setSubmissionErrorTitle('No pudimos enviar tu respuesta');
      setSubmissionErrorDetails('La verificacion de seguridad no esta configurada para esta pantalla.');
      return;
    }
    if (turnstileMissingToken) {
      setSubmissionErrorTitle('Falta verificacion de seguridad');
      setSubmissionErrorDetails('Completa la verificacion antes de enviar tu respuesta.');
      return;
    }

    setSubmissionErrorTitle(null);
    setSubmissionErrorDetails(null);
    setDismissedErrorKey(null);
    setSubmitting(true);
    if (publicEligibility.required) {
      setEligibilityStatus('verifying');
    }
    const submittedScopeKey = submissionScopeKey;
    submissionInFlightScopeRef.current = submittedScopeKey;
    try {
      const sanitizedDemographics = sanitizeDemographics();
      const answeredQuestions = visibleQuestions.reduce((count, pregunta) => {
        const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
        if (pregunta.tipo === 'abierta') {
          return answer.texto?.trim() ? count + 1 : count;
        }
        const selected = answer.opcionIds ?? [];
        return selected.length > 0 ? count + 1 : count;
      }, 0);

      const submissionAttempt = submissionAttemptRef.current ?? {
        submissionId: createSecureSurveySubmissionId(),
        submittedAt: new Date().toISOString(),
      };
      submissionAttemptRef.current = submissionAttempt;

      const metadataPayload: SurveyAnalyticsMetadata = {
        answeredQuestions,
        totalQuestions: visibleQuestions.length,
        submittedAt: submissionAttempt.submittedAt,
      };

      if (defaultMetadata?.canal) {
        metadataPayload.canal = defaultMetadata.canal;
      }

      if (sanitizedDemographics) {
        metadataPayload.demographics = sanitizedDemographics;
      }

      const trimmedDni = dni.trim();
      const trimmedPhone = phone.trim();
      const normalizedDni = trimmedDni.replace(/\D+/g, '');
      const normalizedPhone = trimmedPhone.replace(/\D+/g, '');

      const respuestas = visibleQuestions.reduce<PublicResponsePayload['respuestas']>((acc, pregunta) => {
        const answer = answers[pregunta.id] ?? { opcionIds: [], texto: '' };
        const base = { pregunta_id: pregunta.id } as PublicResponsePayload['respuestas'][number];

        if (pregunta.tipo === 'abierta') {
          const textoLibre = answer.texto?.trim();

          if (!textoLibre) {
            if (pregunta.obligatoria) {
              base.texto_libre = '';
              acc.push(base);
            }
            return acc;
          }

          base.texto_libre = textoLibre;
          acc.push(base);
          return acc;
        }

        const selectedIds = Array.isArray(answer.opcionIds)
          ? uniqueOptionIds(answer.opcionIds)
          : [];

        if (!selectedIds.length) {
          if (pregunta.obligatoria) {
            base.opcion_ids = [];
            acc.push(base);
          }
          return acc;
        }

        base.opcion_ids = pregunta.tipo === 'multiple' ? selectedIds : selectedIds.slice(0, 1);
        acc.push(base);
        return acc;
      }, []);

      if (!respuestas.length) {
        setSubmitting(false);
        setSubmissionErrorTitle('No pudimos enviar tu respuesta');
        setSubmissionErrorDetails('Seleccioná al menos una opción o completá una respuesta antes de enviar.');
        return;
      }

      metadataPayload.answeredQuestions = respuestas.length;

      const payload: PublicResponsePayload = {
        submission_id: submissionAttempt.submissionId,
        respuestas,
        ...(typeof survey.instrument_revision === 'number' && survey.instrument_revision > 0
          ? { instrument_revision: survey.instrument_revision }
          : {}),
        dni: normalizedDni ? normalizedDni : undefined,
        phone: normalizedPhone ? normalizedPhone : undefined,
        ...defaultMetadata,
        metadata: metadataPayload,
        ...(turnstileToken.trim() ? { turnstile_token: turnstileToken.trim() } : {}),
        privacy_consent: true,
        ...(typeof (survey as { privacy_policy_version?: unknown })?.privacy_policy_version === 'string'
          ? { privacy_policy_version: ((survey as { privacy_policy_version?: string }).privacy_policy_version || '').trim() || undefined }
          : {}),
        ...(publicGovernance.required && publicGovernance.acknowledgment
          ? { governance: publicGovernance.acknowledgment }
          : {}),
      };
      if (publicEligibility.required && publicEligibility.expectation) {
        await onSubmit(payload, {
          eligibilityCredential,
          eligibilityExpectation: publicEligibility.expectation,
        });
      } else {
        await onSubmit(payload);
      }
      if (activeSubmissionScopeRef.current !== submittedScopeKey) return;
      if (publicEligibility.required) {
        if (eligibilityCredentialInputRef.current) {
          eligibilityCredentialInputRef.current.value = '';
        }
        setEligibilityCredentialReady(false);
        setEligibilityStatus('eligible');
      }
      submissionAttemptRef.current = null;
      clearParticipantResponseState();
    } catch (error) {
      if (activeSubmissionScopeRef.current !== submittedScopeKey) return;
      if (!shouldReuseSurveySubmissionAttempt(error)) {
        submissionAttemptRef.current = null;
      }
      const reasonCode = getSurveySubmissionReasonCode(error);
      const idempotencyConflict = isSurveySubmissionIdConflictError(error);
      if (reasonCode === SURVEY_RESPONSE_DUPLICATE_REASON_CODE) {
        clearParticipantResponseState();
      }
      if (publicEligibility.required) {
        if (isTerminalSurveyEligibilityError(error)) {
          if (eligibilityCredentialInputRef.current) {
            eligibilityCredentialInputRef.current.value = '';
          }
          setEligibilityCredentialReady(false);
          setEligibilityStatus('required');
        } else {
          const credentialStillPresent = Boolean(
            eligibilityCredentialInputRef.current?.value.trim(),
          );
          setEligibilityCredentialReady(credentialStillPresent);
          setEligibilityStatus(credentialStillPresent ? 'ready' : 'required');
        }
      }
      setSubmissionErrorTitle(
        reasonCode === SURVEY_RESPONSE_DUPLICATE_REASON_CODE
          ? 'Ya registramos tu opinion'
          : 'No pudimos enviar tu respuesta',
      );
      setSubmissionErrorDetails(
        idempotencyConflict
          ? `${error instanceof Error && error.message.trim() ? error.message : 'La referencia del intento entro en conflicto.'} Conservamos tus respuestas para que puedas volver a enviarlas.`
          : error instanceof Error && error.message.trim()
            ? error.message
            : 'No recibimos una confirmacion segura. Tu respuesta sigue disponible para reintentar.',
      );
    } finally {
      if (submissionInFlightScopeRef.current === submittedScopeKey) {
        submissionInFlightScopeRef.current = null;
      }
      if (activeSubmissionScopeRef.current === submittedScopeKey) {
        setSubmitting(false);
      }
    }
  };

  if (!previewMode && !readOnly && requiresAuthenticatedParticipant && !user) {
    return (
      <Card className="w-full border border-border/70 bg-background shadow-sm" data-testid="survey-auth-gate">
        <CardHeader className="space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Identifica tu participacion</CardTitle>
            <CardDescription>
              Esta consulta registra un voto por persona. Tu cuenta valida la participacion sin enviar tu identificador dentro de la respuesta.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {authLoading ? (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              Verificando tu cuenta...
            </p>
          ) : clerkRuntime.enabled ? (
            <ClerkAuthButtons mode="login" />
          ) : (
            <Button asChild className="w-full sm:w-auto">
              <a href={loginHref}>
                <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                Iniciar sesion para participar
              </a>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isVotingVariant ? 'w-full border border-border/70 bg-background/80 shadow-sm' : 'w-full'}>
      {showHeader && (
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">{survey.titulo}</CardTitle>
          {survey.descripcion && (
            <CardDescription className="max-w-3xl whitespace-pre-line text-base text-muted-foreground">
              {survey.descripcion}
            </CardDescription>
          )}
          <div className="text-sm text-muted-foreground flex flex-col gap-1">
            <span>
              Vigencia: {new Date(survey.inicio_at).toLocaleDateString()} –{' '}
              {survey.fin_at ? new Date(survey.fin_at).toLocaleDateString() : 'Sin fecha de cierre'}
            </span>
            <span>Tipo: {survey.tipo}</span>
          </div>
        </CardHeader>
      )}
      <CardContent className="space-y-10">
        {previewMode ? (
          <section
            className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4"
            aria-label="Ruta activa de la simulación"
            data-testid="survey-preview-route"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Route className="h-4 w-4" aria-hidden="true" />
                  Ruta activa de la simulación
                </h3>
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
                  {visibleQuestions.length} de {survey.preguntas.length} preguntas visibles
                  {hiddenQuestionsCount > 0 ? ` · ${hiddenQuestionsCount} fuera de esta ruta` : ''}.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={handleResetPreview}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Reiniciar prueba
              </Button>
            </div>
            <ol className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Preguntas de la ruta activa">
              {visibleQuestions.map((question, index) => (
                <li
                  key={question.id}
                  aria-current={index + 1 === currentQuestionIndex ? 'step' : undefined}
                  className="min-w-9 shrink-0 rounded-full border border-primary/30 bg-background px-3 py-1 text-center text-xs font-medium"
                  title={toDisplayText(question.texto)}
                >
                  <span className="sr-only">Pregunta </span>
                  {question.orden}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              Tus respuestas quedan solamente en la memoria de esta vista previa.
            </p>
          </section>
        ) : null}
        {!previewMode && publicGovernance.required ? (
          publicGovernance.valid ? (
            <section
              className="space-y-4 rounded-xl border border-sky-300/70 bg-sky-50 p-4 text-sky-950"
              aria-labelledby="survey-governance-title"
              data-testid="survey-governance-ack"
            >
              <div>
                <h3 id="survey-governance-title" className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Participación con política versionada
                </h3>
                <p className="mt-1 text-sm">
                  Release v{publicGovernance.versionNumber ?? 'sin número'} · Elegibilidad{' '}
                  {publicGovernance.eligibilityPolicyVersion} · Consentimiento{' '}
                  {publicGovernance.consentPolicyVersion}.
                </p>
              </div>
              <dl className="grid gap-3 text-xs md:grid-cols-2">
                <div className="rounded-lg bg-white/70 p-3">
                  <dt className="font-semibold">Snapshot del instrumento</dt>
                  <dd className="mt-1 break-all font-mono">{publicGovernance.snapshotSha256}</dd>
                </div>
                <div className="rounded-lg bg-white/70 p-3">
                  <dt className="font-semibold">Huella de políticas</dt>
                  <dd className="mt-1 break-all font-mono">{publicGovernance.policySha256}</dd>
                </div>
              </dl>
              <div className="space-y-2 text-sm">
                <p>
                  Elegibilidad: {publicGovernance.eligibilityMode || 'modo no descriptivo'}.
                  {publicGovernance.eligibilityDeclarations.length
                    ? ` Declaraciones requeridas: ${publicGovernance.eligibilityDeclarations.join(', ')}.`
                    : ' Sin códigos declarativos adicionales.'}
                  {' '}La elegibilidad no se decide automáticamente y requiere revisión humana.
                </p>
                <div className="rounded-lg border border-sky-300 bg-white/80 p-3">
                  <p className="font-semibold">Texto exacto de consentimiento</p>
                  <p
                    className="mt-2 whitespace-pre-wrap break-words"
                    data-testid="survey-public-consent-text"
                  >
                    {publicGovernance.consentPublicText}
                  </p>
                  <p className="mt-3 break-all font-mono text-xs text-sky-800">
                    SHA-256: {publicGovernance.consentTextSha256}
                  </p>
                </div>
                {visiblePublicConsentIntegrityStatus === 'pending' ? (
                  <p className="rounded-lg border border-sky-300 bg-white/80 p-3" role="status">
                    Verificando localmente que el texto coincida con su huella SHA-256…
                  </p>
                ) : null}
                {visiblePublicConsentIntegrityStatus === 'verified' ? (
                  <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-950" role="status">
                    Texto público íntegro: la huella coincide con este contenido exacto.
                  </p>
                ) : null}
                {visiblePublicConsentIntegrityStatus === 'invalid' ? (
                  <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-destructive" role="alert">
                    {publicConsentIntegrity.error || 'No se pudo verificar el texto público.'}
                  </p>
                ) : null}
                <p className="font-semibold">
                  Chatboc no certifica una elección regulada ni sus resultados, y no reemplaza la revisión humana.
                </p>
              </div>
              {!readOnly && publicConsentIntegrityVerified ? (
                <div className="space-y-3 border-t border-sky-200 pt-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="survey-governance-consent"
                      checked={governanceConsentAccepted}
                      onCheckedChange={(checked) => setGovernanceConsentAccepted(checked === true)}
                    />
                    <Label htmlFor="survey-governance-consent" className="cursor-pointer leading-5">
                      Confirmo que leí el texto exacto mostrado arriba y acepto la política de consentimiento versión{' '}
                      {publicGovernance.consentPolicyVersion} vinculada a esta huella.
                    </Label>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="survey-governance-eligibility"
                      checked={governanceEligibilityAcknowledged}
                      onCheckedChange={(checked) => setGovernanceEligibilityAcknowledged(checked === true)}
                    />
                    <Label htmlFor="survey-governance-eligibility" className="cursor-pointer leading-5">
                      Reconozco la política de elegibilidad versión {publicGovernance.eligibilityPolicyVersion} y que
                      su evaluación queda sujeta a revisión humana.
                    </Label>
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <Alert variant="destructive" data-testid="survey-governance-invalid">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Participación gobernada bloqueada</AlertTitle>
              <AlertDescription>{publicGovernance.invalidReason}</AlertDescription>
            </Alert>
          )
        ) : null}
        {!previewMode && !readOnly && publicEligibility.restricted ? (
          publicEligibility.valid && publicEligibility.available ? (
            <section
              className="space-y-3 rounded-xl border border-emerald-300/70 bg-emerald-50 p-4 text-emerald-950"
              aria-labelledby="survey-eligibility-title"
              data-testid="survey-eligibility-gate"
              data-eligibility-state={eligibilityStatus}
            >
              <div className="space-y-1">
                <h3 id="survey-eligibility-title" className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Validación de elegibilidad
                </h3>
                <p className="text-sm">
                  Esta consulta requiere una credencial opaca emitida por un operador autorizado según la política
                  publicada. Chatboc no la copia al historial, la caché ni el almacenamiento local; se usa solamente
                  durante este envío.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-eligibility-credential">Credencial de elegibilidad</Label>
                <Input
                  id="survey-eligibility-credential"
                  name="survey-eligibility-credential"
                  type="password"
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  spellCheck={false}
                  ref={eligibilityCredentialInputRef}
                  disabled={Boolean(loading || submitting)}
                  aria-describedby="survey-eligibility-status"
                  onInput={(event) => {
                    const ready = Boolean(event.currentTarget.value.trim());
                    setEligibilityCredentialReady(ready);
                    setEligibilityStatus(ready ? 'ready' : 'required');
                  }}
                />
                <p id="survey-eligibility-status" className="text-xs" role="status" aria-live="polite">
                  {eligibilityStatus === 'verifying'
                    ? 'Verificando la credencial y registrando la respuesta en una única operación segura…'
                    : eligibilityStatus === 'eligible'
                      ? 'Elegibilidad confirmada mediante un recibo durable.'
                      : eligibilityStatus === 'ready'
                        ? 'Credencial lista. Se verificará recién cuando envíes la respuesta.'
                        : 'Ingresá la credencial para habilitar el envío.'}
                </p>
                <p className="text-xs font-medium">
                  Esta validación no certifica secreto del voto, una elección regulada ni sus resultados.
                </p>
              </div>
            </section>
          ) : (
            <Alert variant="destructive" data-testid="survey-eligibility-unavailable">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Validación de elegibilidad no disponible</AlertTitle>
              <AlertDescription>
                {publicEligibility.invalidReason ||
                  'Conservá tu credencial y volvé a intentar cuando el municipio restablezca este acceso.'}
              </AlertDescription>
            </Alert>
          )
        ) : null}
        {!readOnly && (
          <div
            className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pregunta {currentQuestionIndex} de {totalQuestionsCount}</span>
              <span>{progressPercent}% completado</span>
            </div>
            <Progress value={progressPercent} aria-label="Progreso de encuesta" />
          </div>
        )}
        {submissionErrorTitle && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 text-left">
            <div className="flex flex-col gap-3">
              <div>
                <AlertTitle>{submissionErrorTitle}</AlertTitle>
                {submissionErrorDetails && (
                  <AlertDescription>
                    <p>{submissionErrorDetails}</p>
                    {submitErrorStatus && submitErrorStatus >= 500 && (
                      <p className="mt-2 text-xs text-destructive/80">
                        El servidor devolvió un error inesperado. Intentá nuevamente en unos minutos o compartí este mensaje con
                        soporte.
                      </p>
                    )}
                  </AlertDescription>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSubmissionErrorTitle(null);
                    setSubmissionErrorDetails(null);
                    setDismissedErrorKey(currentErrorKey);
                  }}
                >
                  Entendido
                </Button>
              </div>
            </div>
          </Alert>
        )}
        {showContactBlock && (
          <div className="rounded-lg border border-border bg-card/40 p-4 space-y-2">
            <p className="text-sm font-medium">
              Validación de participación
            </p>
            <p className="text-xs text-muted-foreground">
              {requireDni
                ? 'Ingresá tu número de documento para validar tu participación.'
                : requirePhone
                  ? 'Ingresá tu número de teléfono para validar tu participación.'
                  : 'Ingresá tu número de documento o teléfono para validar tu participación.'}
            </p>
            {showDniField && (
              <div className="space-y-2">
                <Label htmlFor="survey-dni">Documento</Label>
                <Input
                  id="survey-dni"
                  inputMode="numeric"
                  value={dni}
                  onChange={(event) => setDni(event.target.value)}
                  placeholder="Ingresá tu número de documento"
                  disabled={readOnly}
                />
              </div>
            )}
            {showPhoneField && (
              <div className="space-y-2">
                <Label htmlFor="survey-phone">Teléfono</Label>
                <Input
                  id="survey-phone"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Ingresá tu número de teléfono"
                  disabled={readOnly}
                />
              </div>
            )}
            {identityError && <p className="text-sm text-destructive">{identityError}</p>}
          </div>
        )}
        {!readOnly && !previewMode && (
        <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Datos demográficos y territoriales (opcional)</p>
            <p className="text-xs text-muted-foreground">
              Esta información complementaria permite construir métricas segmentadas, mapas de calor y tableros en tiempo real.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-age-range">Rango etario</Label>
              <Select
                value={demographics.rangoEtario}
                onValueChange={(value) => handleDemographicsChange('rangoEtario', value)}
                disabled={readOnly}
              >
                <SelectTrigger id="survey-age-range">
                  <SelectValue placeholder="Seleccioná tu rango etario" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-gender">Sexo / género</Label>
              <Select
                value={demographics.genero}
                onValueChange={(value) => handleDemographicsChange('genero', value)}
                disabled={readOnly}
              >
                <SelectTrigger id="survey-gender">
                  <SelectValue placeholder="Seleccioná una opción" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {demographics.genero === 'self-described' ? (
            <div className="space-y-2">
              <Label htmlFor="survey-gender-detail">Autodescripción</Label>
              <Input
                id="survey-gender-detail"
                value={customGender}
                onChange={(event) => {
                  const value = event.target.value;
                  setCustomGender(value);
                  handleDemographicsChange('generoDescripcion', value);
                }}
                placeholder="Ingresá cómo te identificás"
                disabled={readOnly}
              />
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-education">Nivel educativo</Label>
              <Select
                value={demographics.nivelEducativo}
                onValueChange={(value) => handleDemographicsChange('nivelEducativo', value)}
                disabled={readOnly}
              >
                <SelectTrigger id="survey-education">
                  <SelectValue placeholder="Seleccioná una opción" />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-employment">Situación laboral</Label>
              <Select
                value={demographics.situacionLaboral}
                onValueChange={(value) => handleDemographicsChange('situacionLaboral', value)}
                disabled={readOnly}
              >
                <SelectTrigger id="survey-employment">
                  <SelectValue placeholder="Seleccioná una opción" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="survey-occupation">Ocupación / rubro (opcional)</Label>
            <Input
              id="survey-occupation"
              value={demographics.ocupacion ?? ''}
              onChange={(event) => handleDemographicsChange('ocupacion', event.target.value)}
              placeholder="Ej: Comercio minorista, educación, salud"
              disabled={readOnly}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-country">País o región</Label>
              <Input
                id="survey-country"
                value={demographics.ubicacion?.pais ?? ''}
                onChange={(event) => handleLocationFieldChange('pais', event.target.value)}
                placeholder="Ej: Argentina"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-province">Provincia / estado</Label>
              <Input
                id="survey-province"
                value={demographics.ubicacion?.provincia ?? ''}
                onChange={(event) => handleLocationFieldChange('provincia', event.target.value)}
                placeholder="Ej: Santa Fe"
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-city">Ciudad o localidad</Label>
              <Input
                id="survey-city"
                value={demographics.ubicacion?.ciudad ?? ''}
                onChange={(event) => handleLocationFieldChange('ciudad', event.target.value)}
                placeholder="Ej: Rosario"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-neighborhood">Barrio o zona</Label>
              <Input
                id="survey-neighborhood"
                value={demographics.ubicacion?.barrio ?? ''}
                onChange={(event) => handleLocationFieldChange('barrio', event.target.value)}
                placeholder="Ej: Barrio Centro"
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="survey-postal-code">Código postal</Label>
              <Input
                id="survey-postal-code"
                value={demographics.ubicacion?.codigoPostal ?? ''}
                onChange={(event) => handleLocationFieldChange('codigoPostal', event.target.value)}
                placeholder="Ej: 2000"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-residency">Tiempo de residencia en la zona</Label>
              <Input
              id="survey-residency"
              value={demographics.tiempoResidencia ?? ''}
              onChange={(event) => handleDemographicsChange('tiempoResidencia', event.target.value)}
              placeholder="Ej: 5 años"
              disabled={readOnly}
            />
            </div>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
              Podés compartir tu ubicación para fortalecer las métricas territoriales y la segmentación por barrios.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={handleRequestLocation}
                disabled={geoStatus === 'loading' || readOnly}
            >
              {geoStatus === 'loading' ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
            </Button>
          </div>
          {geoMessage ? (
            <p className={`text-xs ${geoStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {geoMessage}
            </p>
          ) : null}
          {typeof demographics.ubicacion?.lat === 'number' && typeof demographics.ubicacion?.lng === 'number' ? (
            <p className="text-xs text-muted-foreground">
              Coordenadas registradas: {demographics.ubicacion.lat.toFixed(4)}, {demographics.ubicacion.lng.toFixed(4)}
            </p>
          ) : null}
        </div>
        )}
        {visibleQuestions.map((pregunta) => (
          <div
            key={pregunta.id}
            className={
              isVotingVariant
                ? 'space-y-3 rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 px-4 py-4 shadow-sm transition-all duration-300 hover:shadow-md md:px-5'
                : 'space-y-3 border border-border rounded-lg p-4 bg-card/40'
            }
          >
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-medium">
                {pregunta.orden}. {toDisplayText(pregunta.texto)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {pregunta.obligatoria ? 'Obligatoria' : 'Opcional'} · Tipo: {pregunta.tipo}
              </p>
            </div>
            {(pregunta.tipo === 'opcion_unica' || pregunta.tipo === 'rating_emoji') && (
              <RadioGroup
                value={(answers[pregunta.id]?.opcionIds?.[0] ?? '').toString()}
                onValueChange={(value) => handleRadioChange(pregunta, value)}
                className={pregunta.tipo === 'rating_emoji' ? "flex flex-wrap gap-4 justify-center py-4" : "space-y-2.5"}
              >
                {pregunta.opciones?.map((opcion) => {
                  // Live results calculation
                  const questionStats = showLiveResults && liveResults?.preguntas?.[String(pregunta.id)];
                  const optionStats = questionStats?.opciones?.find((opt) => optionIdsEqual(opt.id, opcion.id));
                  const totalVotes = questionStats?.opciones?.reduce((acc, curr) => acc + curr.votos, 0) || 0;
                  const percent = totalVotes > 0 && optionStats ? Math.round((optionStats.votos / totalVotes) * 100) : 0;

                  return (
                    <Label
                      key={opcion.id}
                      htmlFor={`preg-${pregunta.id}-opc-${opcion.id}`}
                      className={
                        pregunta.tipo === 'rating_emoji'
                          ? "group flex flex-col items-center gap-2 cursor-pointer p-4 rounded-2xl border-2 border-transparent bg-background/70 hover:bg-accent/50 transition-all duration-300 [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5"
                          : "group flex items-center gap-3 rounded-xl border border-border/70 bg-background/90 px-3 py-2.5 transition-all duration-300 hover:border-primary hover:shadow-sm relative overflow-hidden"
                      }
                    >
                      {pregunta.tipo !== 'rating_emoji' && (
                        <RadioGroupItem
                          id={`preg-${pregunta.id}-opc-${opcion.id}`}
                          value={opcion.id.toString()}
                          className="z-10"
                          disabled={readOnly}
                        />
                      )}

                      {pregunta.tipo === 'rating_emoji' && (
                        <div className="sr-only">
                          <RadioGroupItem
                            id={`preg-${pregunta.id}-opc-${opcion.id}`}
                            value={opcion.id.toString()}
                            disabled={readOnly}
                          />
                        </div>
                      )}

                      <span className={pregunta.tipo === 'rating_emoji' ? "text-4xl select-none transition-transform duration-300 group-hover:scale-110" : "z-10 relative"}>
                        {toDisplayText(opcion.texto)}
                      </span>

                      {showLiveResults && pregunta.tipo !== 'rating_emoji' && (
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-primary/15 transition-all duration-700"
                          style={{ width: `${percent}%` }}
                        />
                      )}

                      {showLiveResults && pregunta.tipo !== 'rating_emoji' && (
                        <span className="ml-auto text-xs font-bold z-10 text-muted-foreground">
                          {percent}% ({optionStats?.votos || 0})
                        </span>
                      )}

                      {showLiveResults && pregunta.tipo === 'rating_emoji' && (
                        <div className="text-sm font-bold mt-1 text-muted-foreground">
                          {percent}%
                        </div>
                      )}
                    </Label>
                  );
                })}
              </RadioGroup>
            )}
            {pregunta.tipo === 'multiple' && (
              <div className="flex flex-col gap-2">
                {pregunta.opciones?.map((opcion) => {
                  const checked =
                    answers[pregunta.id]?.opcionIds?.some((id) => optionIdsEqual(id, opcion.id)) ?? false;
                  // Live results calculation
                  const questionStats = showLiveResults && liveResults?.preguntas?.[String(pregunta.id)];
                  const optionStats = questionStats?.opciones?.find((opt) => optionIdsEqual(opt.id, opcion.id));
                  const totalVotes = questionStats?.opciones?.reduce((acc, curr) => acc + curr.votos, 0) || 0;
                  const percent = totalVotes > 0 && optionStats ? Math.round((optionStats.votos / totalVotes) * 100) : 0;

                  return (
                    <Label
                      key={opcion.id}
                      htmlFor={`preg-${pregunta.id}-opc-${opcion.id}`}
                      className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background/90 px-3 py-2.5 transition-all duration-300 hover:border-primary hover:shadow-sm relative overflow-hidden"
                    >
                      <Checkbox
                        id={`preg-${pregunta.id}-opc-${opcion.id}`}
                        checked={checked}
                        onCheckedChange={(state) =>
                          handleCheckboxToggle(pregunta, opcion.id, state === true)
                        }
                        className="z-10"
                        disabled={readOnly}
                      />
                      <span className="z-10 relative">{toDisplayText(opcion.texto)}</span>

                      {showLiveResults && (
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-primary/15 transition-all duration-700"
                          style={{ width: `${percent}%` }}
                        />
                      )}

                      {showLiveResults && (
                        <span className="ml-auto text-xs font-bold z-10 text-muted-foreground">
                          {percent}% ({optionStats?.votos || 0})
                        </span>
                      )}
                    </Label>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  {pregunta.min_selecciones && `Mínimo ${pregunta.min_selecciones}. `}
                  {pregunta.max_selecciones && `Máximo ${pregunta.max_selecciones}.`}
                </p>
              </div>
            )}
            {pregunta.tipo === 'abierta' && (
              <Textarea
                value={answers[pregunta.id]?.texto ?? ''}
                onChange={(event) => handleTextChange(pregunta, event.target.value)}
                placeholder="Escribí tu respuesta"
                className="min-h-[120px]"
                disabled={readOnly}
              />
            )}
            {errors[pregunta.id] && (
              <p className="text-sm text-destructive">{errors[pregunta.id]}</p>
            )}
          </div>
        ))}

        {!readOnly && (
          <div className="space-y-3">
            {previewMode && previewValidated ? (
              <Alert role="status" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Ruta validada</AlertTitle>
                <AlertDescription>
                  La ruta visible está completa. No se guardó ni se envió ningún voto.
                </AlertDescription>
              </Alert>
            ) : null}

            {!previewMode && turnstileConfig.enabled && turnstileSiteKey ? (
              <TurnstileChallenge
                siteKey={turnstileSiteKey}
                onToken={setTurnstileToken}
                resetSignal={turnstileResetSignal}
                disabled={loading || submitting}
                testId="survey-turnstile-challenge"
                description="Protege la votacion o encuesta publica sin pedirte registro previo."
              />
            ) : null}

            {!previewMode && turnstileUnavailable ? (
              <Alert variant="destructive">
                <AlertTitle>Verificacion no disponible</AlertTitle>
                <AlertDescription>
                  Esta encuesta requiere verificacion de seguridad, pero falta configurar la clave publica del sitio.
                </AlertDescription>
              </Alert>
            ) : null}

          <Button
            type="button"
            disabled={
              loading ||
              submitting ||
              turnstileUnavailable ||
              turnstileMissingToken ||
              governanceSubmissionBlocked ||
              eligibilitySubmissionBlocked
            }
            onClick={handleSubmit}
            className="w-full md:w-auto"
          >
            {previewMode
              ? 'Validar esta ruta'
              : loading || submitting
                ? (publicEligibility.required ? 'Validando y enviando…' : 'Enviando…')
                : (submitLabel && submitLabel.trim().length ? submitLabel : 'Enviar opinión')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
