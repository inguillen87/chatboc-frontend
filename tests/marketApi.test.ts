import { describe, it, expect, vi } from 'vitest';
import { searchCatalog } from '../src/api/market';
import { apiFetch } from '../src/utils/api';

// Mock apiFetch
vi.mock('../src/utils/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
  NetworkError: class NetworkError extends Error {},
}));

describe('searchCatalog', () => {
  it('calls correct endpoint with query parameters', async () => {
    const tenantSlug = 'demo-tenant';
    const query = 'vino';
    const filters = { en_promocion: true, precio_max: 1000 };

    await searchCatalog(tenantSlug, query, filters);

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/demo-tenant/catalogo/buscar'),
      expect.objectContaining({
        tenantSlug: 'demo-tenant',
      })
    );

    // Check query params
    const callArgs = (apiFetch as any).mock.calls[0];
    const url = callArgs[0];
    expect(url).toContain('q=vino');
    expect(url).toContain('en_promocion=true');
    expect(url).toContain('precio_max=1000');
  });
});
