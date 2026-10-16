import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SurveyAdmin } from '@/types/encuestas';
const mocks = vi.hoisted(() => ({ user: { rol: 'admin_municipio' }, hasVerifiedSession: true, organizationProfileVerified: true }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => mocks }));
import { SurveyJurisdictionNextAction } from './SurveyJurisdictionNextAction';
const survey = () => ({ id: 701, public_access: { allowed: false, next_action: 'configure_verified_tenant_jurisdiction', reason_code: 'survey_tenant_jurisdiction_unverified' } }) as SurveyAdmin;
beforeEach(() => { mocks.user.rol = 'admin_municipio'; mocks.hasVerifiedSession = true; mocks.organizationProfileVerified = true; }); afterEach(cleanup);
describe('backend-controlled jurisdiction next step', () => {
  it('links the scoped existing center without verifying or publishing', () => {
    render(<SurveyJurisdictionNextAction survey={survey()} tenantSlug="organization-a" />); expect(screen.getByRole('link')).toHaveAttribute('href', '/implementacion?tenant_slug=organization-a#configuracion-base');
  });
  it.each(['role', 'session', 'profile', 'allowed', 'different action', 'invalid tenant'])('offers no link for %s', reason => {
    const row = survey(); if (reason === 'role') mocks.user.rol = 'employee'; if (reason === 'session') mocks.hasVerifiedSession = false; if (reason === 'profile') mocks.organizationProfileVerified = false;
    if (reason === 'allowed') row.public_access!.allowed = true; if (reason === 'different action') row.public_access!.next_action = 'unknown';
    const view = render(<SurveyJurisdictionNextAction survey={row} tenantSlug={reason === 'invalid tenant' ? '../foreign' : 'organization-a'} />); expect(view.container).toBeEmptyDOMElement();
  });
});
