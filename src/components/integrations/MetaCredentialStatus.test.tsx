import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MetaCredentialStatus from './MetaCredentialStatus';

const expiry = Date.parse('2031-03-04T00:08:50Z') / 1000;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime((expiry - 1) * 1000); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('shows the recorded deadline in 24-hour Argentina time with an ISO datetime, without asserting provider availability', () => {
  const view = render(<MetaCredentialStatus configuration_status="configured" expires_at={expiry} />);
  expect(screen.getByText(/Vigencia temporal registrada hasta/)).toHaveTextContent('3/3/2031, 21:08:50 (Argentina, UTC−3).');
  expect(view.container.querySelector('time')).toHaveAttribute('datetime', '2031-03-04T00:08:50.000Z');
  expect(screen.getByRole('status')).toHaveTextContent('Disponibilidad y entrega actuales pendientes de verificar.');
  expect(screen.getByText(/La vigencia registrada no confirma/)).toBeInTheDocument();
});

it('ages a configured snapshot exactly at the deadline without a refresh or provider request', () => {
  render(<MetaCredentialStatus configuration_status="configured" expires_at={expiry} />);
  act(() => vi.advanceTimersByTime(999));
  expect(screen.getByRole('status')).not.toHaveTextContent('venció');
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('status')).toHaveTextContent('venció');
  expect(screen.getByText(/Vencimiento temporal registrado/)).toBeInTheDocument();
  expect(screen.queryByText(/Vigencia temporal registrada hasta/)).not.toBeInTheDocument();
});

it('keeps the backend expired decision even when a recorded deadline is in the future', () => {
  render(<MetaCredentialStatus configuration_status="expired" expires_at={expiry + 3600} />);
  expect(screen.getByRole('status')).toHaveTextContent('venció');
  expect(screen.queryByText(/Vigencia temporal registrada hasta/)).not.toBeInTheDocument();
});

it.each([null, undefined, 0, -1, NaN, Infinity, 253_402_300_800, expiry + 0.1, String(expiry)])(
  'reports an unknown date for invalid or missing epoch %s', invalid => {
    const view = render(<MetaCredentialStatus configuration_status="pending" expires_at={invalid as number | null} />);
    expect(screen.getByText('Vencimiento temporal sin confirmar.')).toBeInTheDocument();
    expect(view.container.querySelector('time')).toBeNull();
    expect(screen.queryByText(/Vigencia temporal registrada hasta/)).not.toBeInTheDocument();
  },
);

it('retires the old deadline when a renewed contract replaces it and clears timers on unmount', () => {
  const view = render(<MetaCredentialStatus configuration_status="configured" expires_at={expiry} />);
  view.rerender(<MetaCredentialStatus configuration_status="configured" expires_at={expiry + 10} />);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole('status')).not.toHaveTextContent('venció');
  expect(vi.getTimerCount()).toBe(1);
  act(() => vi.advanceTimersByTime(10_000));
  expect(screen.getByRole('status')).toHaveTextContent('venció');
  view.rerender(<MetaCredentialStatus configuration_status="configured" expires_at={expiry + 3600} />);
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('recomputes after a suspended tab resumes and respects an already-past replacement contract', () => {
  const view = render(<MetaCredentialStatus configuration_status="configured" expires_at={expiry} />);
  act(() => { vi.setSystemTime((expiry + 1) * 1000); document.dispatchEvent(new Event('visibilitychange')); });
  expect(screen.getByRole('status')).toHaveTextContent('venció');
  view.rerender(<MetaCredentialStatus configuration_status="configured" expires_at={expiry - 1} />);
  expect(screen.getByRole('status')).toHaveTextContent('venció');
  expect(vi.getTimerCount()).toBe(0);
});
