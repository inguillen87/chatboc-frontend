import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TenantTicketFormPage, { createClaimIdempotencyKey } from './TenantTicketFormPage';
import type { TenantClaimIntakeReceipt } from '@/types/tenant';

const mocks = vi.hoisted(() => ({
  submitTenantTicket: vi.fn(),
  toast: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock('@/api/tenant', () => ({
  submitTenantTicket: (...args: unknown[]) => mocks.submitTenantTicket(...args),
}));

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    tenant: { slug: 'junin', nombre: 'Municipio de Junín' },
    currentSlug: 'junin',
  }),
}));

vi.mock('@/components/tenant/TenantShell', () => ({
  TenantShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: (...args: unknown[]) => mocks.toast(...args),
}));

const receipt: TenantClaimIntakeReceipt = {
  contract_version: 'claims.intake_receipt.v1',
  ok: true,
  persisted: true,
  deduplicated: false,
  request_id: 'req-claim-1',
  claim: {
    id: 123,
    code: 'T-123',
    status: 'nuevo',
    category: 'Alumbrado',
    created_at: '2026-07-28T15:30:00Z',
  },
  access: {
    mode: 'code_pin',
    pin: '804231',
  },
  tracking: {
    path: '/tracking/claim/T-123#pin=804231',
    experience_endpoint: '/api/public/tracking/experience?kind=claim&code=T-123',
    credential_transport: 'x-tracking-pin-header',
    requires_pin: true,
  },
  actions: [
    {
      id: 'track_claim',
      label: 'Ver seguimiento',
      href: '/tracking/claim/T-123#pin=804231',
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/t/junin/reclamos/nuevo']}>
      <Routes>
        <Route path="/t/:tenant/reclamos/nuevo" element={<TenantTicketFormPage />} />
      </Routes>
    </MemoryRouter>,
  );

const fillClaim = (description = 'Hay una luminaria apagada frente a la plaza') => {
  fireEvent.change(screen.getByLabelText('Tema o categoría (opcional)'), {
    target: { value: 'Alumbrado' },
  });
  fireEvent.change(screen.getByLabelText('Descripción'), {
    target: { value: description },
  });
};

describe('TenantTicketFormPage claim receipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  it('renders the confirmed receipt and keeps the PIN out of query strings', async () => {
    mocks.submitTenantTicket.mockResolvedValueOnce(receipt);
    renderPage();
    fillClaim();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));

    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();
    expect(screen.getByTestId('claim-code')).toHaveTextContent('T-123');
    expect(screen.getByTestId('claim-pin')).toHaveTextContent('••••••');
    expect(screen.queryByText('804231')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar PIN' }));
    expect(screen.getByTestId('claim-pin')).toHaveTextContent('804231');

    const trackingLink = screen.getByRole('link', { name: /ver seguimiento/i });
    expect(trackingLink).toHaveAttribute('href', '/tracking/claim/T-123#pin=804231');
    expect(trackingLink.getAttribute('href')).not.toContain('?pin=');
    expect(trackingLink).toHaveAttribute('referrerpolicy', 'no-referrer');

    fireEvent.click(screen.getByRole('button', { name: 'Copiar código y PIN' }));
    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith('Código: T-123\nPIN: 804231');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Crear otro reclamo' }));
    expect(screen.queryByTestId('claim-intake-receipt')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Descripción')).toHaveValue('');
  });

  it('reuses the idempotency key when the same payload is retried after an invalid ack', async () => {
    mocks.submitTenantTicket
      .mockRejectedValueOnce(new Error('El servidor no confirmó un comprobante válido.'))
      .mockResolvedValueOnce(receipt);
    renderPage();
    fillClaim();

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    await waitFor(() => expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Descripción')).toHaveValue(
      'Hay una luminaria apagada frente a la plaza',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();

    const firstKey = mocks.submitTenantTicket.mock.calls[0][2];
    const retryKey = mocks.submitTenantTicket.mock.calls[1][2];
    expect(firstKey).toMatch(/^claim-intake-/);
    expect(retryKey).toBe(firstKey);
  });

  it('rotates the idempotency key when the payload changes after a failed attempt', async () => {
    mocks.submitTenantTicket
      .mockRejectedValueOnce(new Error('network_error'))
      .mockResolvedValueOnce(receipt);
    renderPage();
    fillClaim('Primer detalle del reclamo');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    await waitFor(() => expect(mocks.submitTenantTicket).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Descripción'), {
      target: { value: 'Detalle corregido del reclamo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar reclamo' }));
    expect(await screen.findByTestId('claim-intake-receipt')).toBeInTheDocument();

    expect(mocks.submitTenantTicket.mock.calls[1][2]).not.toBe(
      mocks.submitTenantTicket.mock.calls[0][2],
    );
  });

  it('fails closed when the browser has no cryptographically secure random source', () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    try {
      expect(() => createClaimIdempotencyKey()).toThrow('criptografía segura');
    } finally {
      if (cryptoDescriptor) {
        Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
      }
    }
  });
});
