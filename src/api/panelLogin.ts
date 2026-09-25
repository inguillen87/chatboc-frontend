import {validatePanelLoginResponse,PanelLoginBoundaryError} from '@/utils/panelLoginResponse';
import { apiFetch } from '@/utils/api';
import { readPanelLoginScope } from '@/utils/panelLoginScope';

export interface PanelLoginResponse {
  token: string;
  user: { id: number; email: string; name: string; rol: string; role?: string; tenant_slug: string };
  entityToken?: string;
  tipo_chat?: 'pyme' | 'municipio';
}

export async function loginPanelWithCredentials(email: string, password: string, pathname: string) {
  const scope = readPanelLoginScope(pathname);
  if (!scope.valid) throw new PanelLoginBoundaryError('invalid_route');
  const data = await apiFetch<unknown>('/auth/admin/login', {
    method: 'POST',
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
  return validatePanelLoginResponse(data,email,scope.tenantSlug);
}
