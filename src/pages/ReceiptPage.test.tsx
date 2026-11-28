import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const apiFetch = vi.fn();
let search = '';
vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ code: 'K7MQ4XPZ2R' }),
    useSearchParams: () => [new URLSearchParams(search)],
  };
});

import { ApiError } from '@/utils/api';
import ReceiptPage from './ReceiptPage';

const base = {
  code: 'K7MQ-4XPZ-2R', order_number: 12, total: '$ 7.000', paid_reference: null,
  lines: [{ name: 'Bolsón saludable', quantity: 2, amount: '$ 7.000' }],
  pay_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1',
  return_to_chat_url: 'https://wa.me/5492901555000?text=PEDIDO',
  store: { name: 'Ciudad Demo', slug: 'ciudad-demo' },
};

beforeEach(() => {
  apiFetch.mockReset();
  search = '';
});

describe('ReceiptPage', () => {
  it('shows a paid order with its reference, a way back to the chat and to save it', async () => {
    apiFetch.mockResolvedValueOnce({ ...base, status: 'paid', paid_reference: '456789', pay_url: null });
    render(<ReceiptPage />);
    expect(await screen.findByText('Pagado')).toBeTruthy();
    expect(screen.getByText('2 x Bolsón saludable')).toBeTruthy();
    expect(screen.getByText(/terminada en 456789/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Volver al chat/ }).getAttribute('href')).toBe(base.return_to_chat_url);
    expect(screen.getByRole('button', { name: /Guardar comprobante/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Pagar con Mercado Pago/ })).toBeNull();
  });

  it('offers to pay while pending, and says it is confirming when coming back approved', async () => {
    apiFetch.mockResolvedValueOnce({ ...base, status: 'pending' });
    const { unmount } = render(<ReceiptPage />);
    expect(await screen.findByRole('link', { name: 'Pagar con Mercado Pago' })).toBeTruthy();
    unmount();
    search = 'collection_status=approved';
    apiFetch.mockResolvedValue({ ...base, status: 'pending' });
    render(<ReceiptPage />);
    expect(await screen.findByText('Confirmando tu pago…')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Pagar con Mercado Pago/ })).toBeNull();
  });

  it('says when the receipt does not exist', async () => {
    apiFetch.mockRejectedValueOnce(new ApiError('unprocessable', 422));
    render(<ReceiptPage />);
    expect(await screen.findByText('No encontramos este comprobante')).toBeTruthy();
  });
});
