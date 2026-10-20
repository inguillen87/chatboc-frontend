import { readTenantHostBinding } from '@/utils/tenantHostBinding';

export const tenantHostPayload = (host = 'atencion.example.test', slug = 'government-east') => ({
  contract_version: 'public.tenant_host.v1', host, origin: `https://${host}`,
  tenant: { id: 17, slug, nombre: 'Organización de prueba', tipo: 'municipio', logo_url: '/published-logo.svg' },
  brand: { primary_color: '#112233', accent_color: '#223344' },
  paths: { home: '/', login: '/login', workspace: '/perfil' },
  binding: { status: 'active', verified: true, valid_until: Math.floor(Date.now() / 1000) + 3600 },
});
export const tenantHostFixture = (host = 'atencion.example.test', slug = 'government-east') => readTenantHostBinding(tenantHostPayload(host, slug), host);
