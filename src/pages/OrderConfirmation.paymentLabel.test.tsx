import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => {
  class ApiError extends Error {}
  class NetworkError extends Error {}
  return {
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
    ApiError,
    NetworkError,
    getErrorMessage: (_error: unknown, fallback: string) => fallback,
  };
});

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'demo', tenant: null }),
}));

import OrderConfirmationPage from './OrderConfirmation';

const renderAt = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/pedido/confirmado?${query}`]}>
      <OrderConfirmationPage />
    </MemoryRouter>,
  );

describe('OrderConfirmation payment label', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('does not show an approved payment from the return URL when the order cannot be read', async () => {
    apiFetchMock.mockRejectedValue(new Error('unavailable'));
    renderAt('pedido_id=123&status=approved');

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    await screen.findByText('No pudimos recuperar el estado del pedido.');

    expect(screen.queryByText('Pago aprobado')).not.toBeInTheDocument();
    expect(screen.getByText(/Dato del enlace de retorno, sin confirmar: approved/)).toBeInTheDocument();
  });

  it('does not show an approved payment from the return URL when the order has no status', async () => {
    apiFetchMock.mockResolvedValue({ id: 123 });
    renderAt('pedido_id=123&status=approved');

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Pago aprobado')).not.toBeInTheDocument());
  });

  it('shows an approved payment when the backend order says so', async () => {
    apiFetchMock.mockResolvedValue({ id: 123, estado: 'approved' });
    renderAt('pedido_id=123&status=pending');

    expect(await screen.findAllByText('Pago aprobado')).not.toHaveLength(0);
  });
});
