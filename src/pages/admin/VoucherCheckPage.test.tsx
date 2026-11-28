import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const apiFetch = vi.fn();
vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: null }) }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ tenant: 'ciudad-demo' }) };
});

import { ApiError } from '@/utils/api';
import VoucherCheckPage from './VoucherCheckPage';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/t/ciudad-demo/admin/vouchers']}>
      <Routes><Route path="/t/:tenant/admin/vouchers" element={<VoucherCheckPage />} /></Routes>
    </MemoryRouter>,
  );

const voucher = { code: 'K7MQ-4XPZ-2R', name: 'Kit escolar completo', quantity: 1, points: 1500, used_at: '2026-11-28T12:00:00Z' };

beforeEach(() => apiFetch.mockReset());

describe('VoucherCheckPage', () => {
  it('accepts a valid code once and says what to hand over', async () => {
    apiFetch.mockResolvedValueOnce({ result: 'redeemed', voucher: { ...voucher, used_at: null } });
    renderPage();
    fireEvent.change(screen.getByLabelText('Código del voucher'), { target: { value: 'k7mq-4xpz-2r' } });
    fireEvent.submit(screen.getByLabelText('Código del voucher').closest('form') as HTMLFormElement);
    expect(await screen.findByText(/Válido. Entregá/)).toBeTruthy();
    expect(screen.getByText('Kit escolar completo')).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/ciudad-demo/vouchers/redeem',
      { method: 'POST', body: { code: 'K7MQ-4XPZ-2R' }, tenantSlug: 'ciudad-demo', suppressPanel401Redirect: true });
  });

  it('warns when the code was already used, and when it is not valid', async () => {
    const used = new ApiError('conflict', 409, { result: 'used', voucher });
    apiFetch.mockRejectedValueOnce(used).mockRejectedValueOnce(new ApiError('unprocessable', 422, { result: 'invalid' }));
    renderPage();
    fireEvent.change(screen.getByLabelText('Código del voucher'), { target: { value: 'K7MQ4XPZ2R' } });
    fireEvent.submit(screen.getByLabelText('Código del voucher').closest('form') as HTMLFormElement);
    expect(await screen.findByText('Ya se usó')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Código del voucher'), { target: { value: 'ZZZZZZZZZZ' } });
    fireEvent.submit(screen.getByLabelText('Código del voucher').closest('form') as HTMLFormElement);
    expect(await screen.findByText('Código no válido')).toBeTruthy();
  });
});
