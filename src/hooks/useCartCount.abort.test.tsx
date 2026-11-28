import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const read = vi.hoisted(() => vi.fn());
vi.mock('@/api/market', async () => ({ ...(await vi.importActual<Record<string, unknown>>('@/api/market')), fetchMarketCart: read }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: 'tienda' }) }));

import useCartCount from './useCartCount';
import { notifyMarketCartChanged } from '@/utils/marketStorage';
import { captureChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

describe('cart count during a cut-short read', () => {
  it('keeps the last count and reads again instead of dropping to zero', async () => {
    read.mockResolvedValueOnce({ items: [{ id: '1', quantity: 2 }] })
      .mockRejectedValueOnce(new DOMException('Request context retired', 'AbortError'))
      .mockResolvedValue({ items: [{ id: '1', quantity: 2 }, { id: '2', quantity: 1 }] });
    const { result } = renderHook(() => useCartCount(true));
    await waitFor(() => expect(result.current).toBe(2));
    act(() => notifyMarketCartChanged('tienda', captureChatbocSessionRevision()));
    await new Promise((done) => setTimeout(done, 50));
    expect(result.current).toBe(2);
    await waitFor(() => expect(result.current).toBe(3), { timeout: 2000 });
  });
});
