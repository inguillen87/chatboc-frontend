import { describe, it, expect, vi } from 'vitest';
import { searchCatalog } from './market';
import * as apiUtils from '@/utils/api';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class {},
  NetworkError: class {},
}));

describe('searchCatalog', () => {
  it('should construct the correct URL with query and filters', async () => {
    const tenantSlug = 'demo-slug';
    const query = 'vino';
    const filters = { en_promocion: true, con_stock: true, precio_max: 1000 };

    await searchCatalog(tenantSlug, query, filters);

    expect(apiUtils.apiFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/${tenantSlug}/catalogo/buscar`),
      expect.objectContaining({
        tenantSlug,
        suppressPanel401Redirect: true,
        omitChatSessionId: true,
      })
    );

    const callArgs = (apiUtils.apiFetch as any).mock.calls[0];
    const url = callArgs[0];
    expect(url).toContain('q=vino');
    expect(url).toContain('en_promocion=true');
    expect(url).toContain('con_stock=true');
    expect(url).toContain('precio_max=1000');
  });
});
