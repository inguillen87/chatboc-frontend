import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderVerificationPanel } from './OrderVerificationPanel';
import { getVerifiedPaymentStatus } from '@/utils/verifiedPaymentStatus';
vi.unmock('lucide-react');
const props = { status: null, isLoading: false, error: null, lastCheckedAt: null,
  autoRefreshStopped: false, pauseReason: null, onRefresh: vi.fn() } as const;
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('verified payment presentation', () => {
  it('shows no success or invented milestones while initially loading', () => {
    render(<OrderVerificationPanel {...props} isLoading />);
    expect(screen.getByRole('heading')).toHaveTextContent('Consultando el estado');
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.queryByText('Pago acreditado', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).not.toHaveTextContent('Entregado');
  });
  it('offers a real manual refresh without treating authorization as payment', () => {
    render(<OrderVerificationPanel {...props} status={getVerifiedPaymentStatus('authorized')} />);
    expect(screen.getByRole('heading')).toHaveTextContent('aún no acreditado');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar' }));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });
  it('distinguishes a retained state from a failed verification', () => {
    render(<OrderVerificationPanel {...props} status={getVerifiedPaymentStatus('paid')}
      error="No pudimos verificar el pedido." lastCheckedAt={1789770000000} />);
    expect(screen.getByRole('heading')).toHaveTextContent('La verificación no se completó');
    expect(screen.getByText('Último estado confirmado: Pago acreditado')).toBeVisible();
    expect(screen.getByRole('status')).not.toHaveTextContent('22:20');
  });
  it('preserves the financial status during a background read', () => {
    render(<OrderVerificationPanel {...props} status={getVerifiedPaymentStatus('paid')} isLoading />);
    expect(screen.getByRole('heading')).toHaveTextContent('Pago acreditado');
    expect(screen.getByRole('button')).toHaveTextContent('Verificando');
  });
  it('pauses the action and explains reconnection', () => {
    render(<OrderVerificationPanel {...props} pauseReason="offline" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Sin conexión');
    expect(screen.getByRole('button')).toBeDisabled();
  });
  it('never confuses the polling limit with a confirmed payment', () => {
    render(<OrderVerificationPanel {...props} status={getVerifiedPaymentStatus('pending')} autoRefreshStopped />);
    expect(screen.getByRole('heading')).toHaveTextContent('Pago pendiente');
    expect(screen.getByText(/La consulta automática finalizó/, { selector: 'p:not(.sr-only)' })).toBeVisible();
  });
  it('uses one live status region and a machine-readable timestamp', () => {
    const { container } = render(<OrderVerificationPanel {...props} status={getVerifiedPaymentStatus('paid')} lastCheckedAt={1789770000000} />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(container.querySelector('time')).toHaveAttribute('datetime', new Date(1789770000000).toISOString());
  });
});
