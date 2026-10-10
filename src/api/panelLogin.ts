import {validatePanelLoginResponse,PanelLoginBoundaryError} from '@/utils/panelLoginResponse';
import { apiFetch } from '@/utils/api';
import { readPanelLoginScope } from '@/utils/panelLoginScope';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import type {SessionRetirementProof} from '@/utils/sessionRetirement';

export interface PanelLoginResponse {
  token: string;
  session_retirement?:SessionRetirementProof;
  user: { id: number; email: string; name: string; rol: string; role?: string; tenant_slug: string };
  entityToken?: string;
  tipo_chat?: 'pyme' | 'municipio';
}

export async function loginPanelWithCredentials(email: string, password: string, pathname: string, isCurrent: () => boolean = () => true) {
  const revision = captureChatbocSessionRevision();
  const isCurrentAttempt = () => isCurrent() && isChatbocSessionRevisionCurrent(revision);
  const scope = readPanelLoginScope(pathname);
  if (!scope.valid) throw new PanelLoginBoundaryError('invalid_route');
  const data = await apiFetch<unknown>('/auth/admin/login', {
    method: 'POST',
    singleAttempt: true,
    allowStartupRecovery: true,
    isCurrent: isCurrentAttempt,
    isWidgetRequest: false,
    body: { email, password, ...(scope.tenantSlug ? { tenant_slug: scope.tenantSlug } : {}) },
    tenantSlug: scope.tenantSlug,
    omitTenant: !scope.tenantSlug,
    persistTenantSlug: false,
    skipAuth: true,
    omitCredentials: true,
    preserveAuthOn401: true,
    suppressPanel401Redirect: true,
    omitEntityToken: true,
    omitChatSessionId: true,
  });
  if (!isCurrentAttempt()) throw new DOMException('Credential attempt retired', 'AbortError');
  return validatePanelLoginResponse(data,email,scope.tenantSlug);
}
