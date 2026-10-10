import type { PublishedTenantIdentity } from '@/utils/publishedTenantIdentity';

/** This public contract describes presentation, never private permissions. */
export interface TenantHostBinding {
  contract_version: 'public.tenant_host.v1';
  host: string;
  origin: string;
  tenant: { id: number; slug: string; nombre: string; tipo: string | null; logo_url: string | null };
  identity: PublishedTenantIdentity;
  brand: { primary_color: string | null; accent_color: string | null };
  paths: { home: '/'; login: '/login'; workspace: '/perfil' };
  binding: { status: 'active'; verified: true; valid_until: number };
}
