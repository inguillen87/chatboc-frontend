export const addressesScope = { id: 17, slug: 'institution-alpha' };

const slot = (kind: 'platform' | 'custom', scope_note: string) => ({
  kind, source: null, host: null, status: 'unconfigured', active: false,
  valid_until: null, dns_proof: null, allowed_aliases: [], scope_note,
});

const ready = { eligible: true, can_request: true, can_verify_dns: false, can_revoke: false, reason_code: 'ready' };

/** Ejemplo sintético del contrato `organization.addresses.v2` (organización Full sin direcciones). */
export const addressesPayload = (patch: Record<string, unknown> = {}) => ({
  contract_version: 'organization.addresses.v2',
  tenant: { ...addressesScope },
  revision: 'a'.repeat(64),
  version: 0,
  base: { url: 'https://chatboc.ar/t/institution-alpha', available: true },
  canonical_url: 'https://chatboc.ar/t/institution-alpha',
  platform: slot('platform', 'Subdominio de la plataforma. No requiere un TXT del cliente; la publicación y HTTPS deben verificarse antes de activarlo.'),
  custom: slot('custom', 'Dominio del cliente. Requiere un plan Full, prueba TXT y verificación de publicación y HTTPS.'),
  capabilities: {
    can_manage: true,
    writes_blocked: false,
    platform: { ...ready },
    custom: { ...ready },
    activation: { mode: 'platform_operator', available: false, can_plan: false, can_activate: false,
      reason_code: 'operator_runtime_unavailable', provider_changes_supported: false },
  },
  save_endpoint: '/api/admin/tenants/institution-alpha/addresses',
  activation_plan_endpoint: '/api/admin/tenants/institution-alpha/addresses/activation-plan',
  activation_endpoint: '/api/admin/tenants/institution-alpha/addresses/activate',
  provider_changes_performed: false,
  auth_e2e_verified: false,
  ...patch,
});
