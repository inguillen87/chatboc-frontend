import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MemoryRouter } from 'react-router-dom';
import ProductCard from './ProductCard';
import type { MarketProduct } from '@/types/market';

const baseProduct: MarketProduct = {
  id: 'prod-1',
  name: 'Caja de herramientas',
  description: null,
  descriptionShort: null,
  price: 1000,
  priceText: '$ 1.000',
  currency: 'ARS',
  modality: 'venta',
  points: null,
  imageUrl: null,
  category: 'Ferreteria',
  unit: 'u',
  quantity: 10,
  stock_quantity: 10,
  stock_status: 'in_stock',
  available_to_sell: true,
  amount_validated: true,
  inventory: {
    stock_status: 'in_stock',
    available_to_sell: true,
    amount_validated: true,
  },
  sku: null,
  brand: null,
  promoInfo: null,
  publicUrl: null,
  whatsappShareUrl: null,
  disponible: true,
};

describe('ProductCard', () => {
  it('adds directly when the product can start checkout', () => {
    const onAdd = vi.fn();
    const onConsult = vi.fn();

    render(<ProductCard product={baseProduct} onAdd={onAdd} onConsult={onConsult} />);

    fireEvent.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onAdd).toHaveBeenCalledWith('prod-1');
    expect(onConsult).not.toHaveBeenCalled();
  });

  it('keeps Consultar enabled and calls assisted consult when checkout is blocked', () => {
    const onAdd = vi.fn();
    const onConsult = vi.fn();
    const blockedProduct: MarketProduct = {
      ...baseProduct,
      stock_quantity: 0,
      stock_status: 'out_of_stock',
      available_to_sell: false,
      amount_validated: false,
      inventory: {
        stock_status: 'out_of_stock',
        available_to_sell: false,
        amount_validated: false,
      },
    };

    render(<ProductCard product={blockedProduct} onAdd={onAdd} onConsult={onConsult} />);

    const consultButton = screen.getByRole('button', { name: /consultar/i });
    expect(consultButton).toBeEnabled();

    fireEvent.click(consultButton);

    expect(onAdd).not.toHaveBeenCalled();
    expect(onConsult).toHaveBeenCalledWith(blockedProduct, expect.any(String));
  });

  it('shows an imported bare number as a price with currency, and keeps written prices as they are', () => {
    const { rerender } = render(<ProductCard product={{ ...baseProduct, price: 2900, priceText: '2900' }} onAdd={vi.fn()} />);
    expect(screen.getByText(/\$\s?2\.900/)).toBeInTheDocument();
    expect(screen.queryByText('2900')).not.toBeInTheDocument();
    rerender(<ProductCard product={{ ...baseProduct, price: null, priceText: '1100' }} onAdd={vi.fn()} />);
    expect(screen.getByText(/\$\s?1\.100/)).toBeInTheDocument();
    rerender(<ProductCard product={{ ...baseProduct, priceText: 'Desde $ 900 por kilo' }} onAdd={vi.fn()} />);
    expect(screen.getByText('Desde $ 900 por kilo')).toBeInTheDocument();
  });

  it('opens the product page from its name and photo', () => {
    render(<MemoryRouter><ProductCard product={{ ...baseProduct, imageUrl: 'https://img.test/a.jpg' }} onAdd={vi.fn()} detailHref="/t/demo/product/prod-1" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Caja de herramientas' })).toHaveAttribute('href', '/t/demo/product/prod-1');
  });

  it('shows a redemption once in points, with a readable badge', () => {
    render(
      <MemoryRouter>
        <ProductCard product={{ ...baseProduct, name: 'Beca', modality: 'canje', points: 6000, price: 6000, priceText: '6000', currency: 'PTS' }} onAdd={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('6.000 pts')).toBeTruthy();
    expect(screen.queryByText(/PTS/)).toBeNull();
    expect(screen.getByText('Canje')).toBeTruthy();
  });

  it('falls back to the placeholder when the photo does not load', () => {
    const { container } = render(
      <MemoryRouter>
        <ProductCard product={{ ...baseProduct, imageUrl: 'https://example.test/rota.jpg' }} onAdd={vi.fn()} />
      </MemoryRouter>,
    );
    const image = container.querySelector('img');
    expect(image).toBeTruthy();
    fireEvent.error(image as HTMLImageElement);
    expect(container.querySelector('img[src="https://example.test/rota.jpg"]')).toBeNull();
  });
});
