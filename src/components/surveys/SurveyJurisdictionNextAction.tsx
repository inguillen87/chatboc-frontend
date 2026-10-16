import { useUser } from '@/hooks/useUser';
import { hasRequiredRole } from '@/utils/roles';
import { humanizeSurveyEvidenceNextAction } from '@/utils/surveyPublicationEvidenceGate';
import type { SurveyAdmin } from '@/types/encuestas';
export function SurveyJurisdictionNextAction({ survey, tenantSlug }: { survey: SurveyAdmin; tenantSlug?: string | null }) {
  const { user, hasVerifiedSession, organizationProfileVerified } = useUser();
  if (!hasVerifiedSession || !organizationProfileVerified || !hasRequiredRole(user?.rol, ['tenant_admin', 'superadmin']) ||
      !tenantSlug || !/^[a-z0-9][a-z0-9_-]{0,99}$/.test(tenantSlug) || survey.public_access?.allowed !== false ||
      survey.public_access.next_action !== 'configure_verified_tenant_jurisdiction') return null;
  return <a className="block text-sm underline" href={`/implementacion?tenant_slug=${encodeURIComponent(tenantSlug)}#configuracion-base`}>
    {humanizeSurveyEvidenceNextAction(survey.public_access.next_action, survey.public_access.reason_code || '')}
  </a>;
}
