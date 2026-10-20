import { describe, expect, it } from 'vitest';

import type { SurveyAdmin } from '@/types/encuestas';
import { resolveSurveyJurisdictionScope } from '@/utils/surveyJurisdictionScope';

const baseSurvey = (overrides: Record<string, unknown> = {}): SurveyAdmin => ({
  id: 41,
  slug: 'instrumento-generico',
  titulo: 'Instrumento sin geografía inferible',
  tipo: 'opinion',
  estado: 'borrador',
  inicio_at: '2026-08-01T12:00:00Z',
  fin_at: null,
  politica_unicidad: 'libre',
  preguntas: [],
  ...overrides,
} as SurveyAdmin);

const adminScope = ({
  status,
  compatible,
  tenantRef,
  surveyRef,
}: {
  status: 'compatible' | 'conflict' | 'unverified';
  compatible: boolean | null;
  tenantRef: string | null;
  surveyRef: string | null;
}) => ({
  contract_version: 'surveys.admin_scope.v1',
  jurisdiction: {
    contract_version: 'surveys.admin_jurisdiction_scope.v1',
    status,
    compatible,
    reason_code: status === 'conflict'
      ? 'survey_jurisdiction_binding_conflict'
      : status === 'compatible'
      ? 'survey_jurisdiction_compatible'
      : 'survey_jurisdiction_unbound',
    action_hint: status === 'compatible' ? null : 'review_scope',
    tenant_verified_ref: tenantRef,
    survey_ref: surveyRef,
    authoritative_source: 'server_owned_persisted_refs',
    content_review_included: false,
  },
  separation: {
    required: status === 'conflict',
    reason_code: status === 'conflict' ? 'survey_jurisdiction_binding_conflict' : null,
  },
});

describe('resolveSurveyJurisdictionScope', () => {
  it('accepts an exact server-owned compatible contract', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      admin_scope: adminScope({
        status: 'compatible',
        compatible: true,
        tenantRef: 'ar:ba:junin',
        surveyRef: 'ar:ba:junin',
      }),
    }));

    expect(result).toMatchObject({
      classification: 'compatible',
      compatible: true,
      separationRequired: false,
      source: 'admin_scope',
    });
  });

  it('separates a confirmed conflict only when persisted refs disagree', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      admin_scope: adminScope({
        status: 'conflict',
        compatible: false,
        tenantRef: 'ar:ba:junin',
        surveyRef: 'ar:tf:ushuaia',
      }),
    }));

    expect(result).toMatchObject({
      classification: 'conflict',
      compatible: false,
      separationRequired: true,
      source: 'admin_scope',
    });
  });

  it('fails closed when a compatible declaration contradicts its refs', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      admin_scope: adminScope({
        status: 'compatible',
        compatible: true,
        tenantRef: 'ar:ba:junin',
        surveyRef: 'ar:tf:ushuaia',
      }),
    }));

    expect(result).toMatchObject({
      classification: 'unverified',
      compatible: false,
      reasonCode: 'survey_jurisdiction_contract_inconsistent',
    });
  });

  it('preserves opaque jurisdiction ref casing exactly like the backend contract', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      admin_scope: adminScope({
        status: 'compatible',
        compatible: true,
        tenantRef: 'AR:BA:JUNIN',
        surveyRef: 'ar:ba:junin',
      }),
    }));

    expect(result).toMatchObject({
      classification: 'unverified',
      compatible: false,
      reasonCode: 'survey_jurisdiction_contract_inconsistent',
    });
  });

  it('uses the duplicated jurisdiction summary when admin_scope is absent', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      jurisdiction: {
        contract_version: 'surveys.jurisdiction_guard.v1',
        readiness_included: false,
        jurisdiction_ref: 'ar:ba:junin',
        scope_status: 'compatible',
        scope_reason_code: 'survey_jurisdiction_compatible',
        tenant_verified_ref: 'ar:ba:junin',
        content_review_included: false,
      },
    }));

    expect(result).toMatchObject({
      classification: 'compatible',
      source: 'jurisdiction_summary',
    });
  });

  it('uses detailed authoritative refs without treating content review as geography', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      jurisdiction: {
        contract_version: 'surveys.jurisdiction_guard.v1',
        readiness_included: true,
        ready: false,
        reason_code: 'survey_content_review_required',
        tenant_jurisdiction_ref: 'ar:ba:junin',
        survey_jurisdiction_ref: 'ar:ba:junin',
      },
    }));

    expect(result).toMatchObject({
      classification: 'compatible',
      source: 'jurisdiction_detail',
    });
  });

  it('keeps the lifecycle conflict as a narrow legacy fallback', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      admin_lifecycle: {
        actions: {
          publish: { disabled_reason_code: 'survey_jurisdiction_binding_conflict' },
        },
      },
    }));

    expect(result).toMatchObject({
      classification: 'conflict',
      separationRequired: true,
      source: 'lifecycle_fallback',
    });
  });

  it('never infers compatibility from title or slug', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      slug: 'junin-prioridades',
      titulo: 'Municipalidad de Junín',
    }));

    expect(result).toEqual({
      classification: 'unverified',
      compatible: false,
      separationRequired: false,
      source: 'missing',
      reasonCode: 'survey_jurisdiction_scope_missing',
    });
  });

  it('fails closed when the authoritative compatible scope contradicts lifecycle', () => {
    const result = resolveSurveyJurisdictionScope(baseSurvey({
      admin_scope: adminScope({
        status: 'compatible',
        compatible: true,
        tenantRef: 'ar:ba:junin',
        surveyRef: 'ar:ba:junin',
      }),
      admin_lifecycle: {
        actions: {
          publish: { disabled_reason_code: 'survey_jurisdiction_binding_conflict' },
        },
      },
    }));

    expect(result).toMatchObject({
      classification: 'unverified',
      compatible: false,
      source: 'admin_scope',
      reasonCode: 'survey_jurisdiction_contract_contradiction',
    });
  });

  it('fails closed for unknown scope status values', () => {
    const malformed = adminScope({
      status: 'compatible',
      compatible: true,
      tenantRef: 'ar:ba:junin',
      surveyRef: 'ar:ba:junin',
    }) as Record<string, unknown>;
    (malformed.jurisdiction as Record<string, unknown>).status = 'assumed-compatible';

    const result = resolveSurveyJurisdictionScope(baseSurvey({ admin_scope: malformed }));

    expect(result).toMatchObject({
      classification: 'unverified',
      compatible: false,
      source: 'admin_scope',
    });
  });
});
