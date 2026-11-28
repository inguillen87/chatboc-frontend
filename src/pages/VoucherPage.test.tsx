import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const apiFetch = vi.fn();
vi.mock('@/utils/api', async () => {
  const actual = await vi.importActual<typeof import('@/utils/api')>('@/utils/api');
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ code: 'K7MQ4XPZ2R' }) };
});

import { ApiError } from '@/utils/api';
import VoucherPage from './VoucherPage';

const base = { code: 'K7MQ-4XPZ-2R', name: 'Kit escolar completo', quantity: 1, kind: 'canje', points: 1500,
  issued_at: null, store: { name: 'Ciudad Demo', slug: 'ciudad-demo' } };

beforeEach(() => apiFetch.mockReset());

describe('VoucherPage', () => {
  it('shows the code, its QR and that it is valid', async () => {
    apiFetch.mockResolvedValueOnce({ ...base, status: 'valid', used_at: null });
    render(<VoucherPage />);
    expect(await screen.findByText('K7MQ-4XPZ-2R')).toBeTruthy();
    expect(screen.getByText(/Válido/)).toBeTruthy();
    expect((screen.getByRole('img') as HTMLImageElement).getAttribute('src')).toBe('/api/public/vouchers/K7MQ4XPZ2R/qr.svg');
  });

  it('says when it was already used, and when the code does not exist', async () => {
    apiFetch.mockResolvedValueOnce({ ...base, status: 'used', used_at: '2026-11-28T12:00:00Z' });
    const { unmount } = render(<VoucherPage />);
    expect(await screen.findByText(/Ya usado/)).toBeTruthy();
    unmount();
    apiFetch.mockRejectedValueOnce(new ApiError('not found', 404));
    render(<VoucherPage />);
    expect(await screen.findByText('No encontramos este código')).toBeTruthy();
  });
});
