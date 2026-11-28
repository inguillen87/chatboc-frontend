import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ code: 'k7mq4xpz' }) };
});

import { ApiError } from '@/utils/api';
import PayLinkPage from './PayLinkPage';

const store = { name: 'Comedor del barrio', slug: 'comedor' };

beforeEach(() => apiFetch.mockReset());

describe('PayLinkPage', () => {
  it('shows a fixed charge with its amount', async () => {
    apiFetch.mockResolvedValueOnce({ code: 'k7mq4xpz', concept: 'Seña turno', description: null, amount: '$ 5.000',
      free_amount: false, min_amount: null, suggested: [], available: true, store });
    render(<PayLinkPage />);
    expect(await screen.findByText('$ 5.000')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeTruthy();
  });

  it('lets the person pick a donation amount and explains a refusal', async () => {
    apiFetch.mockResolvedValueOnce({ code: 'k7mq4xpz', concept: 'Colecta', description: null, amount: null,
      free_amount: true, min_amount: '$ 500', suggested: [{ value: 2000, label: '$ 2.000' }], available: true, store });
    render(<PayLinkPage />);
    fireEvent.click(await screen.findByRole('button', { name: '$ 2.000' }));
    apiFetch.mockRejectedValueOnce(new ApiError('x', 422, { error: 'payment_link_amount_invalid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pagar con Mercado Pago' }));
    await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith('/api/public/pay/k7mq4xpz',
      expect.objectContaining({ method: 'POST', body: { amount: '2000' } })));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('says when the charge is not available', async () => {
    apiFetch.mockResolvedValueOnce({ code: 'k7mq4xpz', concept: 'Cuota', description: null, amount: '$ 1.000',
      free_amount: false, min_amount: null, suggested: [], available: false, store });
    render(<PayLinkPage />);
    expect(await screen.findByText('Este cobro no está disponible para pagar ahora.')).toBeTruthy();
  });
});
