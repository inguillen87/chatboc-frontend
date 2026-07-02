import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MarketProductPage from './MarketProductPage';

const apiClientGetMock = vi.fn();
const fetchMarketCartMock = vi.fn();
const addMarketItemMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ tenant: 'junin', slug: 'cat_10' }),
  };
});

vi.mock('@/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiClientGetMock(...args),
  },
}));

vi.mock('@/api/market', () => ({
  fetchMarketCart: (...args: unknown[]) => fetchMarketCartMock(...args),
  addMarketItem: (...args: unknown[]) => addMarketItemMock(...args),
}));

const renderProductPage = () =>
  render(
    <MemoryRouter initialEntries={['/t/junin/product/cat_10']}>
      <Routes>
        <Route path="/t/:tenant/product/:slug" element={<MarketProductPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('MarketProductPage conversational webview', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    fetchMarketCartMock.mockReset();
    addMarketItemMock.mockReset();
    fetchMarketCartMock.mockResolvedValue({ items: [], totalAmount: 0, totalPoints: 0 });
    addMarketItemMock.mockResolvedValue({
      items: [{ id: 'cat_10', name: 'Malbec Reserva', quantity: 2 }],
      totalAmount: 24000,
      totalPoints: 0,
    });
  });

  it('blocks cart confirmation for unsafe stock while keeping WhatsApp consultation available', async () => {
    apiClientGetMock.mockResolvedValueOnce({
      catalogo_item_id: 'cat_10',
      name: 'Malbec Reserva',
      description: 'Caja de degustacion premium.',
      price: 12000,
      currency: 'ARS',
      stock_status: 'out_of_stock',
      amount_validated: true,
      available_to_sell: true,
      whatsappShareUrl: 'https://wa.me/5492631000000?text=Malbec',
    });

    renderProductPage();

    expect(await screen.findByText('Malbec Reserva')).toBeInTheDocument();
    expect(apiClientGetMock).toHaveBeenCalledWith(
      '/api/public/market/junin/productos/cat_10',
      expect.objectContaining({
        tenantSlug: 'junin',
        skipAuth: true,
        omitCredentials: true,
        omitChatSessionId: true,
        suppressPanel401Redirect: true,
        sendAnonId: true,
      }),
    );
    expect(screen.getByTestId('market-product-commerce-panel')).toBeInTheDocument();
    expect(screen.getByTestId('market-product-validation-reason')).toHaveTextContent('Sin stock confirmado.');
    expect(screen.getByRole('button', { name: /Compra a validar/i })).toBeDisabled();
    expect(screen.getByTestId('market-product-whatsapp')).toHaveAttribute(
      'href',
      'https://wa.me/5492631000000?text=Malbec',
    );

    fireEvent.click(screen.getByRole('button', { name: /Compra a validar/i }));

    expect(addMarketItemMock).not.toHaveBeenCalled();
  });

  it('lets anonymous buyers choose quantity, add a validated product and continue to the cart', async () => {
    apiClientGetMock.mockResolvedValueOnce({
      catalogo_item_id: 'cat_10',
      name: 'Malbec Reserva',
      descriptionShort: 'Producto destacado.',
      price: 12000,
      currency: 'ARS',
      foto_url: 'https://cdn.example.com/malbec.jpg',
      category: 'Vinos',
      brand: 'Chatboc Bodega',
      promoInfo: '2 Malbec + degustacion',
      stock_status: 'validated',
      stock_quantity: 5,
      amount_validated: true,
      available_to_sell: true,
      publicUrl: 'https://chatboc.ar/t/junin/product/cat_10',
    });

    renderProductPage();

    expect(await screen.findByText('Malbec Reserva')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Malbec Reserva' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/malbec.jpg',
    );
    expect(screen.getByTestId('market-product-stock-signal')).toHaveTextContent('Stock validado');
    expect(screen.getByText('2 Malbec + degustacion')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sumar cantidad/i }));
    expect(screen.getByTestId('market-product-quantity')).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('button', { name: /Agregar al carrito/i }));

    await waitFor(() => {
      expect(addMarketItemMock).toHaveBeenCalledWith('junin', {
        productId: 'cat_10',
        quantity: 2,
      });
    });
    expect(await screen.findByText(/Agregado al carrito/i)).toBeInTheDocument();
    expect(screen.getByTestId('market-product-cart-link')).toHaveAttribute('href', '/t/junin/cart');
    expect(screen.getByTestId('market-product-whatsapp')).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/?text='),
    );
  });

  it('does not show a success message when the cart update fails', async () => {
    addMarketItemMock.mockRejectedValueOnce(new Error('El servidor no pudo responder correctamente.'));
    apiClientGetMock.mockResolvedValueOnce({
      catalogo_item_id: 'cat_10',
      name: 'Malbec Reserva',
      price: 12000,
      currency: 'ARS',
      stock_status: 'validated',
      stock_quantity: 5,
      amount_validated: true,
      available_to_sell: true,
    });

    renderProductPage();

    expect(await screen.findByText('Malbec Reserva')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Agregar al carrito/i }));

    expect(await screen.findByText('No se pudo actualizar el carrito')).toBeInTheDocument();
    expect(screen.getByText('El servidor no pudo responder correctamente.')).toBeInTheDocument();
    expect(screen.queryByText(/Agregado al carrito/i)).not.toBeInTheDocument();
  });
});
