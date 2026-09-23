import { apiFetch } from '@/utils/api';
import { readPanelLoginScope } from '@/utils/panelLoginScope';

export interface PanelLoginResponse {
  token: string;
  user: { id: number; email: string; name: string; rol: string; role?: string; tenant_slug: string };
  entityToken?: string;
  tipo_chat?: 'pyme' | 'municipio';
}

export function loginPanelWithCredentials(email: string, password: string, pathname: string) {
  const scope = readPanelLoginScope(pathname);
  if (!scope.valid) return Promise.reject(new Error('La dirección de acceso no es válida.'));
  return apiFetch<PanelLoginResponse>('/auth/admin/login', {
    method: 'POST',
    body: { email, password, ...(scope.tenantSlug ? { tenant_slug: scope.tenantSlug } : {}) },
    tenantSlug: scope.tenantSlug,
    omitTenant: !scope.tenantSlug,
    persistTenantSlug: false,
    skipAuth: true,
    omitEntityToken: true,
    omitChatSessionId: true,
  });
}
