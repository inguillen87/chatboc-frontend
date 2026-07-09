import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
});
