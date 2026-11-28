import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
import ProductCard from './ProductCard';

const product = { id: '168', name: 'Aceite de girasol 900 ml', price: 2900, priceText: '2900', currency: 'ARS' } as never;

describe('ProductCard share', () => {
  it('copies the store product page when the catalog has no share link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    render(<MemoryRouter><ProductCard product={product} onAdd={vi.fn()} detailHref="/t/tienda/product/168" /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /Compartir/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/t/tienda/product/168`));
    expect(await screen.findByRole('button', { name: /Link copiado/ })).toBeTruthy();
  });

  it('stays disabled with nothing to share', () => {
    render(<MemoryRouter><ProductCard product={product} onAdd={vi.fn()} /></MemoryRouter>);
    expect((screen.getByRole('button', { name: /Compartir/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
