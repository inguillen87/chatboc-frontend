import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartCount } from './useCartCount';

const cart = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: 'junin' }) }));
vi.mock('@/api/market', () => ({ fetchMarketCart: cart.read }));
const Probe = ({ enabled }: { enabled: boolean }) => <output>{useCartCount(enabled)}</output>;

beforeEach(() => cart.read.mockReset());
describe('public cart reads while entering a private workspace', () => {
  it('does not initialize the public cart for a private header', () => {
    render(<Probe enabled={false} />);
    expect(cart.read).not.toHaveBeenCalled();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('preserves the public count and withdraws an in-flight response on private navigation', async () => {
    let resolveCart!: (value: { items: Array<{ quantity: number }> }) => void;
    cart.read.mockReturnValue(new Promise(resolve => { resolveCart = resolve; }));
    const view = render(<Probe enabled />);
    await waitFor(() => expect(cart.read).toHaveBeenCalledWith('junin'));
    view.rerender(<Probe enabled={false} />);
    await act(async () => resolveCart({ items: [{ quantity: 7 }] }));
    expect(screen.getByText('0')).toBeInTheDocument();
    cart.read.mockResolvedValue({ items: [{ quantity: 3 }] });
    view.rerender(<Probe enabled />);
    expect(await screen.findByText('3')).toBeInTheDocument();
  });
});
