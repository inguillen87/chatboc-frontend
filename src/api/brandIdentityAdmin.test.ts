import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch as apiFetchImport, ApiError } from '@/utils/api';

vi.mock('@/utils/api', async original => ({ ...await original<typeof import('@/utils/api')>(), apiFetch: vi.fn() }));
const apiFetch = vi.mocked(apiFetchImport);

import { BrandIdentityAdminError, brandIdentityReasonMessage, getBrandIdentityAdmin, putBrandIdentityAdmin } from './brandIdentityAdmin';

const envelope = (slug: string, identity: unknown, published = true) => ({
  contract_version: 'organization.brand_identity_admin.v1', tenant: { id: 7, slug }, brand_identity: identity, published,
});

describe('brand identity admin transport', () => {
  beforeEach(() => { apiFetch.mockReset(); });

  it('reads the stored identity for the exact organization, without tenant headers', async () => {
    apiFetch.mockResolvedValue(envelope('org-sintetica', { palette: ['#112233', '#445566'] }, false));
    await expect(getBrandIdentityAdmin('org-sintetica')).resolves.toEqual({
      tenant: { id: 7, slug: 'org-sintetica' }, brandIdentity: { palette: ['#112233', '#445566'] }, published: false,
    });
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/org-sintetica/brand-identity',
      expect.objectContaining({ omitTenant: true, omitEntityToken: true, singleAttempt: true }));
  });

  it('publishes and removes with the whole record', async () => {
    apiFetch.mockResolvedValue(envelope('org-sintetica', null, false));
    await putBrandIdentityAdmin('org-sintetica', null);
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/org-sintetica/brand-identity',
      expect.objectContaining({ method: 'PUT', body: { brand_identity: null } }));
  });

  it('rejects a response for another organization or contract', async () => {
    apiFetch.mockResolvedValue(envelope('otra-org', null));
    await expect(getBrandIdentityAdmin('org-sintetica')).rejects.toMatchObject({ reason: 'brand_identity_response_invalid' });
    apiFetch.mockResolvedValue({ ...envelope('org-sintetica', null), contract_version: 'other' });
    await expect(getBrandIdentityAdmin('org-sintetica')).rejects.toBeInstanceOf(BrandIdentityAdminError);
  });

  it('keeps the backend reason code and explains it in Spanish', async () => {
    apiFetch.mockRejectedValue(new ApiError('Bad request', 400, { reason_code: 'brand_identity_palette_invalid' }));
    const failure = await putBrandIdentityAdmin('org-sintetica', { palette: ['#112233', '#445566'] }).catch((error) => error);
    expect(failure).toMatchObject({ reason: 'brand_identity_palette_invalid', status: 400 });
    expect(brandIdentityReasonMessage('brand_identity_palette_invalid')).toMatch(/2 a 6 colores/);
    expect(brandIdentityReasonMessage('desconocido')).toBe('No se pudo completar la operación.');
  });
});
